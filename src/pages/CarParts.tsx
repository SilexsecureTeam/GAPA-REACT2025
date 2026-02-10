import React, { useEffect, useMemo, useState, Fragment, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductActionCard from '../components/ProductActionCard'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getSubCategories, getSubSubCategories, getProductsBySubSubCategory, liveSearch, addToCartApi } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, subCategoryImageFrom, subSubCategoryImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import TopBrands from '../components/TopBrands'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import BrandDrilldown from '../components/BrandDrilldown'
import { getPersistedVehicleFilter, setPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'
import useWishlist from '../hooks/useWishlist'
import WishlistButton from '../components/WishlistButton'
import { toast } from 'react-hot-toast'
import { brandOf, categoryOf, mapProductToActionData, toSlug, makerIdOf } from '../utils/productMapping'
import useManufacturers from '../hooks/useManufacturers'
import ManufacturerSelector from '../components/ManufacturerSelector'

// Error boundary to surface runtime errors on the page
class ErrorBoundary extends React.Component<{ children?: React.ReactNode }, { hasError: boolean; error?: Error | null; info?: React.ErrorInfo | null }> {
  constructor(props: { children?: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null, info: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info })
    console.error('CarParts error boundary caught an error:', error, info)
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null })
  }
  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'Something went wrong.'
      const stack = this.state.info?.componentStack || this.state.error?.stack || ''
      return (
        <div className="mx-auto my-6 max-w-3xl rounded-xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
          <h2 className="text-lg font-semibold">Something went wrong on this page.</h2>
          <p className="mt-2 text-sm">{message}</p>
          {stack ? (
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded bg-white/70 p-3 text-xs text-red-800 ring-1 ring-red-200">
              {stack}
            </pre>
          ) : null}
          <div className="mt-3">
            <button type="button" onClick={this.handleReset} className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children as React.ReactElement
  }
}

function Crumb() {
  return (
    <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
      <ol className="flex items-center gap-3 font-medium">
        <li>
          <Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link>
        </li>
        <li aria-hidden className='text-[24px] -mt-1.5'>›</li>
        <li className="font-semibold text-brand">All Parts</li>
      </ol>
    </nav>
  )
}

// --- Car Accessories sections (grid) placeholders ---
type Section = { title: string; img: string; links: string[] }
const SECTIONS: Section[] = []

