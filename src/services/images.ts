import { BASE_URL } from './apiClient'

// Normalizes image URLs returned by the API to ensure they load from the correct host.
// - Rewrites localhost/127.0.0.1 origins to production API host
// - Prefixes relative `/storage/...` paths with `${BASE_URL}` (which includes `/api`)
// - Ensures https scheme for production host and adds missing /api for storage paths
// - Accepts already-correct absolute URLs
export function normalizeApiImage(input?: string | null): string | undefined {
  if (!input || typeof input !== 'string') return undefined
  let s = input.trim()
  if (!s) return undefined
  if (s.startsWith('data:') || s.startsWith('blob:')) return s

  const API = BASE_URL.replace(/\/?$/, '') // .../api
  const ORIGIN = API.replace(/\/api$/, '') // ...

  // Precompute origin URL parts
  let ORIGIN_URL: URL | null = null
  try { ORIGIN_URL = new URL(ORIGIN) } catch { ORIGIN_URL = null }

  // Common relative forms
  if (s.startsWith('/api/storage/')) return `${ORIGIN}${s}`
  if (s.startsWith('/storage/')) return `${API}${s}`
  if (s.startsWith('storage/')) return `${API}/${s}`

  // Try absolute URL handling
  try {
    const u = new URL(s)
    const path = u.pathname + u.search + u.hash

    const sameHost = ORIGIN_URL ? u.hostname === ORIGIN_URL.hostname : false

    // If URL already points to the production host (any protocol)
    if (sameHost) {
      // Force https and correct base
      const base = ORIGIN // already correct https origin
      // Ensure storage paths include /api prefix
      if (path.startsWith('/api/')) return `${base}${path}`
      if (path.startsWith('/storage/')) return `${API}${path}`
      return `${base}${path.startsWith('/') ? '' : '/'}${path}`
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
  const candidate = obj?.image
    || obj?.img_url
    || obj?.logo
    || obj?.brand_logo
    || obj?.thumbnail
    || obj?.icon
    || obj?.photo
    || obj?.picture
    || obj?.img
  return normalizeApiImage(candidate)
}

// Explicit image URL builders per API spec
const CDN_BASE = 'https://stockmgt.gapaautoparts.com'

function absoluteOr(basePath: string, val?: string | null): string | undefined {
  if (!val) return undefined
  const s = String(val).trim()
  if (!s) return undefined
  // Already absolute
  if (/^https?:\/\//i.test(s)) return s
  // Remove any leading slashes in value
  const clean = s.replace(/^\/+/, '')
  return `${CDN_BASE}${basePath}/${clean}`
}

function firstOf(obj: any, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return undefined
}

export function productImageFrom(obj: any): string | undefined {
  const v = firstOf(obj, ['image', 'img_url', 'thumbnail', 'photo', 'picture', 'img'])
  return absoluteOr('/uploads/product', v)
}

export function carImageFrom(obj: any): string | undefined {
  const v = firstOf(obj, ['image', 'img_url', 'thumbnail', 'photo', 'picture', 'img'])
  return absoluteOr('/uploads/cars', v)
}

export function categoryImageFrom(obj: any): string | undefined {
  // Support common keys and fall back to generic picker
  const v = firstOf(obj, ['image', 'icon', 'thumbnail', 'img_url', 'img', 'category_image'])
  return absoluteOr('/uploads/category', v) || normalizeApiImage(pickImage(obj))
}

export function modelImageFrom(obj: any): string | undefined {
  const v = firstOf(obj, ['image', 'img_url', 'thumbnail', 'photo', 'picture', 'img'])
  return absoluteOr('/uploads/models', v)
}

// New: brand and partner explicit builders per CDN paths
export function brandImageFrom(obj: any): string | undefined {
  const v = firstOf(obj, ['logo', 'image', 'img_url', 'thumbnail', 'img'])
  return absoluteOr('/uploads/brands', v)
}

export function partnerImageFrom(obj: any): string | undefined {
  const v = firstOf(obj, ['logo', 'image', 'img_url', 'thumbnail', 'img'])
  // Note: API path is 'patners' as provided in spec
  return absoluteOr('/uploads/makers_', v)
}
