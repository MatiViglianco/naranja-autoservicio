export function ensureHttps(url) {
  if (!url || typeof url !== 'string') return url
  if (url.startsWith('http://')) return `https://${url.slice('http://'.length)}`
  return url
}
