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
// --- Render ---
  if (loading) return <FallbackLoader />

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Search Header */}
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <Link to="/" className="flex-shrink-0">
            <img src={logoImg} alt="Gapa" className="h-8 w-auto" />
          </Link>
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                placeholder="Search within car parts..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
              />
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <Crumb />
        
        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Sidebar Filters */}
          <aside className="w-full flex-shrink-0 lg:w-64">
            <div className="sticky top-24 space-y-6">
              {/* Vehicle Filter - Fixed prop to onChange */}
              <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Vehicle Compatibility</h3>
                <VehicleFilter 
                  variant="sidebar"
                  onChange={(f) => {
                    setVehFilter(f)
                    setPersistedVehicleFilter(f)
                  }}
                />
              </div>

              {/* Categories Sidebar */}
              <div className="hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5 lg:block">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Categories</h3>
                <ul className="space-y-2 text-sm">
                  {topCats.map((c) => (
                    <li key={c.name}>
                      <button 
                        onClick={() => scrollToCat(c.name)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-gray-600 hover:bg-gray-50 hover:text-brand"
                      >
                        <span>{c.name}</span>
                        <span className="text-xs text-gray-400">{c.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {/* Page Title */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Car Parts Catalogue</h1>
              <p className="mt-2 text-gray-600">
                Browse our extensive collection of car parts and accessories. 
                {hasVehicleFilter ? (
                  <span className="font-medium text-brand"> Showing parts compatible with {vehicleEcho}.</span>
                ) : (
                  <span> Select your vehicle to see compatible parts.</span>
                )}
              </p>
            </div>

            {/* Top Brands Carousel */}
            <div className="mb-8 overflow-hidden rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
               <h2 className="mb-4 text-lg font-bold text-gray-900">Popular Brands</h2>
               <TopBrands />
            </div>

            {/* Active Filters Summary */}
            {(hasVehicleFilter || selectedManufacturerId) && (
              <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800 ring-1 ring-blue-100">
                <span className="font-medium">Active Filters:</span>
                {vehFilter.brandName && (
                  <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-black/10">
                    {vehFilter.brandName}
                  </span>
                )}
                {vehFilter.modelName && (
                  <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-black/10">
                    {vehFilter.modelName}
                  </span>
                )}
                 {selectedManufacturerId && (
                  <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-black/10">
                    Manufacturer: {manufacturers.find(m => String(m.id) === selectedManufacturerId)?.name || 'Unknown'}
                     <button onClick={() => setSelectedManufacturerId('')} className="ml-1 text-gray-400 hover:text-red-500">×</button>
                  </span>
                )}
                <button 
                  onClick={() => {
                    setVehFilter({ brandName: '', modelName: '', year: '', engineName: '' })
                    setPersistedVehicleFilter({ brandName: '', modelName: '', year: '', engineName: '' })
                    setSelectedManufacturerId('')
                  }}
                  className="ml-auto text-xs font-medium underline hover:text-blue-600"
                >
                  Clear All
                </button>
              </div>
            )}

            {/* Conditional Views based on Drilldown Mode */}
            
            {/* 1. Brand Drilldown Mode */}
            {inBrandDrillMode ? (
              <div className="space-y-8">
                 <BrandDrilldown 
                   initialBrandId={brandIdParam}
                   onCategorySelect={(catName) => setBrandDrilldownCategoryFilter(catName)}
                 />
                 
                 {/* Manufacturer Filter in Brand Drilldown Mode */}
                 {renderManufacturerFilter(paginatedBrandProducts)}

                 <div ref={productsRef} className="scroll-mt-24">
                   <h2 className="mb-4 text-xl font-bold text-gray-900">
                      {brandDrilldownCategoryFilter 
                        ? `${brandDrilldownCategoryFilter} for ${vehFilter.brandName || 'Selected Brand'}`
                        : `All Parts for ${vehFilter.brandName || 'Selected Brand'}`
                      }
                   </h2>
                   
                   {paginatedBrandProducts.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {paginatedBrandProducts.map((product) => (
                             <ProductActionCard 
                               key={product.id || (product as any).product_id}
                               product={product}
                               onAddToCart={() => onAddToCart(product)}
                               onViewDetails={() => onViewProduct(product)}
                             />
                          ))}
                        </div>
                        <PaginationControls 
                           page={brandPage}
                           setPage={setBrandPage}
                           pageSize={brandPageSize}
                           setPageSize={setBrandPageSize}
                           total={brandProductsSource.length}
                        />
                      </>
                   ) : (
                      <div className="rounded-xl bg-white p-12 text-center ring-1 ring-black/5">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                          <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No parts found</h3>
                        <p className="mt-1 text-gray-500">We couldn't find any parts matching your specific criteria.</p>
                        <button 
                           onClick={() => {
                             setBrandDrilldownCategoryFilter('')
                             setVehFilter({ brandName: '', modelName: '', year: '', engineName: '' })
                           }}
                           className="mt-4 text-sm font-medium text-brand hover:underline"
                        >
                          Clear filters
                        </button>
                      </div>
                   )}
                 </div>
              </div>

            ) : inVehicleSearchMode ? (
              /* 2. Vehicle Search Mode */
              <div className="space-y-8">
                 <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                       <div>
                          <h2 className="text-xl font-bold text-gray-900">
                             Parts for {activeVehicleBrand} {activeVehicleModel}
                          </h2>
                          <p className="text-sm text-gray-600">
                             {activeVehicleEngine ? `Engine: ${activeVehicleEngine}` : 'Select an engine to refine results'}
                          </p>
                       </div>
                       
                       {/* Engine Selector if missing */}
                       {!activeVehicleEngine && vehicleEngines.length > 0 && (
                          <div className="w-full md:w-64">
                             <select 
                                value={activeVehicleEngine}
                                onChange={(e) => setParams({ vehicleEngine: e.target.value })}
                                className="w-full rounded-lg border-gray-300 text-sm focus:border-brand focus:ring-brand"
                             >
                                <option value="">Select Engine...</option>
                                {vehicleEngines.map(e => <option key={e} value={e}>{e}</option>)}
                             </select>
                          </div>
                       )}
                    </div>

                    {/* Category Filter Pills */}
                    {availableCategories.length > 0 && (
                       <div className="mt-6">
                          <div className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by Category</div>
                          <div className="flex flex-wrap gap-2">
                             <button
                                onClick={() => setVehicleSearchCategoryFilter('')}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!vehicleSearchCategoryFilter ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                             >
                                All ({displayFiltered.length})
                             </button>
                             {availableCategories.map((cat) => (
                                <button
                                   key={cat.name}
                                   onClick={() => setVehicleSearchCategoryFilter(cat.name)}
                                   className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${vehicleSearchCategoryFilter === cat.name ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                >
                                   {cat.name} ({cat.count})
                                </button>
                             ))}
                          </div>
                       </div>
                    )}
                 </div>

                 {/* Manufacturer Filter in Vehicle Search Mode */}
                 {renderManufacturerFilter(filteredWithCategory)}

                 {/* Results Grid */}
                 <div className="space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="text-lg font-bold text-gray-900">
                          {vehicleSearchCategoryFilter || 'All'} Components
                       </h3>
                       <span className="text-sm text-gray-500">{filteredWithCategory.length} items</span>
                    </div>

                    {filteredWithCategory.length > 0 ? (
                       <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                          {filteredWithCategory.map((product) => (
                             <ProductActionCard 
                                key={product.id || (product as any).product_id}
                                product={product}
                                onAddToCart={() => onAddToCart(product)}
                                onViewDetails={() => onViewProduct(product)}
                             />
                          ))}
                       </div>
                    ) : (
                       <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
                          <p className="text-gray-500">No parts found for this specific configuration.</p>
                          <button 
                             onClick={() => setVehicleSearchCategoryFilter('')}
                             className="mt-2 text-sm font-medium text-brand hover:underline"
                          >
                             View all parts for this model
                          </button>
                       </div>
                    )}
                 </div>
              </div>

            ) : activeCatId ? (
              /* 3. Category Drilldown Mode */
              <div className="space-y-8">
                 {/* Breadcrumb / Back Navigation */}
                 <div className="flex items-center gap-2 text-sm text-gray-500">
                    <button onClick={() => setParams({ catId: '', subCatId: '', subSubCatId: '' })} className="hover:text-brand hover:underline">All Categories</button>
                    <span>›</span>
                    <span className={`font-medium ${!activeSubCatId ? 'text-gray-900' : ''}`}>{activeCategoryName}</span>
                    {activeSubCatId && (
                       <>
                          <span>›</span>
                          <button onClick={() => setParams({ subSubCatId: '' })} className={`hover:text-brand hover:underline ${!activeSubSubCatId ? 'font-medium text-gray-900' : ''}`}>
                             {activeSubCategoryName}
                          </button>
                       </>
                    )}
                    {activeSubSubCatId && (
                       <>
                          <span>›</span>
                          <span className="font-medium text-gray-900">{activeTypeName}</span>
                       </>
                    )}
                 </div>

                 {/* Level 1: Sub-Categories Selection */}
                 {!activeSubCatId && (
                    <div ref={catSectionRef} className="animate-fade-in space-y-4">
                       <h2 className="text-xl font-bold text-gray-900">Select a Sub-Category</h2>
                       {subCatsLoading ? (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                             {[1,2,3,4].map(i => <div key={i} className="h-32 animate-pulse rounded-xl bg-gray-200"></div>)}
                          </div>
                       ) : subCats.length > 0 ? (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                             {subCats.map((sc) => (
                                <button
                                   key={sc.id}
                                   onClick={() => setParams({ subCatId: sc.id })}
                                   className="group relative flex h-32 flex-col items-center justify-center overflow-hidden rounded-xl bg-white p-4 text-center shadow-sm ring-1 ring-black/10 transition hover:shadow-md hover:ring-brand/50"
                                >
                                   <div className="mb-2 h-16 w-16 opacity-80 transition group-hover:scale-110 group-hover:opacity-100">
                                      <img src={sc.image} alt="" className="h-full w-full object-contain" />
                                   </div>
                                   <span className="text-sm font-semibold text-gray-900 group-hover:text-brand">{sc.name}</span>
                                </button>
                             ))}
                          </div>
                       ) : (
                          <div className="py-12 text-center text-gray-500">No sub-categories found.</div>
                       )}
                    </div>
                 )}

                 {/* Level 2: Sub-Sub-Categories (Pills) */}
                 {activeSubCatId && (
                    <div ref={subSubCatSectionRef} className="animate-fade-in space-y-4">
                       <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold text-gray-900">Filter by Type</h2>
                          <button onClick={() => setParams({ subCatId: '' })} className="text-xs text-gray-500 hover:text-brand">Change Category</button>
                       </div>
                       
                       {subSubCatsLoading ? (
                          <div className="flex gap-2 overflow-x-auto pb-2">
                             {[1,2,3,4].map(i => <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-gray-200"></div>)}
                          </div>
                       ) : subSubCats.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                             {subSubCats.map((ssc) => (
                                <button
                                   key={ssc.id}
                                   onClick={() => setParams({ subSubCatId: ssc.id })}
                                   className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                                      activeSubSubCatId === ssc.id 
                                      ? 'bg-brand text-white shadow-md' 
                                      : 'bg-white text-gray-700 ring-1 ring-black/10 hover:bg-gray-50'
                                   }`}
                                >
                                   {ssc.name}
                                </button>
                             ))}
                          </div>
                       ) : (
                          <p className="text-sm text-gray-500">No specific types found.</p>
                       )}
                    </div>
                 )}

                 {/* Level 3: Products Grid */}
                 {activeSubSubCatId && (
                    <div ref={productsSectionRef} className="animate-fade-in space-y-6 pt-4 border-t border-gray-100">
                       <h2 className="text-xl font-bold text-gray-900">
                          {activeTypeName} 
                          {hasVehicleFilter && <span className="text-base font-normal text-gray-500 ml-2">compatible with {vehicleEcho}</span>}
                       </h2>
                       
                       {/* Manufacturer Filter in Drilldown Level 3 */}
                       {renderManufacturerFilter(filteredSubProducts)}

                       {subProductsLoading ? (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                             {[1,2,3,4].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200"></div>)}
                          </div>
                       ) : subProductsPaged.length > 0 ? (
                          <>
                             <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                {subProductsPaged.map((product) => (
                                   <ProductActionCard 
                                      key={product.id || (product as any).product_id}
                                      product={product}
                                      onAddToCart={() => onAddToCart(product)}
                                      onViewDetails={() => onViewProduct(product)}
                                   />
                                ))}
                             </div>
                             <PaginationControls 
                                page={subProductsPage}
                                setPage={setSubProductsPage}
                                pageSize={subProductsPageSize}
                                setPageSize={setSubProductsPageSize}
                                total={filteredSubProducts.length}
                             />
                          </>
                       ) : (
                          <div className="rounded-xl bg-gray-50 p-12 text-center ring-1 ring-black/5">
                             <p className="text-lg font-medium text-gray-900">No products found</p>
                             <p className="text-gray-500">Try adjusting your vehicle filters or selecting a different category.</p>
                          </div>
                       )}
                    </div>
                 )}
              </div>

            ) : (
              /* 4. Default Catalogue View (All Categories) */
              <div className="space-y-12">
                 
                 {/* Search Results (if q param exists) */}
                 {qParam && (
                    <div className="space-y-6">
                       <h2 className="text-xl font-bold text-gray-900">Search Results for "{qParam}"</h2>
                       
                       {/* Manufacturer Filter in Search Results */}
                       {renderManufacturerFilter(searchPaged)}

                       {searchLoading ? (
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                             {[1,2,3,4].map(i => <div key={i} className="h-64 animate-pulse rounded-xl bg-gray-200"></div>)}
                          </div>
                       ) : searchPaged.length > 0 ? (
                          <>
                             <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                {searchPaged.map((p) => (
                                   <ProductActionCard 
                                      key={p.id || (p as any).product_id}
                                      product={p}
                                      onAddToCart={() => onAddToCart(p)}
                                      onViewDetails={() => onViewProduct(p)}
                                   />
                                ))}
                             </div>
                             <PaginationControls 
                                page={searchPage}
                                setPage={setSearchPage}
                                pageSize={searchPageSize}
                                setPageSize={setSearchPageSize}
                                total={filteredSearchResults.length}
                             />
                          </>
                       ) : (
                          <div className="text-center py-12 text-gray-500">No results found matching "{qParam}"</div>
                       )}
                    </div>
                 )}

                 {/* Render Groups by Category */}
                 {/* Only show if NOT searching or if search is empty */}
                 {!qParam && (
                    <>
                      {/* Manufacturer Filter for General List */}
                      {renderManufacturerFilter(filteredPaged)}
                      
                      {grouped.map(([catName, items]) => {
                         const catInfo = catInfoFor(items[0])
                         const previewItems = items.slice(0, 8)
                         const catId = categoryIdOf(items[0])

                         return (
                            <section key={catName} id={`cat-${toSlug(catName)}`} className="scroll-mt-24 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                               <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
                                  <div className="flex items-center gap-4">
                                     <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-50 p-2 ring-1 ring-black/5">
                                        <img src={catInfo.image} alt="" className="max-h-full max-w-full object-contain" />
                                     </div>
                                     <h2 className="text-lg font-bold text-gray-900">{catInfo.name}</h2>
                                  </div>
                                  <button 
                                     onClick={() => {
                                        if (catId) setParams({ catId })
                                        else toast.error('Category ID missing')
                                     }}
                                     className="text-sm font-semibold text-brand hover:underline"
                                  >
                                     View All ({items.length})
                                  </button>
                               </div>

                               <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                                  {previewItems.map((p) => (
                                     <ProductActionCard 
                                        key={p.id || (p as any).product_id}
                                        product={p}
                                        onAddToCart={() => onAddToCart(p)}
                                        onViewDetails={() => onViewProduct(p)}
                                     />
                                  ))}
                               </div>
                            </section>
                         )
                      })}
                      
                      {/* Fallback if no groups found */}
                      {grouped.length === 0 && !loading && (
                         <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="mb-4 rounded-full bg-gray-100 p-6">
                               <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                               </svg>
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No parts found</h3>
                            <p className="mt-2 text-gray-500 max-w-md">
                               We couldn't find any parts matching your current filters. Try clearing the vehicle filter or searching for a different term.
                            </p>
                            <button 
                               onClick={() => {
                                  setVehFilter({ brandName: '', modelName: '', year: '', engineName: '' })
                                  setPageSearch('')
                                  setParams({ catId: '', subCatId: '', subSubCatId: '' })
                                  setSelectedManufacturerId('')
                               }}
                               className="mt-6 rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
                            >
                               Reset Filters
                            </button>
                         </div>
                      )}
                    </>
                 )}
              </div>
            )}
          </main>
        </div>

        {/* SEO / Extra Content Section at Bottom */}
        {!activeCatId && !qParam && (
          <section className="mt-20 rounded-2xl bg-gray-100 p-6 md:p-10">
            <div className="grid gap-10 md:grid-cols-[2fr_1fr]">
              <div>
                <h2 className="text-[20px] font-bold text-gray-900 md:text-[24px]">Comprehensive Car Parts &amp; Accessories</h2>
                <div className="mt-4 space-y-4 text-[13px] leading-6 text-gray-700 md:text-[14px]">
                  <p>
                    Find everything you need to keep your vehicle running smoothly. From essential engine components to interior upgrades,
                    Gapa Naija offers a vast selection of high-quality parts for all major car brands.
                  </p>
                  <ul className="space-y-4">
                    <li>
                      <div className="font-semibold text-gray-900">Car Electronics</div>
                      <p className="mt-1 text-gray-600">Upgrade your driving experience with dash cams, Bluetooth kits, GPS trackers, and premium audio systems.</p>
                    </li>
                    <li>
                      <div className="font-semibold text-gray-900">Exterior Accessories</div>
                      <p className="mt-1 text-gray-600">Protect and style your car with car covers, mud flaps, window visors, and bumper guards. These protect your vehicle from wear, scratches.</p>
                    </li>
                    <li>
                      <div className="font-semibold text-gray-900">Car Care Essentials</div>
                      <p className="mt-1 text-gray-600">Brushes, scrapers, sponges, and cleaning kits to help you maintain a spotless car without damaging the paintwork.</p>
                    </li>
                    <li>
                      <div className="font-semibold text-gray-900">Safety &amp; Emergency Gear</div>
                      <p className="mt-1 text-gray-600">Be prepared with first aid kits, warning triangles, fire extinguishers, reflective vests, safety hammers, and other must-haves for emergencies.</p>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Why choose */}
              <aside className="md:pl-6">
                <h3 className="text-[16px] font-semibold text-gray-900">Why Choose Gapa Naija?</h3>
                <p className="mt-3 text-[13px] leading-6 text-gray-700">
                  At Gapa Naija, we make shopping for car accessories simple, affordable, and reliable. With thousands of products,
                  competitive prices, and fast delivery across Nigeria, you can always count on us to keep your car in top shape.
                </p>
              </aside>
            </div>
          </section>
        )}
      </div>
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
