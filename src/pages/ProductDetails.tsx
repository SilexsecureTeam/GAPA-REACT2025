import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import FallbackLoader from '../components/FallbackLoader'
import { getProductById, getProductOEM } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'

type Attr = { label: string; value: string }

type UiProduct = {
  id: string
  brand: string
  brandLogo: string
  name: string
  articleNo: string
  price: number
  image: string
  gallery: string[]
  rating: number
  reviews: number
  inStock: boolean
  attributes: Attr[]
  description?: string
}

function mapApiToUi(p: any): UiProduct {
  const id = String(p?.id ?? p?.product_id ?? '')
  const brandName = String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || 'GAPA')
  const brandLogo = normalizeApiImage(pickImage(p?.brand)) || normalizeApiImage(p?.brand_logo) || normalizeApiImage(pickImage(p)) || '/gapa-logo.png'
  const name = String(p?.name || p?.title || p?.product_name || 'Car Part')
  const articleNo = String(p?.article_no || p?.article || p?.sku || p?.code || 'N/A')
  const price = Number(p?.price || p?.selling_price || p?.amount || 0)
  // Use productImageFrom for proper CDN path
  const image = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || '/gapa-logo.png'
  const rawImages: any[] = Array.isArray(p?.images) ? p.images : Array.isArray(p?.gallery) ? p.gallery : []
  // Build gallery using productImageFrom for objects, normalize for strings
  const builtGallery = rawImages.map((x) => {
    if (typeof x === 'string') return normalizeApiImage(x) || ''
    return productImageFrom(x) || normalizeApiImage(pickImage(x) || '') || ''
  })
  const gallery = Array.from(new Set([image, ...builtGallery].filter(Boolean)))
  const rating = Number(p?.rating || p?.stars || 4)
  const reviews = Number(p?.reviews_count || p?.reviews || 0)
  const inStock = Boolean(p?.in_stock ?? true)
  const attributes: Attr[] = []
  if (p?.properties && typeof p.properties === 'object') {
    for (const k of Object.keys(p.properties)) {
      const v = (p.properties as any)[k]
      attributes.push({ label: k, value: String(v) })
    }
  }
  if (Array.isArray(p?.specs)) {
    for (const s of p.specs) {
      const label = String(s?.label || s?.name || '')
      const value = String(s?.value || s?.val || '')
      if (label && value) attributes.push({ label, value })
    }
  }
  const description = String(p?.description || p?.details || '')
  return { id, brand: brandName, brandLogo: brandLogo || '/gapa-logo.png', name, articleNo, price, image, gallery: gallery.length ? gallery : [image], rating, reviews, inStock, attributes, description }
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const wishlist = useWishlist()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prod, setProd] = useState<UiProduct | null>(null)
  const [oem, setOem] = useState<any[]>([])
  const [qty, setQty] = useState(2)
  const [activeIdx, setActiveIdx] = useState(0)

  const inc = () => setQty((v) => Math.min(v + 1, 99))
  const dec = () => setQty((v) => Math.max(v - 1, 1))

  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const detail = await getProductById(id)
        if (!alive) return
        const ui = mapApiToUi(detail)
        setProd(ui)
        setActiveIdx(0)
        try { const o = await getProductOEM(id); if (alive) setOem(Array.isArray(o) ? o : []) } catch { /* ignore */ }
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Failed to load product')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  const isFav = useMemo(() => (prod ? wishlist.has(prod.id) : false), [wishlist, prod])

  if (loading) {
    return (
      <div className="bg-white !pt-14">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <FallbackLoader label="Loading product…" />
        </section>
      </div>
    )
  }

  if (error || !prod) {
    return (
      <div className="bg-white !pt-14">
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
            <div className="text-[16px] font-semibold text-gray-900">Unable to load product</div>
            <div className="mt-1 text-[13px] text-gray-600">{error}</div>
            <div className="mt-4 flex justify-center gap-3">
              <button onClick={() => navigate(-1)} className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-5 text-[14px] font-semibold text-white ring-1 ring-black/10">Go Back</button>
              <Link to="/parts" className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Browse All Parts</Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const mainImage = prod.gallery[activeIdx] || prod.image

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">{prod.name}</h1>

        <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
          <ol className="flex items-center gap-3 font-medium">
            <li><Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li><Link to="/parts" className="hover:underline text-gray-700">Car Parts</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li className="font-semibold text-brand">{prod.brand}</li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr_320px]">
          {/* Gallery */}
          <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6">
              <img src={mainImage} alt={prod.name} className="h-[360px] w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {prod.gallery.map((g, i) => (
                <button key={i} onClick={() => setActiveIdx(i)} className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10 ${i===activeIdx ? 'outline-2 outline-accent' : ''}`} aria-label={`Preview ${i+1}`}>
                  <img src={g} alt={`Preview ${i+1}`} className="h-16 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                </button>
              ))}
            </div>
          </aside>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <img src={prod.brandLogo} alt={prod.brand} className="h-6 w-auto" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
              <div className="ml-auto text-right text-[12px] text-gray-500">
                <div>Article No: {prod.articleNo}</div>
                {oem.length > 0 && (
                  <div className="text-[11px] text-gray-600">OEM: {oem.map((x:any)=>x?.oem || x?.OEM || x?.code).filter(Boolean).slice(0,3).join(', ')}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <Rating value={prod.rating} />
              <span>({prod.reviews})</span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {prod.attributes.map((a) => (
                <div key={a.label + a.value} className="grid grid-cols-[180px_1fr] text-[13px]">
                  <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                  <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700">{a.value}</div>
                </div>
              ))}
              <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
            </div>

            {prod.description && (
              <div className="pt-2 text-[13px] text-gray-700">{prod.description}</div>
            )}
          </div>

          {/* Purchase */}
          <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="text-right">
              <div className="text-[22px] font-bold text-gray-900">₦{prod.price.toLocaleString('en-NG')}</div>
              <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button aria-label="Decrease" onClick={dec} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">‹</button>
              <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
              <button aria-label="Increase" onClick={inc} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">›</button>
            </div>

            <button className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              Add to cart
            </button>

            <div className="mt-2 text-center">
              <WishlistButton active={isFav} onToggle={() => prod && wishlist.toggle(prod.id)} ariaLabel="Add to wishlist" />
            </div>

            <div className="mt-2 text-center text-[12px] text-purple-700">{prod.inStock ? 'In Stock' : 'Out of stock'}</div>
          </aside>
        </div>

        {/* Info section bottom */}
        <section aria-labelledby="pd-info" className="mt-10">
          <h2 id="pd-info" className="text-[18px] font-semibold text-gray-900">Product information</h2>
          <div className="mt-3 grid gap-2 text-[13px] text-gray-700 sm:grid-cols-2">
            {prod.attributes.map((a) => (
              <div key={a.label + a.value + '-info'} className="grid grid-cols-[180px_1fr]">
                <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5">{a.value}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
