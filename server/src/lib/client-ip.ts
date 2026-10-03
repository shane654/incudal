import { isIP } from 'node:net'
import proxyAddr from '@fastify/proxy-addr'
import type { FastifyRequest } from 'fastify'

// Published by Cloudflare: https://www.cloudflare.com/ips/
const defaultTrustedProxyRanges = [
  'loopback',
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32'
] as const

export function resolveTrustedProxyRanges(additionalCidrs = ''): string[] {
  const extraRanges = additionalCidrs.split(',').map(value => value.trim()).filter(Boolean)
  for (const range of extraRanges) {
    const [address, prefix, ...extraParts] = range.split('/')
    const family = isIP(address)
    const maxPrefix = family === 4 ? 32 : 128
    if (!family || extraParts.length > 0 || (prefix !== undefined && (
      !/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > maxPrefix
    ))) {
      throw new Error(`Invalid INCUDAL_TRUSTED_PROXY_CIDRS entry: ${range}`)
    }
  }
  return [...new Set([...defaultTrustedProxyRanges, ...extraRanges])]
}

// Docker-published loopback ports reach the container through its bridge gateway.
// Trust that specific proxy only when the operator explicitly configures it.
export const trustedProxyRanges = resolveTrustedProxyRanges(process.env.INCUDAL_TRUSTED_PROXY_CIDRS)

const isTrustedProxy = proxyAddr.compile([...trustedProxyRanges])

function normalizeIp(value: string | string[] | undefined): string | null {
  const first = Array.isArray(value) ? value[0] : value
  if (!first) return null
  let candidate = first.split(',')[0].trim()
  if (candidate.startsWith('[') && candidate.includes(']')) {
    candidate = candidate.slice(1, candidate.indexOf(']'))
  }
  if (candidate.toLowerCase().startsWith('::ffff:') && isIP(candidate.slice(7)) === 4) {
    candidate = candidate.slice(7)
  }
  return isIP(candidate) ? candidate : null
}

export function applyVerifiedClientIp(request: FastifyRequest): void {
  const peerIp = normalizeIp(request.raw.socket.remoteAddress)
  if (!peerIp || !isTrustedProxy(peerIp, 0)) return

  const cloudflareIp = normalizeIp(request.headers['cf-connecting-ip'])
  if (!cloudflareIp) return

  // Fastify's ip is a prototype getter. Shadow it for all downstream consumers.
  Object.defineProperty(request, 'ip', {
    configurable: false,
    enumerable: true,
    value: cloudflareIp
  })
}
