/** Resolve a deployment's public URL without assuming a third-party domain. */
export function resolveSeoSiteUrl(configured: string | null | undefined): string {
  const candidates = [configured, process.env.SITE_URL, process.env.FRONTEND_URL?.split(',')[0]]
  for (const candidate of candidates) {
    if (!candidate?.trim()) continue
    try {
      const url = new URL(candidate.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
      url.hash = ''
      url.search = ''
      return url.toString().replace(/\/+$/, '')
    } catch {
      // An invalid saved value must not hide a valid deployment URL.
    }
  }
  return ''
}
