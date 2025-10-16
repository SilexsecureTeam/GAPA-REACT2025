import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getAllProducts, liveSearch, getRelatedProducts, type ApiProduct, getProductById, getAllCategories, type ApiCategory, addToCartApi, type ApiManufacturer, getProductReviews, type ApiReview } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, manufacturerImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import { toast } from 'react-hot-toast'
import ManufacturerSelector from '../components/ManufacturerSelector'
import useManufacturers from '../hooks/useManufacturers'
import { makerIdOf, isViewEnabledCategory } from '../utils/productMapping'

// Helpers
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

// Derive brand and category names from product
function brandOf(p: any): string {
  return String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || p?.brand_name || '').trim()
}
function categoryOf(p: any): string {
  const c = (p as any)?.category
  if (typeof c === 'string') return c
  return String(c?.name || c?.title || (p as any)?.category_name || '').trim()
}

// Small helpers to read attributes/specs consistently
type Attr = { label: string; value: string }
function attrsFrom(p: any): Attr[] {
  // Unwrap nested `part` if present
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const out: Attr[] = []
  if (src?.properties && typeof src.properties === 'object') {
    for (const k of Object.keys(src.properties)) {
      const v = (src.properties as any)[k]
      const label = String(k).trim()
      const value = String(v ?? '').trim()
      if (label && value) out.push({ label, value })
    }
  }
  if (Array.isArray(src?.specs)) {
    for (const s of src.specs) {
      const label = String(s?.label || s?.name || '').trim()
      const value = String(s?.value || s?.val || '').trim()
      if (label && value) out.push({ label, value })
    }
  }
  // Common flat fields we can surface as attributes
  const extra: Record<string, any> = {
    EAN: (src as any)?.EAN,
    Weight: (src as any)?.weight_in_kg,
    Pairs: (src as any)?.pairs,
  }
  for (const [k, v] of Object.entries(extra)) {
    const val = String(v ?? '').trim()
    if (val) out.push({ label: k, value: val })
  }
  return out
}

function mapApiToUi(p: any) {
  // Unwrap nested `part` payloads
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  // Prefer product_id (string)
  const id = String(src?.product_id ?? src?.id ?? '')
  const brandName = String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || 'GAPA')
  const brandLogo = normalizeApiImage(pickImage(src?.brand)) || normalizeApiImage(src?.brand_logo) || normalizeApiImage(pickImage(src)) || logoImg
  // Prefer part_name
  const name = String(src?.part_name || src?.name || src?.title || src?.product_name || 'Car Part')
  const articleNo = String(src?.article_no || src?.article_number || src?.article || src?.sku || src?.code || 'N/A')
  const price = Number(src?.price || src?.selling_price || src?.amount || 0)
  const image = productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  // Build gallery from known image fields and arrays (respect product image base URL)
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
  const inStock = Boolean((src as any)?.in_stock ?? (src as any)?.live_status ?? true)
  const attributes = attrsFrom(src)
  const description = String(src?.description || src?.details || '')
  // Extract maker information
  const makerId = String(src?.maker_id_ ?? src?.maker_id ?? src?.manufacturer_id ?? '').trim()
  const makerName = String(src?.maker?.name || src?.manufacturer?.name || src?.manufacturer || src?.maker || '').trim()
  const makerImage = manufacturerImageFrom(src?.maker || src?.manufacturer || src) || ''
  return { id, brand: brandName, brandLogo: brandLogo || logoImg, name, articleNo, price, image, gallery: gallery.length ? gallery : [image], rating, reviews, inStock, attributes, description, makerId, makerName, makerImage }
}

// Stateful image component to avoid infinite onError loops where React keeps re-setting a broken src.
// Once a fallback is applied it persists until the original src prop changes.
function ImageWithFallback({ src, alt, className, showFallback = false }: { src: string | undefined; alt: string; className?: string; showFallback?: boolean }) {
  const safeSrc = src || (showFallback ? logoImg : '')
  const [current, setCurrent] = useState(safeSrc)
  const [hasError, setHasError] = useState(false)
  useEffect(() => { setCurrent(safeSrc); setHasError(false) }, [safeSrc])
  
  if (!current || hasError && !showFallback) {
    return <div className={className} />
  }
  
  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => { 
        if (showFallback && current !== logoImg) {
          setCurrent(logoImg)
        } else {
          setHasError(true)
        }
      }}
      loading="lazy"
    />
  )
}

const RELATED_LIMIT = 24
const INITIAL_VISIBLE_RELATED = 10

// Simple in‑memory UI mapping cache to avoid recomputing galleries repeatedly
const __productUiCache = new Map<string, ReturnType<typeof mapApiToUi>>()
function mapApiToUiCached(p: any) {
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const id = String(src?.product_id ?? src?.id ?? '')
  if (id && __productUiCache.has(id)) return __productUiCache.get(id)!
  const ui = mapApiToUi(p)
  if (id) __productUiCache.set(id, ui)
  return ui
}

