import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductCard, { type Product as UiProduct } from '../components/ProductCard'
import useWishlist from '../hooks/useWishlist'
import { getProductById, type ApiProduct } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

function brandOf(p: any): string {
  return String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || '').trim()
}
function categoryOf(p: any): string {
  const c = (p as any)?.category
  if (typeof c === 'string') return c
  return String(c?.name || c?.title || (p as any)?.category_name || 'Parts')
}

function mapToUiProduct(p: ApiProduct, i: number): UiProduct {
  const id = String((p as any)?.product_id ?? (p as any)?.id ?? i)
  const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || 'Car Part')
  const image = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg
  const rating = Number((p as any)?.rating || 4)
  const bName = brandOf(p)
  const cName = categoryOf(p)
  const brandSlug = bName ? toSlug(bName) : undefined
  const partSlug = cName ? toSlug(cName) : undefined
  return { id, title, image, rating, brandSlug, partSlug }
}

export default function Wishlist() {
  const navigate = useNavigate()
  const { ids, toggle } = useWishlist()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ApiProduct[]>([])

  // Unique ids
  const uniqueIds = useMemo(() => Array.from(new Set(ids.map(String))), [ids])

  useEffect(() => {
    let alive = true
    if (!uniqueIds.length) { setItems([]); return }
    ;(async () => {
      try {
        setLoading(true)
        const results = await Promise.allSettled(uniqueIds.map((id) => getProductById(id)))
        if (!alive) return
        const ok = results
          .map((r) => (r.status === 'fulfilled' ? r.value : null))
          .filter(Boolean) as ApiProduct[]
        setItems(ok)
      } catch {
        if (!alive) return
        setItems([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [uniqueIds])

  const uiProducts: UiProduct[] = useMemo(() => items.map(mapToUiProduct), [items])

  const handleClearAll = () => {
    // Toggle all off
    uniqueIds.forEach((id) => toggle(id))
  }

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">My Wishlist</h1>
          {uniqueIds.length > 0 && (
            <button onClick={handleClearAll} className="inline-flex h-9 items-center justify-center rounded-md border border-black/10 px-3 text-[12px] font-semibold text-gray-800 hover:bg-black/5">
              Clear all
            </button>
          )}
        </div>

        <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
          <ol className="flex items-center gap-2 font-medium">
            <li><Link to="/parts" className="hover:underline">Parts Catalogue</Link></li>
            <li aria-hidden className='text-[22px] -mt-1'>›</li>
            <li className="font-semibold text-brand">Wishlist</li>
          </ol>
        </nav>

        {loading ? (
          <div className="mt-6"><FallbackLoader label="Loading wishlist…" /></div>
        ) : uniqueIds.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
            <div className="text-[14px] text-gray-700">Your wishlist is empty.</div>
            <div className="mt-3">
              <button onClick={() => navigate('/parts')} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">
                Browse parts
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <div className="mb-2 text-[13px] text-gray-700">{uiProducts.length} item{uiProducts.length === 1 ? '' : 's'}</div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {uiProducts.map((p) => (
                <li key={p.id} className="relative">
                  {/* Remove button overlay */}
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-label="Remove from wishlist"
                    title="Remove"
                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-[#350e49] ring-1 ring-black/10 hover:text-[#5A1E78]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                  <ProductCard product={p} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
