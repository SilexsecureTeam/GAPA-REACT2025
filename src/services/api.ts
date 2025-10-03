import { apiRequest } from './apiClient'
// Optional secrets fallback (development only) for GIG base URL only (static token flow in use)
import { GIG_BASE_URL as SECRET_GIG_BASE } from '../secrets'

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

// Profile update helpers (from Postman)
export async function updateUserProfile(payload: { user_id: string | number; name?: string; address?: string; phone?: string }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  if (payload.name !== undefined) form.set('name', payload.name)
  if (payload.address !== undefined) form.set('address', payload.address)
  if (payload.phone !== undefined) form.set('phone', payload.phone)
  return apiRequest<{ message?: string; user?: Profile }>('/updateUserProfile', { method: 'POST', body: form, auth: true })
}

export async function updateProfilePhoto(payload: { user_id: string | number; file: File | Blob }) {
  const form = new FormData()
  form.set('user_id', String(payload.user_id))
  form.set('img_url', payload.file)
  return apiRequest<{ message?: string; user?: Profile }>('/updateProfileProfile', { method: 'POST', body: form, auth: true })
}

export async function getUserProfileById(userId: string | number) {
  const res = await apiRequest<any>(`/getUserProfile/${encodeURIComponent(String(userId))}`, { method: 'GET', auth: true })
  let u = res?.result || res?.user || res?.data?.user || res
  if (u && typeof u === 'object' && u.image && typeof u.image === 'string' && !/^https?:/i.test(u.image)) {
    u = { ...u, image: `https://stockmgt.gapaautoparts.com/uploads/user/${u.image}` }
  }
  return u
}

export async function updateUserProfileExplicit(payload: { user_id: string | number; name?: string; address?: string; phone?: string }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  if (payload.name != null) form.set('name', payload.name)
  if (payload.address != null) form.set('address', payload.address)
  if (payload.phone != null) form.set('phone', payload.phone)
  return apiRequest<any>('/updateUserProfile', { method: 'POST', body: form, auth: true })
}

export async function uploadProfileImageExplicit(payload: { user_id: string | number; file: File | Blob }) {
  const form = new FormData()
  form.set('user_id', String(payload.user_id))
  form.set('img_url', payload.file)
  return apiRequest<any>('/updateProfileProfile', { method: 'POST', body: form, auth: true })
}

export async function deleteUserAccount(userId: string | number) {
  return apiRequest<any>(`/delete-user/${encodeURIComponent(String(userId))}`, { method: 'DELETE', auth: true })
}

// ----- Catalog APIs (from Postman collection) -----
export type ApiProduct = Record<string, any>
export type ApiBrand = { id?: string | number; brand_id?: string | number; name?: string; title?: string; logo?: string; image?: string } & Record<string, any>
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
  // category drill-down
  subCategoriesByCategoryId: (catId: string | number) => `/getSubCategory?cat_id=${encodeURIComponent(String(catId))}`,
  subSubCategoriesBySubCatId: (subCatId: string | number) => `/getSubSubCategory?sub_cat_id=${encodeURIComponent(String(subCatId))}`,
  subSubCategoryProducts: (subSubCatId: string | number) => `/getSubSubCategoryProduct?subsubcatID=${encodeURIComponent(String(subSubCatId))}`,
} as const

export const CART_ENDPOINTS = {
  addToCart: '/product/add-to-cart',
  increase: '/product/increase_cart',
  updateQty: '/product/update_cart_quantity',
  getAllForUser: (userId: string | number) => `/product/getAllcart/${userId}`,
  removeByQuery: (userId: string | number, productId: string) => `/product/removeProductFromCart?product_id=${encodeURIComponent(productId)}&user_id=${encodeURIComponent(String(userId))}`,
  deleteById: '/product/delete_product_cart',
  total: '/product/get_total_cart',
} as const