export default function CarPartDetails() {
  const navigate = useNavigate()
  const { brand, part } = useParams<{ brand?: string; part?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const pid = searchParams.get('pid') || ''

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [related, setRelated] = useState<ApiProduct[]>([])
  const [selected, setSelected] = useState<ReturnType<typeof mapApiToUi> | null>(null)
  const [selectedRaw, setSelectedRaw] = useState<any | null>(null)
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)
  const [visibleCompatCount, setVisibleCompatCount] = useState(INITIAL_VISIBLE_RELATED)
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(INITIAL_VISIBLE_RELATED)
  const { manufacturers, loading: manufacturersLoading, error: manufacturersError } = useManufacturers()
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('')
  const [selectedManufacturerName, setSelectedManufacturerName] = useState<string>('')
  const [isMobileFilterOpen, setMobileFilterOpen] = useState(false)
  
  // Reviews
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showAllReviews, setShowAllReviews] = useState(false)

  // Wishlist
  const { has: wishlistHas, toggle: wishlistToggle } = useWishlist()

  // NEW: shared vehicle filter state
  const [vehFilter, setVehFilter] = useState<VehState>(() => getPersistedVehicleFilter())
  // Stable handler to avoid recreating on each render (prevents child effect loop)
  const handleVehFilterChange = useCallback((next: VehState) => {
    setVehFilter(prev => {
      if (
        prev.brandId === next.brandId &&
        prev.modelId === next.modelId &&
        prev.engineId === next.engineId &&
        prev.brandName === next.brandName &&
        prev.modelName === next.modelName &&
        prev.engineName === next.engineName
      ) return prev // no actual change
      return next
    })
  }, [])
  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  const productMatchesVehicle = (p: any) => sharedVehicleMatches(p, vehFilter)
  const hasManufacturerFilter = Boolean(selectedManufacturerId)
  const selectedVehicleLabel = useMemo(() => {
    if (!vehFilter.brandName && !vehFilter.modelName && !vehFilter.engineName) return 'All vehicles'
    return [vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' • ')
  }, [vehFilter])

  const handleManufacturerSelect = useCallback((manufacturer: ApiManufacturer | null) => {
    if (!manufacturer) {
      setSelectedManufacturerId('')
      setSelectedManufacturerName('')
      return
    }
    // Use saler_id instead of maker_id
    const rawId = (manufacturer as any)?.saler_id
      ?? manufacturer.id
      ?? (manufacturer as any)?.maker_id_
      ?? (manufacturer as any)?.maker_id
      ?? (manufacturer as any)?.manufacturer_id
    const id = rawId != null ? String(rawId) : ''
    setSelectedManufacturerId(id)
    const name = String(manufacturer.name || manufacturer.title || (manufacturer as any)?.maker_name || 'Manufacturer').trim()
    setSelectedManufacturerName(name)
  }, [])

  // Filter manufacturers to only show those with products in current view
  const manufacturersWithProducts = useMemo(() => {
    if (!manufacturers.length) return []
    
    // Use products array
    const productsToCheck = products
    
    // If no products loaded yet, return empty array (don't show manufacturers yet)
    if (!productsToCheck.length) return []
    
    // Build a Set of all manufacturer IDs present in the products
    const productManufacturerIds = new Set<string>()
    
    productsToCheck.forEach(p => {
      // Extract manufacturer ID using the makerIdOf utility
      const makerId = makerIdOf(p)
      if (makerId) {
        productManufacturerIds.add(makerId)
      }
    })
    
    // Debug logging
    if (import.meta.env.DEV) {
      console.log('[ManufacturerFilter] Products to check:', productsToCheck.length)
      console.log('[ManufacturerFilter] Unique manufacturer IDs in products:', Array.from(productManufacturerIds))
      console.log('[ManufacturerFilter] Total manufacturers available:', manufacturers.length)
      console.log('[ManufacturerFilter] Sample product:', productsToCheck[0])
      console.log('[ManufacturerFilter] Sample product makerIdOf:', makerIdOf(productsToCheck[0]))
      console.log('[ManufacturerFilter] Sample manufacturer:', manufacturers[0])
    }
    
    // If no manufacturer IDs found, return empty (don't show any)
    if (productManufacturerIds.size === 0) {
      console.warn('[ManufacturerFilter] No manufacturer IDs found in products')
      return []
    }
    
    // Filter manufacturers to only those present in products
    const filtered = manufacturers.filter(m => {
      // Check all possible ID fields in manufacturer
      const mSalerId = String((m as any)?.saler_id ?? '')
      const mId = String(m.id ?? '')
      const mMakerId = String((m as any)?.maker_id_ ?? '')
      const mMakerId2 = String((m as any)?.maker_id ?? '')
      const mManufacturerId = String((m as any)?.manufacturer_id ?? '')
      
      // Check if any of these IDs match
      return (mSalerId && productManufacturerIds.has(mSalerId)) ||
             (mId && productManufacturerIds.has(mId)) ||
             (mMakerId && productManufacturerIds.has(mMakerId)) ||
             (mMakerId2 && productManufacturerIds.has(mMakerId2)) ||
             (mManufacturerId && productManufacturerIds.has(mManufacturerId))
    })
    
    if (import.meta.env.DEV) {
      console.log('[ManufacturerFilter] Filtered manufacturers:', filtered.length)
      if (filtered.length > 0) {
        console.log('[ManufacturerFilter] First filtered manufacturer:', filtered[0])
      }
    }
    
    return filtered
  }, [manufacturers, products])

  // Helper to enhance product UI data with manufacturer info from loaded list
  const enhanceWithManufacturerData = useCallback((ui: ReturnType<typeof mapApiToUi>, _raw: any) => {
    if (!ui.makerId || !manufacturers.length) return ui
    
    // Find manufacturer by saler_id (prioritize) or fallback to maker_id_
    const manufacturer = manufacturers.find(m => {
      const mSalerId = String((m as any)?.saler_id ?? '')
      const mId = String(m.id ?? (m as any)?.maker_id_ ?? (m as any)?.maker_id ?? (m as any)?.manufacturer_id ?? '')
      // Match by saler_id first, then fallback to other IDs
      return (mSalerId && mSalerId === ui.makerId) || (mId && mId === ui.makerId)
    })
    
    if (manufacturer) {
      const makerImg = manufacturerImageFrom(manufacturer) || ui.makerImage
      const makerNm = String(manufacturer.name || manufacturer.title || (manufacturer as any)?.maker_name || ui.makerName || '').trim()
      return { ...ui, makerImage: makerImg, makerName: makerNm }
    }
    
    return ui
  }, [manufacturers])

  // Re-enhance selected product when manufacturers become available
  useEffect(() => {
    if (selected && selectedRaw && manufacturers.length && !manufacturersLoading) {
      const enhanced = enhanceWithManufacturerData(selected, selectedRaw)
      if (enhanced.makerImage !== selected.makerImage || enhanced.makerName !== selected.makerName) {
        setSelected(enhanced)
      }
    }
  }, [manufacturers, manufacturersLoading, enhanceWithManufacturerData])

  const renderManufacturers = (className = 'mt-4') => (
    <div className={className}>
      <ManufacturerSelector
        manufacturers={manufacturersWithProducts}
        loading={manufacturersLoading}
        selectedId={selectedManufacturerId || null}
        onSelect={handleManufacturerSelect}
        title="Shop by manufacturer"
      />
      {manufacturersError && (
        <div className="mt-2 text-[11px] text-red-600">{manufacturersError}</div>
      )}
      {hasManufacturerFilter && selectedManufacturerName && (
        <div className="mt-2 text-[12px] text-gray-700 break-words">
          Showing parts from <span className="font-semibold text-brand">{selectedManufacturerName}</span>
        </div>
      )}
    </div>
  )

  // Load catalog + categories
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          setLoading(true)
          const [all, cats] = await Promise.allSettled([getAllProducts(), getAllCategories()])
          if (!alive) return
          if (all.status === 'fulfilled') setProducts(Array.isArray(all.value) ? all.value : [])
          if (cats.status === 'fulfilled') setCategories(Array.isArray(cats.value) ? cats.value : [])
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => { alive = false }
  }, [])

  // Attempt live search when q is present and no selected product yet
  useEffect(() => {
    let alive = true
    if (!q || pid) return
      ; (async () => {
        try {
          const res = await liveSearch(q)
          if (!alive) return
          const list = Array.isArray(res) ? res : (res as any)?.data
          const items = Array.isArray(list) ? list : []
          if (items.length > 0) {
            const first = items[0]
            const firstId = String((first as any)?.product_id || (first as any)?.id || '')
            // Avoid navigation loop if pid already matches
            if (!firstId || firstId === pid) return
            const brandSlug = brand ? toSlug(brand) : toSlug(brandOf(first)) || 'gapa'
            const partSlug = part ? toSlug(part) : toSlug(categoryOf(first)) || 'parts'
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('pid', firstId)
              next.delete('q')
              return next
            }, { replace: true })
            navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(firstId)}`, { replace: true })
          }
        } catch { }
      })()
    return () => { alive = false }
  }, [q, pid, brand, part, setSearchParams, navigate])

  // Filter strictly by section/category when only part provided
  const scoped = useMemo(() => {
    const list = products
    return list.filter((p) => {
      const b = toSlug(brandOf(p))
      const c = toSlug(categoryOf(p))
      if (brand && part) {
        return b === toSlug(brand) && c === toSlug(part)
      }
      if (!brand && part) {
        return c === toSlug(part) // strict section scope
      }
      return true
    })
  }, [products, brand, part])

  // Apply vehicle compatibility only (facets disabled in this view)
  const filtered = useMemo(() => {
    let list = scoped
    if (hasManufacturerFilter) {
      list = list.filter((p) => makerIdOf(p) === selectedManufacturerId)
    }
    if (hasVehicleFilter) {
      list = list.filter(productMatchesVehicle)
    }
    return list
  }, [scoped, hasManufacturerFilter, selectedManufacturerId, hasVehicleFilter, vehFilter])

  const zeroResults = !loading && filtered.length === 0

  // Fetch details + related when pid is present (selected product) - incremental strategy
  useEffect(() => {
    let alive = true
    const relAbort = new AbortController()
    const location = (window as any).history?.state?.usr
    
    ;(async () => {
      try {
        if (!pid) { setSelected(null); setSelectedRaw(null); setRelated([]); setReviews([]); return }
        setRelatedLoading(true)
        
        // Try to get product data from navigation state or local products array
        let detail: any = location?.productData
        if (!detail) {
          detail = products.find(p => String((p as any)?.product_id ?? (p as any)?.id) === pid)
        }
        
        // Determine if we should fetch from API based on category
        const categoryName = detail ? categoryOf(detail) : ''
        const shouldFetchDetails = isViewEnabledCategory(categoryName)
        
        // 1. Fetch detail from API ONLY for Car Parts & Car Electricals
        if (shouldFetchDetails) {
          try {
            detail = await getProductById(pid)
          } catch (err) {
            console.error('Failed to fetch product details:', err)
            // If API fails but we have local data, use it
            if (!detail) {
              if (!alive) return
              setSelected(null)
              setSelectedRaw(null)
              setRelated([])
              setReviews([])
              setRelatedLoading(false)
              return
            }
          }
        } else if (!detail) {
          // No local data and category doesn't support API fetch
          console.warn('No product data available for pid:', pid)
          if (!alive) return
          setSelected(null)
          setSelectedRaw(null)
          setRelated([])
          setReviews([])
          setRelatedLoading(false)
          return
        }
        
        if (!alive) return
        setSelectedRaw(detail)
        // Schedule mapping after next frame to unblock paint
        requestAnimationFrame(() => { 
          if (alive) {
            const mapped = mapApiToUi(detail)
            setSelected(enhanceWithManufacturerData(mapped, detail))
          }
        })
        
        // 2. Kick off related fetch in background (for ALL categories)
        ;(async () => {
          try {
            const rel = await getRelatedProducts(pid)
            if (!alive || relAbort.signal.aborted) return
            setRelated(Array.isArray(rel) ? rel.slice(0, RELATED_LIMIT) : [])
          } catch (err) {
            console.error('Related products fetch error:', err)
            if (!alive) return
            setRelated([])
          } finally {
            if (alive) setRelatedLoading(false)
          }
        })()
        
        // 3. Fetch reviews in background (for ALL products)
        ;(async () => {
          try {
            setReviewsLoading(true)
            const reviewsData = await getProductReviews(pid)
            if (!alive || relAbort.signal.aborted) return
            setReviews(Array.isArray(reviewsData) ? reviewsData : [])
          } catch {
            if (!alive) return
            setReviews([])
          } finally {
            if (alive) setReviewsLoading(false)
          }
        })()
      } catch {
        if (!alive) return
        setSelected(null)
        setSelectedRaw(null)
        setRelated([])
        setReviews([])
        setRelatedLoading(false)
      }
    })()
    return () => { alive = false; relAbort.abort() }
  }, [pid, products, enhanceWithManufacturerData])

  // Frontend-related suggestions when search fails or related API fails
  const frontendRelated = useMemo(() => {
    const selectedId = String((selectedRaw && ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw)?.product_id) || (selectedRaw && ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw)?.id) || '')
    const basePool = scoped.length ? scoped : products

    // If there is a query, try token-based scoring against titles
    const tokens = (q || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    if (tokens.length) {
      const scored = basePool
        .filter((p) => String((p as any)?.id ?? (p as any)?.product_id ?? '') !== selectedId)
        .map((p, i) => {
          const title = String((p as any)?.name || (p as any)?.title || (p as any)?.product_name || '').toLowerCase()
          const score = tokens.reduce((acc, t) => acc + (title.includes(t) ? 1 : 0), 0)
          return { p, score, i }
        })
      scored.sort((a, b) => (b.score - a.score) || (a.i - b.i))
      const anyHit = scored.some(s => s.score > 0)
      const picked = (anyHit ? scored.filter(s => s.score > 0) : scored).slice(0, 8).map(s => s.p)
      return picked
    }

    // Else, derive by similarity (same category/brand) if we have a selected product or URL part/brand
    const wantBrand = brand ? toSlug(brand) : (selectedRaw ? toSlug(brandOf(selectedRaw)) : '')
    const wantPart = part ? toSlug(part) : (selectedRaw ? toSlug(categoryOf(selectedRaw)) : '')
    const similar = basePool.filter((p) => {
      const b = toSlug(brandOf(p))
      const c = toSlug(categoryOf(p))
      const sameCat = wantPart ? c === wantPart : true
      const sameBrand = wantBrand ? b === wantBrand : true
      const notSelf = String((p as any)?.product_id ?? (p as any)?.id ?? '') !== selectedId
      return notSelf && (sameCat || sameBrand)
    })
    return similar.slice(0, 8)
  }, [products, q, scoped, selectedRaw, brand, part])

  const finalRelated = (related && related.length) ? related : frontendRelated
  const manufacturerFilteredFinalRelated = useMemo(() => {
    if (!hasManufacturerFilter) return finalRelated
    
    if (import.meta.env.DEV) {
      console.log('[ManufacturerFilter] Filtering related products')
      console.log('[ManufacturerFilter] Selected manufacturer ID:', selectedManufacturerId)
      console.log('[ManufacturerFilter] Total related products:', finalRelated.length)
      console.log('[ManufacturerFilter] Sample related product:', finalRelated[0])
    }
    
    const filtered = finalRelated.filter((p) => {
      const productMakerId = makerIdOf(p)
      const matches = productMakerId === selectedManufacturerId
      
      if (import.meta.env.DEV && finalRelated.indexOf(p) < 2) {
        console.log('[ManufacturerFilter] Product maker ID:', productMakerId, 'Matches:', matches)
      }
      
      return matches
    })
    
    if (import.meta.env.DEV) {
      console.log('[ManufacturerFilter] Filtered related products:', filtered.length)
    }
    
    return filtered
  }, [finalRelated, hasManufacturerFilter, selectedManufacturerId])
  const compatibleRelated = useMemo(() => manufacturerFilteredFinalRelated.filter(productMatchesVehicle), [manufacturerFilteredFinalRelated, vehFilter])
  // NEW: ensure uniqueness of related products by id to avoid duplicate key warnings
  const uniqueFinalRelated = useMemo(() => {
    const seen = new Set<string>()
    return manufacturerFilteredFinalRelated.filter((p: any) => {
      const id = String(p?.product_id ?? p?.id ?? '')
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [manufacturerFilteredFinalRelated])
  // NEW: ensure uniqueness for compatible related products (vehicle‑filtered)
  const uniqueCompatibleRelated = useMemo(() => {
    const seen = new Set<string>()
    return compatibleRelated.filter((p: any) => {
      const id = String(p?.product_id ?? p?.id ?? '')
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [compatibleRelated])
  const compatSlice = useMemo(() => uniqueCompatibleRelated.slice(0, visibleCompatCount), [uniqueCompatibleRelated, visibleCompatCount])
  const relatedSlice = useMemo(() => uniqueFinalRelated.slice(0, visibleRelatedCount), [uniqueFinalRelated, visibleRelatedCount])

  // When a user clicks a result, request details, then navigate and update pid
  const onViewProduct = async (id: string, p: any) => {
    // Only fetch details for view-enabled categories (Car Parts & Car Electricals)
    const categoryName = categoryOf(p)
    const shouldFetchDetails = isViewEnabledCategory(categoryName)
    
    if (shouldFetchDetails) {
      try { await getProductById(id) } catch { /* ignore view errors */ }
    }
    
    const brandSlug = toSlug(brandOf(p) || brand || '') || (brand ? toSlug(brand) : 'gapa')
    const partSlug = toSlug(categoryOf(p) || part || '') || (part ? toSlug(part) : 'parts')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('q')
      next.set('pid', id)
      return next
    }, { replace: true })
    // Pass product data via state for non-view-enabled categories
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(id)}`, {
      state: { productData: p },
      replace: true
    })
  }

  // Map to UI and optionally highlight selection
  const results = useMemo(() => filtered.map((p, i) => ({
    id: String(p?.product_id ?? p?.id ?? i),
    title: String(p?.part_name || p?.name || p?.title || p?.product_name || 'Car Part'),
    image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg,
    rating: Number(p?.rating || 4),
    price: Number(p?.price || p?.selling_price || p?.amount || 0),
    inStock: Boolean(p?.in_stock ?? true),
    raw: p,
  })), [filtered])

  // Breadcrumb part label: if URL part looks like an ID, resolve name from categories using selected product's category id
  const breadcrumbPartLabel = useMemo(() => {
    const looksNumeric = part ? /^\d+$/.test(part) : false
    if (!looksNumeric && part) return titleCase(part)
    const raw = selectedRaw && (selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw
    const catId = raw && raw.category ? String(raw.category) : (part || '')
    const match = categories.find((c) => String(c.id) === String(catId))
    if (match) return String((match as any).name || (match as any).title || part || '')
    return part ? titleCase(part) : 'Car Parts'
  }, [part, selectedRaw, categories])

  // Category image derived from selected product/category list
  const categoryImage = useMemo(() => {
    // Prefer selected product's category
    const raw = selectedRaw && (selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw
    const catFromSelected = raw ? (typeof raw.category === 'object' ? raw.category : categories.find((c) => String(c.id) === String(raw?.category))) : undefined
    const imgFromSelected = catFromSelected ? (categoryImageFrom(catFromSelected) || normalizeApiImage(pickImage(catFromSelected) || '')) : undefined
    if (imgFromSelected) return imgFromSelected
    // Else, try to match by URL part slug
    if (part) {
      const match = categories.find((c) => toSlug(String((c as any)?.name || (c as any)?.title || '')) === toSlug(part))
      const img = match ? (categoryImageFrom(match) || normalizeApiImage(pickImage(match) || '')) : undefined
      if (img) return img
    }
    return undefined
  }, [selectedRaw, categories, part])

  // Selected product compatibility
  const selectedCompatible = useMemo(() => {
    return selectedRaw ? productMatchesVehicle(selectedRaw) : true
  }, [selectedRaw, vehFilter])

  const ProductPanel = ({ ui, isSelected, raw, onSelect }: { ui: ReturnType<typeof mapApiToUi>; isSelected?: boolean; raw?: any; onSelect?: (id: string, raw: any) => void }) => {
    // Derive pairs flag and selected raw source for the main (selected) product
    const rawSrc = raw ? (raw?.part ? raw.part : raw) : ((isSelected && selectedRaw) ? ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw) : undefined)
    const rawPairsVal = rawSrc ? (rawSrc?.pairs ?? rawSrc?.sold_in_pairs ?? rawSrc?.pair ?? rawSrc?.is_pair) : undefined
    const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
    const pairsYes = Boolean(isSelected && (rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'))

    const [qty, setQty] = useState(() => (pairsYes ? 2 : 1))
    const [activeIdx, setActiveIdx] = useState(0)
    const { user } = useAuth()
    const [adding, setAdding] = useState(false)
    const [showPopup, setShowPopup] = useState(false)

    // Wishlist status for this item
    const wished = wishlistHas(ui.id)

    // Removed old expand/collapse booleans in favor of tabbed/accordion UI

    // Heavy parsing only when viewing the main selected product; skip for related list items
    const compatList = useMemo(() => {
      if (!rawSrc || !isSelected) return [] as string[]
      // ...existing code...
      const src: any = rawSrc
      const comp = src?.compatibility ?? src?.compatibilities ?? src?.vehicle_compatibility ?? src?.vehicleCompatibility ?? src?.fitment ?? src?.fitments
      const out: string[] = []
      const pushItem = (item: any) => {
        if (!item) return
        if (typeof item === 'string') { item.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return }
        if (Array.isArray(item)) { item.forEach(pushItem); return }
        if (typeof item === 'object') { Object.values(item).forEach(pushItem as any); return }
        out.push(String(item))
      }
      pushItem(comp)
      return Array.from(new Set(out))
    }, [rawSrc, isSelected])

    type CompatTree = Record<string, Record<string, string[]>>
    const compatTree = useMemo<CompatTree>(() => {
      if (!isSelected) return {} as CompatTree
      // ...existing code...
      const tree: CompatTree = {}
      let currentMaker = 'Other'
      const up = (s: string) => s.trim().toUpperCase()
      const stripBullets = (s: string) => s.replace(/^[\s\t•·\-\u2022]+/, '').trim()
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      for (let raw of compatList) {
        if (!raw) continue
        let s = stripBullets(raw).replace(/\s+/g, ' ')
        if (!s) continue
        const isMakerHeader = /^[A-Z][A-Z\s\-&/]+$/.test(s) && !/[()]/.test(s) && !/\d{2}\.\d{4}/.test(s) && s.length <= 40
        if (isMakerHeader) { currentMaker = s; if (!tree[currentMaker]) tree[currentMaker] = {}; continue }
        const tokens = s.split(/\s+/)
        if (currentMaker && new RegExp('^' + esc(currentMaker) + '\\b', 'i').test(up(s))) {
          s = s.replace(new RegExp('^' + esc(currentMaker) + '\\s+', 'i'), '')
        } else {
          const guess = tokens[0]
            ; (currentMaker = guess)
          if (!tree[currentMaker]) tree[currentMaker] = {}
          s = s.replace(new RegExp('^' + esc(guess) + '\\s+', 'i'), '')
        }
        let model = s
        let rest = ''
        const upper = s.toUpperCase()
        const yearIdx = upper.indexOf('YEAR OF CONSTRUCTION')
        const parenIdx = s.indexOf('(')
        const commaIdx = s.indexOf(',')
        const stopIdx = yearIdx >= 0 ? yearIdx : (parenIdx >= 0 ? parenIdx : (commaIdx >= 0 ? commaIdx : -1))
        if (stopIdx > 0) {
          model = s.slice(0, stopIdx).trim()
          rest = s.slice(stopIdx).trim()
        }
        if (!model) model = s
        if (!tree[currentMaker][model]) tree[currentMaker][model] = []
        if (rest) tree[currentMaker][model].push(rest)
      }
      return tree
    }, [compatList, isSelected])

    const oemList = useMemo(() => {
      if (!rawSrc || !isSelected) return [] as string[]
      const src: any = rawSrc
      // Check multiple possible OEM field names
      const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList ?? src?.OEM ?? src?.OEM_NO
      const out: string[] = []
      const push = (v: any) => {
        if (!v) return
        if (typeof v === 'string') { 
          // Split by newlines, commas, semicolons, and spaces
          v.split(/[\n,;\s]+/).map((s) => s.trim()).filter(s => s.length > 0).forEach((s) => out.push(s))
          return
        }
        if (Array.isArray(v)) { v.forEach(push); return }
        if (typeof v === 'object') { Object.values(v).map((x) => String(x).trim()).filter(Boolean).forEach((x) => out.push(x)); return }
        out.push(String(v))
      }
      push(o)
      return Array.from(new Set(out)).filter(s => s && s !== 'null' && s !== 'undefined')
    }, [rawSrc, isSelected])

    const [copiedOEM, setCopiedOEM] = useState<number | null>(null)
    // Removed unused infoTab state that previously controlled tab UI
    // const [infoTab, setInfoTab] = useState<'vehicles' | 'oem'>('vehicles')

    const inc = () => setQty((v) => (pairsYes ? 2 : Math.min(v + 1, 99)))
    const dec = () => setQty((v) => (pairsYes ? 2 : Math.max(v - 1, 1)))
    const mainImage = ui.gallery[activeIdx] || ui.image

    const onAddToCart = async () => {
      if (adding) return
      setAdding(true)
      try {
        const effQty = isSelected ? (pairsYes ? 2 : 1) : qty
        if (user && user.id) {
          await addToCartApi({ user_id: user.id, product_id: ui.id, quantity: effQty })
        } else {
          addGuestCartItem(ui.id, effQty)
        }
        setShowPopup(true)
        // Open global cart popup
        navigate({ hash: '#cart' })
        setTimeout(() => setShowPopup(false), 1200)
      } catch (e) {
        setShowPopup(true)
        navigate({ hash: '#cart' })
        setTimeout(() => setShowPopup(false), 1200)
      } finally {
        setAdding(false)
      }
    }

    return (
  <div className="overflow-hidden rounded-xl bg-white p-4 ring-1 ring-black/10">
        {/* Warning */}
        {hasVehicleFilter && !selectedCompatible && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
            This product may not fit your selected vehicle. See compatible alternatives below or reset your vehicle.
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-7">
          <aside className="rounded-lg p-6 row-span-2 lg:col-span-3">
            <div className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6 ${onSelect && !isSelected ? 'cursor-pointer hover:opacity-90' : ''}`}
              onClick={() => { if (onSelect && !isSelected) onSelect(ui.id, raw) }}>
              <ImageWithFallback src={mainImage} alt={ui.name} className="h-[320px] w-auto object-contain" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {ui.gallery.map((g, i) => (
                <button key={`g-${ui.id}-${i}`} onClick={() => setActiveIdx(i)} className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10 ${i === activeIdx ? 'outline-2 outline-accent' : ''}`} aria-label={`Preview ${i + 1}`}>
                  <ImageWithFallback src={g} alt={`Preview ${i + 1}`} className="h-14 w-auto object-contain" />
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-3 col-span-2">
            <div className="flex items-start gap-2">
              <p className='font-semibold'>Article No: {ui.articleNo}</p>
              <div className="ml-auto flex items-center gap-2">
                <WishlistButton ariaLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'} size={22} active={wished} onToggle={(active) => { wishlistToggle(ui.id); if (active) toast.success('Added to wishlist') }} />

              </div>
            </div>
            {ui.makerId && ui.makerId !== 'null' && (ui.makerImage || ui.makerName) && (
              <div className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-black/10">
                {ui.makerImage && <ImageWithFallback src={ui.makerImage} alt={ui.makerName || 'Manufacturer'} className="h-12 w-12 object-contain" />}
                {ui.makerName && (
                  <div className="text-[12px] text-gray-600">
                    <span className="font-medium">Manufacturer:</span> {ui.makerName}
                  </div>
                )}
              </div>
            )}
            <h2 className="text-[18px] font-semibold text-gray-900">
              {onSelect && !isSelected ? (
                <button type="button" onClick={() => onSelect(ui.id, raw)} className="text-left hover:underline focus:outline-none">
                  {ui.name}
                </button>
              ) : ui.name}
            </h2>
            <div className="grid grid-cols-1 gap-1">
              {ui.attributes.map((a) => (
                <div key={a.label + a.value} className="grid grid-cols-1 text-[13px] sm:grid-cols-[160px_1fr]">
                  <div className="rounded-t-md bg-[#FBF5E9] pl-3 py-1.5 font-medium text-gray-800 sm:rounded-l-md sm:rounded-tr-none">{a.label}</div>
                  <div className="rounded-b-md bg-[#FBF5E9] px-0 py-1.5 text-gray-700 break-words sm:rounded-r-md sm:rounded-bl-none">{a.value}</div>
                </div>
              ))}
              <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
            </div>
          </div>

          <aside className="rounded-lg bg-white col-span-2 px-1">
            <div className="text-right">
              <div className="text-[22px] font-bold text-gray-900">₦{ui.price.toLocaleString('en-NG')}</div>
              <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button aria-label="Decrease" onClick={dec} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">‹</button>
              <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
              <button aria-label="Increase" onClick={inc} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">›</button>
            </div>
            {isSelected && pairsYes && (
              <div className="mt-1 text-center text-[11px] text-gray-600">Ships in pairs. Add to cart will add 2 units.</div>
            )}
            <button onClick={onAddToCart} disabled={adding} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658] disabled:opacity-60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              {adding ? 'Adding…' : 'Add to cart'}
            </button>
{isSelected && (() => {
              // Only show "View Full Details" for CAR PARTS and CAR ELECTRICALS
              const productCategoryRaw = rawSrc ? categoryOf(rawSrc) : ''
              
              // Resolve category ID to category name
              let categoryName = productCategoryRaw
              if (/^\d+$/.test(productCategoryRaw)) {
                // It's a category ID, look up the name from categories array
                const categoryId = productCategoryRaw
                const categoryObj = categories.find(c => String(c.id) === categoryId)
                categoryName = categoryObj ? String(categoryObj.title || categoryObj.name || '').trim().toUpperCase() : ''
              } else {
                // It's already a name, normalize it
                categoryName = productCategoryRaw.trim().toUpperCase()
              }
              
              const shouldShowFullDetails = isViewEnabledCategory(categoryName)
              return shouldShowFullDetails ? (
                <Link to={`/product/${ui.id}?from=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white text-[13px] font-medium text-gray-900 ring-1 ring-black/10 hover:bg-gray-50">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  View Full Details
                </Link>
              ) : null
            })()}
            {!isSelected && onSelect && (
              <button type="button" onClick={() => onSelect(ui.id, raw)} className="mt-2 w-full rounded-md bg-white text-[12px] font-medium text-accent underline-offset-2 hover:underline">View details</button>
            )}
            <div className="mt-2 text-center text-[12px] text-purple-700">{ui.inStock ? 'In Stock' : 'Out of stock'}</div>
          </aside>
          {/* Full-width sections: Description + Collapsible panels */}
          <div className="mt-5 space-y-4 lg:col-span-4">
            {ui.description && (
              <section className="rounded-lg bg-[#F6F5FA] p-4 ring-1 ring-black/10">
                <h3 className="text-[14px] font-semibold text-gray-900">Description</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{ui.description}</p>
              </section>
            )}
            {/* Collapsible Suitable Vehicles */}
            {Object.keys(compatTree).length > 0 && (
              <details className="rounded-lg bg-white ring-1 ring-black/10">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-gray-900">Suitable vehicles</summary>
                <div className="max-h-96 overflow-auto p-3 pt-0">
                  <div className="space-y-3">
                    {Object.values(compatTree).every(models => Object.keys(models).length === 0) ? (
                      <ul className="list-disc pl-5 text-[12px] text-gray-800">
                        {compatList.map((c, i) => (<li key={`compat-${i}`}>{c}</li>))}
                      </ul>
                    ) : (
                      <div className="space-y-3">
                        {Object.keys(compatTree).sort().map((maker) => {
                          const models = compatTree[maker] || {}
                          return (
                            <details key={`maker-${maker}`} className="rounded-md border border-black/10 bg-[#F6F5FA] p-0">
                              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] font-semibold text-gray-900">
                                <span>{maker}</span>
                                <span className="text-gray-500">▾</span>
                              </summary>
                              <div className="px-3 pb-3">
                                {Object.keys(models).sort().map((model) => {
                                  const detailsList = models[model]
                                  return (
                                    <details key={`model-${maker}-${model}`} className="mb-2 rounded border border-black/10 bg-white">
                                      <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[12px] font-medium text-gray-900">
                                        <span>{model}</span>
                                        <span className="text-gray-500">▾</span>
                                      </summary>
                                      <div className="px-3 pb-2">
                                        {detailsList && detailsList.length > 0 ? (
                                          <ul className="list-disc pl-5 text-[12px] text-gray-800">
                                            {detailsList.map((d, i) => (<li key={`det-${maker}-${model}-${i}`}>{d}</li>))}
                                          </ul>
                                        ) : (
                                          <div className="text-[12px] text-gray-600">No additional details</div>
                                        )}
                                      </div>
                                    </details>
                                  )
                                })}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </details>
            )}
            {/* Collapsible OEM Numbers */}
            {oemList.length > 0 && (
              <details className="rounded-lg bg-white ring-1 ring-black/10">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-gray-900">OEM Part Numbers</summary>
                <div className="p-3 pt-0">
                  <div className="mt-1 flex flex-wrap gap-2">
                    {oemList.map((code, i) => (
                      <span key={`oem-${i}`} className="inline-flex items-center gap-2 rounded bg-[#F6F5FA] px-2 py-1 text-[12px] ring-1 ring-black/10">
                        <span>{code}</span>
                        <button
                          type="button"
                          className="inline-flex items-center rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-black/10 hover:bg-gray-50"
                          onClick={async () => {
                            try { await navigator.clipboard.writeText(code); setCopiedOEM(i); setTimeout(() => setCopiedOEM((prev) => (prev === i ? null : prev)), 1200) } catch {}
                          }}
                          aria-label={`Copy ${code}`}
                        >{copiedOEM === i ? 'Copied' : 'Copy'}</button>
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
        {/* Popup */}
        {showPopup && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg ring-1 ring-black/20">
            <div className="flex items-center gap-2 text-[14px]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span>Added to cart</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Page layout
  return (
  <div className="mx-auto w-full max-w-6xl px-3 py-4 overflow-x-hidden">
      {/* Breadcrumbs */}
      <nav className="mb-4 text-[12px] text-gray-600">
        <Link to="/" className="hover:text-gray-900">Home</Link>
        <span className="mx-1">/</span>
        <Link to="/parts" className="hover:text-gray-900">Car Parts</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{breadcrumbPartLabel}</span>
      </nav>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 self-start">
            {/* Vehicle Filter Card */}
            <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
              <div className="rounded-[10px] bg-white p-2">
                <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0]">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] shadow-md">
                      <svg className="h-5 w-5 text-[#201A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </div>
                    <h3 className="text-[12px] font-black uppercase tracking-wide text-gray-900">
                      Filter by Vehicle
                    </h3>
                  </div>
                  
                  <VehicleFilter onChange={handleVehFilterChange} />
                  
                  {/* Active Selection Badge */}
                  {hasVehicleFilter && (
                    <div className="mt-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                      <div className="flex items-start gap-2">
                        <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                          <div className="text-[11px] font-bold text-gray-900 break-words">{selectedVehicleLabel}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {categoryImage && (
              <div className="rounded-xl bg-white p-3 ring-1 ring-black/10 shadow-sm">
                <ImageWithFallback src={categoryImage} alt="Category" className="mx-auto h-28 w-auto object-contain" showFallback={true} />
              </div>
            )}
          </div>
        </aside>

        <main className="space-y-6 min-w-0">
          <div className="lg:hidden">
            <div className="sticky top-16 z-20 mb-4 flex items-center justify-between rounded-full bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(true)}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-3 py-2 text-[12px] font-semibold uppercase tracking-wide text-white shadow"
                aria-expanded={isMobileFilterOpen}
                aria-controls="vehicle-filter-drawer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-90">
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h10" />
                </svg>
                Vehicle filter
              </button>
              <span className="ml-3 line-clamp-1 text-[12px] font-medium text-gray-700">{selectedVehicleLabel}</span>
            </div>
            {categoryImage && (
              <div className="mb-4 rounded-lg bg-[#F6F5FA] p-3 ring-1 ring-black/10">
                <ImageWithFallback src={categoryImage} alt="Category" className="mx-auto h-24 w-auto object-contain" showFallback={true} />
              </div>
            )}
          </div>
          {renderManufacturers('mt-0')}
          {selected && selectedRaw ? (
            <>
              <ProductPanel ui={selected} isSelected raw={selectedRaw} />
              
              {/* Product Reviews Section */}
              <section className="rounded-xl bg-white p-6 ring-1 ring-black/10">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Customer Reviews</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {reviews.length > 0 ? `${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
                    </p>
                  </div>
                  {reviews.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {Array.from({ length: 5 }).map((_, i) => {
                          const avgRating = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length
                          return (
                            <svg
                              key={i}
                              className={`h-5 w-5 ${i < Math.round(avgRating) ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          )
                        })}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{(reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length).toFixed(1)}</span>
                    </div>
                  )}
                </div>

                {reviewsLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="animate-pulse space-y-3 rounded-lg bg-gray-50 p-4">
                        <div className="h-4 w-1/4 rounded bg-gray-200" />
                        <div className="h-3 w-full rounded bg-gray-200" />
                        <div className="h-3 w-3/4 rounded bg-gray-200" />
                      </div>
                    ))}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="rounded-lg bg-gradient-to-br from-gray-50 to-white p-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <h4 className="text-base font-medium text-gray-900">No reviews yet</h4>
                    <p className="mt-1 text-sm text-gray-600">Be the first to share your experience with this product</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(showAllReviews ? reviews : reviews.slice(0, 3)).map((review, idx) => {
                      const userName = review.name || review.user?.name || 'Anonymous'
                      const rating = Number(review.rating || 0)
                      const reviewText = review.review || ''
                      const date = review.created_at ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
                      
                      return (
                        <div key={idx} className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50/50 p-4 shadow-sm transition-shadow hover:shadow-md">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#F7CD3A]/20 text-sm font-semibold text-gray-900 ring-2 ring-[#F7CD3A]/30">
                                {userName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-semibold text-gray-900">{userName}</h4>
                                  {date && <span className="text-xs text-gray-500">{date}</span>}
                                </div>
                                <div className="mt-1 flex items-center gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
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
                            </div>
                          </div>
                          <p className="mt-3 text-sm leading-relaxed text-gray-700">{reviewText}</p>
                        </div>
                      )
                    })}
                    
                    {reviews.length > 3 && (
                      <button
                        onClick={() => setShowAllReviews(!showAllReviews)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        {showAllReviews ? 'Show Less' : `View All ${reviews.length} Reviews`}
                      </button>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Results</h3>
                <span className="text-[12px] text-gray-600">{results.length} items</span>
              </div>
              {zeroResults ? (
                <div className="space-y-2 text-[13px] text-gray-700">
                  <p>No products match your current selection.</p>
                  {hasManufacturerFilter && (
                    <button
                      type="button"
                      onClick={() => handleManufacturerSelect(null)}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1 text-[12px] font-medium text-accent ring-1 ring-black/10 hover:bg-[#F6F5FA]"
                    >
                      Clear manufacturer filter
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3">
                  {results.map((r) => (
                    <button key={r.id} onClick={() => onViewProduct(r.id, r.raw)} className="text-left">
                      <div className="rounded-lg bg-white p-2 ring-1 ring-black/10 hover:shadow">
                        <div className="flex items-center justify-center rounded bg-[#F6F5FA] p-3">
                          {/* Use fallback component to prevent infinite reload loop */}
                          <ImageWithFallback src={r.image} alt={r.title} className="h-28 w-auto object-contain" />
                        </div>
                        <div className="mt-2 text-[12px] font-medium text-gray-900 line-clamp-2">{r.title}</div>
                        <div className="mt-1 text-[12px] text-gray-600">₦{r.price.toLocaleString('en-NG')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Compatible alternatives first if available */}
          {selected && relatedLoading && (
            <section className="space-y-4 animate-pulse">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (<div key={`rel-skel-${i}`} className="h-32 rounded-lg bg-gray-100" />))}
              </div>
            </section>
          )}
          {selected && uniqueCompatibleRelated.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Compatible Alternatives</h3>
                <span className="text-[12px] text-gray-600">{uniqueCompatibleRelated.length}</span>
              </div>
              {compatSlice.map((p: any, idx: number) => {
                const id = String((p?.product_id ?? p?.id) ?? '')
                const ui = mapApiToUiCached(p)
                return (
                  <div key={`${id}-compat-${idx}`}>
                    <ProductPanel ui={ui} raw={p} onSelect={onViewProduct} />
                  </div>
                )
              })}
              {uniqueCompatibleRelated.length > compatSlice.length && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleCompatCount(c => Math.min(c + 10, uniqueCompatibleRelated.length))}
                    className="mx-auto flex items-center justify-center rounded-md bg-white px-4 py-2 text-[12px] font-medium text-accent ring-1 ring-black/10 hover:bg-[#F6F5FA]"
                  >View more ({uniqueCompatibleRelated.length - compatSlice.length})</button>
                </div>
              )}
            </section>
          )}

          {/* More related */}
          {selected && uniqueFinalRelated.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Related Products</h3>
                <span className="text-[12px] text-gray-600">{uniqueFinalRelated.length}</span>
              </div>
              {relatedSlice.map((p: any, idx: number) => {
                const id = String((p?.product_id ?? p?.id) ?? '')
                const ui = mapApiToUiCached(p)
                return (
                  <div key={`${id}-rel-${idx}`}>
                    <ProductPanel ui={ui} raw={p} onSelect={onViewProduct} />
                  </div>
                )
              })}
              {uniqueFinalRelated.length > relatedSlice.length && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setVisibleRelatedCount(c => Math.min(c + 10, uniqueFinalRelated.length))}
                    className="mx-auto flex items-center justify-center rounded-md bg-white px-4 py-2 text-[12px] font-medium text-accent ring-1 ring-black/10 hover:bg-[#F6F5FA]"
                  >View more ({uniqueFinalRelated.length - relatedSlice.length})</button>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileFilterOpen(false)}
            aria-label="Close vehicle filter"
          />
          <div
            id="vehicle-filter-drawer"
            className="relative ml-auto flex h-full w-full max-w-sm flex-col rounded-l-3xl bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <h2 className="text-[14px] font-semibold text-gray-900">Select your vehicle</h2>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600"
                aria-label="Close vehicle filter"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <VehicleFilter onChange={handleVehFilterChange} className="shadow-none ring-0" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
