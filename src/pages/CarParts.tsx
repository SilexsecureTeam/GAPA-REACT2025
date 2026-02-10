import React, { useEffect, useMemo, useState, Fragment, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductActionCard from '../components/ProductActionCard'
import { 
  getAllCategories, 
  getAllProducts, 
  type ApiCategory, 
  type ApiProduct, 
  getSubCategories, 
  getSubSubCategories, 
  getProductsBySubSubCategory, 
  liveSearch, 
  addToCartApi,
  type ApiManufacturer
} from '../services/api'
import { 
  normalizeApiImage, 
  pickImage, 
  productImageFrom, 
  categoryImageFrom, 
  subCategoryImageFrom, 
  subSubCategoryImageFrom,
  manufacturerImageFrom
} from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import TopBrands from '../components/TopBrands'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import BrandDrilldown from '../components/BrandDrilldown'
import ManufacturerSelector from '../components/ManufacturerSelector'
import { 
  getPersistedVehicleFilter, 
  setPersistedVehicleFilter, 
  vehicleMatches as sharedVehicleMatches, 
  type VehicleFilterState as VehState 
} from '../services/vehicle'
import useWishlist from '../hooks/useWishlist'
import useManufacturers from '../hooks/useManufacturers'
import WishlistButton from '../components/WishlistButton'
import { toast } from 'react-hot-toast'
import { 
  brandOf, 
  categoryOf, 
  mapProductToActionData, 
  toSlug,
  makerIdOf
} from '../utils/productMapping'

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
  
  // Manufacturer filtering states
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
  const hasManufacturerFilter = Boolean(selectedManufacturerId)
  
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

  // Helper to check if product has complete data
  const isCompleteProduct = (p: any): boolean => {
    const hasTitle = !!(p?.part_name || p?.name || p?.title)
    const hasPrice = !!(p?.price || p?.selling_price || p?.sellingPrice || p?.amount || p?.cost || p?.unit_price)
    const hasImage = !!(p?.img_url || p?.imgUrl || p?.image || p?.photo)
    return hasTitle && (hasPrice || hasImage)
  }

  // Detect drilldown-start flag
  const drillFlag = searchParams.get('drill')
  const inDrillMode = !!drillFlag
  
  // Vehicle search mode
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

  // Resolve category name from raw category field
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

  // --- Vehicle & Manufacturer compatibility matching ---
  const productMatchesFilters = (p: any) => {
    // 1. Vehicle Match
    let vehiclePass = true
    if (hasVehicleFilter) {
      const cid = categoryIdOf(p)
      if (!cid || !NON_VEHICLE_CATEGORY_IDS.has(cid)) {
        vehiclePass = sharedVehicleMatches(p, vehFilter)
      }
    }
    
    // 2. Manufacturer Match
    let manufacturerPass = true
    if (hasManufacturerFilter) {
      const productMakerId = makerIdOf(p)
      manufacturerPass = productMakerId === selectedManufacturerId
    }

    return vehiclePass && manufacturerPass
  }

  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    return searchResults
      .filter((p) => {
        const b = brandOf(p)
        const cName = resolveCategoryName((p as any)?.category) || categoryOf(p)
        const brandPass = selectedBrands.size === 0 || (b && selectedBrands.has(b))
        const catPass = selectedCats.size === 0 || (cName && selectedCats.has(cName))
        return brandPass && catPass
      })
      .filter(productMatchesFilters)
  }, [searchResults, selectedBrands, selectedCats, vehFilter, selectedManufacturerId])

  // Hierarchical navigation state
  const catIdParam = searchParams.get('catId') || ''
  const subCatIdParam = searchParams.get('subCatId') || ''
  const subSubCatIdParam = searchParams.get('subSubCatId') || ''
  const brandParam = searchParams.get('brand') || ''
  const brandIdParam = searchParams.get('brandId') || ''

  const [activeCatId, setActiveCatId] = useState<string>(catIdParam)
  const [activeSubCatId, setActiveSubCatId] = useState<string>(subCatIdParam)
  const [activeSubSubCatId, setActiveSubSubCatId] = useState<string>(subSubCatIdParam)
  const [activeBrandFilter, setActiveBrandFilter] = useState<string>(brandParam)
  
  const [vehicleSearchCategoryFilter, setVehicleSearchCategoryFilter] = useState<string>('')
  const [brandDrilldownCategoryFilter, setBrandDrilldownCategoryFilter] = useState<string>('')

  // Determine if vehicle filter should be shown
  const shouldShowVehicleFilter = useMemo(() =>
    !activeCatId || !NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)),
    [activeCatId, NON_VEHICLE_CATEGORY_IDS]
  )

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
    if (!products || products.length === 0) return []
    if (!activeSubSubCatId) return []

    const targetId = String(activeSubSubCatId).trim()
    return products.filter((p) => {
      const raw = (p as any).part || p
      const pId = raw.sub_sub_category ?? raw.sub_sub_category_id ?? raw.subSubCategoryId ?? ''
      return String(pId).trim() === targetId
    })
  }, [products, activeSubSubCatId])

  const subProductsLoading = loading

  // Accessories data
  const ACCESSORIES_CAT_ID = '4'
  const [accSubCats, setAccSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [accProducts, setAccProducts] = useState<ApiProduct[]>([])
  const [accProductsLoading, setAccProductsLoading] = useState(false)

  // --- Scroll refs ---
  const catSectionRef = useRef<HTMLDivElement | null>(null)
  const subSubCatSectionRef = useRef<HTMLDivElement | null>(null)
  const productsSectionRef = useRef<HTMLDivElement | null>(null)

  const SCROLL_OFFSET = 180
  const scrollToEl = (el: HTMLElement | null) => {
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const y = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET
    window.scrollTo({ top: y, behavior: prefersReduced ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    if (activeCatId && !activeSubCatId && !subCatsLoading) {
      requestAnimationFrame(() => scrollToEl(catSectionRef.current))
    }
  }, [activeCatId, activeSubCatId, subCatsLoading])

  useEffect(() => {
    if (activeSubCatId && !activeSubSubCatId && !subSubCatsLoading) {
      requestAnimationFrame(() => scrollToEl(subSubCatSectionRef.current))
    }
  }, [activeSubCatId, activeSubSubCatId, subSubCatsLoading])

  useEffect(() => {
    if (activeSubSubCatId && !subProductsLoading) {
      requestAnimationFrame(() => scrollToEl(productsSectionRef.current))
    }
  }, [activeSubSubCatId, subProductsLoading])

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
        if (alive) setVehicleModels(Array.from(modelsSet).sort())
      } catch (err) {
        console.error('Failed to fetch vehicle models:', err)
        if (alive) setVehicleModels([])
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
        if (alive) setVehicleEngines(Array.from(enginesSet).sort())
      } catch (err) {
        console.error('Failed to fetch vehicle engines:', err)
        if (alive) setVehicleEngines([])
      } finally {
        if (alive) setVehicleEnginesLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeVehicleBrand, activeVehicleModel])

  // Fetch drill-down subcategories
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
        if (alive) setSubCats([])
      } finally {
        if (alive) setSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeCatId])

  // Fetch drill-down sub-subcategories
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
        if (alive) setSubSubCats([])
      } finally {
        if (alive) setSubSubCatsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeSubCatId])

  // Fetch search results
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
        const completeProducts = items.filter(isCompleteProduct)
        setSearchResults(completeProducts as ApiProduct[])
      } catch (_) {
        if (alive) setSearchResults([])
      } finally {
        if (alive) setSearchLoading(false)
      }
    })()
    return () => { alive = false }
  }, [qParam])

  // Handler for Manufacturer Selection
  const handleManufacturerSelect = (manufacturer: ApiManufacturer | null) => {
    if (!manufacturer) {
      setSelectedManufacturerId('')
      return
    }
    const rawId = (manufacturer as any)?.saler_id
      ?? manufacturer.id
      ?? (manufacturer as any)?.maker_id_
      ?? (manufacturer as any)?.maker_id
      ?? (manufacturer as any)?.manufacturer_id
    setSelectedManufacturerId(rawId != null ? String(rawId) : '')
  }

  // Parameter helper
  const setParams = (next: Partial<{ catId: string; subCatId: string; subSubCatId: string; vehicleBrand: string; vehicleModel: string; vehicleEngine: string }>) => {
    const current: Record<string, string> = {}
    for (const [k, v] of Array.from(searchParams.entries())) current[k] = v
    const merged = { ...current, ...next }
    if (!merged.catId) delete merged.catId
    if (!merged.subCatId) delete merged.subCatId
    if (!merged.subSubCatId) delete merged.subSubCatId
    if (!merged.vehicleBrand) delete merged.vehicleBrand
    if (!merged.vehicleModel) delete merged.vehicleModel
    if (!merged.vehicleEngine) delete merged.vehicleEngine
    setSearchParams(merged, { replace: false })
  }

  const INITIAL_VISIBLE = 10
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  // --- Load Full Catalog ---
  useEffect(() => {
    let alive = true
    async function loadCatalog() {
      try {
        setLoading(true)
        const [prods, c] = await Promise.all([getAllProducts(), getAllCategories()])
        if (!alive) return
        const rawProducts = Array.isArray(prods) ? prods : (prods as any)?.data || []
        const completeProducts = rawProducts.filter(isCompleteProduct)
        setProducts(completeProducts)
        setCategories(Array.isArray(c) ? c : [])
      } catch (err) {
        if (alive) setProducts([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadCatalog()
    return () => { alive = false }
  }, [])

  // Accessory data loading
  useEffect(() => {
    let alive = true
    ; (async () => {
      try {
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
        if (alive) setAccSubCats([])
      }
    })()
    return () => { alive = false }
  }, [])

  // Ref for auto-scroll
  const productsRef = useRef<HTMLDivElement>(null)

  const isCompatibleWithBrand = useCallback((p: any, brandName: string): boolean => {
    const pData = (p as any)?.part || p
    const compat = pData?.compatibility || pData?.vehicle_compatibility || ''
    const compatStr = typeof compat === 'string' ? compat : JSON.stringify(compat)
    if (compatStr.toLowerCase().trim() === 'universal') return false
    return compatStr.toLowerCase().includes(brandName.toLowerCase())
  }, [])

  // --- Main Global Filter Logic ---
  const filtered = useMemo(() => {
    let list = products

    // 1. Manufacturer filter
    if (hasManufacturerFilter) {
      list = list.filter((p) => makerIdOf(p) === selectedManufacturerId)
    }

    // 2. Brand compatibility (header clicks)
    if (activeBrandFilter) {
      list = list.filter((p) => isCompatibleWithBrand(p, activeBrandFilter))
    }

    // 3. Vehicle drill-down (header clicks)
    if (inVehicleDrillMode && activeVehicleEngine) {
      list = list.filter((p) => {
        const cid = categoryIdOf(p)
        if (cid !== '1' && cid !== '2') return false
        const pData = (p as any)?.part || p
        const compat = pData?.compatibility || pData?.vehicle_compatibility || []
        const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
        if (compatList.some((c: any) => String(c).toLowerCase().trim() === 'universal')) return false
        for (const c of compatList) {
          const lowerStr = String(c).toLowerCase()
          if (lowerStr.includes(activeVehicleBrand.toLowerCase()) && 
              lowerStr.includes(activeVehicleModel.toLowerCase()) && 
              lowerStr.includes(activeVehicleEngine.toLowerCase())) return true
        }
        return false
      })
    } else if (inVehicleDrillMode && activeVehicleModel && !activeVehicleEngine) {
      list = list.filter((p) => {
        const cid = categoryIdOf(p)
        if (cid !== '1' && cid !== '2') return false
        const pData = (p as any)?.part || p
        const compat = pData?.compatibility || pData?.vehicle_compatibility || []
        const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
        if (compatList.some((c: any) => String(c).toLowerCase().trim() === 'universal')) return false
        for (const c of compatList) {
          const lowerStr = String(c).toLowerCase()
          if (lowerStr.includes(activeVehicleBrand.toLowerCase()) && lowerStr.includes(activeVehicleModel.toLowerCase())) return true
        }
        return false
      })
    } else if (inVehicleDrillMode && activeVehicleBrand && !activeVehicleModel) {
      list = list.filter((p) => {
        const cid = categoryIdOf(p)
        if (cid !== '1' && cid !== '2') return false
        const pData = (p as any)?.part || p
        const compat = pData?.compatibility || pData?.vehicle_compatibility || []
        const compatList = Array.isArray(compat) ? compat : (compat ? [compat] : [])
        if (compatList.some((c: any) => String(c).toLowerCase().trim() === 'universal')) return false
        for (const c of compatList) {
          if (String(c).toLowerCase().includes(activeVehicleBrand.toLowerCase())) return true
        }
        return false
      })
    }

    // 4. Regular vehicle filter
    if (hasVehicleFilter) {
      list = list.filter(p => sharedVehicleMatches(p, vehFilter))
    }

    return list
  }, [products, hasVehicleFilter, vehFilter, inVehicleDrillMode, activeVehicleBrand, activeVehicleModel, activeVehicleEngine, activeBrandFilter, isCompatibleWithBrand, selectedManufacturerId, hasManufacturerFilter])

  // Client-side text search on page
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

  const displayFiltered = useMemo(() => {
    if (!pageSearch || !pageSearch.trim()) return filtered
    return filtered.filter(p => matchesPageSearch(p))
  }, [filtered, pageSearch, matchesPageSearch])
 // --- Category Drilldown Helpers ---
  const activeCategoryObj = useMemo(() => {
    return categories.find(c => String((c as any).id ?? (c as any).category_id ?? '') === String(activeCatId))
  }, [categories, activeCatId])

  const activeSubCategoryObj = useMemo(() => {
    return subCats.find(sc => String(sc.id) === String(activeSubCatId))
  }, [subCats, activeSubCatId])

  const activeSubSubCategoryObj = useMemo(() => {
    return subSubCats.find(ssc => String(ssc.id) === String(activeSubSubCatId))
  }, [subSubCats, activeSubSubCatId])

  // --- Render Helpers ---
  if (loading && products.length === 0) return <FallbackLoader />

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      {/* Header / Breadcrumbs */}
      <div className="mx-auto max-w-[1400px] px-4 pt-6">
        <Crumb />
        <div className="mt-4 flex flex-col items-start justify-between gap-4 border-b border-gray-200 pb-6 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {activeSubSubCategoryObj?.name || activeSubCategoryObj?.name || activeCategoryObj?.title || 'Car Parts & Accessories'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {displayFiltered.length} products found
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 md:w-auto">
             {/* Integrated Manufacturer Filter */}
             <div className="w-full sm:w-[240px]">
                <ManufacturerSelector 
                  onSelect={handleManufacturerSelect}
                  selectedId={selectedManufacturerId}
                />
             </div>

             <div className="relative w-full sm:w-[300px]">
              <input
                type="text"
                placeholder="Search within results..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                className="w-full rounded-lg border-gray-300 py-2 pl-4 pr-10 text-sm focus:border-brand focus:ring-brand"
              />
              <span className="absolute right-3 top-2.5 text-gray-400">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
          
          {/* Sidebar Filters */}
          <aside className="space-y-8">
            {shouldShowVehicleFilter && (
              <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">Your Vehicle</h3>
                <VehicleFilter 
                  onFilterChange={(v) => {
                    setVehFilter(v)
                    setPersistedVehicleFilter(v)
                  }}
                  initialState={vehFilter}
                />
              </div>
            )}

            <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-900">Categories</h3>
              <nav className="space-y-1">
                {categories.map((cat) => {
                  const id = String((cat as any).id ?? (cat as any).category_id ?? '')
                  const isActive = activeCatId === id
                  return (
                    <button
                      key={id}
                      onClick={() => {
                        if (isActive) {
                          setParams({ catId: '', subCatId: '', subSubCatId: '' })
                        } else {
                          setParams({ catId: id, subCatId: '', subSubCatId: '' })
                        }
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive ? 'bg-brand/10 text-brand' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{(cat as any).title || (cat as any).name}</span>
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-brand" />}
                    </button>
                  )
                })}
              </nav>
            </div>
          </aside>

          {/* Product Grid / Drilldown View */}
          <section>
            {/* If we have subcategories to show */}
            {activeCatId && !activeSubCatId && (
              <div ref={catSectionRef} className="mb-12">
                <h2 className="mb-6 text-xl font-bold text-gray-900">Browse by Sub-Category</h2>
                {subCatsLoading ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-40 animate-pulse rounded-xl bg-gray-200" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {subCats.map((sc) => (
                      <button
                        key={sc.id}
                        onClick={() => setParams({ subCatId: sc.id })}
                        className="group flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md"
                      >
                        <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl bg-gray-50">
                          <img src={sc.image} alt={sc.name} className="h-full w-full object-contain transition-transform group-hover:scale-110" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{sc.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* If we have sub-subcategories to show */}
            {activeSubCatId && !activeSubSubCatId && (
              <div ref={subSubCatSectionRef} className="mb-12">
                <button 
                   onClick={() => setParams({ subCatId: '' })}
                   className="mb-4 flex items-center text-sm font-medium text-brand hover:underline"
                >
                  ← Back to Sub-Categories
                </button>
                <h2 className="mb-6 text-xl font-bold text-gray-900">Select Type</h2>
                {subSubCatsLoading ? (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200" />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                    {subSubCats.map((ssc) => (
                      <button
                        key={ssc.id}
                        onClick={() => setParams({ subSubCatId: ssc.id })}
                        className="group flex flex-col items-center rounded-xl bg-white p-3 text-center shadow-sm ring-1 ring-black/5 transition-all hover:shadow-md"
                      >
                        <div className="mb-2 h-16 w-16 overflow-hidden">
                          <img src={ssc.image} alt={ssc.name} className="h-full w-full object-contain group-hover:scale-110" />
                        </div>
                        <span className="text-xs font-bold text-gray-800">{ssc.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Products Grid */}
            <div ref={productsSectionRef}>
               {activeSubSubCatId && (
                 <button 
                  onClick={() => setParams({ subSubCatId: '' })}
                  className="mb-4 flex items-center text-sm font-medium text-brand hover:underline"
                >
                  ← Back to Types
                </button>
               )}
               
               {displayFiltered.length === 0 ? (
                 <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm ring-1 ring-black/5">
                   <div className="rounded-full bg-gray-50 p-6">
                     <svg className="h-12 w-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                     </svg>
                   </div>
                   <h3 className="mt-4 text-lg font-semibold text-gray-900">No products found</h3>
                   <p className="mt-1 text-gray-500">Try adjusting your filters or search terms</p>
                   {(hasVehicleFilter || hasManufacturerFilter) && (
                     <button 
                       onClick={() => {
                         setVehFilter({ brandName: '', modelName: '', engineName: '', year: '' })
                         setPersistedVehicleFilter({ brandName: '', modelName: '', engineName: '', year: '' })
                         setSelectedManufacturerId('')
                         setPageSearch('')
                       }}
                       className="mt-6 rounded-lg bg-brand px-6 py-2 text-sm font-bold text-white shadow-lg shadow-brand/20"
                     >
                       Clear All Filters
                     </button>
                   )}
                 </div>
               ) : (
                 <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                   {displayFiltered.map((p) => (
                     <ProductActionCard key={(p as any).id} product={mapProductToActionData(p)} />
                   ))}
                 </div>
               )}
            </div>
          </section>
        </div>
      </main>

      {/* SEO & Informational Section */}
      <section className="mx-auto mt-20 max-w-[1400px] px-4">
        <div className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-black/5 md:p-12">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Quality Parts for Every Vehicle</h2>
              <p className="mt-4 text-lg leading-relaxed text-gray-600">
                Gapa Naija is Nigeria's leading marketplace for high-quality auto parts and car accessories. 
                Whether you're performing routine maintenance or a major repair, we provide the reliable parts 
                you need to keep your vehicle running smoothly.
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Authentic Parts</h4>
                    <p className="text-sm text-gray-500">Direct from trusted manufacturers</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Fast Delivery</h4>
                    <p className="text-sm text-gray-500">Express shipping nationwide</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 rounded-2xl bg-gray-50 p-6 md:p-8">
              <h3 className="text-xl font-bold text-gray-900">Expert Support</h3>
              <p className="text-gray-600">Not sure which part fits your car? Our team of auto experts is ready to assist you in finding the perfect match.</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link to="/contact" className="inline-flex items-center justify-center rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800">
                  Contact Us
                </Link>
                <a href="tel:+234000000000" className="inline-flex items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-6 py-3 text-sm font-bold text-gray-900 transition-colors hover:bg-gray-50">
                  Call Expert
                </a>
              </div>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-8 border-t border-gray-100 pt-16 md:grid-cols-3">
             <div>
                <h4 className="font-bold text-gray-900 underline decoration-brand decoration-2 underline-offset-4">Essential Maintenance</h4>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li>Oil Filters & Engine Oil</li>
                  <li>Brake Pads & Rotors</li>
                  <li>Spark Plugs & Ignition</li>
                  <li>Batteries & Alternators</li>
                </ul>
             </div>
             <div>
                <h4 className="font-bold text-gray-900 underline decoration-brand decoration-2 underline-offset-4">Interior & Exterior</h4>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li>Floor Mats & Seat Covers</li>
                  <li>Headlights & Bulbs</li>
                  <li>Wiper Blades</li>
                  <li>Car Care & Cleaning</li>
                </ul>
             </div>
             <div>
                <h4 className="font-bold text-gray-900 underline decoration-brand decoration-2 underline-offset-4">Performance Tools</h4>
                <ul className="mt-4 space-y-2 text-sm text-gray-600">
                  <li>Diagnostic Tools</li>
                  <li>Socket Sets & Wrenches</li>
                  <li>Jacks & Stands</li>
                  <li>Tire Pressure Gauges</li>
                </ul>
             </div>
          </div>
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