// Address/Location endpoints from Postman
export const ADDRESS_ENDPOINTS = {
  updateAddress: '/updateAddress', // POST urlencoded: address, user_id
  getAllStates: '/getAllStates',
  getStatesByLocation: (location: string) => `/get-states?location=${encodeURIComponent(location)}`,
  // new delivery-related
  deliveryRate: '/delivery-rate',
  paymentsuccess: '/product/paymentsuccessfull',
} as const

// Orders endpoints
export const ORDER_ENDPOINTS = {
  getUserOrders: (userId: string | number) => `/product/getUserOrders/${encodeURIComponent(String(userId))}`,
  getUserOrderItems: (orderId: string | number) => `/product/getUserOrdersIteams/${encodeURIComponent(String(orderId))}`,
} as const

// Review endpoints
export const REVIEW_ENDPOINTS = {
  submitReview: '/submit_review',
  getProductReviews: (productId: string) => `/product/getAllProductReview/${encodeURIComponent(productId)}`,
} as const

// Optional alternate base for some legacy endpoints (e.g., get-price)
const GAPA_LIVE_BASE = (import.meta as any)?.env?.VITE_GAPA_LIVE_BASE as string | undefined
function absUrl(path: string) {
  if (!path) return path
  return path.startsWith('http') ? path : `${path.startsWith('/') ? '' : '/'}${path}`
}

