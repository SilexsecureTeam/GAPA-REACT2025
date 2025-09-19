import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductCard, { type Product as UiProduct } from '../components/ProductCard'
import useWishlist from '../hooks/useWishlist'
import { getProductById, type ApiProduct, getAllProducts } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }

function mapToUiProduct(p: ApiProduct, i: number): UiProduct {
  // Unwrap `part` if present (as in the getProductById response)
  const src: any = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const id = String((src as any)?.product_id ?? (src as any)?.id ?? i)
  const title = String(src?.part_name || src?.name || src?.title || 'Car Part')
  // Prefer explicit image fields img_url/img_url_1/img_url_2, run through productImageFrom to get absolute URL
  const galleryFields = [src?.img_url, src?.img_url_1, src?.img_url_2].filter(Boolean) as string[]
  const fromFields = galleryFields.map((s) => productImageFrom({ img_url: s }) || normalizeApiImage(s) || '').filter(Boolean)
  const primary = fromFields[0] || productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  const image = primary || logoImg
  const rating = Number((src as any)?.rating || 4)
  // Derive brand and category when available
  const bName = String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || '').trim()
  const cRaw = (src as any)?.category
  const cName = typeof cRaw === 'string' ? cRaw : String(cRaw?.name || cRaw?.title || (src as any)?.category_name || 'Parts')
  const brandSlug = bName ? toSlug(bName) : undefined
  const partSlug = cName ? toSlug(cName) : undefined
  return { id, title, image, rating, brandSlug, partSlug }
}

export default function Wishlist() {
  const navigate = useNavigate()
  const { ids, toggle, loaded } = useWishlist()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ApiProduct[]>([])
  const [attemptedFallback, setAttemptedFallback] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Unique ids
  const uniqueIds = useMemo(() => Array.from(new Set(ids.map(String))).filter(Boolean), [ids])

  useEffect(() => {
    let alive = true
    if (!loaded) return
    if (!uniqueIds.length) { setItems([]); return }
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        // 1. Try fetching each product individually (may require auth)
        const results = await Promise.allSettled(uniqueIds.map((id) => getProductById(id)))
        if (!alive) return
        let ok = results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean) as ApiProduct[]

        // 2. If none (likely due to auth), or missing some, fallback to public catalogue
        if (ok.length < uniqueIds.length && !attemptedFallback) {
          try {
            const all = await getAllProducts()
            if (!alive) return
            const map = new Map<string, ApiProduct>()
            for (const p of all) {
              const src: any = (p && (p as any).part) ? (p as any).part : p
              const pid = String((src as any)?.product_id ?? (src as any)?.id ?? '')
              if (pid) map.set(pid, p)
            }
            const recovered: ApiProduct[] = []
            for (const id of uniqueIds) {
              const found = map.get(id)
              // compare against unwrapped ids in ok as well
              const hasId = ok.find(p => {
                const src: any = (p && (p as any).part) ? (p as any).part : p
                return String((src as any)?.product_id ?? (src as any)?.id) === id
              })
              if (found && !hasId) recovered.push(found)
            }
            ok = [...ok, ...recovered]
          } catch (e) {
            // capture fallback error but do not hard fail UI
            setError('Some items could not be loaded.')
          }
          setAttemptedFallback(true)
        }
        setItems(ok)
      } catch {
        if (!alive) return
        setItems([])
        setError('Failed to load wishlist items.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [uniqueIds, attemptedFallback, loaded])

  const uiProducts: UiProduct[] = useMemo(() => items.map(mapToUiProduct), [items])

  const handleClearAll = () => {
    uniqueIds.forEach((id) => toggle(id))
  }

  const showInitialLoader = !loaded || (loading && loaded)
  const hasIds = uniqueIds.length > 0
  const nothingResolved = hasIds && uiProducts.length === 0 && !showInitialLoader

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">My Wishlist</h1>
          {hasIds && (
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

        {showInitialLoader ? (
          <div className="mt-6"><FallbackLoader label="Loading wishlist…" /></div>
        ) : !hasIds ? (
          <div className="mt-6 rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
            <div className="text-[14px] text-gray-700">Your wishlist is empty.</div>
            <div className="mt-3">
              <button onClick={() => navigate('/parts')} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">
                Browse parts
              </button>
            </div>
          </div>
        ) : nothingResolved ? (
          <div className="mt-6 rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
            <div className="text-[14px] text-gray-700">We couldn't load your saved items. They may require login or are no longer available.</div>
            {error && <div className="mt-2 text-[12px] text-red-600">{error}</div>}
            <div className="mt-3 flex flex-col items-center gap-2">
              <button onClick={() => navigate('/parts')} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">
                Explore parts
              </button>
              <button onClick={() => window.location.reload()} className="inline-flex h-9 items-center justify-center rounded-md bg-gray-100 px-4 text-[12px] font-medium text-gray-800 ring-1 ring-black/10 hover:bg-gray-50">Retry</button>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">{error}</div>}
            <div className="mb-2 text-[13px] text-gray-700">{uiProducts.length} item{uiProducts.length === 1 ? '' : 's'}</div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {uiProducts.map((p) => (
                <li key={p.id} className="relative">
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
