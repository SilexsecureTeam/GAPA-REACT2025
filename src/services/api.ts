import { apiRequest } from './apiClient'

// Types based on provided login response
export type LoginResponse = {
  message: string
  user: {
    id: number
    name: string
    email: string
    address: string | null
    phone: string | null
    bal: number
    created_at: string
    updated_at: string
    city: string | null
    region: string | null
    country: string | null
    postbox: string | null
    shipping_address: string | null
    shipping_city: string | null
    shipping_region: string | null
    shipping_country: string | null
    shipping_postbox: string | null
    image: string | null
    group_id: number | null
    type: string | null
    token: string | null
    verified_at: string | null
    referal_code: string | null
    status: string | null
    email_verified_at: string | null
    deleted_at: string | null
  }
  barear_token: string
}

export type RegisterPayload = {
  name: string
  email: string
  phone: string
  role?: string
  address?: string
  password: string
  password_confirmation: string
}

export type Profile = LoginResponse['user']

export async function login(payload: { email?: string; phone?: string; password: string }) {
  // Postman expects field "email_phone" and "password"
  const email_phone = (payload.email || payload.phone || '').trim()
  return apiRequest<LoginResponse>('/login', {
    method: 'POST',
    body: { email_phone, password: payload.password },
  })
}

export async function register(payload: RegisterPayload) {
  // Postman uses x-www-form-urlencoded and expects 'comfirm_password'
  const form = new URLSearchParams()
  form.set('name', payload.name)
  form.set('email', payload.email)
  form.set('phone', payload.phone)
  if (payload.address) form.set('address', payload.address)
  form.set('password', payload.password)
  form.set('comfirm_password', payload.password_confirmation)
  // role is not part of API spec; we keep it client-side only
  return apiRequest<LoginResponse>('/register', {
    method: 'POST',
    body: form,
  })
}

export async function getProfile() {
  return apiRequest<Profile>('/user', { auth: true })
}

export async function logout() {
  // If an endpoint exists, call it; otherwise client-only clear
  try {
    await apiRequest('/logout', { method: 'POST', auth: true })
  } catch (_) { /* ignore */ }
}

// ----- Extra Auth Flows (aligned with Postman collection) -----
export async function forgotPassword(payload: { email: string }) {
  // POST /password/forget with form-data { email }
  const form = new FormData()
  form.set('email', payload.email)
  return apiRequest<{ message: string }>('/password/forget', {
    method: 'POST',
    body: form,
  })
}

export async function resetPassword(payload: { email: string; otp: string; password: string }) {
  // POST /password/reset with form-data { email, otp, password }
  const form = new FormData()
  form.set('email', payload.email)
  form.set('otp', payload.otp)
  form.set('password', payload.password)
  return apiRequest<{ message: string }>('/password/reset', {
    method: 'POST',
    body: form,
  })
}

export async function requestOtp(payload: { email: string }) {
  // No dedicated request endpoint in Postman; use resend endpoint to trigger sending
  const email = payload.email.trim()
  return apiRequest<{ message: string }>(`/resendotp?email=${encodeURIComponent(email)}`, {
    method: 'POST',
  })
}

export async function resendOtp(payload: { email: string }) {
  const email = payload.email.trim()
  return apiRequest<{ message: string }>(`/resendotp?email=${encodeURIComponent(email)}`, {
    method: 'POST',
  })
}

export async function changePassword(payload: { old_password: string; new_password: string; id: number | string }) {
  // POST /changePassword with JSON { old_password, new_password, id }
  const body = {
    old_password: payload.old_password,
    new_password: payload.new_password,
    id: payload.id,
  }
  return apiRequest<{ message: string }>('/changePassword', {
    method: 'POST',
    auth: true,
    body,
  })
}