// Generic unwrap for variable API array envelopes
export function unwrapArray<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res
  // common top-level keys
  if (res?.result && Array.isArray(res.result)) return res.result
  if (res?.data && Array.isArray(res.data)) return res.data
  // nested under data
  if (res?.data && typeof res.data === 'object') {
    const d = res.data as any
    if (Array.isArray(d.result)) return d.result as T[]
    for (const k of Object.keys(d)) {
      const v = d[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  // any array under any key
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
  if (res?.result && Array.isArray(res.result)) return res.result
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

// Category drill-down helpers
export async function getSubCategories(catId: string | number) {
  const res = await apiRequest<any>(ENDPOINTS.subCategoriesByCategoryId(catId))
  return unwrapArray<any>(res)
}

export async function getSubSubCategories(subCatId: string | number) {
  const res = await apiRequest<any>(ENDPOINTS.subSubCategoriesBySubCatId(subCatId))
  return unwrapArray<any>(res)
}

export async function getProductsBySubSubCategory(subSubCatId: string | number) {
  const res = await apiRequest<any>(ENDPOINTS.subSubCategoryProducts(subSubCatId))
  return unwrapArray<ApiProduct>(res)
}

export async function addToCartApi(payload: { user_id: number | string; product_id: string; quantity: number }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  form.set('product_id', payload.product_id)
  form.set('quantity', String(payload.quantity))
  return apiRequest<any>(CART_ENDPOINTS.addToCart, { method: 'POST', body: form, auth: true })
}

export async function getUserCartTotal() {
  try {
    const res = await apiRequest<any>(CART_ENDPOINTS.total, { method: 'GET', auth: true })
    return res
  } catch (e) {
    return null
  }
}

// New: cart items retrieval
export async function getCartForUser(userId: string | number) {
  const res = await apiRequest<any>(CART_ENDPOINTS.getAllForUser(userId), { method: 'GET', auth: true })
  // Attempt to unwrap arrays in various envelopes
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

export async function removeCartItem(userId: string | number, productId: string) {
  return apiRequest<any>(CART_ENDPOINTS.removeByQuery(userId, productId), { method: 'GET', auth: true })
}

export async function updateCartQuantity(payload: { user_id: string | number; product_id: string; quantity: number }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  form.set('product_id', payload.product_id)
  form.set('quantity', String(payload.quantity))
  return apiRequest<any>(CART_ENDPOINTS.updateQty, { method: 'POST', body: form, auth: true })
}

export async function increaseCartItem(payload: { user_id: string | number; product_id: string }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  form.set('product_id', payload.product_id)
  return apiRequest<any>(CART_ENDPOINTS.increase, { method: 'POST', body: form, auth: true })
}

// ----- Address helpers -----
export type ApiState = { id?: string | number; name?: string; state?: string; title?: string } & Record<string, any>

export async function getAllStatesApi() {
  const res = await apiRequest<any>(ADDRESS_ENDPOINTS.getAllStates)
  return unwrapArray<ApiState>(res)
}

export async function getStatesByLocation(location: string = 'gapa') {
  const res = await apiRequest<any>(ADDRESS_ENDPOINTS.getStatesByLocation(location))
  return unwrapArray<ApiState>(res)
}

export async function getDeliveryRate() {
  const res = await apiRequest<any>(ADDRESS_ENDPOINTS.deliveryRate)
  const rateStr = (res && (res.results?.rate ?? res.rate ?? res.price ?? res.amount)) ?? 0
  const num = Number(rateStr)
  return isNaN(num) ? 0 : num
}

export async function getPriceByState(stateId: string | number) {
  // Prefer env-provided base for this endpoint
  const base = (GAPA_LIVE_BASE && GAPA_LIVE_BASE.trim()) ? GAPA_LIVE_BASE.trim().replace(/\/$/, '') : undefined
  const url = base ? `${base}/get-price/${encodeURIComponent(String(stateId))}` : `/get-price/${encodeURIComponent(String(stateId))}`
  return apiRequest<any>(absUrl(url))
}

export async function updateDeliveryAddress(payload: { user_id: string | number; address: string }) {
  const form = new URLSearchParams()
  form.set('user_id', String(payload.user_id))
  form.set('address', payload.address)
  return apiRequest<any>(ADDRESS_ENDPOINTS.updateAddress, { method: 'POST', body: form, auth: true })
}

// ----- Payment helpers -----
export async function paymentSuccessfull(payload: { shipping_cost: number; address: string; user_id?: string | number; userId?: string | number; txn_id: string; pickup_location_id?: string }) {
  const form = new FormData()
  form.set('shipping_cost', String(payload.shipping_cost ?? 0))
  form.set('pickup_location_id', payload.pickup_location_id || '')
  form.set('address', payload.address)
  // Prefer new user_id field; support legacy userId for backward compatibility
  const uid = payload.user_id ?? payload.userId ?? ''
  form.set('user_id', String(uid))
  form.set('txn_id', payload.txn_id)
  return apiRequest<any>(ADDRESS_ENDPOINTS.paymentsuccess, { method: 'POST', body: form, auth: true })
}

// ----- Orders helpers -----
export type ApiOrder = Record<string, any>
export type ApiOrderItem = Record<string, any>

export async function getUserOrders(userId: string | number) {
  const res = await apiRequest<any>(ORDER_ENDPOINTS.getUserOrders(userId), { method: 'GET', auth: true })
  return unwrapArray<ApiOrder>(res)
}

export async function getUserOrderItems(orderId: string | number) {
  const res = await apiRequest<any>(ORDER_ENDPOINTS.getUserOrderItems(orderId), { method: 'GET', auth: true })
  return unwrapArray<ApiOrderItem>(res)
}

// ----- Review helpers -----
export type ApiReview = {
  id?: string | number
  user_id?: string | number
  product_id?: string
  review?: string
  rating?: number
  user_name?: string
  user?: { name?: string; image?: string }
  created_at?: string
  updated_at?: string
} & Record<string, any>

export type SubmitReviewPayload = {
  user_id: string | number
  product_id: string
  review: string
  rating: number
}

export async function submitReview(payload: SubmitReviewPayload) {
  const form = new FormData()
  form.set('user_id', String(payload.user_id))
  form.set('product_id', payload.product_id)
  form.set('review', payload.review)
  form.set('rating', String(payload.rating))
  return apiRequest<{ message?: string; success?: boolean }>(REVIEW_ENDPOINTS.submitReview, {
    method: 'POST',
    body: form,
    auth: true,
  })
}

export async function getProductReviews(productId: string) {
  const res = await apiRequest<any>(REVIEW_ENDPOINTS.getProductReviews(productId), { method: 'GET' })
  return unwrapArray<ApiReview>(res)
}

// --- GIG Logistics Integration -------------------------------------------------
// Agility Systems Third Party API (GIG) per documentation in workspace.
// Env vars expected:
// - VITE_GIG_BASE_URL (e.g. https://dev-agilitythirdpartyapi.theagilitysystems.com/api/thirdparty)
// - VITE_GIG_USERNAME / VITE_GIG_PASSWORD
// Optional sender defaults:
// - VITE_GIG_SENDER_NAME, VITE_GIG_SENDER_PHONE, VITE_GIG_SENDER_ADDRESS, VITE_GIG_SENDER_LOCALITY, VITE_GIG_SENDER_STATION_ID
// - VITE_GIG_SENDER_LAT, VITE_GIG_SENDER_LNG
// - VITE_GIG_VEHICLE_TYPE (default 'BIKE')

// Window fallback (index.html injects these for now). NOTE: Shipping credentials in the browser is NOT secure for production.
const __win: any = (typeof window !== 'undefined') ? (window as any) : {}
const GIG_BASE = ((import.meta as any)?.env?.VITE_GIG_BASE_URL as string | undefined) || __win.VITE_GIG_BASE_URL || SECRET_GIG_BASE

// Removed legacy username/password & client credential constants (now using static token only)
// const GIG_USERNAME = ... (deprecated)
// const GIG_PASSWORD = ... (deprecated)
// const GIG_KEY = ... (deprecated)
// const GIG_SECRET = ... (deprecated)

// Optional static bearer token bypass (NOT for production credentials exposure)
const GIG_STATIC_TOKEN = (import.meta as any)?.env?.VITE_GIG_STATIC_TOKEN || __win.VITE_GIG_STATIC_TOKEN
// Provided customer code (fallback to ECO038586 if not supplied via env/window)
const GIG_CUSTOMER_CODE = (import.meta as any)?.env?.VITE_GIG_CUSTOMER_CODE || __win.VITE_GIG_CUSTOMER_CODE || 'ECO038586'

// NEW: Static token fetch endpoint (replaces username/password login flow)
// Endpoint: https://gapaautoparts.com/logistics/access-token (GET) => { token: string }
// We cache token until ~60s before exp (exp claim in JWT) or 25m default.
let gigTokenCache: { token: string; exp: number } | null = null
let gigTokenFetchInFlight: Promise<string> | null = null

function decodeJwtExp(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (payload && typeof payload.exp === 'number') return payload.exp * 1000
    return null
  } catch { return null }
}

async function fetchStaticGigToken(): Promise<string> {
  // De-dup parallel requests
  if (gigTokenFetchInFlight) return gigTokenFetchInFlight
  gigTokenFetchInFlight = (async () => {
    // const primaryUrl = 'https://gapaautoparts.com/logistics/access-token'
    const proxyUrl = '/api/gig-token' 
    const tryFetch = async (url: string) => {
      console.info('[GIG DEBUG] Fetching static token from', url)
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) {
        const txt = await res.text().catch(()=> '')
        throw new Error(`Static token fetch failed (${res.status}) ${txt.slice(0,120)}`)
      }
      const json: any = await res.json().catch(()=> ({}))
      const token = json?.token || json?.access_token || ''
      if (!token) throw new Error('Static token endpoint returned no token')
      return token
    }
    let token: string
    try {
      token = await tryFetch(proxyUrl)
    } catch (e: any) {
      // Likely CORS in browser – attempt proxy fallback (same-origin serverless function)
      console.warn('[GIG DEBUG] Primary token fetch failed, trying proxy fallback', e?.message)
      token = await tryFetch(proxyUrl)
    }
    const exp = decodeJwtExp(token) || (Date.now() + 25 * 60 * 1000) // fallback 25m
    // subtract 60s for refresh buffer
    gigTokenCache = { token, exp: exp - 60_000 }
    gigTokenFetchInFlight = null
    console.info('[GIG DEBUG] Static token acquired; exp at', new Date(gigTokenCache.exp).toISOString())
    return token
  })()
  try { return await gigTokenFetchInFlight } finally { /* keep promise until resolved */ }
}

async function getGigToken(): Promise<string> {
  const now = Date.now()
  if (gigTokenCache && gigTokenCache.exp > now + 5000) return gigTokenCache.token

  // Highest priority: explicit env/window static token
  if (GIG_STATIC_TOKEN) {
    const exp = decodeJwtExp(GIG_STATIC_TOKEN) || (Date.now() + 25 * 60 * 1000)
    gigTokenCache = { token: String(GIG_STATIC_TOKEN), exp: exp - 60_000 }
    console.info('[GIG DEBUG] Using provided static token (env/window)')
    return gigTokenCache.token
  }

  // Next: fetch from external access-token endpoint
  try {
    return await fetchStaticGigToken()
  } catch (e) {
    console.error('[GIG DEBUG] Failed to fetch static token', e)
    throw new Error("Can't ship to this location")
  }
}

export type GigQuoteParams = {
  destination_state: string
  destination_city?: string
  receiver_name?: string
  receiver_phone?: string
  receiver_address?: string
  weight_kg?: number
  items_count?: number
  // optional overrides
  origin_state?: string
  // raw cart items to build PreShipmentItems dynamically
  items?: Array<{ name?: string; description?: string; weight_in_kg?: number | string; quantity?: number; article_number?: string; code?: string; value?: number }>
  receiver_latitude?: number | string
  receiver_longitude?: number | string
  // NEW optional logistics enrichment
  receiver_station_id?: number
  destination_service_centre_id?: number
  declared_value?: number
  vehicle_type?: string
}

async function gigFetch(path: string, init: RequestInit & { auth?: boolean } = {}) {
  if (!GIG_BASE) throw new Error('GIG base URL not configured')
  const url = `${GIG_BASE.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
  const headers: Record<string,string> = { 'Accept': 'application/json' }
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (init.auth) {
    const token = await getGigToken()
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...init, headers })
  if (!res.ok) {
    const text = await res.text().catch(()=> 'error')
    throw new Error(`GIG request failed (${res.status}): ${text.slice(0,120)}`)
  }
  const txt = await res.text().catch(()=> '')
  if (!txt) return {}
  try { return JSON.parse(txt) } catch { return {} }
}

export async function getGigQuote(params: GigQuoteParams) {
  const rawEnv = (import.meta as any)?.env || {}
  if (!(window as any).__GIG_DEBUG_LOGGED__) {
    (window as any).__GIG_DEBUG_LOGGED__ = true
    try {
      console.info('[GIG DEBUG] env keys:', Object.keys(rawEnv).filter(k=>k.includes('GIG')))
      console.info('[GIG DEBUG] Resolved values', { GIG_BASE, hasStaticEnvToken: !!GIG_STATIC_TOKEN })
      console.info('[GIG DEBUG] Window fallbacks', { winBase: __win.VITE_GIG_BASE_URL, winStaticToken: !!__win.VITE_GIG_STATIC_TOKEN })
    } catch {}
  }

  if (!GIG_BASE || !String(GIG_BASE).trim()) {
    console.warn('[GIG DEBUG] Missing base URL VITE_GIG_BASE_URL')
    throw new Error("Can't ship to this location")
  }

  // Helpers ---------------------------------------------------------------
  const normalizeState = (s: string) => {
    if (!s) return s
    const up = s.toUpperCase().trim()
    if (up.includes('FEDERAL CAPITAL TERRITORY') || up === 'F C T' || up === 'ABUJA FCT') return 'FCT'
    if (up === 'ABUJA') return 'FCT'
    return up.replace(/\s+STATE$/,'').trim()
  }
  const stateCapitalMap: Record<string,string> = {
    LAGOS: 'Ikeja', FCT: 'Abuja', ABUJA: 'Abuja', OGUN: 'Abeokuta', OYO: 'Ibadan', RIVERS: 'Port Harcourt', KADUNA: 'Kaduna', KANO: 'Kano'
  }
  const sanitizeCity = (city: string, state: string) => {
    if (!city) return city
    let c = city.trim()
    // Remove trailing STATE if user selected state instead of city
    c = c.replace(/\bSTATE$/i,'').trim()
    if (c.toUpperCase() === state) return stateCapitalMap[state] || c
    // Avoid values like "OGUN STATE"
    if (c.toUpperCase() === state + ' STATE') return stateCapitalMap[state] || c.replace(/\s+STATE$/i,'')
    // If still all uppercase single token and equals state, map to capital
    if (c.toUpperCase() === state && stateCapitalMap[state]) return stateCapitalMap[state]
    return c
  }
  const pickCityForState = (state: string, providedCity?: string) => {
    const up = (providedCity||'').trim()
    if (up) return sanitizeCity(up, state)
    return stateCapitalMap[state] || state
  }
  const normalizePhone = (p?: string) => {
    if (!p) return ''
    const digits = p.replace(/\D+/g,'')
    if (digits.startsWith('234')) return '+'+digits
    if (digits.startsWith('0')) return '+234'+digits.slice(1)
    if (digits.startsWith('+234')) return digits.startsWith('+')?digits:'+'+digits
    return '+234'+digits
  }

  // Sender defaults -------------------------------------------------------
  const senderName = (import.meta as any)?.env?.VITE_GIG_SENDER_NAME || 'GAPA Auto Parts'
  const senderPhoneRaw = (import.meta as any)?.env?.VITE_GIG_SENDER_PHONE || '+2349074694221'
  const senderPhone = normalizePhone(senderPhoneRaw)
  const senderAddress = (import.meta as any)?.env?.VITE_GIG_SENDER_ADDRESS || 'No 5 OP, Fingesi Street, Utako Abuja'
  const senderLocality = (import.meta as any)?.env?.VITE_GIG_SENDER_LOCALITY || 'Utako'
  const senderStationId = Number((import.meta as any)?.env?.VITE_GIG_SENDER_STATION_ID || 1)
  const senderLat = String((import.meta as any)?.env?.VITE_GIG_SENDER_LAT || '9.0666') // Abuja fallback
  const senderLng = String((import.meta as any)?.env?.VITE_GIG_SENDER_LNG || '7.4583')
  const vehicleType = params.vehicle_type || (import.meta as any)?.env?.VITE_GIG_VEHICLE_TYPE || 'VAN'

  // Derive item weights/qty ----------------------------------------------
  const cartItems = Array.isArray(params.items) ? params.items.filter(Boolean) : []
  const derivedWeight = cartItems.length
    ? cartItems.reduce((sum, it) => sum + (Math.max(0, Number(it.weight_in_kg) || 1) * (Number(it.quantity) || 1)), 0)
    : Number(params.weight_kg || 1)
  const derivedQty = cartItems.length
    ? cartItems.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0)
    : Number(params.items_count || 1)
  const weight = Math.max(1, derivedWeight)
  const qty = Math.max(1, derivedQty)

  // Monetary values -------------------------------------------------------
  const itemsDeclaredValue = cartItems.reduce((sum, it) => sum + ((it.value || 0) * (Number(it.quantity)||1)), 0)
  const declaredValue = Math.max(1000, Number(params.declared_value || itemsDeclaredValue || 0)) // ensure non-zero floor

  // Destination normalization --------------------------------------------
  const destStateNormRaw = params.destination_state || ''
  const destStateNorm = normalizeState(destStateNormRaw)
  const finalCity = pickCityForState(destStateNorm, params.destination_city)

  // Auto-populate station IDs if not provided ----------------------------
  let receiverStationId = params.receiver_station_id != null ? Number(params.receiver_station_id) : 0
  let destinationServiceCentreId = params.destination_service_centre_id != null ? Number(params.destination_service_centre_id) : receiverStationId
  if (!receiverStationId) {
    try {
      const stations = await getGigStations(destStateNorm)
      if (stations && stations.length) {
        // Prefer a station whose city matches provided city if possible
        const matchCity = stations.find(s => String(s.city).toUpperCase() === String(finalCity).toUpperCase())
        const pick = matchCity || stations[0]
        receiverStationId = Number(pick.id)
        destinationServiceCentreId = destinationServiceCentreId || receiverStationId
      }
    } catch (e) { /* ignore station lookup errors */ }
  }

  // Pre-shipment items ----------------------------------------------------
  const preShipmentItems = (cartItems.length ? cartItems : [{ name: 'Car Parts', description: 'Auto parts', weight_in_kg: weight, quantity: qty, value: declaredValue }]).map((it, idx) => ({
    PreShipmentItemMobileId: 0,
    Description: it.description || it.name || 'Auto part',
    Weight: Number(it.weight_in_kg) || 1,
    Weight2: 0,
    ItemType: 'Normal',
    ShipmentType: 1,
    ItemName: it.name || 'Car Part',
    EstimatedPrice: 0,
    Value: String(Math.max(0, it.value || 0)),
    ImageUrl: '',
    Quantity: Number(it.quantity) || 1,
    SerialNumber: idx,
    IsVolumetric: false,
    Length: 0,
    Width: 0,
    Height: 0,
    PreShipmentMobileId: 0,
    CalculatedPrice: 0,
    SpecialPackageId: null,
    IsCancelled: false,
    PictureName: '',
    PictureDate: null,
    WeightRange: '0'
  }))

  const receiverPhone = normalizePhone(params.receiver_phone || '')

  // Root payload (extended) ----------------------------------------------
  // receiverStationId & destinationServiceCentreId already resolved above
  const payload: any = {
    CustomerCode: GIG_CUSTOMER_CODE,
    UserChannelCode: GIG_CUSTOMER_CODE,
    PreShipmentMobileId: 0,
    SenderName: senderName,
    SenderPhoneNumber: senderPhone,
    SenderStationId: senderStationId,
    InputtedSenderAddress: senderAddress,
    SenderLocality: senderLocality,
    SenderAddress: senderAddress,
    SenderCountry: 'Nigeria',
    ReceiverCountry: 'Nigeria',
    DestinationState: destStateNorm,
    DestinationCity: finalCity,
    ReceiverState: destStateNorm,
    ReceiverCity: finalCity,
    ReceiverStationId: receiverStationId,
    ReceiverName: params.receiver_name || 'Customer',
    ReceiverPhoneNumber: receiverPhone,
    ReceiverAddress: params.receiver_address || finalCity,
    InputtedReceiverAddress: params.receiver_address || finalCity,
    SenderLocation: { Latitude: senderLat, Longitude: senderLng, FormattedAddress: '', Name: senderLocality, LGA: '' },
    ReceiverLocation: { Latitude: params.receiver_latitude != null ? String(params.receiver_latitude) : '', Longitude: params.receiver_longitude != null ? String(params.receiver_longitude) : '', FormattedAddress: '', Name: finalCity, LGA: '' },
    PreShipmentItems: preShipmentItems,
    VehicleType: vehicleType,
    IsBatchPickUp: false,
    WaybillImage: '',
    WaybillImageFormat: '',
    DestinationServiceCentreId: destinationServiceCentreId,
    // keep legacy key for compatibility if backend expects either spelling
    DestinationServiceCenterId: destinationServiceCentreId,
    IsCashOnDelivery: false,
    CashOnDeliveryAmount: 0,
    TotalWeight: weight,
    ItemsCount: qty,
    TotalQuantity: qty,
    ApproximateItemsValue: declaredValue,
    DeclaredValue: declaredValue,
    ItemsValue: declaredValue,
    DeliveryType: 1,
    ShipmentType: 1,
    PaymentOnDelivery: false,
    IsInternational: false,
    ItemCategory: 'Auto Parts',
    ItemSenderType: 'Individual'
  }

  console.info('[GIG DEBUG] Using CustomerCode:', GIG_CUSTOMER_CODE)
  console.debug('[GIG DEBUG] Quote payload (sanitized):', {
    CustomerCode: payload.CustomerCode,
    DestinationState: payload.DestinationState,
    DestinationCity: payload.DestinationCity,
    ReceiverStationId: payload.ReceiverStationId,
    DestinationServiceCentreId: payload.DestinationServiceCentreId,
    ItemsCount: payload.ItemsCount,
    TotalWeight: payload.TotalWeight,
    DeclaredValue: payload.DeclaredValue,
    VehicleType: payload.VehicleType,
    PreShipmentItems: payload.PreShipmentItems.map((i:any)=>({ ItemName: i.ItemName, Weight: i.Weight, Qty: i.Quantity, Value: i.Value }))
  })

  try {
    const res: any = await gigFetch('/price', { method: 'POST', auth: true, body: JSON.stringify(payload) })
    
    // Primary candidates from the nested response structure
    const candidates: any[] = [
      res?.object?.grandTotal,
      res?.object?.deliveryPrice,
      res?.object?.mainCharge,
      res?.amount, 
      res?.price, 
      res?.total, 
      res?.data?.amount, 
      res?.data?.price, 
      res?.data?.total,
      res?.CalculatedPrice, 
      res?.Data?.Total, 
      res?.Data?.Amount, 
      res?.result?.price
    ]
    
    let amountNum = 0
    for (const c of candidates) {
      const n = Number(c)
      if (!isNaN(n) && n > 0) { amountNum = n; break }
    }
    
    // Fallback: search through object properties if still not found
    if (!amountNum && res && typeof res === 'object') {
      for (const k of Object.keys(res)) {
        const v: any = (res as any)[k]
        const n = Number(v)
        if (!isNaN(n) && n > 0) { amountNum = n; break }
      }
    }
    
    if (!amountNum) {
      console.error('[GIG] No valid price found in response:', res)
      throw new Error("Can't ship to this location")
    }
    
    console.info('[GIG] Successfully extracted price:', amountNum, 'from response')
    return { raw: res, amount: Math.max(0, Math.round(amountNum || 0)) }
  } catch (e: any) {
    console.warn('GIG quote failed', e)
    const msg = e?.message || ''
    if (msg && !/ship to this location/i.test(msg)) throw new Error(msg)
    throw new Error("Can't ship to this location")
  }
}

let __gigStationsCache: Record<string, any[]> = {}
export async function getGigStations(state: string) {
  const key = (state||'').toUpperCase().trim()
  if (key && __gigStationsCache[key]) return __gigStationsCache[key]
  const candidates = [
    '/stations', '/station', '/domestic/stations', '/domestic/station', '/country/stations'
  ]
  const found: any[] = []
  for (const path of candidates) {
    try {
      const res: any = await gigFetch(path, { auth: true })
      const arr = Array.isArray(res) ? res : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.result) ? res.result : []))
      if (!Array.isArray(arr) || !arr.length) continue
      for (const raw of arr) {
        if (!raw || typeof raw !== 'object') continue
        const st = String(raw.State || raw.state || raw.Region || raw.region || '').toUpperCase()
        if (key && st && st !== key) continue
        const id = raw.StationId ?? raw.stationId ?? raw.ServiceCentreId ?? raw.serviceCentreId ?? raw.Id ?? raw.id
        if (id == null) continue
        const city = raw.City || raw.city || raw.Location || raw.location || raw.Name || raw.name
        found.push({
          id: Number(id),
          name: String(raw.Name || raw.name || city || `Station ${id}`),
          city: String(city || ''),
          state: st || key,
          raw
        })
      }
      if (found.length) break
    } catch { /* try next */ }
  }
  if (!found.length) {
    // Fallback hardcoded minimal mapping (adjust when real IDs known)
    const fallbackMap: Record<string, { id: number; name: string; city: string }[]> = {
      'FCT': [{ id: 1, name: 'Abuja Hub', city: 'Abuja' }],
      'LAGOS': [{ id: 2, name: 'Ikeja Hub', city: 'Ikeja' }],
      'OGUN': [{ id: 3, name: 'Abeokuta Hub', city: 'Abeokuta' }]
    }
    const fb = fallbackMap[key]
    if (fb) __gigStationsCache[key] = fb
    return fb || []
  }
  __gigStationsCache[key] = found
  return found
}

// ----------------------------------------------------------------------------
