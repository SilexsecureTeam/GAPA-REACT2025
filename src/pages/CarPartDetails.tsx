import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getAllProducts, liveSearch, getRelatedProducts, type ApiProduct, getProductById, getAllCategories, type ApiCategory, addToCartApi, type ApiManufacturer } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom } from '../services/images'
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
import { makerIdOf } from '../utils/productMapping'

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
  return { id, brand: brandName, brandLogo: brandLogo || logoImg, name, articleNo, price, image, gallery: gallery.length ? gallery : [image], rating, reviews, inStock, attributes, description }
}

// Stateful image component to avoid infinite onError loops where React keeps re-setting a broken src.
// Once a fallback is applied it persists until the original src prop changes.
function ImageWithFallback({ src, alt, className }: { src: string | undefined; alt: string; className?: string }) {
  const safeSrc = src || logoImg
  const [current, setCurrent] = useState(safeSrc)
  useEffect(() => { setCurrent(safeSrc) }, [safeSrc])
  return (
    <img
      src={current}
      alt={alt}
      className={className}
      onError={() => { if (current !== logoImg) setCurrent(logoImg) }}
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

  const handleManufacturerSelect = useCallback((manufacturer: ApiManufacturer | null) => {
    if (!manufacturer) {
      setSelectedManufacturerId('')
      setSelectedManufacturerName('')
      return
    }
    const rawId = manufacturer.id
      ?? (manufacturer as any)?.maker_id_
      ?? (manufacturer as any)?.maker_id
      ?? (manufacturer as any)?.manufacturer_id
    const id = rawId != null ? String(rawId) : ''
    setSelectedManufacturerId(id)
    const name = String(manufacturer.name || manufacturer.title || (manufacturer as any)?.maker_name || 'Manufacturer').trim()
    setSelectedManufacturerName(name)
  }, [])

  const renderManufacturers = (className = 'mt-4') => (
    <div className={className}>
      <ManufacturerSelector
        manufacturers={manufacturers}
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
    ;(async () => {
      try {
        if (!pid) { setSelected(null); setSelectedRaw(null); setRelated([]); return }
        setRelatedLoading(true)
        // 1. Fetch detail FIRST (do not wait for related) so UI renders immediately
        const detail = await getProductById(pid)
        if (!alive) return
        setSelectedRaw(detail)
        // Schedule mapping after next frame to unblock paint
        requestAnimationFrame(() => { if (alive) setSelected(mapApiToUi(detail)) })
        // 2. Kick off related fetch in background
        ;(async () => {
          try {
            const rel = await getRelatedProducts(pid)
            if (!alive || relAbort.signal.aborted) return
            setRelated(Array.isArray(rel) ? rel.slice(0, RELATED_LIMIT) : [])
          } catch {
            if (!alive) return
            setRelated([])
          } finally {
            if (alive) setRelatedLoading(false)
          }
        })()
      } catch {
        if (!alive) return
        setSelected(null)
        setSelectedRaw(null)
        setRelated([])
        setRelatedLoading(false)
      }
    })()
    return () => { alive = false; relAbort.abort() }
  }, [pid])

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
    return finalRelated.filter((p) => makerIdOf(p) === selectedManufacturerId)
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
    try { await getProductById(id) } catch { /* ignore view errors */ }
    const brandSlug = toSlug(brandOf(p) || brand || '') || (brand ? toSlug(brand) : 'gapa')
    const partSlug = toSlug(categoryOf(p) || part || '') || (part ? toSlug(part) : 'parts')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('q')
      next.set('pid', id)
      return next
    }, { replace: true })
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(id)}`)
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
      // ...existing code...
      const src: any = rawSrc
      const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList
      const out: string[] = []
      const push = (v: any) => {
        if (!v) return
        if (typeof v === 'string') { v.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return }
        if (Array.isArray(v)) { v.forEach(push); return }
        if (typeof v === 'object') { Object.values(v).map((x) => String(x).trim()).filter(Boolean).forEach((x) => out.push(x)); return }
        out.push(String(v))
      }
      push(o)
      return Array.from(new Set(out))
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
              <div className="ml-auto flex items-center gap-2">
                <WishlistButton ariaLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'} size={22} active={wished} onToggle={(active) => { wishlistToggle(ui.id); if (active) toast.success('Added to wishlist') }} />

              </div>
            </div>
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
                  <div className="rounded-t-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800 sm:rounded-l-md sm:rounded-tr-none">{a.label}</div>
                  <div className="rounded-b-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700 break-words sm:rounded-r-md sm:rounded-bl-none">{a.value}</div>
                </div>
              ))}
              <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
            </div>
          </div>

          <aside className="rounded-lg bg-white col-span-2">
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

      <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
        <aside>
          <VehicleFilter onChange={handleVehFilterChange} />
          {categoryImage && (
            <div className="mt-4 rounded-lg bg-[#F6F5FA] p-3 ring-1 ring-black/10">
              <ImageWithFallback src={categoryImage} alt="Category" className="mx-auto h-28 w-auto object-contain" />
            </div>
          )}
        </aside>

  <main className="space-y-6 min-w-0">
          {renderManufacturers('mt-0')}
          {selected && selectedRaw ? (
            <ProductPanel ui={selected} isSelected raw={selectedRaw} />
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
    </div>
  )
}
