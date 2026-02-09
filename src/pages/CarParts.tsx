import React, { useEffect, useMemo, useState, Fragment, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductActionCard from '../components/ProductActionCard'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getSubCategories, getSubSubCategories, getProductsBySubSubCategory, liveSearch, addToCartApi } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, subCategoryImageFrom, subSubCategoryImageFrom, manufacturerImageFrom } from '../services/images'
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
    // Optional: log to service
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

// Map helpers moved to utils/productMapping

// --- Car Accessories sections (grid) placeholders ---
type Section = { title: string; img: string; links: string[] }
const SECTIONS: Section[] = [
]

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

  // --- Manufacturer Filter Hooks & State ---
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

  // Filters for search mode
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())

  // --- Shared vehicle filter (persisted across pages) ---
  const [vehFilter, setVehFilter] = useState<VehState>(() => {
    const initial = getPersistedVehicleFilter()
    console.log('🔧 Initial vehFilter from localStorage:', initial)
    return initial
  })

  // Log vehFilter changes
  useEffect(() => {
    console.log('🔄 vehFilter state changed:', vehFilter)
  }, [vehFilter])

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
    const hasImage = !!(p?.img_url || p?.imgUrl || p?.image || p?.photo)
    // Product must have title and at least price or image
    return hasTitle && (hasPrice || hasImage)
  }

  // Detect drilldown-start flag (from home search)
  const drillFlag = searchParams.get('drill')
  const inDrillMode = !!drillFlag
  
  // NEW: Vehicle search mode - show products directly instead of category selection
  const vehicleSearchFlag = searchParams.get('vehicleSearch')
  const inVehicleSearchMode = !!vehicleSearchFlag

  // Helper to toggle entries in a Set state
  const toggleSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  // Derive brand and category options from search results
  const allSearchBrands = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const p of searchResults) {
      const b = brandOf(p)
      if (b) set.add(b)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [searchResults])

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

  const allSearchCats = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const p of searchResults) {
      const raw = (p as any)?.category
      const name = resolveCategoryName(raw) || categoryOf(p)
      if (name) set.add(name)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [searchResults, resolveCategoryName])

  // --- Vehicle compatibility matching (shared util) ---
  const productMatchesVehicle = (p: any) => {
    if (!hasVehicleFilter) return true
    const cid = categoryIdOf(p)
    if (cid && NON_VEHICLE_CATEGORY_IDS.has(cid)) return true // skip filtering for non-vehicle categories
    
    // Delegate entirely to the shared service which now handles 
    // strict ID checks, token-based model safety, and fuzzy engine matching.
    return sharedVehicleMatches(p, vehFilter)
  }

  // --- Search Results Filtering ---
  // 1. Base list based on text search + sidebar filters + vehicle
  const baseSearchResults = useMemo<ApiProduct[]>(() => {
    return searchResults
      .filter((p) => {
        const b = brandOf(p)
        const cName = resolveCategoryName((p as any)?.category) || categoryOf(p)
        const brandPass = selectedBrands.size === 0 || (b && selectedBrands.has(b))
        const catPass = selectedCats.size === 0 || (cName && selectedCats.has(cName))
        return brandPass && catPass
      })
      .filter(productMatchesVehicle)
  }, [searchResults, selectedBrands, selectedCats, vehFilter])

  // 2. Final list with Manufacturer Filter
  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    if (!selectedManufacturerId) return baseSearchResults
    return baseSearchResults.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [baseSearchResults, selectedManufacturerId])

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

  // Scroll when category selected (to sub-categories) once loaded
  useEffect(() => {
    if (activeCatId && !activeSubCatId && !subCatsLoading) {
      requestAnimationFrame(() => scrollToEl(catSectionRef.current))
    }
  }, [activeCatId, activeSubCatId, subCatsLoading])

  // Scroll when sub-category selected (to sub-sub categories) once loaded
  useEffect(() => {
    if (activeSubCatId && !activeSubSubCatId && !subSubCatsLoading) {
      requestAnimationFrame(() => scrollToEl(subSubCatSectionRef.current))
    }
  }, [activeSubCatId, activeSubSubCatId, subSubCatsLoading])

  // Scroll when sub-sub-category selected (to products) once loaded
  useEffect(() => {
    if (activeSubSubCatId && !subProductsLoading) {
      requestAnimationFrame(() => scrollToEl(productsSectionRef.current))
    }
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

  // Fetch vehicle models when brand is selected
  useEffect(() => {
    let alive = true
    if (!activeVehicleBrand) { setVehicleModels([]); return }
    ; (async () => {
      try {
        setVehicleModelsLoading(true)
        // Extract unique models for the selected brand from product compatibility data
        const allProds = await getAllProducts()
        const prods = Array.isArray(allProds) ? allProds : []

        const modelsSet = new Set<string>()
        for (const p of prods) {
          const pData = (p as any)?.part || p
          const compat = pData?.compatibility || pData?.vehicle_compatibility || []
          const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])

          for (const c of compatList) {
            const cStr = typeof c === 'string' ? c : JSON.stringify(c)
            // Check if this compatibility entry mentions our brand
            if (cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())) {
              // Extract model name (simplified - you may need more sophisticated parsing)
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
        console.error('Failed to fetch vehicle models:', err)
        if (!alive) return
        setVehicleModels([])
      } finally {
        if (alive) setVehicleModelsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeVehicleBrand])

  // Fetch vehicle engines when model is selected
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
            // Check if this compatibility mentions our brand and model
            const brandMatch = cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())
            const modelMatch = cStr.toLowerCase().includes(activeVehicleModel.toLowerCase())

            if (brandMatch && modelMatch) {
              // Extract engine info (look for patterns like "2.5L", "V6", "1.8 TFSI" etc)
              const engineMatches = cStr.match(/\b\d+\.\d+\s*[LTV]?\w*\b|\bV\d+\b|\b\d+\.\d+\s+\w+\b/gi)
              if (engineMatches) {
                engineMatches.forEach(e => enginesSet.add(e.trim()))
              }
            }
          }
        }

        if (!alive) return
        setVehicleEngines(Array.from(enginesSet).sort())
      } catch (err) {
        console.error('Failed to fetch vehicle engines:', err)
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
    if (!qParam) { setSearchResults([]); setSelectedBrands(new Set()); setSelectedCats(new Set()); return }
    ; (async () => {
      try {
        setSearchLoading(true)
        const res = await liveSearch(qParam)
        if (!alive) return
        const list = Array.isArray(res) ? res : (res as any)?.data
        const items = Array.isArray(list) ? list : []
        
        // Filter out products with missing critical data (price or image)
        const completeProducts = items.filter(isCompleteProduct)
        
        const filtered = items.length - completeProducts.length
        if (filtered > 0) {
          console.info(`ℹ️ Filtered out ${filtered} incomplete products from search results (${completeProducts.length} valid products shown)`)
        }
        
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

  // Per-category expand state (replaces global pagination)
  const INITIAL_VISIBLE = 10
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

 // --- Load Full Catalog (Run once on mount) ---
  useEffect(() => {
    let alive = true
    
    async function loadCatalog() {
      try {
        setLoading(true)
        console.log('🔄 CarParts: Loading full catalog...')
        
        // Fetch both products and categories
        const [prods, c] = await Promise.all([
          getAllProducts(),
          getAllCategories(),
        ])
        
        if (!alive) return
        
        // 1. Process Products
        const rawProducts = Array.isArray(prods) ? prods : (prods as any)?.data || []
        // Filter out incomplete items
        const completeProducts = rawProducts.filter(isCompleteProduct)
        
        console.log(`✅ CarParts: Loaded ${completeProducts.length} valid products (from ${rawProducts.length} total)`)
        
        if (completeProducts.length === 0) {
           console.warn('⚠️ Warning: No valid products found. Check API or isCompleteProduct logic.')
        }

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

  // Ensure categories are available for search/drilldown mapping (if not already loaded)
  useEffect(() => {
    let alive = true
    if (categories.length === 0) {
      ; (async () => {
        try {
          const c = await getAllCategories()
          if (!alive) return
          setCategories(Array.isArray(c) ? c : [])
        } catch { // ignore }
        })()
    }
    return () => { alive = false }
  }, [qParam, activeCatId, categories.length])

  // Load accessories subcategories and products (real data from category id 4)
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
        if (!alive) return setAccSubCats([])
      } finally {
        if (alive) setAccSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    ; (async () => {
      try {
        setAccProductsLoading(true)
        // For performance, use first few subcategories and their first few sub-sub categories
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
            // Filter out incomplete products
            if (!isCompleteProduct(p)) continue
            seen.add(pid)
            combined.push(p)
          }
        }
        if (!alive) return setAccProducts(combined)
      } catch {
        if (!alive) return setAccProducts([])
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
    // Skip products with "Universal" compatibility
    if (compatStr.toLowerCase().trim() === 'universal') return false
    // Check if brand name appears in compatibility string (case-insensitive)
    return compatStr.toLowerCase().includes(brandName.toLowerCase())
  }, [])

  // --- Filtered Products Logic ---
  // 1. filtered: Applied Vehicle Compatibility + Brand Filter + Vehicle Drilldown
  // This list is used as the SOURCE for generating the Manufacturer Filter options
  const filtered = useMemo(() => {
    let list = products

    // Filter by brand compatibility (from header brand selection)
    if (activeBrandFilter) {
      list = list.filter((p) => isCompatibleWithBrand(p, activeBrandFilter))
    }

    // Filter by vehicle brand drill-down (from header) - only for Car Parts & Car Electricals
    if (inVehicleDrillMode && activeVehicleEngine) {
      list = list.filter((p) => {
        const cid = categoryIdOf(p)
        // Only apply to Car Parts (1) and Car Electricals (2)
        if (cid !== '1' && cid !== '2') return false
        
        const pData = (p as any)?.part || p
        const compat = pData?.compatibility || pData?.vehicle_compatibility || []
        const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
        
        // Filter out universal compatibility products
        const isUniversal = compatList.some((c: any) => 
          String(c).toLowerCase().trim() === 'universal'
        )
        if (isUniversal) return false

        // Check if ANY compatibility entry matches ALL 3 selected values
        return compatList.some((c: any) => {
          const cStr = typeof c === 'string' ? c : JSON.stringify(c)
          const brandMatch = cStr.toLowerCase().includes(activeVehicleBrand.toLowerCase())
          const modelMatch = cStr.toLowerCase().includes(activeVehicleModel.toLowerCase())
          // Fuzzy match for engine
          const engineTokens = activeVehicleEngine.split(/\s+/).filter(t => t.length > 1)
          const engineMatch = engineTokens.every(token => cStr.toLowerCase().includes(token.toLowerCase()))
          return brandMatch && modelMatch && engineMatch
        })
      })
    }

    // Apply global vehicle compatibility filter if set
    if (hasVehicleFilter) {
      list = list.filter(productMatchesVehicle)
    }

    return list
  }, [products, activeBrandFilter, inVehicleDrillMode, activeVehicleBrand, activeVehicleModel, activeVehicleEngine, hasVehicleFilter, vehFilter, isCompatibleWithBrand])

  // 2. manufacturerFiltered: 'filtered' + Manufacturer Filter
  // This list is used for DISPLAY
  const manufacturerFiltered = useMemo(() => {
    if (!selectedManufacturerId) return filtered
    return filtered.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [filtered, selectedManufacturerId])

  // --- Sub-Products Logic (Category Drilldown) ---
  // 1. baseSubProducts: Sub-Products + Vehicle Compatibility
  // Used as SOURCE for Manufacturer Filter in sub-category view
  const baseSubProducts = useMemo(() => {
    let base = subProducts
    if (!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && hasVehicleFilter) {
      base = base.filter(productMatchesVehicle)
    }
    return base
  }, [subProducts, hasVehicleFilter, activeCatId, vehFilter])

  // 2. filteredSubProducts: baseSubProducts + Manufacturer Filter
  // Used for DISPLAY in sub-category view
  const filteredSubProducts = useMemo(() => {
    if (!selectedManufacturerId) return baseSubProducts
    return baseSubProducts.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [baseSubProducts, selectedManufacturerId])

  // --- Filter Bar Component ---
  const ManufacturerFilterBar = ({ sourceProducts }: { sourceProducts: ApiProduct[] }) => {
    // Only show manufacturers that have at least one product in the source list
    const relatedMakerIds = useMemo(() => new Set(sourceProducts.map(p => makerIdOf(p)).filter(Boolean)), [sourceProducts])
    const manufacturerList = useMemo(() => manufacturers.filter(m => relatedMakerIds.has(String(m.id))), [manufacturers, relatedMakerIds])

    if (manufacturerList.length === 0) return null

    return (
      <div className="mb-4">
        <div className="mb-2 text-[13px] font-medium text-gray-700">Filter by manufacturer:</div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          <button
            type="button"
            className={`group relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${!selectedManufacturerId ? 'border-brand bg-white shadow-lg ring-1 ring-brand/30' : 'border-transparent bg-white ring-1 ring-black/10 hover:ring-brand/40'}`}
            onClick={() => setSelectedManufacturerId('')}
            aria-pressed={!selectedManufacturerId}
            title="All manufacturers"
          >
            <span className="text-[10px] font-medium text-gray-600">All</span>
          </button>
          {manufacturerList.map((m) => {
            const id = String(m.id);
            const active = selectedManufacturerId === id;
            const img = manufacturerImageFrom(m) || normalizeApiImage(m.image) || '';
            const name = String(m.name || m.title || (m as any).maker_name || (m as any).manufacturer_name || 'Manufacturer');
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedManufacturerId(id)}
                className={`group relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:h-[76px] sm:w-[76px] ${active ? 'border-brand bg-white shadow-lg ring-1 ring-brand/30' : 'border-transparent bg-white ring-1 ring-black/10 hover:ring-brand/40'}`}
                aria-pressed={active}
                title={name}
              >
                {img ? (
                  <img src={img} alt={name} className="h-10 w-10 object-contain" loading="lazy" />
                ) : (
                  <span className="text-[10px] font-medium text-gray-600">{name}</span>
                )}
                <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- Display filtering & search inside main views ---
  const [pageSearch, setPageSearch] = useState('')
  
  // Logic to filter the *Manufacturer Filtered* list by text search
  const matchesPageSearch = useCallback((p: ApiProduct) => {
    if (!pageSearch.trim()) return true
    const term = pageSearch.toLowerCase()
    const name = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || '').toLowerCase()
    const art = String((p as any)?.article_no || (p as any)?.sku || '').toLowerCase()
    return name.includes(term) || art.includes(term)
  }, [pageSearch])

  // Final list for display (Catalogue & Brand Views)
  const displayFiltered = useMemo(() => {
    // 1. Start with manufacturerFiltered (which includes base filters + manufacturer)
    let list = manufacturerFiltered
    
    // 2. Apply page text search
    if (pageSearch.trim()) {
      list = list.filter(matchesPageSearch)
    }
    
    // 3. For Vehicle Search mode, we might filter by category if user picked one
    if (inVehicleSearchMode && vehicleSearchCategoryFilter) {
      list = list.filter(p => categoryIdOf(p) === vehicleSearchCategoryFilter)
    }
    
    return list
  }, [manufacturerFiltered, pageSearch, inVehicleSearchMode, vehicleSearchCategoryFilter, matchesPageSearch])

  const filteredPaged = displayFiltered // (Pagination logic was replaced by infinite scroll style expand)

  const productsInActiveCategory = useMemo(() => {
    if (!activeCatId) return []
    return displayFiltered.filter(p => categoryIdOf(p) === activeCatId)
  }, [displayFiltered, activeCatId])

  // Derive categories available in vehicle search mode
  const availableVehicleSearchCategories = useMemo(() => {
    const cats = new Set<string>()
    // Use manufacturerFiltered as base so categories update when manufacturer changes
    manufacturerFiltered.forEach(p => {
      const cid = categoryIdOf(p)
      if (cid) cats.add(cid)
    })
    return Array.from(cats).map(id => categoriesById.get(id)).filter(Boolean) as ApiCategory[]
  }, [manufacturerFiltered, categoriesById])

  // --- Main Render ---
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_1fr]">
      {/* LEFT COLUMN: Vehicle Filter */}
      <div className="space-y-4 self-start">
        <VehicleFilter onChange={(filter) => {
          setVehFilter(filter)
          // Persist the filter
          setPersistedVehicleFilter(filter)
        }} />
        
        {/* Category Image (Desktop) */}
        {!inDrillMode && activeCatId && !inBrandDrillMode && (
          <div className="hidden lg:block rounded-xl bg-white p-3 ring-1 ring-black/10 shadow-sm">
             {(() => {
                const cObj = categoriesById.get(activeCatId)
                const img = cObj ? (categoryImageFrom(cObj) || normalizeApiImage(pickImage(cObj) || '')) : null
                if (!img) return null
                return <img src={img} alt="" className="mx-auto h-28 w-auto object-contain" />
             })()}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Main Content */}
      <main className="space-y-6 min-w-0">
        
        {/* VIEW 1: SEARCH RESULTS */}
        {qParam ? (
          <>
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">Search Results for "{qParam}"</h1>
              <span className="text-sm text-gray-500">{filteredSearchResults.length} found</span>
            </div>
            
            {/* Manufacturer Filter */}
            <ManufacturerFilterBar sourceProducts={baseSearchResults} />

            {searchLoading ? (
              <FallbackLoader />
            ) : filteredSearchResults.length === 0 ? (
              <div className="rounded-xl bg-white p-8 text-center ring-1 ring-black/10">
                <p className="text-gray-600">No results found matching your criteria.</p>
                <Link to="/parts" className="mt-4 inline-block text-brand font-medium hover:underline">Browse all parts</Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {filteredSearchResults.map((p) => {
                  const data = mapProductToActionData(p)
                  return (
                    <ProductActionCard 
                      key={data.id} 
                      {...data}
                      onAddToCart={(id, qty) => {
                        if (user) addToCartApi({ user_id: user.id, product_id: id, quantity: qty }).then(() => { toast.success('Added to cart'); navigate({ hash: '#cart' }) })
                        else { addGuestCartItem(id, qty); toast.success('Added to cart'); navigate({ hash: '#cart' }) }
                      }}
                    />
                  )
                })}
              </div>
            )}
          </>
        ) : 
        
        /* VIEW 2: BRAND FILTER MODE (Shop by Brand) */
        activeBrandFilter ? (
          <>
            <div className="mb-4">
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeBrandFilter} Parts</h1>
              <p className="text-sm text-gray-600 mt-1">
                Showing compatible parts for {activeBrandFilter}. 
                {hasVehicleFilter && ' Filtered by your vehicle selection.'}
              </p>
            </div>

            {/* Manufacturer Filter */}
            <ManufacturerFilterBar sourceProducts={filtered} />

            <div className="mb-4">
              <input 
                type="search" 
                placeholder={`Search ${activeBrandFilter} parts...`} 
                value={pageSearch}
                onChange={e => setPageSearch(e.target.value)}
                className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {displayFiltered.length === 0 ? (
              <div className="rounded-xl bg-white p-12 text-center ring-1 ring-black/10">
                <p className="text-gray-500">No parts found for {activeBrandFilter} matching your filters.</p>
                <button onClick={() => { setVehFilter({ brandId: '', modelId: '', engineId: '', brandName: '', modelName: '', engineName: '' }); setPersistedVehicleFilter({}) }} className="mt-2 text-brand font-medium hover:underline">
                  Reset vehicle filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                {displayFiltered.slice(0, expanded['brand'] ? undefined : INITIAL_VISIBLE).map((p) => {
                  const data = mapProductToActionData(p)
                  return (
                    <ProductActionCard 
                      key={data.id} 
                      {...data}
                      onAddToCart={(id, qty) => {
                        if (user) addToCartApi({ user_id: user.id, product_id: id, quantity: qty }).then(() => { toast.success('Added to cart'); navigate({ hash: '#cart' }) })
                        else { addGuestCartItem(id, qty); toast.success('Added to cart'); navigate({ hash: '#cart' }) }
                      }}
                    />
                  )
                })}
              </div>
            )}
            {displayFiltered.length > INITIAL_VISIBLE && (
              <div className="mt-6 flex justify-center">
                <button 
                  onClick={() => setExpanded(prev => ({...prev, brand: !prev.brand}))}
                  className="rounded-full bg-white px-6 py-2 text-sm font-semibold shadow ring-1 ring-black/10 hover:bg-gray-50"
                >
                  {expanded['brand'] ? 'Show Less' : `Show All (${displayFiltered.length})`}
                </button>
              </div>
            )}
          </>
        ) :

        /* VIEW 3: VEHICLE DRILLDOWN MODE (Brand/Model/Engine from header) */
        inVehicleDrillMode ? (
          <>
             {/* ... (Keep existing selection UI for Brand/Model/Engine) ... */}
             <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/10 mb-8">
               <h2 className="mb-4 text-lg font-bold text-gray-900">Select Your Vehicle</h2>
               <div className="grid gap-4 sm:grid-cols-3">
                 {/* Brand Select */}
                 <div>
                   <label className="mb-1.5 block text-xs font-semibold text-gray-700">Make</label>
                   <select 
                     value={activeVehicleBrand} 
                     onChange={(e) => { 
                       setParams({ vehicleBrand: e.target.value, vehicleModel: '', vehicleEngine: '' })
                       setActiveVehicleModel(''); setActiveVehicleEngine('');
                     }} 
                     className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:border-brand focus:ring-brand"
                   >
                     <option value="">Select Make</option>
                     {/* We could use manufacturers here but keeping it simple with param or uniq brands */}
                     <option value={activeVehicleBrand}>{activeVehicleBrand}</option>
                   </select>
                 </div>
                 {/* Model Select */}
                 <div>
                   <label className="mb-1.5 block text-xs font-semibold text-gray-700">Model</label>
                   <select 
                     value={activeVehicleModel} 
                     onChange={(e) => {
                       setParams({ vehicleModel: e.target.value, vehicleEngine: '' })
                       setActiveVehicleEngine('')
                     }}
                     disabled={!activeVehicleBrand}
                     className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:border-brand focus:ring-brand disabled:opacity-50"
                   >
                     <option value="">Select Model</option>
                     {vehicleModels.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                 </div>
                 {/* Engine Select */}
                 <div>
                   <label className="mb-1.5 block text-xs font-semibold text-gray-700">Engine / Trim</label>
                   <select 
                     value={activeVehicleEngine} 
                     onChange={(e) => setParams({ vehicleEngine: e.target.value })}
                     disabled={!activeVehicleModel}
                     className="w-full rounded-lg border-gray-300 bg-gray-50 text-sm focus:border-brand focus:ring-brand disabled:opacity-50"
                   >
                     <option value="">Select Engine</option>
                     {vehicleEngines.map(e => <option key={e} value={e}>{e}</option>)}
                   </select>
                 </div>
               </div>
             </div>

             {/* Results Grid when Engine Selected */}
             {activeVehicleBrand && activeVehicleModel && activeVehicleEngine && (
               <>
                 <div className="mb-4">
                   <h3 className="text-xl font-bold text-gray-900">Compatible Parts</h3>
                   <p className="text-sm text-gray-600">
                     Found {filteredPaged.length} parts for {activeVehicleBrand} {activeVehicleModel} {activeVehicleEngine}
                   </p>
                 </div>

                 {/* Manufacturer Filter */}
                 <ManufacturerFilterBar sourceProducts={filtered} />

                 <div className="mb-4">
                    <input 
                      type="search" 
                      placeholder="Filter parts..." 
                      value={pageSearch}
                      onChange={e => setPageSearch(e.target.value)}
                      className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
                    />
                 </div>

                 {filteredPaged.length > 0 ? (
                   <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                     {filteredPaged.slice(0, expanded['veh-drill'] ? undefined : INITIAL_VISIBLE).map((p) => {
                        const data = mapProductToActionData(p)
                        return (
                          <ProductActionCard 
                            key={data.id} 
                            {...data}
                            onAddToCart={(id, qty) => {
                              if (user) addToCartApi({ user_id: user.id, product_id: id, quantity: qty }).then(() => { toast.success('Added to cart'); navigate({ hash: '#cart' }) })
                              else { addGuestCartItem(id, qty); toast.success('Added to cart'); navigate({ hash: '#cart' }) }
                            }}
                          />
                        )
                     })}
                   </div>
                 ) : (
                   <div className="rounded-xl bg-white p-8 text-center ring-1 ring-black/10">
                     <p className="text-gray-500">No specific parts found matching this exact configuration.</p>
                   </div>
                 )}
               </>
             )}
          </>
        ) :

        /* VIEW 4: CATEGORY DRILLDOWN (Standard Browse) */
        activeCatId ? (
          <>
            {/* ... Sub Category List ... */}
            <div ref={catSectionRef} className="scroll-mt-32">
              <h1 className="mb-4 text-2xl font-bold text-gray-900">
                {categoriesById.get(activeCatId)?.title || categoriesById.get(activeCatId)?.name || 'Category'}
              </h1>
              {subCatsLoading ? <FallbackLoader /> : subCats.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {subCats.map(sc => (
                    <button
                      key={sc.id}
                      onClick={() => { setActiveSubCatId(sc.id); setParams({ subCatId: sc.id, subSubCatId: '' }) }}
                      className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${activeSubCatId === sc.id ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-gray-200 bg-white hover:border-brand/50'}`}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F6F5FA]">
                        <img src={sc.image} alt="" className="h-10 w-10 object-contain" />
                      </div>
                      <span className="text-center text-xs font-semibold text-gray-900 line-clamp-2">{sc.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No sub-categories found.</p>
              )}
            </div>

            {/* Sub-Sub Categories (Pills) */}
            {activeSubCatId && (
              <div ref={subSubCatSectionRef} className="mt-8 scroll-mt-32">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Select Type</h3>
                {subSubCatsLoading ? <div className="h-10 w-full animate-pulse rounded bg-gray-100" /> : (
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => { setActiveSubSubCatId(''); setParams({ subSubCatId: '' }) }}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${!activeSubSubCatId ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}
                    >
                      All
                    </button>
                    {subSubCats.map(ssc => (
                      <button
                        key={ssc.id}
                        onClick={() => { setActiveSubSubCatId(ssc.id); setParams({ subSubCatId: ssc.id }) }}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${activeSubSubCatId === ssc.id ? 'bg-brand text-white' : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'}`}
                      >
                        {ssc.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Products Grid (when sub-sub-cat selected) */}
            {activeSubSubCatId && (
              <div ref={productsSectionRef} className="mt-8 scroll-mt-32">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Products</h3>
                  <span className="text-sm text-gray-500">{filteredSubProducts.length} items</span>
                </div>

                {/* Manufacturer Filter */}
                <ManufacturerFilterBar sourceProducts={baseSubProducts} />

                {subProductsLoading ? <FallbackLoader /> : filteredSubProducts.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredSubProducts.map(p => {
                      const data = mapProductToActionData(p)
                      return (
                        <ProductActionCard 
                          key={data.id} 
                          {...data}
                          onAddToCart={(id, qty) => {
                            if (user) addToCartApi({ user_id: user.id, product_id: id, quantity: qty }).then(() => { toast.success('Added to cart'); navigate({ hash: '#cart' }) })
                            else { addGuestCartItem(id, qty); toast.success('Added to cart'); navigate({ hash: '#cart' }) }
                          }}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white p-8 text-center ring-1 ring-black/10">
                    <p className="text-gray-500">No products found in this category matching your filters.</p>
                  </div>
                )}
              </div>
            )}

            {/* Search within category (if no sub-sub selected) */}
            {!activeSubSubCatId && (
              <div className="mt-10 border-t pt-8">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Search in this category</h3>
                </div>
                <input 
                  type="search" 
                  placeholder="Type part name..." 
                  value={pageSearch}
                  onChange={e => setPageSearch(e.target.value)}
                  className="mb-6 w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-brand focus:ring-1 focus:ring-brand"
                />
                
                {/* Only show manufacturer filter if we have a search term or list isn't empty? 
                    Actually, let's show it if we have filtered items 
                */}
                {productsInActiveCategory.length > 0 && <ManufacturerFilterBar sourceProducts={productsInActiveCategory} />}

                {productsInActiveCategory.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
                    {productsInActiveCategory.slice(0, expanded['cat-search'] ? undefined : INITIAL_VISIBLE).map(p => {
                      const data = mapProductToActionData(p)
                      return <ProductActionCard key={data.id} {...data} onAddToCart={(id, qty) => {
                        if (user) addToCartApi({ user_id: user.id, product_id: id, quantity: qty }).then(() => { toast.success('Added to cart'); navigate({ hash: '#cart' }) })
                        else { addGuestCartItem(id, qty); toast.success('Added to cart'); navigate({ hash: '#cart' }) }
                      }} />
                    })}
                  </div>
                ) : pageSearch ? (
                  <p className="text-sm text-gray-500">No matching parts found in this category.</p>
                ) : null}
              </div>
            )}
          </>
        ) : (
          /* DEFAULT: Browse Categories */
          <>
            <Crumb />
            <div className="mt-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/10">
              <h1 className="mb-2 text-2xl font-bold text-gray-900">Car Parts Catalogue</h1>
              <p className="mb-6 text-sm text-gray-600">Select a category to start browsing parts.</p>
              
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
                {categories.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setActiveCatId(String(c.id)); setParams({ catId: String(c.id) }) }}
                    className="group relative flex flex-col items-center rounded-xl border border-gray-100 bg-white p-4 transition-all hover:border-brand hover:shadow-md"
                  >
                    <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-[#F6F5FA] group-hover:bg-brand/5">
                      <img 
                        src={categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || logoImg} 
                        alt="" 
                        className="h-12 w-12 object-contain"
                      />
                    </div>
                    <span className="text-center text-sm font-bold text-gray-900">{c.title || c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function CarParts() {
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 md:px-6">
      <ErrorBoundary>
        <CarPartsInner />
      </ErrorBoundary>
    </div>
  )
}
