import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import type { ProductActionData } from '../components/ProductActionCard'

export const VIEW_ENABLED_CATEGORIES = new Set(['CAR PARTS', 'CAR ELECTRICALS'])

export const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const unwrapProduct = <T,>(p: T): any => {
  if (p && typeof p === 'object' && 'part' in (p as any)) {
    return (p as any).part
  }
  return p
}

export const productIdOf = (p: any, fallbackIndex = 0) => {
  const src = unwrapProduct(p)
  return String(src?.product_id ?? src?.id ?? fallbackIndex)
}

export const categoryOf = (p: any) => {
  const src = unwrapProduct(p)
  const c = src?.category
  if (typeof c === 'string') return c
  if (typeof c === 'object' && c) return String(c?.name || c?.title || c?.category_name || 'General')
  return String(src?.category_name || 'General')
}

export const brandOf = (p: any) => {
  const src = unwrapProduct(p)
  return String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || '').trim()
}

export const makerIdOf = (p: any) => {
  const src = unwrapProduct(p)
  const raw = src?.maker_id ?? src?.manufacturer_id ?? (typeof src?.maker === 'object' ? src?.maker?.id : undefined)
  return raw != null && raw !== '' ? String(raw) : ''
}

export const manufacturerNameOf = (p: any) => {
  const src = unwrapProduct(p)
  if (typeof src?.maker === 'object') {
    return String(src.maker?.name || src.maker?.title || src.maker?.maker_name || '').trim()
  }
  return String(src?.manufacturer || src?.maker || '').trim()
}

export const isViewEnabledCategory = (name?: string | null) => {
  if (!name) return false
  return VIEW_ENABLED_CATEGORIES.has(name.trim().toUpperCase())
}

export const mapProductToActionData = (p: any, fallbackIndex = 0): ProductActionData => {
  const src = unwrapProduct(p)
  const id = productIdOf(src, fallbackIndex)
  const title = String(src?.part_name || src?.name || src?.title || 'Car Part')
  const rawImgUrl = src?.img_url || src?.imgUrl
  const forcedFromImgUrl = rawImgUrl ? productImageFrom({ img_url: rawImgUrl }) || normalizeApiImage(rawImgUrl) : undefined
  const fallbackImage = productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  const image = forcedFromImgUrl || fallbackImage || logoImg
  const rating = Number(src?.rating || src?.stars || 4)
  const reviews = Number(src?.reviews_count || src?.reviews || 0)
  const brand = brandOf(src) || 'GAPA'
  const price = Number(src?.price || src?.selling_price || src?.amount || 0)
  const priceLabel = `₦${Math.max(0, price).toLocaleString('en-NG')}`
  return { id, title, image, rating, reviews, brand, price, priceLabel }
}
