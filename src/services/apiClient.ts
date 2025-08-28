// Simple API client using Fetch with JSON helpers and auth token support
export const BASE_URL = 'https://stockmgt.gapaautoparts.com/api'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface RequestOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: any
  auth?: boolean // include Bearer token from localStorage
  signal?: AbortSignal
}

export interface ApiError extends Error {
  status?: number
  data?: unknown
}

function isPlainObject(val: any) {
  return val && typeof val === 'object' && !(
    val instanceof FormData || val instanceof URLSearchParams || val instanceof Blob
  )
}

export async function apiRequest<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(isPlainObject(options.body) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  }

  if (options.auth) {
    const token = localStorage.getItem('authToken')
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const body = isPlainObject(options.body)
    ? JSON.stringify(options.body)
    : options.body

  const resp = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body,
    signal: options.signal,
  })

  const contentType = resp.headers.get('content-type') || ''
  let data: any
  if (contentType.includes('application/json')) {
    data = await resp.json()
  } else {
    const text = await resp.text()
    // Attempt to parse JSON from text if it looks like JSON
    const trimmed = text.trim()
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try { data = JSON.parse(trimmed) } catch { data = text }
    } else {
      data = text
    }
  }

  if (!resp.ok) {
    const err: ApiError = Object.assign(new Error('API request failed'), {
      status: resp.status,
      data,
    })
    throw err
  }

  return data as T
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem('authToken', token)
  else localStorage.removeItem('authToken')
}

export function getAuthToken() {
  return localStorage.getItem('authToken')
}
