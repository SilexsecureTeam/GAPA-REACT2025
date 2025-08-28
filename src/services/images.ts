import { BASE_URL } from './apiClient'

// Normalizes image URLs returned by the API to ensure they load from the correct host.
// - Rewrites localhost/127.0.0.1 origins to production API host
// - Prefixes relative `/storage/...` paths with `${BASE_URL}` (which includes `/api`)
// - Accepts already-correct absolute URLs
export function normalizeApiImage(input?: string | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined
  let s = input.trim()
  if (!s) return undefined
  if (s.startsWith('data:') || s.startsWith('blob:')) return s

  const API = BASE_URL.replace(/\/?$/, '') // .../api
  const ORIGIN = API.replace(/\/api$/, '') // ...

  // Common relative forms
  if (s.startsWith('/api/storage/')) return `${ORIGIN}${s}`
  if (s.startsWith('/storage/')) return `${API}${s}`
  if (s.startsWith('storage/')) return `${API}/${s}`

  // Try absolute URL handling
  try {
    const u = new URL(s)
    const path = u.pathname + u.search + u.hash

    // If already on the production origin
    if (u.origin === ORIGIN) {
      // Ensure storage paths include /api prefix
      if (path.startsWith('/api/')) return `${ORIGIN}${path}`
      if (path.startsWith('/storage/')) return `${API}${path}`
      return s
    }

    // Rewrite localhost-like hosts to production
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const idxApiStorage = path.indexOf('/api/storage/')
      if (idxApiStorage >= 0) {
        return `${ORIGIN}${path.slice(idxApiStorage)}`
      }
      const idxStorage = path.indexOf('/storage/')
      if (idxStorage >= 0) {
        return `${API}${path.slice(idxStorage)}`
      }
      // Fallback: attach /api prefix to path on production origin
      const fixed = path.startsWith('/api/') ? path : `/api${path}`
      return `${ORIGIN}${fixed}`
    }

    // Any other fully-qualified URL: trust it
    return s
  } catch {
    // Non-URL strings like 'uploads/foo.jpg'
    if (s.startsWith('uploads/') || s.startsWith('images/')) return `${API}/${s}`
    return s
  }
}

// Attempts to extract an image-like field from an arbitrary API object and normalize it
export function pickImage(obj: any): string | undefined {
  const candidate = obj?.image || obj?.img_url || obj?.logo || obj?.thumbnail || obj?.icon || obj?.img
  return normalizeApiImage(candidate)
}
