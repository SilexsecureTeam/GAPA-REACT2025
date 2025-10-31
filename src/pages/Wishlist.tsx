import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductActionCard from '../components/ProductActionCard'
import useWishlist from '../hooks/useWishlist'
import { getProductById, type ApiProduct, getAllProducts, addToCartApi } from '../services/api'
import { addGuestCartItem } from '../services/cart'
import { useAuth } from '../services/auth'
import { brandOf, categoryOf, isViewEnabledCategory, mapProductToActionData, productIdOf, toSlug } from '../utils/productMapping'
import { toast } from 'react-hot-toast'

export default function Wishlist() {
  const navigate = useNavigate()
  const { ids, toggle, loaded } = useWishlist()
  const { user } = useAuth()
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

  const cardProducts = useMemo(() => items.map((item, index) => mapProductToActionData(item, index)), [items])

  const handleViewProduct = useCallback((product: ApiProduct) => {
    const pid = productIdOf(product)
    if (!pid) return
    const brandSlug = toSlug(brandOf(product) || 'gapa') || 'gapa'
    const partSlug = toSlug(categoryOf(product) || 'parts') || 'parts'
    navigate(`/parts/${encodeURIComponent(brandSlug)}/${encodeURIComponent(partSlug)}?pid=${encodeURIComponent(pid)}`)
  }, [navigate])

  const handleAddToCart = useCallback(async (product: ApiProduct) => {
    const pid = productIdOf(product)
    if (!pid) return
    try {
      if (user && user.id) {
        await addToCartApi({ user_id: user.id, product_id: pid, quantity: 1 })
      } else {
        addGuestCartItem(pid, 1)
      }
      toast.success('Added to cart')
      navigate({ hash: '#cart' })
    } catch {
      toast.error('Could not add to cart')
    }
  }, [navigate, user])

  const handleClearAll = () => {
    uniqueIds.forEach((id) => toggle(id))
  }

  const showInitialLoader = !loaded || (loading && loaded)
  const hasIds = uniqueIds.length > 0
  const nothingResolved = hasIds && cardProducts.length === 0 && !showInitialLoader

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
            <div className="mb-2 text-[13px] text-gray-700">{cardProducts.length} item{cardProducts.length === 1 ? '' : 's'}</div>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((product, index) => {
                const cardProduct = cardProducts[index]
                if (!cardProduct) return null
                const viewEnabled = isViewEnabledCategory(categoryOf(product))
                return (
                  <li key={cardProduct.id} className="relative">
                    <div className="flex flex-col">
                      <ProductActionCard
                        product={cardProduct}
                        enableView={viewEnabled}
                        onView={viewEnabled ? () => handleViewProduct(product) : undefined}
                        onAddToCart={() => handleAddToCart(product)}
                      />

                      {/* View is available by clicking the image in ProductActionCard; no extra button needed */}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}
