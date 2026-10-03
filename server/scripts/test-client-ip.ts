import assert from 'node:assert/strict'
import Fastify from 'fastify'
import proxyAddr from '@fastify/proxy-addr'

const previousCidrs = process.env.INCUDAL_TRUSTED_PROXY_CIDRS
process.env.INCUDAL_TRUSTED_PROXY_CIDRS = '172.31.0.1/32'
const { applyVerifiedClientIp, resolveTrustedProxyRanges, trustedProxyRanges } = await import('../src/lib/client-ip.js')
if (previousCidrs === undefined) delete process.env.INCUDAL_TRUSTED_PROXY_CIDRS
else process.env.INCUDAL_TRUSTED_PROXY_CIDRS = previousCidrs

const trustDefaults = proxyAddr.compile(resolveTrustedProxyRanges())
assert.equal(trustDefaults('172.31.0.1', 0), false)
assert.equal(trustDefaults('127.0.0.1', 0), true)
assert.equal(trustDefaults('104.16.0.1', 0), true)
assert.equal(trustDefaults('2606:4700::1', 0), true)
assert.deepEqual(resolveTrustedProxyRanges(' 172.31.0.1/32,172.31.0.1/32, '), trustedProxyRanges)
for (const invalid of ['0.0.0.0/0', '::/0', '172.31.0.1/33', '::1/129', 'loopback', 'invalid', '172.31.0.1/32/1']) {
  assert.throws(() => resolveTrustedProxyRanges(invalid), /Invalid INCUDAL_TRUSTED_PROXY_CIDRS/)
}
assert.equal(proxyAddr.compile(resolveTrustedProxyRanges('fd42:dead:beef:10::1/128'))('fd42:dead:beef:10::1', 0), true)

const app = Fastify({ trustProxy: trustedProxyRanges })
app.addHook('onRequest', async request => applyVerifiedClientIp(request))
app.get('/ip', async request => ({ ip: request.ip }))
try {
  const cases = [
    { peer: '172.31.0.1', headers: { 'cf-connecting-ip': '198.51.100.20' }, expected: '198.51.100.20' },
    { peer: '::ffff:172.31.0.1', headers: { 'cf-connecting-ip': '::ffff:198.51.100.20' }, expected: '198.51.100.20' },
    { peer: '172.31.0.1', headers: { 'cf-connecting-ip': '[2001:db8::20]' }, expected: '2001:db8::20' },
    { peer: '172.31.0.1', headers: { 'cf-connecting-ip': 'invalid' }, expected: '172.31.0.1' },
    { peer: '172.31.0.1', headers: { 'x-forwarded-for': '198.51.100.20' }, expected: '198.51.100.20' },
    { peer: '172.31.0.2', headers: { 'cf-connecting-ip': '198.51.100.20', 'x-forwarded-for': '198.51.100.20' }, expected: '172.31.0.2' },
    { peer: '203.0.113.5', headers: { 'cf-connecting-ip': '198.51.100.20', 'x-forwarded-for': '198.51.100.20' }, expected: '203.0.113.5' }
  ]
  for (const { peer, headers, expected } of cases) {
    const response = await app.inject({ method: 'GET', url: '/ip', remoteAddress: peer, headers })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().ip, expected, `peer ${peer}`)
  }
} finally {
  await app.close()
}
console.log('trusted proxy and client IP security: ok')