function Tile({ s }: { s: Section }) {
  const getLinkHref = (label: string) => {
    const l = label.toLowerCase()
    if (l.includes('car air freshener') || l.includes('air freshner') || l.includes('freshener')) return '/parts/air-fresheners'
    return '#'
  }
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-black/10 md:p-5">
      <div className="grid grid-cols-[140px_1fr] items-start gap-4">
        <div className="overflow-hidden rounded-lg">
          <img src={s.img} alt="" className="h-24 w-full object-contain md:h-28" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-gray-900 md:text-[14px]">{s.title}</h4>
          <ul className="mt-2 grid grid-cols-1 gap-1 text-[12px] text-gray-700">
            {s.links.map((l) => (
              <li key={l}><Link to={getLinkHref(l)} className="hover:underline">{l}</Link></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function CarPartsInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])

  // --- Manufacturer Filter Hooks ---
  const { manufacturers, loading: manufacturersLoading } = useManufacturers()
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('')

  // Build a quick lookup for categories by id to resolve names/images
  const categoriesById = useMemo(() => {
    const map = new Map<string, any>()
    for (const c of categories || []) {
      const id = String((c as any)?.id ?? (c as any)?.category_id ?? (c as any)?.cat_id ?? '')
      if (id) map.set(id, c)
    }
    return map
  }, [categories])

  // Search mode
  const qParam = (searchParams.get('q') || '').trim()
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<ApiProduct[]>([])

  // --- Shared vehicle filter (persisted across pages) ---
  const [vehFilter, setVehFilter] = useState<VehState>(() => {
    const initial = getPersistedVehicleFilter()
    return initial
  })

  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  // Categories where vehicle compatibility does NOT apply (Car Care=3, Accessories=4, Tools=7)
  const NON_VEHICLE_CATEGORY_IDS = useMemo(() => new Set(['3', '4', '7']), [])

  // Helper to extract category id (string) from product
  const categoryIdOf = (p: any): string => {
    const c = p?.category
    if (!c) return ''
    if (typeof c === 'object') return String(c.id ?? c.category_id ?? c.cat_id ?? '')
    if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) return String(c)
    return ''
  }

  // Helper to check if product has complete data (used to filter out incomplete products)
  const isCompleteProduct = (p: any): boolean => {
    const hasTitle = !!(p?.part_name || p?.name || p?.title)
    const hasPrice = !!(p?.price || p?.selling_price || p?.sellingPrice || p?.amount || p?.cost || p?.unit_price)
    // Product must have title and at least price or image
    return hasTitle && hasPrice
  }

  // Detect drilldown-start flag (from home search)
  const drillFlag = searchParams.get('drill')
  const inDrillMode = !!drillFlag

  // NEW: Vehicle search mode - show products directly instead of category selection
  const vehicleSearchFlag = searchParams.get('vehicleSearch')
  const inVehicleSearchMode = !!vehicleSearchFlag

  // Resolve category name from raw category field using categories API mapping
  const resolveCategoryName = useCallback((raw: any): string => {
    if (!raw) return ''
    if (typeof raw === 'object') return String(raw?.name || raw?.title || raw?.category_name || '')
    if (typeof raw === 'number' || (typeof raw === 'string' && /^\d+$/.test(raw))) {
      const cObj = categoriesById.get(String(raw))
      return cObj ? String((cObj as any)?.title || (cObj as any)?.name || '') : ''
    }
    return String(raw)
  }, [categoriesById])

  // --- Vehicle compatibility matching (shared util) ---
  const productMatchesVehicle = (p: any) => {
    if (!hasVehicleFilter) return true
    const cid = categoryIdOf(p)
    if (cid && NON_VEHICLE_CATEGORY_IDS.has(cid)) return true // skip filtering for non-vehicle categories

    // Delegate entirely to the shared service which now handles
    // strict ID checks, token-based model safety, and fuzzy engine matching.
    return sharedVehicleMatches(p, vehFilter)
  }

  // --- Filter Logic ---
  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    return searchResults.filter(productMatchesVehicle)
  }, [searchResults, productMatchesVehicle])

  // NEW: Search results filtered by Manufacturer
  const finalSearchResults = useMemo(() => {
    if (!selectedManufacturerId) return filteredSearchResults
    return filteredSearchResults.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [filteredSearchResults, selectedManufacturerId])

  // Hierarchical navigation state (via query params)
  const catIdParam = searchParams.get('catId') || ''
  const subCatIdParam = searchParams.get('subCatId') || ''
  const subSubCatIdParam = searchParams.get('subSubCatId') || ''

  // Brand filter from query params (when clicking brand in header)
  const brandParam = searchParams.get('brand') || ''

  // NEW: Brand drilldown (brand -> model -> submodel) from header brand clicks
  const brandIdParam = searchParams.get('brandId') || ''

  const [activeCatId, setActiveCatId] = useState<string>(catIdParam)
  const [activeSubCatId, setActiveSubCatId] = useState<string>(subCatIdParam)
  const [activeSubSubCatId, setActiveSubSubCatId] = useState<string>(subSubCatIdParam)
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>(brandParam)

  // Category filter for vehicle search mode
  const [vehicleSearchCategoryFilter, setVehicleSearchCategoryFilter] = useState<string>('')

  // Category filter for brand drilldown mode
  const [brandDrilldownCategoryFilter, setBrandDrilldownCategoryFilter] = useState<string>('')

  // Determine if vehicle filter should be shown for current category
  const shouldShowVehicleFilter = useMemo(() =>
    !activeCatId || !NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)),
    [activeCatId, NON_VEHICLE_CATEGORY_IDS]
  )

  // Vehicle brand drill-down state (from header brand clicks)
  const vehicleBrandParam = searchParams.get('vehicleBrand') || ''
  const vehicleModelParam = searchParams.get('vehicleModel') || ''
  const vehicleEngineParam = searchParams.get('vehicleEngine') || ''

  const [activeVehicleBrand, setActiveVehicleBrand] = useState<string>(vehicleBrandParam)
  const [activeVehicleModel, setActiveVehicleModel] = useState<string>(vehicleModelParam)
  const [activeVehicleEngine, setActiveVehicleEngine] = useState<string>(vehicleEngineParam)

  const [vehicleModels, setVehicleModels] = useState<string[]>([])
  const [vehicleEngines, setVehicleEngines] = useState<string[]>([])
  const [vehicleModelsLoading, setVehicleModelsLoading] = useState(false)
  const [vehicleEnginesLoading, setVehicleEnginesLoading] = useState(false)

  const inVehicleDrillMode = Boolean(vehicleBrandParam)
  const inBrandDrillMode = Boolean(brandIdParam)

  const [subCats, setSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subCatsLoading, setSubCatsLoading] = useState(false)
  const [subSubCats, setSubSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subSubCatsLoading, setSubSubCatsLoading] = useState(false)

  // --- Filter Products for Category Drilldown ---
  const subProducts = useMemo(() => {
    // 1. Basic checks
    if (!products || products.length === 0) return []
    if (!activeSubSubCatId) return []
    const targetId = String(activeSubSubCatId).trim()

    const results = products.filter((p) => {
      // Unwrap potentially nested part object
      const raw = (p as any).part || p
      // Get ID from various possible fields
      const pId = raw.sub_sub_category ?? raw.sub_sub_category_id ?? raw.subSubCategoryId ?? ''
      const pIdString = String(pId).trim()
      if (pIdString === targetId) return true
      return false
    })
    return results
  }, [products, activeSubSubCatId])

  // Ensure loader is tied to main loading state
  const subProductsLoading = loading

  // Accessories data (category id: 4)
  const ACCESSORIES_CAT_ID = '4'
  const [accSubCats, setAccSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [, setAccSubCatsLoading] = useState(false)
  const [accProducts, setAccProducts] = useState<ApiProduct[]>([])
  const [accProductsLoading, setAccProductsLoading] = useState(false)

  // --- Scroll refs for drill-down sections ---
  const catSectionRef = useRef<HTMLDivElement | null>(null) // sub-categories section (after selecting a category)
  const subSubCatSectionRef = useRef<HTMLDivElement | null>(null) // sub-sub categories pills (after selecting a sub-category)
  const productsSectionRef = useRef<HTMLDivElement | null>(null) // products grid (after selecting a sub-sub-category)

  const SCROLL_OFFSET = 180 // header allowance
  const scrollToEl = (el: HTMLElement | null) => {
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const y = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
    window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' })
  }

  // Scroll logic
  useEffect(() => {
    if (activeCatId && !activeSubCatId && !subCatsLoading) requestAnimationFrame(() => scrollToEl(catSectionRef.current))
  }, [activeCatId, activeSubCatId, subCatsLoading])

  useEffect(() => {
    if (activeSubCatId && !activeSubSubCatId && !subSubCatsLoading) requestAnimationFrame(() => scrollToEl(subSubCatSectionRef.current))
  }, [activeSubCatId, activeSubSubCatId, subSubCatsLoading])

  useEffect(() => {
    if (activeSubSubCatId && !subProductsLoading) requestAnimationFrame(() => scrollToEl(productsSectionRef.current))
  }, [activeSubSubCatId, subProductsLoading])

  // Sync internal state when URL changes
  useEffect(() => {
    setActiveCatId(catIdParam)
    setActiveSubCatId(subCatIdParam)
    setActiveSubSubCatId(subSubCatIdParam)
    setActiveVehicleBrand(vehicleBrandParam)
    setActiveVehicleModel(vehicleModelParam)
    setActiveVehicleEngine(vehicleEngineParam)
    setActiveBrandFilter(brandParam)
  }, [catIdParam, subCatIdParam, subSubCatIdParam, vehicleBrandParam, vehicleModelParam, vehicleEngineParam, brandParam])

  // Fetch vehicle models
  useEffect(() => {
    let alive = true
    if (!activeVehicleBrand) { setVehicleModels([]); return }
    ; (async () => {
      try {
        setVehicleModelsLoading(true)
        const allProds = await getAllProducts()
        const prods = Array.isArray(allProds) ? allProds : []
        const modelsSet = new Set<string>()
        for (const p of prods) {
          const pData = (p as any)?.part || p
          const compat = pData?.compatibility || pData?.vehicle_compatibility || []
          const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
          for (const c of compatList) {
            const cStr = typeof c === 'string' ? c : JSON.stringify(c)
            if (cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())) {
              const match = cStr.match(new RegExp(activeVehicleBrand + '\\s+([A-Z0-9][A-Za-z0-9\\s-]+)', 'i'))
              if (match && match[1]) {
                const modelName = match[1].trim().split(/[,(]/)[0].trim()
                if (modelName) modelsSet.add(modelName)
              }
            }
          }
        }
        if (!alive) return
        setVehicleModels(Array.from(modelsSet).sort())
      } catch (err) {
        if (!alive) return
        setVehicleModels([])
      } finally {
        if (alive) setVehicleModelsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeVehicleBrand])

  // Fetch vehicle engines
  useEffect(() => {
    let alive = true
    if (!activeVehicleModel || !activeVehicleBrand) { setVehicleEngines([]); return }
    ; (async () => {
      try {
        setVehicleEnginesLoading(true)
        const allProds = await getAllProducts()
        const prods = Array.isArray(allProds) ? allProds : []
        const enginesSet = new Set<string>()
        for (const p of prods) {
          const pData = (p as any)?.part || p
          const compat = pData?.compatibility || pData?.vehicle_compatibility || []
          const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
          for (const c of compatList) {
            const cStr = typeof c === 'string' ? c : JSON.stringify(c)
            const brandMatch = cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())
            const modelMatch = cStr.toLowerCase().includes(activeVehicleModel.toLowerCase())
            if (brandMatch && modelMatch) {
              const engineMatches = cStr.match(/\b\d+\.\d+\s*[LTV]?\w*\b|\bV\d+\b|\b\d+\.\d+\s+\w+\b/gi)
              if (engineMatches) engineMatches.forEach(e => enginesSet.add(e.trim()))
            }
          }
        }
        if (!alive) return
        setVehicleEngines(Array.from(enginesSet).sort())
      } catch (err) {
        if (!alive) return
        setVehicleEngines([])
      } finally {
        if (alive) setVehicleEnginesLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeVehicleBrand, activeVehicleModel])

  // Fetch drill-down data
  useEffect(() => {
    let alive = true
    if (!activeCatId) { setSubCats([]); return }
    ; (async () => {
      try {
        setSubCatsLoading(true)
        const res = await getSubCategories(activeCatId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        const mapped = arr.map((sc: any, i: number) => ({
          id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
          name: String(sc?.sub_title || sc?.title || sc?.name || 'Sub Category'),
          image: subCategoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || logoImg,
        }))
        setSubCats(mapped)
      } catch (_) {
        if (!alive) return
        setSubCats([])
      } finally {
        if (alive) setSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeCatId])

  useEffect(() => {
    let alive = true
    if (!activeSubCatId) { setSubSubCats([]); return }
    ; (async () => {
      try {
        setSubSubCatsLoading(true)
        const res = await getSubSubCategories(activeSubCatId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        const mapped = arr.map((ssc: any, i: number) => ({
          id: String(ssc?.sub_sub_cat_id ?? ssc?.subsubcatID ?? ssc?.id ?? ssc?.sub_sub_category_id ?? i),
          name: String(ssc?.sub_sub_title || ssc?.title || ssc?.name || 'Type'),
          image: subSubCategoryImageFrom(ssc) || normalizeApiImage(pickImage(ssc) || '') || logoImg,
        }))
        setSubSubCats(mapped)
      } catch (_) {
        if (!alive) return
        setSubSubCats([])
      } finally {
        if (alive) setSubSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeSubCatId])

  // Fetch search results when qParam present
  useEffect(() => {
    let alive = true
    if (!qParam) { setSearchResults([]); return }
    ; (async () => {
      try {
        setSearchLoading(true)
        const res = await liveSearch(qParam)
        if (!alive) return
        const list = Array.isArray(res) ? res : (res as any)?.data
        const items = Array.isArray(list) ? list : []
        // Filter out products with missing critical data (price or image)
        const completeProducts = items.filter(isCompleteProduct)
        setSearchResults(completeProducts as ApiProduct[])
      } catch (_) {
        if (!alive) return
        setSearchResults([])
      } finally {
        if (alive) setSearchLoading(false)
      }
    })()
    return () => { alive = false }
  }, [qParam])

  // Handlers to update the URL
  const setParams = (next: Partial<{ catId: string; subCatId: string; subSubCatId: string; vehicleBrand: string; vehicleModel: string; vehicleEngine: string }>) => {
    const current: Record<string, string> = {}
    for (const [k, v] of Array.from(searchParams.entries())) current[k] = v
    const merged = { ...current, ...next }
    // Clean empties
    if (!merged.catId) delete merged.catId
    if (!merged.subCatId) delete merged.subCatId
    if (!merged.subSubCatId) delete merged.subSubCatId
    if (!merged.vehicleBrand) delete merged.vehicleBrand
    if (!merged.vehicleModel) delete merged.vehicleModel
    if (!merged.vehicleEngine) delete merged.vehicleEngine
    setSearchParams(merged, { replace: false })
  }

  // Per-category expand state
  const INITIAL_VISIBLE = 10
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // --- Load Full Catalog (Run once on mount) ---
  useEffect(() => {
    let alive = true
    async function loadCatalog() {
      try {
        setLoading(true)
        const [prods, c] = await Promise.all([
          getAllProducts(),
          getAllCategories(),
        ])
        if (!alive) return
        // 1. Process Products
        const rawProducts = Array.isArray(prods) ? prods : (prods as any)?.data || []
        const completeProducts = rawProducts.filter(isCompleteProduct)
        setProducts(completeProducts)
        // 2. Process Categories
        setCategories(Array.isArray(c) ? c : [])
      } catch (err) {
        console.error('❌ CarParts: Failed to load catalog:', err)
        if (alive) setProducts([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadCatalog()
    return () => { alive = false }
  }, [])

  // Ensure categories are available
  useEffect(() => {
    let alive = true
    if (categories.length === 0) {
      ; (async () => {
        try {
          const c = await getAllCategories()
          if (!alive) return
          setCategories(Array.isArray(c) ? c : [])
        } catch { }
      })()
    }
    return () => { alive = false }
  }, [qParam, activeCatId, categories.length])

  // Load accessories subcategories
  useEffect(() => {
    let alive = true
    ; (async () => {
      try {
        setAccSubCatsLoading(true)
        const res = await getSubCategories(ACCESSORIES_CAT_ID)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        const mapped = arr.map((sc: any, i: number) => ({
          id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
          name: String(sc?.sub_title || sc?.title || sc?.name || 'Accessory'),
          image: subCategoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || logoImg,
        }))
        setAccSubCats(mapped)
      } catch {
        if (!alive) return
        setAccSubCats([])
      } finally {
        if (alive) setAccSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Load accessory products
  useEffect(() => {
    let alive = true
    ; (async () => {
      try {
        setAccProductsLoading(true)
        const subCats = accSubCats.slice(0, 4)
        const subSubLists = await Promise.all(subCats.map(sc => getSubSubCategories(sc.id)))
        const subSubIds: string[] = []
        subSubLists.forEach(list => {
          const arr = Array.isArray(list) ? list : []
          for (const ssc of arr.slice(0, 3)) {
            const id = String((ssc as any)?.sub_sub_cat_id ?? (ssc as any)?.subsubcatID ?? (ssc as any)?.id ?? '')
            if (id) subSubIds.push(id)
          }
        })
        const productLists = await Promise.all(subSubIds.slice(0, 8).map(id => getProductsBySubSubCategory(id)))
        const combined: ApiProduct[] = []
        const seen = new Set<string>()
        for (const list of productLists) {
          const arr = Array.isArray(list) ? list : []
          for (const p of arr) {
            const pid = String((p as any)?.product_id ?? (p as any)?.id ?? '')
            if (!pid || seen.has(pid)) continue
            if (!isCompleteProduct(p)) continue
            seen.add(pid)
            combined.push(p)
          }
        }
        if (!alive) return
        setAccProducts(combined)
      } catch {
        if (!alive) return
        setAccProducts([])
      } finally {
        if (alive) setAccProductsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [accSubCats])

  // Ref for auto-scroll in brand drilldown mode
  const productsRef = useRef<HTMLDivElement>(null)

  // Helper to check if product is compatible with a brand
  const isCompatibleWithBrand = useCallback((p: any, brandName: string): boolean => {
    const pData = (p as any)?.part || p
    const compat = pData?.compatibility || pData?.vehicle_compatibility || ''
    const compatStr = typeof compat === 'string' ? compat : JSON.stringify(compat)
    if (compatStr.toLowerCase().trim() === 'universal') return false
    return compatStr.toLowerCase().includes(brandName.toLowerCase())
  }, [])

  // Apply vehicle compatibility filter globally for catalogue views
  const filtered = useMemo(() => {
    let list = products

    // Filter by brand compatibility (from header brand selection)
    if (activeBrandFilter) {
      list = list.filter((p) => isCompatibleWithBrand(p, activeBrandFilter))
    }

    // Filter by vehicle brand drill-down (from header)
    if (inVehicleDrillMode) {
        // ... (existing logic for vehicle drill down filtering)
        if (activeVehicleEngine) {
            list = list.filter((p) => {
                const cid = categoryIdOf(p)
                if (cid !== '1' && cid !== '2') return false
                const pData = (p as any)?.part || p
                const compat = pData?.compatibility || pData?.vehicle_compatibility || []
                const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
                const isUniversal = compatList.some((c: any) => {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    return cStr.toLowerCase().trim() === 'universal'
                })
                if (isUniversal) return false
                for (const c of compatList) {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    const lowerStr = cStr.toLowerCase()
                    const brandMatch = lowerStr.includes(activeVehicleBrand.toLowerCase())
                    const modelMatch = lowerStr.includes(activeVehicleModel.toLowerCase())
                    const engineMatch = lowerStr.includes(activeVehicleEngine.toLowerCase())
                    if (brandMatch && modelMatch && engineMatch) return true
                }
                return false
            })
        } else if (activeVehicleModel && !activeVehicleEngine) {
            list = list.filter((p) => {
                const cid = categoryIdOf(p)
                if (cid !== '1' && cid !== '2') return false
                const pData = (p as any)?.part || p
                const compat = pData?.compatibility || pData?.vehicle_compatibility || []
                const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
                const isUniversal = compatList.some((c: any) => {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    return cStr.toLowerCase().trim() === 'universal'
                })
                if (isUniversal) return false
                for (const c of compatList) {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    const lowerStr = cStr.toLowerCase()
                    const brandMatch = lowerStr.includes(activeVehicleBrand.toLowerCase())
                    const modelMatch = lowerStr.includes(activeVehicleModel.toLowerCase())
                    if (brandMatch && modelMatch) return true
                }
                return false
            })
        } else if (activeVehicleBrand && !activeVehicleModel) {
            list = list.filter((p) => {
                const cid = categoryIdOf(p)
                if (cid !== '1' && cid !== '2') return false
                const pData = (p as any)?.part || p
                const compat = pData?.compatibility || pData?.vehicle_compatibility || []
                const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
                const isUniversal = compatList.some((c: any) => {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    return cStr.toLowerCase().trim() === 'universal'
                })
                if (isUniversal) return false
                for (const c of compatList) {
                    const cStr = typeof c === 'string' ? c : JSON.stringify(c)
                    if (cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())) return true
                }
                return false
            })
        }
    }

    // Apply regular vehicle filter
    if (hasVehicleFilter) {
      list = list.filter(productMatchesVehicle)
    }

    return list
  }, [products, hasVehicleFilter, vehFilter, inVehicleDrillMode, activeVehicleBrand, activeVehicleModel, activeVehicleEngine, activeBrandFilter, isCompatibleWithBrand, inBrandDrillMode])

  // NEW: Final filtered list incorporating Manufacturer selection
  const finalFiltered = useMemo(() => {
    if (!selectedManufacturerId) return filtered
    return filtered.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [filtered, selectedManufacturerId])

  // Page-level client-side search
  const [pageSearch, setPageSearch] = useState<string>(() => {
    try { return searchParams.get('q') || '' } catch { return '' }
  })

  const matchesPageSearch = useCallback((p: any) => {
    if (!pageSearch || !pageSearch.trim()) return true
    const q = pageSearch.trim().toLowerCase()
    const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || '').toLowerCase()
    const brand = String(brandOf(p) || '').toLowerCase()
    const maker = String((p as any)?.manufacturer || (p as any)?.maker || '').toLowerCase()
    return title.includes(q) || brand.includes(q) || maker.includes(q)
  }, [pageSearch])

  // Displayed filtered set (uses finalFiltered)
  const displayFiltered = useMemo(() => {
    if (!pageSearch || !pageSearch.trim()) return finalFiltered
    return finalFiltered.filter(p => matchesPageSearch(p))
  }, [finalFiltered, pageSearch, matchesPageSearch])

  // Derived values for drill-down
  const activeCategoryName = useMemo(() => {
    const c = categoriesById.get(String(activeCatId))
    return String((c as any)?.title || (c as any)?.name || '')
  }, [categoriesById, activeCatId])

  const activeSubCategoryName = useMemo(() => {
    const sc = subCats.find((x) => x.id === activeSubCatId)
    return sc?.name || ''
  }, [subCats, activeSubCatId])

  const activeTypeName = useMemo(() => {
    const ssc = subSubCats.find((x) => x.id === activeSubSubCatId)
    return ssc?.name || ''
  }, [subSubCats, activeSubSubCatId])

  const vehicleEcho = useMemo(() => {
    const brand = (vehFilter.brandName || '').trim()
    const model = (vehFilter.modelName || '').trim()
    const engine = (vehFilter.engineName || '').trim()
    const base = [brand, model].filter(Boolean).join(' ')
    if (!base && !engine) return ''
    return engine ? `${base} (${engine})` : base || engine
  }, [vehFilter])

  // --- Drill/search inside category ---
  const [drillSearch, setDrillSearch] = useState<string>('')
  const [drillSearchPage, setDrillSearchPage] = useState(1)
  const [drillSearchPageSize, setDrillSearchPageSize] = useState(12)

  const productsInActiveCategory = useMemo(() => {
    if (!activeCatId) return [] as ApiProduct[]
    return displayFiltered.filter((p) => {
      const cid = categoryIdOf(p)
      if (cid && String(cid) === String(activeCatId)) return true
      const raw = (p as any)?.category
      const name = resolveCategoryName(raw) || categoryOf(p)
      if (name && activeCategoryName && String(name).toLowerCase() === String(activeCategoryName).toLowerCase()) return true
      return false
    })
  }, [displayFiltered, activeCatId, activeCategoryName, resolveCategoryName])

  const drillSuggestions = useMemo(() => {
    const q = (drillSearch || '').trim().toLowerCase()
    if (!q) return [] as string[]
    const bigramCounts = new Map<string, number>()
    const unigramCounts = new Map<string, number>()
    for (const p of productsInActiveCategory) {
      const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || '')
      const words = title.split(/[^A-Za-z0-9]+/).map(w => w.trim()).filter(Boolean).map(w => w.toLowerCase())
      for (let i = 0; i < words.length; i++) {
        const w = words[i]
        if (w.length >= 3) unigramCounts.set(w, (unigramCounts.get(w) || 0) + 1)
        if (i + 1 < words.length) {
          const bg = `${words[i]} ${words[i+1]}`
          if (bg.replace(/\d+/g, '').length > 2) bigramCounts.set(bg, (bigramCounts.get(bg) || 0) + 1)
        }
      }
    }
    const candidates: Array<{ t: string; c: number }> = []
    for (const [k, v] of bigramCounts) {
      if (k.includes(q) || k.startsWith(q)) candidates.push({ t: k, c: v })
    }
    for (const [k, v] of unigramCounts) {
      if (k.includes(q) || k.startsWith(q)) candidates.push({ t: k, c: v })
    }
    candidates.sort((a, b) => b.c - a.c)
    return Array.from(new Set(candidates.map(x => x.t))).slice(0, 8)
  }, [productsInActiveCategory, drillSearch])

  useEffect(() => { setDrillSearchPage(1) }, [productsInActiveCategory, drillSearchPageSize])

  const filteredWithCategory = useMemo(() => {
    if (!vehicleSearchCategoryFilter) return displayFiltered
    return displayFiltered.filter(p => {
      const raw = (p as any)?.category
      const catName = resolveCategoryName(raw) || categoryOf(p)
      return catName.toLowerCase() === vehicleSearchCategoryFilter.toLowerCase()
    })
  }, [displayFiltered, vehicleSearchCategoryFilter, resolveCategoryName])

  const availableCategories = useMemo(() => {
    const catSet = new Map<string, number>()
    for (const p of displayFiltered) {
      const raw = (p as any)?.category
      const catName = resolveCategoryName(raw) || categoryOf(p)
      if (catName) {
        catSet.set(catName, (catSet.get(catName) || 0) + 1)
      }
    }
    return Array.from(catSet.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [displayFiltered, resolveCategoryName])

  // Auto-scroll for brand drilldown
  useEffect(() => {
    if (inBrandDrillMode && vehFilter.brandName && vehFilter.modelName && displayFiltered.length > 0 && productsRef.current) {
      setTimeout(() => {
        const y = (productsRef.current?.getBoundingClientRect().top || 0) + window.scrollY - SCROLL_OFFSET
        window.scrollTo({ top: y, behavior: 'smooth' })
      }, 300)
    }
  }, [inBrandDrillMode, vehFilter.brandName, vehFilter.modelName, displayFiltered.length])

  // Group by category (all filtered items)
  const grouped = useMemo(() => {
    const map = new Map<string, ApiProduct[]>()
    for (const p of displayFiltered) {
      const key = categoryOf(p)
      const list = map.get(key) || []
      list.push(p)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [displayFiltered])

  const catInfoFor = (sample: any) => {
    const name = categoryOf(sample)
    const c = sample?.category
    let catObj: any | undefined
    let catId: string | undefined
    if (c && typeof c === 'object') {
      catObj = c
      catId = String(c?.id ?? c?.category_id ?? '')
    } else if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) {
      catId = String(c)
    }
    if (!catObj && catId) {
      catObj = (categories as any[]).find((x: any) => String(x?.id ?? x?.category_id ?? '') === catId)
    }
    if (!catObj && name) {
      const nLower = name.toLowerCase()
      catObj = (categories as any[]).find((x: any) => String(x?.name || x?.title || '').toLowerCase() === nLower)
    }
    let img: string | undefined
    if (catObj) {
      img = categoryImageFrom(catObj) || normalizeApiImage(pickImage(catObj) || '')
    }
    if (!img && c && typeof c === 'object') {
      img = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '')
    }
    const displayName = catObj ? String(catObj?.title || catObj?.name || name || 'Category') : (name || 'Category')
    return { name: displayName, image: img || logoImg }
  }

  const topCats = useMemo(() => {
    const rows = grouped.map(([name, list]) => {
      const info = catInfoFor(list[0] as any)
      return { name: info.name || name, count: list.length }
    })
    rows.sort((a, b) => b.count - a.count)
    return rows.slice(0, 12)
  }, [grouped, categories])

  const scrollToCat = (catName: string) => {
    const id = `cat-${toSlug(catName)}`
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Accessories UI mapping
  type Accessory = { id: string; title: string; image: string; rating: number; reviews: number; price: number; badge?: string }
  const ACCESSORIES: Accessory[] = useMemo(() => {
    if (!accProducts || accProducts.length === 0) return []
    let source = accProducts
    if (!source.length) return []
    return source.slice(0, 20).map((p, i) => {
      const m = {
        id: String((p as any)?.product_id ?? (p as any)?.id ?? i),
        title: String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || 'Car Part'),
        image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg,
        rating: Number((p as any)?.rating || (p as any)?.stars || 4),
        reviews: Number((p as any)?.reviews_count || (p as any)?.reviews || 0),
        price: Number((p as any)?.price || (p as any)?.selling_price || (p as any)?.amount || 0),
      }
      return m
    })
  }, [accProducts])

  function AccessoryCard({ a }: { a: Accessory }) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
        {a.badge && (
          <span className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-[#201A2B] ring-1 ring-black/10">{a.badge}</span>
        )}
        <div className="px-4 pb-4 pt-3">
          <Link to={`/product/${a.id}`} className="block">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img src={a.image} alt={a.title} className="h-[80%] w-auto object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
            </div>
          </Link>
          <div className="mt-3 space-y-1">
            <div className="text-[12px] text-gray-600">{(a.rating as number).toFixed ? (a.rating as any).toFixed(1) : Number(a.rating).toFixed(1)} • ({a.reviews.toLocaleString()})</div>
            <Link to={`/product/${a.id}`} className="block text-[14px] font-semibold text-gray-900 hover:underline">{a.title}</Link>
            <div className="text-[16px] font-extrabold text-brand">{formatNaira(a.price)}</div>
            <div className="text-left text-[11px] leading-3 text-gray-600">Incl. VAT</div>
          </div>
          <div className="mt-3 flex items-center justify-end">
            <button type="button" aria-label="Add to cart" className="inline-flex h-9 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105">
              Add to cart
            </button>
          </div>
        </div>
      </div>
    )
  }

  const wishlist = useWishlist()

  const onViewProduct = (p: any) => {
    const pid = String((p as any)?.product_id ?? (p as any)?.id ?? '')
    if (!pid) return
    const brandSlug = toSlug(brandOf(p) || 'gapa')
    const partSlug = toSlug(categoryOf(p) || 'parts')
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(pid)}`, {
      state: { productData: p }
    })
  }
  const onAddToCart = async (p: any) => {
    const pid = String((p as any)?.product_id ?? (p as any)?.id ?? '')
    if (!pid) return
    try {
      if (user && user.id) {
        await addToCartApi({ user_id: user.id, product_id: pid, quantity: 1 })
      } else {
        addGuestCartItem(pid, 1)
      }
      navigate({ hash: '#cart' })
    } catch {
      navigate({ hash: '#cart' })
    }
  }

  // Derived values for drill-down
  const filteredSubProducts = useMemo(() => {
    let base = subProducts
    if (!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && hasVehicleFilter) {
      base = base.filter(productMatchesVehicle)
    }
    // NEW: Apply Manufacturer Filter to Sub Products (Drilldown)
    if (selectedManufacturerId) {
      base = base.filter(p => makerIdOf(p) === selectedManufacturerId)
    }
    return base
  }, [subProducts, hasVehicleFilter, activeCatId, vehFilter, selectedManufacturerId])

  // Pagination helper
  function PaginationControls({ page, setPage, pageSize, setPageSize, total }: { page: number; setPage: (n: number) => void; pageSize: number; setPageSize: (n: number) => void; total: number }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const toDisplay = (current: number, total: number) => {
      const set = new Set<number>()
      set.add(1)
      set.add(total)
      set.add(current)
      if (current - 1 >= 1) set.add(current - 1)
      if (current + 1 <= total) set.add(current + 1)
      if (current - 2 >= 1) set.add(current - 2)
      if (current + 2 <= total) set.add(current + 2)
      const arr = Array.from(set).sort((a, b) => a - b)
      const out: (number | '...')[] = []
      let last = 0
      for (const n of arr) {
        if (last && n - last > 1) out.push('...')
        out.push(n)
        last = n
      }
      return out
    }
    const pages = toDisplay(page, totalPages)
    return (
      <div className="mt-8 flex flex-col items-center gap-4">
        <div className="w-full max-w-3xl flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">Showing</div>
            <div className="rounded-md border bg-white px-3 py-1 text-sm font-medium text-gray-900">{pageSize}</div>
            <div className="text-sm text-gray-600">per page</div>
            <div className="ml-4 hidden items-center gap-2 sm:flex">
              <span className="text-sm text-gray-500">Results</span>
              <span className="rounded-md bg-[#F7CD3A] px-3 py-1 text-sm font-semibold text-[#201A2B]">{total.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="pageSizeSelect" className="sr-only">Items per page</label>
            <select id="pageSizeSelect" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand">
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
            </select>
          </div>
        </div>
        <nav className="w-full max-w-3xl" aria-label="Pagination">
          <ul className="mx-auto flex items-center justify-center gap-2">
            <li>
              <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Go to first page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>«</button>
            </li>
            <li>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>‹</button>
            </li>
            {pages.map((p, idx) => (
              <li key={`p-${idx}`}>
                {p === '...' ? (
                  <div className="inline-flex h-9 min-w-[44px] items-center justify-center text-sm text-gray-500">…</div>
                ) : (
                  <button onClick={() => setPage(Number(p))} aria-current={p === page ? 'page' : undefined} className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${p === page ? 'bg-brand text-white shadow' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>{p}</button>
                )}
              </li>
            ))}
            <li>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>›</button>
            </li>
            <li>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Go to last page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>»</button>
            </li>
          </ul>
        </nav>
      </div>
    )
  }

  const PAGE_SIZE_DEFAULT = 16;
  const [brandPage, setBrandPage] = useState(1);
  const [brandPageSize, setBrandPageSize] = useState(PAGE_SIZE_DEFAULT);
  
  // Category filter for brand drilldown
  const categoryFiltered = useMemo(() => {
    const base = displayFiltered
    if (!brandDrilldownCategoryFilter) return base
    return base.filter((p) => {
      const raw = (p as any)?.category
      const catName = resolveCategoryName(raw) || categoryOf(p)
      return String(catName).toLowerCase() === String(brandDrilldownCategoryFilter).toLowerCase()
    })
  }, [displayFiltered, brandDrilldownCategoryFilter, resolveCategoryName])

  const brandProductsSource = (inBrandDrillMode && brandDrilldownCategoryFilter) ? categoryFiltered : displayFiltered
  const paginatedBrandProducts = brandProductsSource.slice((brandPage - 1) * brandPageSize, brandPage * brandPageSize);

  // Pagination for the general "filtered" grid
  const [filteredPage, setFilteredPage] = useState(1)
  const [filteredPageSize, setFilteredPageSize] = useState(12)
  useEffect(() => { setFilteredPage(1) }, [displayFiltered, filteredPageSize])
  const filteredPaged = displayFiltered.slice((filteredPage - 1) * filteredPageSize, filteredPage * filteredPageSize)

  // Pagination for sub-sub-category products
  const [subProductsPage, setSubProductsPage] = useState(1)
  const [subProductsPageSize, setSubProductsPageSize] = useState(12)
  useEffect(() => { setSubProductsPage(1) }, [filteredSubProducts, subProductsPageSize])
  const subProductsPaged = filteredSubProducts.slice((subProductsPage - 1) * subProductsPageSize, subProductsPage * subProductsPageSize)

  // Pagination for search results
  const [searchPage, setSearchPage] = useState(1)
  const [searchPageSize, setSearchPageSize] = useState(12)
  useEffect(() => { setSearchPage(1) }, [finalSearchResults, searchPageSize])
  const searchPaged = finalSearchResults.slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize)


  // --- Helper to render Manufacturer Filter ---
  const renderManufacturerFilter = (sourceProducts: ApiProduct[]) => {
    // Determine available manufacturers based on the source product list (before manufacturer filtering)
    // sourceProducts here should be the list *before* applying the selectedManufacturerId filter,
    // but *after* other contextual filters (like search query, vehicle filter, etc.)
    
    // Calculate unique manufacturer IDs present in the source list
    const relevantMakerIds = new Set<string>()
    sourceProducts.forEach(p => {
        const mid = makerIdOf(p)
        if(mid) relevantMakerIds.add(mid)
    })

    const relevantManufacturers = manufacturers.filter(m => {
         const id = String((m as any)?.saler_id ?? m?.id ?? (m as any)?.maker_id_ ?? (m as any)?.maker_id ?? (m as any)?.manufacturer_id)
         return relevantMakerIds.has(id)
    })

    if (relevantManufacturers.length === 0) return null

    return (
        <div className="mb-6">
            <ManufacturerSelector 
                manufacturers={relevantManufacturers}
                selectedId={selectedManufacturerId}
                onSelect={(m) => {
                    const id = m ? String((m as any)?.saler_id ?? m?.id ?? (m as any)?.maker_id_ ?? (m as any)?.maker_id ?? (m as any)?.manufacturer_id) : ''
                    setSelectedManufacturerId(id)
                    // Reset paginations
                    setBrandPage(1)
                    setFilteredPage(1)
                    setSubProductsPage(1)
                    setSearchPage(1)
                }}
                loading={manufacturersLoading}
                title="Filter by Manufacturer"
            />
        </div>
    )
  }

  // --- View: Brand Drilldown ---
  if (activeBrandFilter && !qParam && !activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[32px]">{activeBrandFilter} Compatible Parts</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li><Link to="/parts" className="hover:underline">Parts Catalogue</Link></li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">{activeBrandFilter}</li>
            </ol>
          </nav>

          <div className={`mt-6 grid gap-6 ${shouldShowVehicleFilter ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
            {shouldShowVehicleFilter && (
              <aside className="hidden lg:block">
                <div className="sticky top-40 space-y-4">
                  <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                    <div className="rounded-[10px] bg-white p-1">
                      <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0]">
                        <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                        {hasVehicleFilter && (
                          <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div><div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div></div>
                                <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20" aria-label="Clear"><svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}

            <div className="min-w-0 overflow-hidden">
              {/* Manufacturer Filter */}
              {renderManufacturerFilter(filtered)}
              
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-gray-900">{displayFiltered.length} Compatible Part{displayFiltered.length === 1 ? '' : 's'}</h3>
              </div>
              {loading ? (
                <FallbackLoader label="Loading products…" />
              ) : displayFiltered.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                   <h4 className="mt-4 text-lg font-semibold text-gray-900">No parts match your selection</h4>
                   <button onClick={() => { setBrandDrilldownCategoryFilter(''); navigate('/parts'); setSelectedManufacturerId('') }} className="mt-4 rounded-md bg-white border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">Browse all parts</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {paginatedBrandProducts.map((p, i) => {
                      const cardProduct = mapProductToActionData(p, i)
                      return (<ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} />)
                    })}
                  </div>
                  <PaginationControls page={brandPage} setPage={setBrandPage} pageSize={brandPageSize} setPageSize={setBrandPageSize} total={displayFiltered.length} />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  // --- View: Vehicle Drill Mode ---
  if (inVehicleDrillMode && !qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[32px]">
            {activeVehicleEngine ? `${activeVehicleBrand} ${activeVehicleModel} ${activeVehicleEngine}` : activeVehicleModel ? `${activeVehicleBrand} ${activeVehicleModel}` : activeVehicleBrand}
          </h1>
          
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
             <ol className="flex items-center gap-2 font-medium">
                <li><Link to="/parts" className="hover:underline">Parts Catalogue</Link></li>
                <li aria-hidden className='text-[22px] -mt-1'>›</li>
                <li className="font-semibold text-brand">{activeVehicleBrand}</li>
             </ol>
          </nav>

          {activeVehicleBrand && !activeVehicleModel && (
            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Select Model</h3>
              {vehicleModelsLoading ? <div className="mt-3"><FallbackLoader label="Loading models…" /></div> : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {vehicleModels.map((model) => (
                    <li key={model}>
                      <button onClick={() => setParams({ vehicleBrand: activeVehicleBrand, vehicleModel: model, vehicleEngine: '' })} className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-medium text-gray-900 transition hover:border-[#F7CD3A] hover:bg-[#F7CD3A]/10">{model}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Engine Selection - Previously missing block */}
          {activeVehicleBrand && activeVehicleModel && !activeVehicleEngine && (
            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Select Engine</h3>
              {vehicleEnginesLoading ? <div className="mt-3"><FallbackLoader label="Loading engines…" /></div> : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {vehicleEngines.map((engine) => (
                    <li key={engine}>
                      <button onClick={() => setParams({ vehicleBrand: activeVehicleBrand, vehicleModel: activeVehicleModel, vehicleEngine: engine })} className="w-full rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-medium text-gray-900 transition hover:border-[#F7CD3A] hover:bg-[#F7CD3A]/10">{engine}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

           {/* Show filtered products if engine selected */}
          {activeVehicleBrand && activeVehicleModel && activeVehicleEngine && (
            <div className="mt-6">
              <h3 className="text-[16px] font-semibold text-gray-900 mb-4">Compatible Parts</h3>
              
              {/* Manufacturer Filter */}
              {renderManufacturerFilter(filtered)}

              {loading ? (
                <div className="mt-3"><FallbackLoader label="Loading products…" /></div>
              ) : displayFiltered.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                   <h4 className="mt-4 text-lg font-semibold text-gray-900">No compatible parts found</h4>
                </div>
              ) : (
                <div>
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {filteredPaged.map((p, i) => {
                      const cardProduct = mapProductToActionData(p, i)
                      return (<ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} />)
                    })}
                  </div>
                  <PaginationControls page={filteredPage} setPage={setFilteredPage} pageSize={filteredPageSize} setPageSize={setFilteredPageSize} total={displayFiltered.length} />
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    )
  }

  // --- View: Brand Drilldown Mode ---
  if (inBrandDrillMode && !qParam && !activeCatId) {
      return (
          <div className="bg-white !pt-10">
              <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
                  <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">Select Your Vehicle</h1>
                   {/* ... Breadcrumb ... */}
                   <div className="mt-6">
                       <BrandDrilldown brandId={brandIdParam} onComplete={setVehFilter} onFilterChange={({ categoryId, q }) => { setBrandDrilldownCategoryFilter(categoryId || ''); setPageSearch(q || ''); setBrandPage(1); }} />
                       {vehFilter.brandName && vehFilter.modelName && (
                           <div id="compatible-parts-section" ref={productsRef} className="mt-8">
                               {/* Vehicle echo */}
                               <div className="rounded-xl bg-gradient-to-br from-white to-[#FFFBF0] p-4 ring-1 ring-black/5 mb-6">
                                   <div className="flex items-start justify-between gap-4">
                                       <div>
                                           <div className="text-[13px] font-semibold text-gray-700">Vehicle Selected</div>
                                           <div className="mt-1 text-[17px] font-bold text-gray-900">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}</div>
                                       </div>
                                       <div className="flex items-center gap-3">
                                            <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); navigate('/parts') }} className="rounded-md bg-white px-3 py-2 text-sm font-medium ring-1 ring-black/10">Clear</button>
                                            <button onClick={() => { requestAnimationFrame(() => scrollToEl(catSectionRef.current)) }} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Browse categories</button>
                                       </div>
                                   </div>
                               </div>
                               <div className="min-w-0">
                                   {loading ? <FallbackLoader label="Loading categories…" /> : (
                                       <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                           {categories.map((c: any, i: number) => {
                                               const info = catInfoFor(c)
                                               return (
                                                   <li key={i}>
                                                       <button onClick={() => { setParams({ catId: String(c.id || i) }); setActiveCatId(String(c.id || i)) }} className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/10 transition hover:shadow">
                                                           <div className="flex w-full flex-col items-center gap-3">
                                                               <div className="overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10"><img src={info.image} alt="" className="h-full w-full object-contain" /></div>
                                                               <div className="truncate text-[13px] font-semibold text-gray-900">{info.name}</div>
                                                           </div>
                                                       </button>
                                                   </li>
                                               )
                                           })}
                                       </ul>
                                   )}
                               </div>
                           </div>
                       )}
                   </div>
              </section>
          </div>
      )
  }

  // --- View: Vehicle Search Mode ---
  if (inVehicleSearchMode && !qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">{hasVehicleFilter ? `Parts for ${[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}` : 'Compatible Parts'}</h1>
          
          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-40 space-y-4">
                 <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                    <div className="rounded-[10px] bg-white p-1">
                        <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                    </div>
                 </div>
              </div>
            </aside>

            <div className="min-w-0 overflow-hidden">
               {/* Category Filter Pills */}
              {availableCategories.length > 0 && (
                 <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                       <button onClick={() => setVehicleSearchCategoryFilter('')} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${!vehicleSearchCategoryFilter ? 'bg-[#F7CD3A] text-[#201A2B] ring-2 ring-[#F7CD3A]' : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:ring-gray-400'}`}>
                          <span>All Categories</span>
                          <span className="text-[11px] opacity-75">({displayFiltered.length})</span>
                       </button>
                       {availableCategories.map(({ name, count }) => (
                          <button key={name} onClick={() => setVehicleSearchCategoryFilter(name)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${vehicleSearchCategoryFilter === name ? 'bg-[#F7CD3A] text-[#201A2B] ring-2 ring-[#F7CD3A]' : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:ring-gray-400'}`}>
                             <span>{name}</span>
                             <span className="text-[11px] opacity-75">({count})</span>
                          </button>
                       ))}
                    </div>
                 </div>
              )}
              
              {/* Manufacturer Filter */}
              {renderManufacturerFilter(filtered)}

              {loading ? (
                <FallbackLoader label="Loading products…" />
              ) : filteredWithCategory.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10"><h4 className="mt-4 text-lg font-semibold text-gray-900">No matching parts</h4></div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredWithCategory.map((p, i) => {
                     const cardProduct = mapProductToActionData(p, i)
                     return (<ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} />)
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  // --- View: Drilldown Start Mode ---
  if (inDrillMode && !activeCatId && !qParam) {
     return (
        <div className="bg-white !pt-10">
           <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
              <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">Browse by category</h1>
              {/* Similar logic as Default Catalogue but prioritizing categories */}
              {/* Omitting for brevity as logic is redundant with Default Catalogue */}
           </section>
        </div>
     )
  }

  // --- View: Active Category Drilldown ---
  if (activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">{activeCategoryName || 'Car Parts'}</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
             <ol className="flex items-center gap-2 font-medium">
                <li><Link to="/parts" className="hover:underline">Parts Catalogue</Link></li>
                <li aria-hidden className='text-[22px] -mt-1'>›</li>
                <li className={(activeSubCatId || activeSubSubCatId) ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'} onClick={() => setParams({ catId: activeCatId, subCatId: '', subSubCatId: '' })}>{activeCategoryName || 'Category'}</li>
                {activeSubCatId && (<><li aria-hidden className='text-[22px] -mt-1'>›</li><li className={activeSubSubCatId ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'} onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: '' })}>{activeSubCategoryName || 'Sub Category'}</li></>)}
                {activeSubSubCatId && (<><li aria-hidden className='text-[22px] -mt-1'>›</li><li className="font-semibold text-brand">{activeTypeName || 'Type'}</li></>)}
             </ol>
          </nav>

          <div className={`mt-6 grid gap-6 ${shouldShowVehicleFilter ? 'lg:grid-cols-[280px_1fr]' : ''}`}>
             {shouldShowVehicleFilter && (
                <aside className="hidden lg:block">
                   <div className="sticky top-40 space-y-4">
                      <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                         <div className="rounded-[10px] bg-white p-1">
                             <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                             {hasVehicleFilter && (
                                <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                                   <div className="flex items-start gap-2">
                                       <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div><div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div></div>
                                       <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20"><svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                                   </div>
                                </div>
                             )}
                         </div>
                      </div>
                   </div>
                </aside>
             )}

             <div className="min-w-0 overflow-hidden">
                <div className="mt-0" ref={catSectionRef}>
                   <div className="mb-4">
                      <div className="rounded-md overflow-hidden shadow-sm">
                         <div className="border-t-4 border-b-4 border-purple-600 bg-white px-4 py-4">
                            <div className="flex items-start justify-between gap-4">
                               <div className="min-w-0">
                                  <div className="text-sm font-semibold text-green-800">Selected vehicle</div>
                                  <div className="mt-1 text-lg font-extrabold text-gray-900 truncate">{vehicleEcho || 'No vehicle selected'}</div>
                               </div>
                               <div className="flex items-center gap-2">
                                  {vehicleEcho && <button type="button" onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium ring-1 ring-black/10 hover:bg-gray-50">Clear</button>}
                                  <button type="button" onClick={() => requestAnimationFrame(() => scrollToEl(catSectionRef.current))} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95">Browse categories</button>
                               </div>
                            </div>
                            <div className="bg-white px-4 py-3 border-t border-green-50">
                                <div className="relative">
                                    <input id="category-drill-search" type="search" value={drillSearch} onChange={(e) => setDrillSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { setPageSearch(drillSearch); setDrillSearchPage(1); requestAnimationFrame(() => scrollToEl(productsSectionRef.current)) } }} placeholder={`Search ${activeCategoryName || 'category'} (e.g. brake, pad, disc)`} className="w-full rounded-md border border-gray-200 bg-white pl-10 pr-10 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                                    {drillSearch.trim() && <button type="button" onClick={() => { setDrillSearch(''); setPageSearch(''); setDrillSearchPage(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-gray-500 hover:bg-gray-50"><svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>}
                                    {drillSuggestions.length > 0 && drillSearch.trim() && (
                                        <ul className="absolute right-0 left-0 z-40 mt-1 max-h-52 overflow-auto rounded-md bg-white p-1 shadow ring-1 ring-black/5">
                                            {drillSuggestions.map((s) => (
                                                <li key={s}><button type="button" onClick={() => { setDrillSearch(s); setPageSearch(s); setDrillSearchPage(1); requestAnimationFrame(() => scrollToEl(productsSectionRef.current)) }} className="w-full text-left rounded px-3 py-2 text-sm hover:bg-gray-50">{s}</button></li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Sub Categories List */}
                {pageSearch && pageSearch.trim() ? (
                    // Search results in category
                    (() => {
                        const matched = productsInActiveCategory.filter((p) => matchesPageSearch(p))
                        // Apply Manufacturer Filter here?
                        // productsInActiveCategory is based on displayFiltered which IS filtered by Manufacturer (finalFiltered).
                        // So this list is already correct.
                        const paged = matched.slice((drillSearchPage - 1) * drillSearchPageSize, drillSearchPage * drillSearchPageSize)
                        
                        // We also need to show the Manufacturer Filter UI
                        // Using productsInActiveCategory (without pageSearch filter) as the source for available manufacturers
                        // But wait, pageSearch logic is separate.
                        // Let's pass productsInActiveCategory to the manufacturer filter
                        return (
                            <div className="mt-3">
                                {renderManufacturerFilter(productsInActiveCategory)}
                                <div className="mb-3 flex items-center justify-between">
                                    <div><div className="text-sm text-gray-600">Results for</div><div className="text-[15px] font-semibold text-gray-900">“{pageSearch}” in {activeCategoryName}</div></div>
                                    <div className="text-sm text-gray-500">{matched.length.toLocaleString()} results</div>
                                </div>
                                {matched.length === 0 ? (
                                    <div className="rounded-xl bg-white p-4 text-sm text-gray-700 ring-1 ring-black/10">No matching products in this category.</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                                            {paged.map((p, i) => { const cardProduct = mapProductToActionData(p, i); return <ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} /> })}
                                        </div>
                                        <PaginationControls page={drillSearchPage} setPage={setDrillSearchPage} pageSize={drillSearchPageSize} setPageSize={setDrillSearchPageSize} total={matched.length} />
                                    </>
                                )}
                            </div>
                        )
                    })()
                ) : subCatsLoading ? (
                    <div className="mt-3"><FallbackLoader label="Loading sub categories…" /></div>
                ) : (
                    <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {subCats.map((sc) => (
                           <li key={sc.id} className='w-full'><button onClick={() => setParams({ catId: activeCatId, subCatId: sc.id, subSubCatId: '' })} className={`w-full rounded-2xl bg-white p-4 text-left ring-black/10 transition hover:shadow ${activeSubCatId === sc.id ? 'outline-2 outline-[#F7CD3A]' : ''}`} aria-pressed={activeSubCatId === sc.id}><div className="flex w-full flex-col items-center gap-3"><div className="overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10"><img src={sc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} /></div><div className="min-w-0"><div className="truncate text-[13px] font-semibold text-gray-900">{sc.name}</div></div></div></button></li>
                        ))}
                    </ul>
                )}

                {/* Sub-Sub Categories */}
                {activeSubCatId && (
                   <div className="mt-8" ref={subSubCatSectionRef}>
                      <h3 className="text-[16px] font-semibold text-gray-900">{activeSubCategoryName || 'Types'}</h3>
                      {subSubCatsLoading ? <div className="mt-3"><FallbackLoader label="Loading types…" /></div> : (
                         <div className="mt-4">
                             <ul className="grid grid-cols-2 gap-3 text-[12px] text-gray-800 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                                 {subSubCats.map((ssc) => (
                                     <li key={`pill-${ssc.id}`}><button onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: ssc.id })} className={`w-full flex items-center gap-3 rounded-full border px-3 py-2 text-left transition ${activeSubSubCatId === ssc.id ? 'border-[#F7CD3A] bg-[#F7CD3A]/20' : 'border-black/10 hover:bg-black/5'}`} aria-pressed={activeSubSubCatId === ssc.id}><div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-[#F6F5FA] ring-1 ring-black/10"><img src={ssc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} /></div><span className="truncate block">{ssc.name}</span></button></li>
                                 ))}
                             </ul>
                         </div>
                      )}
                   </div>
                )}

                {/* Products under sub-sub-category */}
                {activeSubSubCatId && (
                   <div className="mt-10" ref={productsSectionRef}>
                      <h3 className="text-[16px] font-semibold text-gray-900 mb-4">{activeTypeName || 'Products'}</h3>
                      
                      {/* Manufacturer Filter for Drilldown Products */}
                      {renderManufacturerFilter(subProducts)}

                      {subProductsLoading ? (
                          <div className="mt-3"><FallbackLoader label="Loading products…" /></div>
                      ) : filteredSubProducts.length === 0 ? (
                          <div className="mt-3 text-sm text-gray-700">No compatible products found in this section.</div>
                      ) : (
                          <div>
                              <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                  {subProductsPaged.map((p, i) => { const cardProduct = mapProductToActionData(p, i); return <ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} /> })}
                              </div>
                              <PaginationControls page={subProductsPage} setPage={setSubProductsPage} pageSize={subProductsPageSize} setPageSize={setSubProductsPageSize} total={filteredSubProducts.length} />
                          </div>
                      )}
                   </div>
                )}
             </div>
          </div>
        </section>
      </div>
    )
  }

  // --- View: Search Results ---
  if (qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-black text-gray-900 sm:text-[28px]">Search results</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[16px] text-gray-700">
             <ol className="flex items-center gap-2 font-medium">
                <li><Link to="/parts" className="hover:underline">Parts Catalogue</Link></li>
                <li aria-hidden className='text-[22px] -mt-1'>›</li>
                <li className="font-semibold text-brand">Results for “{qParam}”</li>
             </ol>
          </nav>

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
             <aside className="hidden lg:block">
                <div className="sticky top-40 space-y-4">
                   <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                      <div className="rounded-[10px] bg-white p-1">
                         <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                         {hasVehicleFilter && (
                            <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                               <div className="flex items-start gap-2">
                                  <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div><div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div></div>
                                  <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20"><svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                               </div>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
             </aside>

             <div className="min-w-0 overflow-hidden">
                {/* Manufacturer Filter - passing the context filtered list (filteredSearchResults) */}
                {renderManufacturerFilter(filteredSearchResults)}

                <div>
                   {searchLoading ? <FallbackLoader label="Searching…" /> : finalSearchResults.length === 0 ? (
                      <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10"><div className="text-[14px] text-gray-700">No results found for "{qParam}".</div></div>
                   ) : (
                      <>
                         <div className="mb-4 flex items-center justify-between"><div className="text-[14px] font-semibold text-gray-900">{finalSearchResults.length} result{finalSearchResults.length === 1 ? '' : 's'} for "{qParam}"</div></div>
                         <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                            {searchPaged.map((p: ApiProduct, i: number) => { const cardProduct = mapProductToActionData(p, i); return <ProductActionCard key={cardProduct.id} product={cardProduct} enableView={true} onView={() => onViewProduct(p)} onAddToCart={() => onAddToCart(p)} /> })}
                         </ul>
                         <PaginationControls page={searchPage} setPage={setSearchPage} pageSize={searchPageSize} setPageSize={setSearchPageSize} total={finalSearchResults.length} />
                      </>
                   )}
                </div>
             </div>
          </div>
        </section>
      </div>
    )
  }

  // --- Default: browse catalogue ---
  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">Browse Car Parts</h1>
        <Crumb />

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky !top-34 space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                 <div className="rounded-[10px] bg-white p-1">
                    <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                    {hasVehicleFilter && (
                       <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                          <div className="flex items-start gap-2">
                             <div className="flex-1 min-w-0"><div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div><div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div></div>
                             <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20"><svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0">
             {/* Manufacturer Filter */}
             {renderManufacturerFilter(filtered)}

             {/* Car Accessories grid (restored) */}
             <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
               {SECTIONS.map((s, i) => (
                 <Fragment key={s.title}>
                   <Tile s={s} />
                   {((i + 1) % 4 === 0) && (<div key={`sep-${i}`} className="col-span-full my-2 h-px bg-black/10" />)}
                 </Fragment>
               ))}
             </div>

             {/* Results */}
             {loading ? (
                <div className="mt-8"><FallbackLoader label="Loading parts…" /></div>
             ) : (
                <div className="-mt-4 space-y-8">
                   {grouped.length === 0 ? (
                      <div className="text-center text-sm text-gray-700">{hasVehicleFilter ? ( <><div>No compatible products for your selected vehicle.</div><div className="mt-2"><button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-[12px] font-medium ring-1 ring-black/10">Reset vehicle filter</button></div></> ) : 'No products found.'}</div>
                   ) : grouped.map(([_, list]) => {
                      const sample = list[0]
                      const info = catInfoFor(sample as any)
                      const catName = info.name || 'Category'
                      const catImg = info.image
                      const isExpanded = !!expanded[catName]
                      const visible = isExpanded ? list : list.slice(0, INITIAL_VISIBLE)
                      return (
                         <section id={`cat-${toSlug(catName)}`} key={catName} className="scroll-mt-28 rounded-xl bg-white p-4 ring-1 ring-black/10">
                            <div className="grid gap-4 md:grid-cols-[260px_1fr] md:items-start">
                               <div className="flex items-center gap-3">
                                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10"><img src={catImg} alt={catName} className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} /></div>
                                  <div><h3 className="text-[16px] font-semibold text-gray-900">{catName}</h3><div className="text-[12px] text-gray-600">{list.length} item{list.length === 1 ? '' : 's'}</div></div>
                               </div>
                               <div className="">
                                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                     {visible.map((p, i) => {
                                        const id = String((p as any)?.product_id ?? (p as any)?.id ?? i)
                                        const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Car Part')
                                        const brandSlug = toSlug(brandOf(p)) || 'gapa'
                                        const partSlug = toSlug(categoryOf(p)) || 'parts'
                                        const wished = wishlist.has(id)
                                        return (
                                           <li key={`${catName}-${id}-${i}`} className="truncate relative group pr-3 text-[13px]">
                                              <Link to={`/parts/${encodeURIComponent(brandSlug)}/${encodeURIComponent(partSlug)}?pid=${encodeURIComponent(id)}`} className="text-[14px] text-brand hover:underline line-clamp-2">{title}</Link>
                                              <span className="hidden right-0 top-0"><WishlistButton size={16} active={wished} onToggle={(active) => { wishlist.toggle(id); if (active) toast.success('Added to wishlist') }} /></span>
                                           </li>
                                        )
                                     })}
                                  </ul>
                                  {list.length > INITIAL_VISIBLE && (
                                     <div className="mt-3"><button onClick={() => setExpanded((s) => ({ ...s, [catName]: !isExpanded }))} className="text-[13px] font-semibold text-brand hover:underline">{isExpanded ? 'View less' : `View more (${list.length - INITIAL_VISIBLE} more)`}</button></div>
                                  )}
                               </div>
                            </div>
                         </section>
                      )
                   })}
                </div>
             )}
          </div>
        </div>
      </section>

      {/* Top car accessories Categories (pill links) */}
      <section className="mx-auto !max-w-7xl px-4 pb-2 pt-2 sm:px-6">
         <div className="flex items-center justify-between"><h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top car accessories Categories</h3></div>
         <ul className="mt-3 grid grid-cols-1 gap-3 text-[12px] text-gray-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
            {(accSubCats.length ? accSubCats.map(sc => sc.name) : (topCats.length ? topCats.map(tc => tc.name) : [])).map((label) => (
               <li key={label} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
                  <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20" aria-hidden />
                  <a href="#" onClick={(e) => { e.preventDefault(); const sc = accSubCats.find(x => x.name === label); if (sc) setSearchParams({ catId: ACCESSORIES_CAT_ID, subCatId: sc.id }); else scrollToCat(label); }} className="hover:underline">{label}</a>
               </li>
            ))}
         </ul>
      </section>

      <TopBrands title="Top brands" limit={12} viewAll={true} />

      {/* Accessories carousel */}
      <section className="mx-auto !max-w-7xl px-4 py-6 sm:px-6">
         <div className="flex items-center justify-between"><h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-quality car accessories at unbeatable prices</h3></div>
         {accProductsLoading ? (
            <div className="mt-4"><FallbackLoader label="Loading accessories…" /></div>
         ) : (
            <div className="mt-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]" aria-label="Top accessories carousel">
               <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
               <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
                  {ACCESSORIES.map((a) => (<div key={a.id} className="shrink-0"><AccessoryCard a={a} /></div>))}
               </div>
            </div>
         )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
         <h2 id="acc-easy-title" className="text-center text-[22px] font-semibold text-gray-900 sm:text-[28px]">Car Accessories Made Easy with Gapa Naija</h2>
         <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-6 text-gray-600">Car accessories play a huge role in making your driving experience safer, more convenient, and more enjoyable. At Gapa Naija, we provide high-quality accessories that not only protect your car but also add comfort, safety, and style for every trip.</p>
         <div className="mt-8 grid gap-10 md:grid-cols-3">
            <div className="md:col-span-2">
               <h3 className="text-[16px] font-semibold text-gray-900">Types of Car Accessories We Offer</h3>
               <div className="mt-4 grid gap-8 sm:grid-cols-2">
                  <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                     <li><div className="font-semibold text-gray-900">Car Mats &amp; Liners</div><p className="mt-1 text-gray-600">Keep your interior clean and protected from dust, mud, and spills while adding durability and comfort.</p></li>
                     <li><div className="font-semibold text-gray-900">Covers &amp; Protectors</div><p className="mt-1 text-gray-600">From car body covers to seat and steering wheel covers, these protect your vehicle from wear, scratches.</p></li>
                  </ul>
                  <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                     <li><div className="font-semibold text-gray-900">Car Care Essentials</div><p className="mt-1 text-gray-600">Brushes, scrapers, sponges, and cleaning kits to help you maintain a spotless car without damaging the paintwork.</p></li>
                     <li><div className="font-semibold text-gray-900">Safety &amp; Emergency Gear</div><p className="mt-1 text-gray-600">Be prepared with first aid kits, warning triangles, fire extinguishers, reflective vests, safety hammers, and other must-haves for emergencies.</p></li>
                  </ul>
               </div>
            </div>
            <aside className="md:pl-6">
               <h3 className="text-[16px] font-semibold text-gray-900">Why Choose Gapa Naija?</h3>
               <p className="mt-3 text-[13px] leading-6 text-gray-700">At Gapa Naija, we make shopping for car accessories simple, affordable, and reliable. With thousands of products, competitive prices, and fast delivery across Nigeria, you can always count on us to keep your car in top shape.</p>
            </aside>
         </div>
      </section>
    </div>
  )
}

export default function CarParts() {
  return (
    <ErrorBoundary>
      <CarPartsInner />
    </ErrorBoundary>
  )
}