// ----- Catalog APIs (from Postman collection) -----
export type ApiProduct = Record<string, any>
export type ApiBrand = { id?: string | number; name?: string; title?: string; logo?: string; image?: string } & Record<string, any>
export type ApiCategory = { id?: string | number; name?: string; title?: string; image?: string; icon?: string } & Record<string, any>
export type ApiManufacturer = { id?: string | number; name?: string; title?: string; logo?: string; image?: string } & Record<string, any>
export type ApiPartner = { id?: string | number; name?: string; title?: string; logo?: string; image?: string; url?: string } & Record<string, any>
export type ApiCar = { id?: string; name?: string; vin?: string | null; img_url?: string | null; brand_id?: string; suitability?: number; status?: string } & Record<string, any>

// Raw endpoints for documentation/reference
export const ENDPOINTS = {
  featuredProducts: '/product/featured-products',
  topProducts: '/product/top-products',
  allProducts: '/product/all-products',
  allBrands: '/brand/all-brand',
  allCategories: '/category/all-category',
  manufacturers: '/manufacturers',
  partners: '/getPartners',
  liveSearch: '/SearchProduct',
  cars: '/car/all-car',
  // details
  productById: (id: string) => `/product/product/${id}`,
  productOEM: (id: string) => `/product/getProductOEM/${id}`,
  relatedProducts: (id: string) => `/product/getRelatedProduct/${id}`,
  // vehicle drill-down
  modelsByBrandId: (brandId: string) => `/getModelByBrandId?brand_id=${encodeURIComponent(brandId)}`,
  subModelsByModelId: (modelId: string) => `/getSubModelByModelId?model_id=${encodeURIComponent(modelId)}`,
} as const

// Generic unwrap for variable API array envelopes
export function unwrapArray<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res?.data && typeof res.data === 'object') {
    for (const k of Object.keys(res.data)) {
      const v = (res.data as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}

export async function getFeaturedProducts() {
  const res = await apiRequest<any>(ENDPOINTS.featuredProducts)
  // handle shapes: { data: [...] } or { 'top-products': [...] } or [...]
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v
    }
  }
  return []
}
export async function getTopProducts() {
  const res = await apiRequest<any>(ENDPOINTS.topProducts)
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}
export async function getAllBrands() {
  const res = await apiRequest<any>(ENDPOINTS.allBrands)
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}
export async function getAllCategories() {
  const res = await apiRequest<any>(ENDPOINTS.allCategories)
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}
export async function getManufacturers() {
  const res = await apiRequest<any>(ENDPOINTS.manufacturers)
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}
export async function getPartners() {
  const res = await apiRequest<any>(ENDPOINTS.partners)
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}
export async function getAllCars() {
  const res = await apiRequest<any>(ENDPOINTS.cars)
  if (Array.isArray(res)) return res
  if (res?.cars && Array.isArray(res.cars)) return res.cars
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}

export async function liveSearch(term: string) {
  const form = new FormData()
  form.set('search', term)
  const res = await apiRequest<any>(ENDPOINTS.liveSearch, { method: 'POST', body: form })
  if (Array.isArray(res)) return res
  if (res?.data && Array.isArray(res.data)) return res.data
  if (res && typeof res === 'object') { for (const k of Object.keys(res)) { const v = (res as any)[k]; if (Array.isArray(v)) return v } }
  return []
}

// New: full product catalog and details
export async function getAllProducts() {
  const res = await apiRequest<any>(ENDPOINTS.allProducts)
  return unwrapArray<ApiProduct>(res)
}

export async function getProductById(id: string) {
  return apiRequest<ApiProduct>(ENDPOINTS.productById(id), { auth: true })
}

export async function getProductOEM(id: string) {
  const res = await apiRequest<any>(ENDPOINTS.productOEM(id), { auth: true })
  return unwrapArray<any>(res)
}

export async function getRelatedProducts(id: string) {
  const res = await apiRequest<any>(ENDPOINTS.relatedProducts(id), { auth: true })
  return unwrapArray<ApiProduct>(res)
}

// Vehicle drill-down helpers
export async function getModelsByBrandId(brandId: string) {
  const res = await apiRequest<any>(ENDPOINTS.modelsByBrandId(brandId))
  return unwrapArray<any>(res)
}

export async function getSubModelsByModelId(modelId: string) {
  const res = await apiRequest<any>(ENDPOINTS.subModelsByModelId(modelId))
  return unwrapArray<any>(res)
}
