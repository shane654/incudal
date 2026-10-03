import assert from 'node:assert/strict'
import { resolveSeoSiteUrl } from '../src/lib/seo-site-url.js'

const saved = { SITE_URL: process.env.SITE_URL, FRONTEND_URL: process.env.FRONTEND_URL }
try {
  delete process.env.SITE_URL
  delete process.env.FRONTEND_URL
  assert.equal(resolveSeoSiteUrl(null), '')
  assert.equal(resolveSeoSiteUrl('javascript:alert(1)'), '')
  assert.equal(resolveSeoSiteUrl('https://user:password@example.test'), '')
  assert.equal(resolveSeoSiteUrl('https://panel.example.test/?utm=test#anchor'), 'https://panel.example.test')
  process.env.FRONTEND_URL = 'https://frontend.example.test,https://other.example.test'
  assert.equal(resolveSeoSiteUrl(null), 'https://frontend.example.test')
  process.env.SITE_URL = 'https://site.example.test/'
  assert.equal(resolveSeoSiteUrl(null), 'https://site.example.test')
  assert.equal(resolveSeoSiteUrl('invalid'), 'https://site.example.test')
  assert.equal(resolveSeoSiteUrl('https://custom.example.test/'), 'https://custom.example.test')
  console.log('SEO site URL: ok')
} finally {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
