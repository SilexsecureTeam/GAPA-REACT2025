import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import WishlistButton from '../components/WishlistButton'
import ProductActionCard from '../components/ProductActionCard'
import useWishlist from '../hooks/useWishlist'
import { getProductById, getProductOEM, getProductReviews, getRelatedProducts, getProductProperties, addToCartApi, type ApiReview,
  checkSuitability, getSuitabilityModel, getSubSuitabilityModel } from '../services/api'
import logoImg from '../assets/gapa-logo.png'
import { normalizeApiImage, pickImage, productImageFrom, manufacturerImageFrom } from '../services/images'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import { toast } from 'react-hot-toast'
import useManufacturers from '../hooks/useManufacturers'
import { mapProductToActionData } from '../utils/productMapping'  

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
  makerId?: string
  makerName?: string
  makerImage?: string
  category?: string
  soldInPairs?: boolean
}

function mapApiToUi(p: any, manufacturers: any[]): UiProduct {
  const src = p?.part || p
  const id = String(src?.product_id ?? src?.id ?? '')
  const brandName = String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || 'GAPA')
  const brandLogo = normalizeApiImage(pickImage(src?.brand)) || normalizeApiImage(src?.brand_logo) || normalizeApiImage(pickImage(src)) || logoImg
  const name = String(src?.part_name || src?.name || src?.title || src?.product_name || 'Car Part')
  const articleNo = String(src?.article_number || src?.article || src?.sku || src?.code || 'N/A')
  const price = Number(src?.price || src?.selling_price || src?.amount || 0)
  
  // Images
  const image = productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  const galleryFields = [src?.img_url, src?.img_url_1, src?.img_url_2].filter(Boolean) as string[]
  const galleryFromFields = galleryFields.map((s) => productImageFrom({ img_url: s }) || normalizeApiImage(s) || '').filter(Boolean)
  const rawImages: any[] = Array.isArray(src?.images) ? src.images : Array.isArray(src?.gallery) ? src.gallery : []
  const builtGallery = rawImages.map((x) => {
    if (typeof x === 'string') return productImageFrom({ img_url: x }) || normalizeApiImage(x) || ''
    return productImageFrom(x) || normalizeApiImage(pickImage(x) || '') || ''
  })
  const gallery = Array.from(new Set([image, ...galleryFromFields, ...builtGallery].filter(Boolean)))
  
  const rating = Number(src?.rating || src?.stars || 4)
  const reviews = Number(src?.reviews_count || src?.reviews || 0)
  const inStock = Boolean(src?.in_stock ?? src?.live_status ?? true)
  const description = String(src?.description || src?.details || '')
  
  // Manufacturer
  const makerId = String(src?.saler_id ?? src?.maker_id_ ?? src?.maker_id ?? src?.manufacturer_id ?? '').trim()
  let makerName = String(src?.maker?.name || src?.manufacturer?.name || src?.manufacturer || src?.maker || '').trim()
  let makerImage = manufacturerImageFrom(src?.maker || src?.manufacturer || src) || ''
  
  // Enhance with manufacturers data
  if (makerId && manufacturers.length) {
    const manufacturer = manufacturers.find((m: any) => {
      const mId = String(m.id ?? m?.maker_id_ ?? m?.maker_id ?? m?.manufacturer_id ?? '')
      return mId === makerId
    })
    if (manufacturer) {
      makerImage = manufacturerImageFrom(manufacturer) || makerImage
      makerName = String(manufacturer.name || manufacturer.title || (manufacturer as any)?.maker_name || makerName || '').trim()
    }
  }
  
  // Attributes
  const attributes: Attr[] = []
  if (src?.properties && typeof src.properties === 'object') {
    for (const k of Object.keys(src.properties)) {
      const v = (src.properties as any)[k]
      attributes.push({ label: k, value: String(v) })
    }
  }
  if (Array.isArray(src?.specs)) {
    for (const s of src.specs) {
      const label = String(s?.label || s?.name || '')
      const value = String(s?.value || s?.val || '')
      if (label && value) attributes.push({ label, value })
    }
  }
  const extra: Record<string, any> = {
    EAN: src?.EAN,
    Weight: src?.weight_in_kg,
  }
  for (const [k, v] of Object.entries(extra)) {
    const val = String(v ?? '').trim()
    if (val) attributes.push({ label: k, value: val })
  }
  
  // Category
  const c = src?.category
  const category = typeof c === 'string' ? c : String(c?.name || c?.title || src?.category_name || '')
  
  // Pairs
  const rawPairsVal = src?.pairs ?? src?.sold_in_pairs ?? src?.pair ?? src?.is_pair
  const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
  const soldInPairs = rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'
  
  return { 
    id, 
    brand: brandName, 
    brandLogo: brandLogo || logoImg, 
    name, 
    articleNo, 
    price, 
    image, 
    gallery: gallery.length ? gallery : [image], 
    rating, 
    reviews, 
    inStock, 
    attributes, 
    description,
    makerId,
    makerName,
    makerImage,
    category,
    soldInPairs
  }
}

