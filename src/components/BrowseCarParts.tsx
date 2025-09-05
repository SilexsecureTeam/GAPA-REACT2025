import { useEffect, useMemo, useState } from 'react'
import ProductCard, { type Product } from './ProductCard'
import FallbackLoader from './FallbackLoader'
import { getFeaturedProducts, type ApiProduct } from '../services/api'
import { pickImage, normalizeApiImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

export type BrowseCarPartsProps = {
  title?: string
  className?: string
  products?: Product[]
  loading?: boolean
  showViewAll?: boolean
}

// Helper to unwrap API responses that might come in various shapes
function unwrap<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && Array.isArray(res.data)) return res.data as T[]
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}

export default function BrowseCarParts({ title = 'Browse Car Parts', className = '', products, loading, showViewAll = true }: BrowseCarPartsProps) {
  const [localLoading, setLocalLoading] = useState(true)
  const [featured, setFeatured] = useState<ApiProduct[]>([])

  // Fetch only if products are not provided from parent
  useEffect(() => {
    if (products) { setLocalLoading(false); return }
    let alive = true
    ;(async () => {
      try {
        const res = await getFeaturedProducts()
        if (!alive) return
        setFeatured(unwrap<ApiProduct>(res))
      } catch (_) {
        setFeatured([])
      } finally {
        setLocalLoading(false)
      }
    })()
    return () => { alive = false }
  }, [products])

  // Map API products into ProductCard model
  const items: Product[] = useMemo(() => {
    if (products) return products
    const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return (featured || []).slice(0, 10).map((it, i) => {
      const brandNameLocal = String((it as any)?.brand?.name || (it as any)?.brand || (it as any)?.manufacturer || (it as any)?.maker || '')
      const catName = typeof (it as any)?.category === 'string' ? (it as any)?.category : ((it as any)?.category?.name || (it as any)?.category?.title || (it as any)?.category_name || '')
      return {
        id: String((it as any)?.id ?? (it as any)?.product_id ?? i),
        title: (it as any)?.name || (it as any)?.title || (it as any)?.product_name || 'Car Part',
        image: productImageFrom(it) || normalizeApiImage(pickImage(it) || '') || logoImg,
        rating: Number((it as any)?.rating || 4),
        brandSlug: brandNameLocal ? toSlug(brandNameLocal) : undefined,
        partSlug: catName ? toSlug(catName) : undefined,
      }
    })
  }, [products, featured])

  const busy = products ? !!loading : localLoading

  return (
    <section className={`mx-auto max-w-7xl px-4 py-10 sm:px-6 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
        {showViewAll && (
          <a href="/parts" className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900">
            View all
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        )}
      </div>

      {busy ? (
        <FallbackLoader label="Loading products…" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {items.length === 0 ? (
            <div className="col-span-full text-center text-sm text-gray-600">No products found.</div>
          ) : (
            items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))
          )}
        </div>
      )}
    </section>
  )
}
