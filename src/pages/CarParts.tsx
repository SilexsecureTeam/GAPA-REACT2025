import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductActionCard from '../components/ProductActionCard'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getSubCategories, getSubSubCategories, getProductsBySubSubCategory, liveSearch, addToCartApi, type ApiManufacturer } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, subCategoryImageFrom, subSubCategoryImageFrom, manufacturerImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import TopBrands from '../components/TopBrands'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import BrandDrilldown from '../components/BrandDrilldown'
import { getPersistedVehicleFilter, setPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'
import useWishlist from '../hooks/useWishlist'
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
    console.error('CarParts error boundary caught an error:', error, info)
  }
  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null })
  }
  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'Something went wrong.'
      return (
        <div className="mx-auto my-6 max-w-3xl rounded-xl bg-red-50 p-4 text-red-900 ring-1 ring-red-200">
          <h2 className="text-lg font-semibold">Something went wrong on this page.</h2>
          <p className="mt-2 text-sm">{message}</p>
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

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

// Pagination helper component moved outside to prevent re-renders
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
            <button onClick={() => setPage(1)} disabled={page === 1} aria-label="Go to first page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>
              «
            </button>
          </li>
          <li>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="Previous page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>
              ‹
            </button>
          </li>

          {pages.map((p, idx) => (
            <li key={`p-${idx}`}>
              {p === '...' ? (
                <div className="inline-flex h-9 min-w-[44px] items-center justify-center text-sm text-gray-500">…</div>
              ) : (
                <button onClick={() => setPage(Number(p))} aria-current={p === page ? 'page' : undefined} className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${p === page ? 'bg-brand text-white shadow' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>
                  {p}
                </button>
              )}
            </li>
          ))}

          <li>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} aria-label="Next page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>
              ›
            </button>
          </li>
          <li>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Go to last page" className={`inline-flex h-9 min-w-[44px] items-center justify-center rounded-md px-3 text-sm ${page === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 ring-1 ring-black/5 hover:bg-gray-50'}`}>
              »
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}

function CarPartsInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])

  // Manufacturer Hook & State
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
    const hasImage = !!(p?.img_url || p?.imgUrl || p?.image || p?.photo)
    return hasTitle && (hasPrice || hasImage)
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
    if (cid && NON_VEHICLE_CATEGORY_IDS.has(cid)) return true 
    return sharedVehicleMatches(p, vehFilter)
  }

  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    return searchResults
      .filter((p) => {
        const b = brandOf(p)
        const cName = resolveCategoryName((p as any)?.category) || categoryOf(p)
        const brandPass = selectedBrands.size === 0 || (b && selectedBrands.has(b))
        const catPass = selectedCats.size === 0 || (cName && selectedCats.has(cName))
        const manuPass = !selectedManufacturerId || makerIdOf(p) === selectedManufacturerId
        return brandPass && catPass && manuPass
      })
      .filter(productMatchesVehicle)
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

  // Vehicle brand drill-down state
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
      const pIdString = String(pId).trim()
      if (pIdString === targetId) return true
      return false
    })
  }, [products, activeSubSubCatId])

  const subProductsLoading = loading

  // Accessories data (category id: 4)
  const ACCESSORIES_CAT_ID = '4'
  const [accSubCats, setAccSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [, setAccSubCatsLoading] = useState(false)
  const [accProducts, setAccProducts] = useState<ApiProduct[]>([])
  const [, setAccProductsLoading] = useState(false)

  // --- Scroll refs for drill-down sections ---
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

  // Scroll effects
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
        console.error('Failed to fetch vehicle models:', err)
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
        const completeProducts = items.filter(isCompleteProduct)
        const filtered = items.length - completeProducts.length
        if (filtered > 0) {
          console.info(`ℹ️ Filtered out ${filtered} incomplete products`)
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
    if (!merged.catId) delete merged.catId
    if (!merged.subCatId) delete merged.subCatId
    if (!merged.subSubCatId) delete merged.subSubCatId
    if (!merged.vehicleBrand) delete merged.vehicleBrand
    if (!merged.vehicleModel) delete merged.vehicleModel
    if (!merged.vehicleEngine) delete merged.vehicleEngine
    setSearchParams(merged, { replace: false })
  }

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
        const rawProducts = Array.isArray(prods) ? prods : (prods as any)?.data || []
        const completeProducts = rawProducts.filter(isCompleteProduct)
        setProducts(completeProducts)
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

  // Load accessories (legacy logic, kept for consistency)
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

  // Ref for auto-scroll
  const productsRef = useRef<HTMLDivElement>(null)

  // Helper to check if product is compatible with a brand
  const isCompatibleWithBrand = useCallback((p: any, brandName: string): boolean => {
    const pData = (p as any)?.part || p
    const compat = pData?.compatibility || pData?.vehicle_compatibility || ''
    const compatStr = typeof compat === 'string' ? compat : JSON.stringify(compat)
    if (compatStr.toLowerCase().trim() === 'universal') return false
    return compatStr.toLowerCase().includes(brandName.toLowerCase())
  }, [])

  // Apply vehicle compatibility filter globally
  const filtered = useMemo(() => {
    let list = products

    if (activeBrandFilter) {
      list = list.filter((p) => isCompatibleWithBrand(p, activeBrandFilter))
    }

    if (inVehicleDrillMode && activeVehicleEngine) {
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
    } else if (inVehicleDrillMode && activeVehicleModel && !activeVehicleEngine) {
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
    } else if (inVehicleDrillMode && activeVehicleBrand && !activeVehicleModel) {
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

    if (hasVehicleFilter) {
      list = list.filter(productMatchesVehicle)
    }

    // Apply manufacturer filter
    if (selectedManufacturerId) {
       list = list.filter(p => makerIdOf(p) === selectedManufacturerId)
    }

    return list
  }, [products, hasVehicleFilter, vehFilter, inVehicleDrillMode, activeVehicleBrand, activeVehicleModel, activeVehicleEngine, activeBrandFilter, isCompatibleWithBrand, inBrandDrillMode, selectedManufacturerId])

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

  const displayFiltered = useMemo(() => {
    if (!pageSearch || !pageSearch.trim()) return filtered
    return filtered.filter(p => matchesPageSearch(p))
  }, [filtered, pageSearch, matchesPageSearch])

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

  // Filter products for vehicle search mode
  const filteredWithCategory = useMemo(() => {
    if (!vehicleSearchCategoryFilter) return displayFiltered
    return displayFiltered.filter(p => {
      const raw = (p as any)?.category
      const catName = resolveCategoryName(raw) || categoryOf(p)
      return catName.toLowerCase() === vehicleSearchCategoryFilter.toLowerCase()
    })
  }, [displayFiltered, vehicleSearchCategoryFilter, resolveCategoryName])

  // Extract unique categories for vehicle search
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

  // Auto-scroll effect for brand drilldown
  useEffect(() => {
    if (inBrandDrillMode && vehFilter.brandName && vehFilter.modelName && displayFiltered.length > 0 && productsRef.current) {
      setTimeout(() => {
        const y = (productsRef.current?.getBoundingClientRect().top || 0) + window.scrollY - SCROLL_OFFSET
        window.scrollTo({ top: y, behavior: 'smooth' })
      }, 300)
    }
  }, [inBrandDrillMode, vehFilter.brandName, vehFilter.modelName, displayFiltered.length])

  // Group by category
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

  const wishlist = useWishlist()

  // Actions
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

  const filteredSubProducts = useMemo(() => {
    let base = subProducts
    if (!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && hasVehicleFilter) {
      base = base.filter(productMatchesVehicle)
    }
    if (selectedManufacturerId) {
       base = base.filter(p => makerIdOf(p) === selectedManufacturerId)
    }
    return base
  }, [subProducts, hasVehicleFilter, activeCatId, vehFilter, selectedManufacturerId])

  const PAGE_SIZE_DEFAULT = 16;
  const [brandPage, setBrandPage] = useState(1);
  const [brandPageSize, setBrandPageSize] = useState(PAGE_SIZE_DEFAULT);
  
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
  
  const [filteredPage, setFilteredPage] = useState(1)
  const [filteredPageSize, setFilteredPageSize] = useState(12)
  useEffect(() => { setFilteredPage(1) }, [displayFiltered, filteredPageSize])
  const filteredPaged = displayFiltered.slice((filteredPage - 1) * filteredPageSize, filteredPage * filteredPageSize)

  const [subProductsPage, setSubProductsPage] = useState(1)
  const [subProductsPageSize, setSubProductsPageSize] = useState(12)
  useEffect(() => { setSubProductsPage(1) }, [filteredSubProducts, subProductsPageSize])
  const subProductsPaged = filteredSubProducts.slice((subProductsPage - 1) * subProductsPageSize, subProductsPage * subProductsPageSize)

  const [searchPage, setSearchPage] = useState(1)
  const [searchPageSize, setSearchPageSize] = useState(12)
  useEffect(() => { setSearchPage(1) }, [filteredSearchResults, searchPageSize])
  const searchPaged = filteredSearchResults.slice((searchPage - 1) * searchPageSize, searchPage * searchPageSize)

  // --- Manufacturer Filter Helper ---
  const handleManufacturerSelect = useCallback((manufacturer: ApiManufacturer | null) => {
    if (!manufacturer) {
      setSelectedManufacturerId('')
      return
    }
    const rawId = (manufacturer as any)?.saler_id
      ?? manufacturer.id
      ?? (manufacturer as any)?.maker_id_
      ?? (manufacturer as any)?.maker_id
      ?? (manufacturer as any)?.manufacturer_id
    const id = rawId != null ? String(rawId) : ''
    setSelectedManufacturerId(id)
  }, [])

  const renderManufacturerFilter = (currentProducts: ApiProduct[]) => {
    const availableMakerIds = new Set(currentProducts.map(p => makerIdOf(p)).filter(Boolean))
    const manufacturerList = manufacturers.filter(m => availableMakerIds.has(String(m.id)))
    
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
            const id = String(m.id)
            const active = selectedManufacturerId === id
            const img = manufacturerImageFrom(m) || normalizeApiImage(m.image) || ''
            const name = String(m.name || m.title || (m as any).maker_name || (m as any).manufacturer_name || 'Manufacturer')
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleManufacturerSelect(m)}
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
            )
          })}
        </div>
      </div>
    )
  }