// Image fallback component
function ImageWithFallback({ src, alt, className, onError }: { src: string | undefined; alt: string; className?: string; onError?: () => void }) {
  const [current, setCurrent] = useState(src || '')
  const [hasError, setHasError] = useState(false)
  
  useEffect(() => { 
    setCurrent(src || '')
    setHasError(false) 
  }, [src])
  
  const handleError = () => {
    setHasError(true)
    if (onError) onError()
  }
  
  if (!current || hasError) {
    return <div className={className} />
  }
  
  return <img src={current} alt={alt} className={className} onError={handleError} loading="lazy" />
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnUrl = searchParams.get('from') || '/parts'
  const { formatPrice } = useCurrency()
  
  const wishlist = useWishlist()
  const { user } = useAuth()
  const { manufacturers } = useManufacturers()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prod, setProd] = useState<UiProduct | null>(null)
  const [productRaw, setProductRaw] = useState<any>(null)
  const [oem, setOem] = useState<any[]>([])
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [qty, setQty] = useState(1)
  const [activeIdx, setActiveIdx] = useState(0)
  const [adding, setAdding] = useState(false)
  const [copiedOEM, setCopiedOEM] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'compatibility' | 'reviews'>('description')
  const [relatedProducts, setRelatedProducts] = useState<any[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [properties, setProperties] = useState<any[]>([])
  const [propertiesLoading, setPropertiesLoading] = useState(false)
  // Suitability (from backend endpoints)
  const [suitabilityLoading, setSuitabilityLoading] = useState(false)
  // const [suitabilityError, setSuitabilityError] = useState<string | null>(null)
  const [suitabilityData, setSuitabilityData] = useState<any[]>([])
  // When the backend returns an explicit empty envelope (e.g. { result: [] })
  // we treat that as "compatible with all vehicles" or an intentional no-list.
  const [suitabilityExplicitEmpty, setSuitabilityExplicitEmpty] = useState(false)

  const inc = () => {
    if (!prod?.soldInPairs) {
      setQty((v) => Math.min(v + 1, 99))
    }
  }
  const dec = () => {
    if (!prod?.soldInPairs) {
      setQty((v) => Math.max(v - 1, 1))
    }
  }

  // Fetch product details
  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    setError(null)
    ;(async () => {
      try {
        const detail = await getProductById(id)
        if (!alive) return
        setProductRaw(detail)
        const ui = mapApiToUi(detail, manufacturers)
        setProd(ui)
        setActiveIdx(0)
        if (ui.soldInPairs) setQty(2)
      } catch (e: any) {
        if (!alive) return
        setError(e?.message || 'Failed to load product')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id, manufacturers])
  
  // Fetch OEM numbers
  useEffect(() => {
    let alive = true
    if (!id) return
    ;(async () => {
      try { 
        const o = await getProductOEM(id)
        if (alive) setOem(Array.isArray(o) ? o : [])
      } catch { 
        if (alive) setOem([])
      }
    })()
    return () => { alive = false }
  }, [id])
  
  // Fetch reviews
  useEffect(() => {
    let alive = true
    if (!id) return
    setReviewsLoading(true)
    ;(async () => {
      try {
        const r = await getProductReviews(id)
        if (alive) setReviews(Array.isArray(r) ? r : [])
      } catch {
        if (alive) setReviews([])
      } finally {
        if (alive) setReviewsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])
  
  // Fetch related products
  useEffect(() => {
    let alive = true
    if (!id) return
    setRelatedLoading(true)
    ;(async () => {
      try {
        const r = await getRelatedProducts(id)
        if (alive) {
          const arr = Array.isArray(r) ? r : []
          setRelatedProducts(arr.slice(0, 8)) // Limit to 8 products
        }
      } catch {
        if (alive) setRelatedProducts([])
      } finally {
        if (alive) setRelatedLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  // Fetch product properties
  useEffect(() => {
    let alive = true
    if (!id) return
    setPropertiesLoading(true)
    ;(async () => {
      try {
        const p = await getProductProperties(id)
        if (alive) {
          const arr = Array.isArray(p) ? p : []
          setProperties(arr)
        }
      } catch {
        if (alive) setProperties([])
      } finally {
        if (alive) setPropertiesLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  const isFav = useMemo(() => (prod ? wishlist.has(prod.id) : false), [wishlist, prod])
  
  // Parse OEM numbers from multiple sources
  const oemNumbers = useMemo(() => {
    if (!productRaw) return []
    const src = productRaw?.part || productRaw
    const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList ?? src?.OEM ?? src?.OEM_NO
    const out: string[] = []
    const push = (v: any) => {
      if (!v) return
      if (typeof v === 'string') {
        v.split(/[\n,;\s]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0).forEach((s: string) => out.push(s))
        return
      }
      if (Array.isArray(v)) { v.forEach(push); return }
      if (typeof v === 'object') { 
        Object.values(v).map((x) => String(x).trim()).filter(Boolean).forEach((x) => out.push(x))
        return 
      }
      out.push(String(v))
    }
    push(o)
    // Also add OEM from API response
    if (oem && Array.isArray(oem)) {
      oem.forEach((item: any) => {
        const code = item?.oem || item?.OEM || item?.code || item?.oem_number
        if (code) push(code)
      })
    }
    return Array.from(new Set(out)).filter(s => s && s !== 'null' && s !== 'undefined')
  }, [productRaw, oem])
  
  // Parse compatibility/suitable vehicles
  const compatibility = useMemo(() => {
    if (!productRaw) return []
    const src = productRaw?.part || productRaw
    const comp = src?.compatibility ?? src?.compatibilities ?? src?.vehicle_compatibility ?? src?.vehicleCompatibility ?? src?.fitment ?? src?.fitments
    const out: string[] = []
    const push = (item: any) => {
      if (!item) return
      if (typeof item === 'string') { 
        item.split(/\n+/).map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => out.push(s))
        item.split('YEAR OF CONSTRUCTION').map((s: string) => s.trim()).filter(Boolean).forEach((s: string) => out.push(s))
        return 
      }
      if (Array.isArray(item)) { item.forEach(push); return }
      if (typeof item === 'object') { Object.values(item).forEach(push as any); return }
      out.push(String(item))
    }
    push(comp)
    return Array.from(new Set(out))
  }, [productRaw])

  // Fetch suitability tree from backend endpoints:
  useEffect(() => {
    let alive = true
    if (!id) return
    setSuitabilityLoading(true)
    // setSuitabilityError(null)
    setSuitabilityData([])
    setSuitabilityExplicitEmpty(false)
    ;(async () => {
      try {
        const models = await checkSuitability(id)
        if (!alive) return
        // API helper may return a sentinel object when the backend explicitly
        // returned { result: [] } — detect and persist that state so the UI
        // can render "Compatible with all vehicles" instead of listing models.
        if (models && (models as any).__emptySuitability) {
          setSuitabilityData([])
          setSuitabilityExplicitEmpty(true)
          return
        }
        const modelArr: any[] = Array.isArray(models) ? models : []
        if (modelArr.length === 0) {
          setSuitabilityData([])
          return
        }

        // For each top-level model, fetch its sub-models (but don't fetch sub-sub HTML yet)
        const prepared = await Promise.all(modelArr.map(async (m: any) => {
          const modelId = m?.id ?? m?.model_id
          const sub = await getSuitabilityModel(modelId)
          const subModels = Array.isArray(sub) ? sub.map((s: any) => ({ ...s, subSubHtml: undefined, loading: false, error: null })) : []
          return { modelId, modelName: m?.model || m?.name || '', raw: m, subModels }
        }))
        if (!alive) return
        setSuitabilityData(prepared)
      } catch (e: any) {
        if (!alive) return
        // setSuitabilityError(e?.message || 'Failed to load suitability information')
        setSuitabilityData([])
      } finally {
        if (alive) setSuitabilityLoading(false)
      }
    })()
    return () => { alive = false }
  }, [id])

  // Lazy-load sub-sub model HTML when a sub-model is expanded
  const loadSubSub = async (modelIndex: number, subIndex: number) => {
    setSuitabilityData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || []))
      const target = copy[modelIndex]?.subModels?.[subIndex]
      if (!target) return prev
      if (target.subSubHtml || target.loading) return prev
      target.loading = true
      return copy
    })

    try {
      const prev = suitabilityData[modelIndex]
      const sub = prev?.subModels?.[subIndex]
      const subModelId = sub?.id ?? sub?.sub_model_id
      const res = await getSubSuitabilityModel(subModelId)
      const html = Array.isArray(res) && res.length ? (res[0]?.sub_sub_model || '') : ''
      setSuitabilityData((prev) => {
        const copy = JSON.parse(JSON.stringify(prev || []))
        if (!copy[modelIndex] || !copy[modelIndex].subModels) return prev
        copy[modelIndex].subModels[subIndex].subSubHtml = html
        copy[modelIndex].subModels[subIndex].loading = false
        copy[modelIndex].subModels[subIndex].error = null
        return copy
      })
    } catch (e: any) {
      setSuitabilityData((prev) => {
        const copy = JSON.parse(JSON.stringify(prev || []))
        if (!copy[modelIndex] || !copy[modelIndex].subModels) return prev
        copy[modelIndex].subModels[subIndex].loading = false
        copy[modelIndex].subModels[subIndex].error = e?.message || 'Failed to load details'
        return copy
      })
    }
  }
  
  // Average rating from reviews
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return prod?.rating || 0
    return reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length
  }, [reviews, prod])
  
  // Add to cart handler
  const handleAddToCart = useCallback(async () => {
    if (!prod || adding) return
    setAdding(true)
    try {
      const effectiveQty = prod.soldInPairs ? 2 : qty
      if (user && user.id) {
        await addToCartApi({ user_id: user.id, product_id: prod.id, quantity: effectiveQty })
      } else {
        addGuestCartItem(prod.id, effectiveQty)
      }
      // Dispatch custom event to update cart count in header
      window.dispatchEvent(new Event('cart-updated'))
      toast.success('Added to cart')
      navigate({ hash: '#cart' })
    } catch {
      toast.error('Failed to add to cart')
    } finally {
      setAdding(false)
    }
  }, [prod, qty, user, adding, navigate])

  if (loading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 pt-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="aspect-square w-full rounded-xl bg-gray-200" />
              <div className="grid grid-cols-4 gap-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-square rounded-lg bg-gray-200" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-10 w-3/4 rounded bg-gray-200" />
              <div className="h-6 w-1/2 rounded bg-gray-200" />
              <div className="h-32 w-full rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !prod) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 pt-12">
        <div className="rounded-xl bg-white p-8 text-center ring-1 ring-black/10">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Product Not Found</h2>
          <p className="mt-2 text-gray-600">{error || 'The product you\'re looking for doesn\'t exist or has been removed.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => navigate(-1)} className="inline-block rounded-lg bg-gray-200 px-6 py-3 font-semibold text-gray-900 hover:bg-gray-300">
              Go Back
            </button>
            <Link to={returnUrl} className="inline-block rounded-lg bg-[#F7CD3A] px-6 py-3 font-semibold text-gray-900 hover:bg-[#f9d658]">
              Back to Products
            </Link>
          </div>
        </div>

        {/* Show Related Products if available */}
        {!relatedLoading && relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 text-2xl font-bold text-gray-900">You Might Also Like</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((relatedProd, idx) => {
                const cardProduct = mapProductToActionData(relatedProd, idx)
                return (
                  <ProductActionCard
                    key={cardProduct.id}
                    product={cardProduct}
                    enableView={true}
                    onView={() => navigate(`/product/${cardProduct.id}?from=${encodeURIComponent(window.location.pathname)}`)}
                    onAddToCart={async () => {
                      try {
                        if (user && user.id) {
                          await addToCartApi({ user_id: user.id, product_id: cardProduct.id, quantity: 1 })
                        } else {
                          addGuestCartItem(cardProduct.id, 1)
                        }
                        window.dispatchEvent(new Event('cart-updated'))
                        toast.success('Added to cart')
                        navigate({ hash: '#cart' })
                      } catch {
                        toast.error('Failed to add to cart')
                      }
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  const mainImage = prod.gallery[activeIdx] || prod.image

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 pt-12">
      {/* Breadcrumbs */}
      <nav className="mb-6 text-sm text-gray-600">
        <Link to="/" className="hover:text-gray-900">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/parts" className="hover:text-gray-900">Car Parts</Link>
        {prod.category && (
          <>
            <span className="mx-2">/</span>
            <span className="text-gray-900">{prod.category}</span>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-gray-900">{prod.name}</span>
      </nav>

      {/* Main Product Section */}
      <div className="mb-8 overflow-hidden rounded-2xl bg-white p-6 ring-1 ring-black/10 shadow-lg lg:p-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-8">
              <div className="flex items-center justify-center">
                <ImageWithFallback 
                  src={mainImage} 
                  alt={prod.name}
                  className="h-96 w-auto max-w-full object-contain"
                />
              </div>
            </div>
            {prod.gallery.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {prod.gallery.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveIdx(i)}
                    className={`overflow-hidden rounded-lg bg-gray-50 p-3 ring-2 transition-all ${
                      i === activeIdx ? 'ring-[#F7CD3A]' : 'ring-transparent hover:ring-gray-300'
                    }`}
                  >
                    <ImageWithFallback 
                      src={img} 
                      alt={`Preview ${i + 1}`}
                      className="h-16 w-full object-contain"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Header */}
            <div>
              <div className="mb-2 flex items-start justify-between gap-4">
                <h1 className="text-3xl font-bold text-gray-900">{prod.name}</h1>
                <WishlistButton 
                  ariaLabel={isFav ? 'Remove from wishlist' : 'Add to wishlist'} 
                  size={28} 
                  active={isFav} 
                  onToggle={(active) => { 
                    prod && wishlist.toggle(prod.id)
                    if (active) toast.success('Added to wishlist')
                    else toast.success('Removed from wishlist')
                  }} 
                />
              </div>
              <p className="text-sm text-gray-600">Article No: <span className="font-semibold">{prod.articleNo}</span></p>
            </div>

            {/* Manufacturer */}
            {prod.makerId && prod.makerId !== 'null' && (prod.makerImage || prod.makerName) && (
              <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-gray-50 to-white p-4 ring-1 ring-black/10">
                {prod.makerImage && (
                  <ImageWithFallback 
                    src={prod.makerImage} 
                    alt={prod.makerName || 'Manufacturer'}
                    className="h-16 w-16 object-contain"
                  />
                )}
                {prod.makerName && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-gray-600">Manufacturer</div>
                    <div className="text-lg font-bold text-gray-900">{prod.makerName}</div>
                  </div>
                )}
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <svg
                      key={i}
                      className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-medium text-gray-700">
                  {avgRating.toFixed(1)} ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}

            {/* Price */}
            <div className="rounded-xl bg-gradient-to-br from-[#F7CD3A]/10 to-[#F7CD3A]/5 p-6">
              <div className="text-4xl font-bold text-gray-900">{formatPrice(prod.price)}</div>
              <div className="mt-1 text-sm text-gray-600">Incl. 20% VAT, excl delivery cost</div>
              <div className="mt-2">
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${
                  prod.inStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {prod.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>

            {/* Quantity & Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-gray-900">Quantity:</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={dec}
                    disabled={prod.soldInPairs}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 ring-1 ring-black/10 hover:bg-gray-200 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <div className="flex h-10 w-16 items-center justify-center rounded-lg border-2 border-gray-200 font-semibold">
                    {prod.soldInPairs ? 2 : qty}
                  </div>
                  <button 
                    onClick={inc}
                    disabled={prod.soldInPairs}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-700 ring-1 ring-black/10 hover:bg-gray-200 disabled:opacity-50"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
              </div>
              {prod.soldInPairs && (
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Note:</span> This product is sold in pairs (2 units)
                </p>
              )}
              <button
                onClick={handleAddToCart}
                disabled={adding || !prod.inStock}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#F7CD3A] px-8 py-4 text-lg font-bold text-gray-900 ring-2 ring-[#F7CD3A] transition-all hover:bg-[#f9d658] hover:ring-[#f9d658] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {adding ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex overflow-x-auto border-b-2 border-gray-200">
          <button
            onClick={() => setActiveTab('description')}
            className={`whitespace-nowrap px-6 py-3 font-semibold transition-colors ${
              activeTab === 'description' ? 'border-b-4 border-[#F7CD3A] text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Description
          </button>
          <button
            onClick={() => setActiveTab('specs')}
            className={`whitespace-nowrap px-6 py-3 font-semibold transition-colors ${
              activeTab === 'specs' ? 'border-b-4 border-[#F7CD3A] text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Specifications
          </button>
          {(compatibility.length > 0 || oemNumbers.length > 0) && (
            <button
              onClick={() => setActiveTab('compatibility')}
              className={`whitespace-nowrap px-6 py-3 font-semibold transition-colors ${
                activeTab === 'compatibility' ? 'border-b-4 border-[#F7CD3A] text-gray-900' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Compatibility & OEM
            </button>
          )}
          <button
            onClick={() => setActiveTab('reviews')}
            className={`whitespace-nowrap px-6 py-3 font-semibold transition-colors ${
              activeTab === 'reviews' ? 'border-b-4 border-[#F7CD3A] text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reviews ({reviews.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="overflow-hidden rounded-xl bg-white p-6 ring-1 ring-black/10 shadow-md">
          {activeTab === 'description' && (
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Description</h2>
              {prod.description ? (
                <p className="leading-relaxed text-gray-700">{prod.description}</p>
              ) : (
                <p className="text-gray-500">No description available for this product.</p>
              )}
            </div>
          )}

          {activeTab === 'specs' && (
            <div className="space-y-8">
              <div>
                <h2 className="mb-4 text-xl font-bold text-gray-900">Specifications</h2>
                {prod.attributes.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {prod.attributes.map((attr, i) => (
                      <div key={i} className="flex overflow-hidden rounded-lg ring-1 ring-black/10">
                        <div className="bg-[#FBF5E9] px-4 py-3 font-semibold text-gray-800 sm:w-48">{attr.label}</div>
                        <div className="flex-1 bg-white px-4 py-3 text-gray-700">{attr.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No specifications available for this product.</p>
                )}
              </div>

              {/* Product Properties */}
              {propertiesLoading ? (
                <div className="text-center text-gray-500">
                  <p>Loading properties...</p>
                </div>
              ) : properties.length > 0 ? (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Product Properties</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {properties.map((prop, i) => (
                      <div key={i} className="flex overflow-hidden rounded-lg ring-1 ring-black/10">
                        <div className="bg-[#FBF5E9] px-4 py-3 font-semibold text-gray-800 sm:w-48">
                          {prop.property || prop.property_name || 'Property'}
                        </div>
                        <div className="flex-1 bg-white px-4 py-3 text-gray-700">
                          {prop.value || 'N/A'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === 'compatibility' && (
            <div className="space-y-6">
              {oemNumbers.length > 0 && (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">OEM Part Numbers</h2>
                  <div className="flex flex-wrap gap-2">
                    {oemNumbers.map((code, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 px-4 py-2 ring-1 ring-black/10">
                        <span className="font-mono text-sm font-semibold">{code}</span>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(code)
                              setCopiedOEM(i)
                              setTimeout(() => setCopiedOEM(null), 2000)
                              toast.success('Copied to clipboard')
                            } catch {
                              toast.error('Failed to copy')
                            }
                          }}
                          className="rounded bg-white px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100"
                        >
                          {copiedOEM === i ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Use suitability endpoints: checkSuitability -> suitabilityModel -> sub-suitabilityModel (lazy-loaded) */}
              {suitabilityLoading ? (
                <div className="text-center text-gray-500">Loading suitability information...</div>
              ) : suitabilityExplicitEmpty ? (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Suitable Vehicles</h2>
                  <div className="p-3 text-sm text-gray-700">Compatible with all vehicles</div>
                </div>
              ) : suitabilityData && suitabilityData.length > 0 ? (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Suitable Vehicles</h2>
                  <div className="max-h-96 space-y-2 overflow-y-auto no-scrollbar">
                    {suitabilityData.map((modelItem: any, mi: number) => (
                      <details key={mi} className="rounded-lg bg-gray-50">
                        <summary className="cursor-pointer px-3 py-2 font-semibold text-sm text-gray-800">{modelItem.modelName || modelItem.raw?.model || `Model ${modelItem.modelId}`}</summary>
                        <div className="mt-2 space-y-2 pl-3">
                          {Array.isArray(modelItem.subModels) && modelItem.subModels.length > 0 ? (
                            modelItem.subModels.map((sub: any, si: number) => (
                              <details
                                key={si}
                                className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-black/5"
                                onToggle={(e) => {
                                  try {
                                    const opened = (e.target as HTMLDetailsElement).open
                                    if (opened && !sub.subSubHtml && !sub.loading) {
                                      loadSubSub(mi, si)
                                    }
                                  } catch (err) { }
                                }}
                              >
                                <summary className="cursor-pointer font-medium">{sub?.sub_model || sub?.name || `Variant ${sub?.id || si}`}</summary>
                                <div className="mt-2 pl-2 text-gray-600">
                                  {sub.loading ? (
                                    <div className="text-sm text-gray-500">Loading details...</div>
                                  ) : sub.error ? (
                                    <div className="text-sm text-red-500">{sub.error}</div>
                                  ) : sub.subSubHtml ? (
                                    <div dangerouslySetInnerHTML={{ __html: sub.subSubHtml }} />
                                  ) : (
                                    <div className="text-sm text-gray-500">No further details available.</div>
                                  )}
                                </div>
                              </details>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500">No sub-models available for this model.</div>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              ) : compatibility.length > 0 ? (
                <div>
                  <h2 className="mb-4 text-xl font-bold text-gray-900">Suitable Vehicles</h2>
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                        {compatibility.map((vehicle, i) => {
                          // Split at "YEAR OF CONSTRUCTION"
                          const splitIdx = vehicle.toUpperCase().indexOf('YEAR OF CONSTRUCTION');
                          let model = vehicle, details = '';
                          if (splitIdx !== -1) {
                            model = vehicle.slice(0, splitIdx).trim();
                            details = vehicle.slice(splitIdx).trim();
                          }
                          // Use the same details/summary styling as the backend suitability layout
                          return (
                            <details key={i} className="rounded-lg bg-gray-50">
                              <summary className="cursor-pointer px-3 py-2 font-semibold text-sm text-gray-800">{model || vehicle}</summary>
                              {details && (
                                <div className="mt-2 pl-2 text-gray-600">{details}</div>
                              )}
                            </details>
                          );
                        })}
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">No compatibility information available for this product.</p>
              )}

              {oemNumbers.length === 0 && compatibility.length === 0 && (
                <p className="text-gray-500">No compatibility information available for this product.</p>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Customer Reviews</h2>
                {reviews.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <svg
                          key={i}
                          className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="font-semibold text-gray-900">{avgRating.toFixed(1)}</span>
                  </div>
                )}
              </div>

              {reviewsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse space-y-3 rounded-lg bg-gray-50 p-4">
                      <div className="h-4 w-1/4 rounded bg-gray-200" />
                      <div className="h-3 w-full rounded bg-gray-200" />
                      <div className="h-3 w-3/4 rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-xl bg-gradient-to-br from-gray-50 to-white p-12 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
                    <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">No reviews yet</h3>
                  <p className="mt-2 text-gray-600">Be the first to share your experience with this product</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(showAllReviews ? reviews : reviews.slice(0, 5)).map((review, i) => {
                    const userName = review.name || review.user?.name || 'Anonymous'
                    const rating = Number(review.rating || 0)
                    const reviewText = review.review || ''
                    const date = review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                    
                    return (
                      <div key={i} className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-5 transition-shadow hover:shadow-md">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#F7CD3A]/20 text-lg font-bold text-gray-900 ring-2 ring-[#F7CD3A]/30">
                            {userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h4 className="font-semibold text-gray-900">{userName}</h4>
                                {date && <p className="text-sm text-gray-500">{date}</p>}
                              </div>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <svg
                                    key={i}
                                    className={`h-4 w-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                                    viewBox="0 0 20 20"
                                  >
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                            </div>
                            <p className="mt-3 text-gray-700">{reviewText}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  
                  {reviews.length > 5 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="w-full rounded-lg border-2 border-gray-200 bg-white py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      {showAllReviews ? 'Show Less' : `View All ${reviews.length} Reviews`}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related Products Section */}
      {!relatedLoading && relatedProducts.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-6 text-2xl font-bold text-gray-900">Related Products</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((relatedProd, idx) => {
              const cardProduct = mapProductToActionData(relatedProd, idx)
              return (
                <ProductActionCard
                  key={cardProduct.id}
                  product={cardProduct}
                  enableView={true}
                  onView={() => navigate(`/product/${cardProduct.id}?from=${encodeURIComponent(window.location.pathname)}`)}
                  onAddToCart={async () => {
                    try {
                      if (user && user.id) {
                        await addToCartApi({ user_id: user.id, product_id: cardProduct.id, quantity: 1 })
                      } else {
                        addGuestCartItem(cardProduct.id, 1)
                      }
                      window.dispatchEvent(new Event('cart-updated'))
                      toast.success('Added to cart')
                      navigate({ hash: '#cart' })
                    } catch {
                      toast.error('Failed to add to cart')
                    }
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
