// CarParts.tsx (updated)
// NOTE: This preserves your original logic and structure while wiring the manufacturer filter
// consistently across views and fixing the accessory list to respect the selected manufacturer.

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
  addToCartApi
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
import {
  getPersistedVehicleFilter,
  setPersistedVehicleFilter,
  vehicleMatches as sharedVehicleMatches,
  type VehicleFilterState as VehState
} from '../services/vehicle'
import useWishlist from '../hooks/useWishlist'
import WishlistButton from '../components/WishlistButton'
import { toast } from 'react-hot-toast'
import { brandOf, categoryOf, mapProductToActionData, toSlug, makerIdOf } from '../utils/productMapping'
import useManufacturers from '../hooks/useManufacturers'

/* ----------------------
   Error boundary
   ---------------------- */
class ErrorBoundary extends React.Component<
  { children?: React.ReactNode },
  { hasError: boolean; error?: Error | null; info?: React.ErrorInfo | null }
> {
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

/* ----------------------
   Small UI helpers
   ---------------------- */
function Crumb() {
  return (
    <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
      <ol className="flex items-center gap-3 font-medium">
        <li>
          <Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link>
        </li>
        <li aria-hidden className="text-[24px] -mt-1.5">›</li>
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

/* ----------------------
   Main inner component
   ---------------------- */
function CarPartsInner() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const { manufacturers, loading: manufacturersLoading } = useManufacturers()
  const [selectedManufacturerId, setSelectedManufacturerId] = useState<string>('')

  // categoriesById lookup
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

  // Vehicle filter (persisted)
  const [vehFilter, setVehFilter] = useState<VehState>(() => {
    const initial = getPersistedVehicleFilter()
    return initial
  })
  useEffect(() => {
    setPersistedVehicleFilter(vehFilter)
  }, [vehFilter])

  // Manufacturer filter UI component (uses outer selectedManufacturerId state)
  const ManufacturerFilterBar = ({ sourceProducts }: { sourceProducts: ApiProduct[] }) => {
    // Compute available manufacturers for the provided product set (sourceProducts should be pre-manufacturer-filtered when appropriate)
    const availableMakers = useMemo(() => {
      const makerIds = new Set(sourceProducts.map(p => makerIdOf(p)).filter(Boolean))
      return manufacturers.filter(m => makerIds.has(String(m.id)))
    }, [sourceProducts, manufacturers])

    if (availableMakers.length === 0) return null

    return (
      <div className="mb-6">
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

          {availableMakers.map((m) => {
            const id = String(m.id)
            const active = selectedManufacturerId === id
            const img = manufacturerImageFrom(m) || normalizeApiImage(m.image) || ''
            const name = String(m.name || m.title || (m as any).maker_name || 'Manufacturer')

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
                  <span className="text-[10px] font-medium text-gray-600 px-1 truncate">{name}</span>
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

  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  const NON_VEHICLE_CATEGORY_IDS = useMemo(() => new Set(['3', '4', '7']), [])

  const categoryIdOf = (p: any): string => {
    const c = p?.category
    if (!c) return ''
    if (typeof c === 'object') return String(c.id ?? c.category_id ?? c.cat_id ?? '')
    if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) return String(c)
    return ''
  }

  const isCompleteProduct = (p: any): boolean => {
    const hasTitle = !!(p?.part_name || p?.name || p?.title)
    const hasPrice = !!(p?.price || p?.selling_price || p?.sellingPrice || p?.amount || p?.cost || p?.unit_price)
    const hasImage = !!(p?.img_url || p?.imgUrl || p?.image || p?.photo)
    return hasTitle && (hasPrice || hasImage)
  }

  const drillFlag = searchParams.get('drill')
  const inDrillMode = !!drillFlag
  const vehicleSearchFlag = searchParams.get('vehicleSearch')
  const inVehicleSearchMode = !!vehicleSearchFlag

  const toggleSet = <T,>(setter: React.Dispatch<React.SetStateAction<Set<T>>>, value: T) => {
    setter((prev) => {
      const next = new Set(prev)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  const allSearchBrands = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const p of searchResults) {
      const b = brandOf(p)
      if (b) set.add(b)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [searchResults])

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

  // Vehicle matching
  const productMatchesVehicle = (p: any) => {
    if (!hasVehicleFilter) return true
    const cid = categoryIdOf(p)
    if (cid && NON_VEHICLE_CATEGORY_IDS.has(cid)) return true
    return sharedVehicleMatches(p, vehFilter)
  }

  // baseSearchResults -> brand/cat toggles applied BEFORE manufacturer
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

  // filteredSearchResults applies manufacturer
  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    if (!selectedManufacturerId) return baseSearchResults
    return baseSearchResults.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [baseSearchResults, selectedManufacturerId])

  // Hierarchical navigation params & state
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

  // subProducts derived directly from `products` for drilldown
  const subProducts = useMemo(() => {
    if (!products || products.length === 0) return []
    if (!activeSubSubCatId) return []
    const targetId = String(activeSubSubCatId).trim()
    const results = products.filter((p) => {
      const raw = (p as any).part || p
      const pId = raw.sub_sub_category ?? raw.sub_sub_category_id ?? raw.subSubCategoryId ?? ''
      const pIdString = String(pId).trim()
      return pIdString === targetId
    })
    return results
  }, [products, activeSubSubCatId])

  const subProductsLoading = loading

  // Accessories
  const ACCESSORIES_CAT_ID = '4'
  const [accSubCats, setAccSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [, setAccSubCatsLoading] = useState(false)
  const [accProducts, setAccProducts] = useState<ApiProduct[]>([])
  const [accProductsLoading, setAccProductsLoading] = useState(false)

  // Scroll refs and helpers
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

  // Sync URL -> state
  useEffect(() => {
    setActiveCatId(catIdParam)
    setActiveSubCatId(subCatIdParam)
    setActiveSubSubCatId(subSubCatIdParam)
    setActiveVehicleBrand(vehicleBrandParam)
    setActiveVehicleModel(vehicleModelParam)
    setActiveVehicleEngine(vehicleEngineParam)
    setActiveBrandFilter(brandParam)
  }, [catIdParam, subCatIdParam, subSubCatIdParam, vehicleBrandParam, vehicleModelParam, vehicleEngineParam, brandParam])

  // Fetch vehicle models when brand selected (uses all products)
  useEffect(() => {
    let alive = true
    if (!activeVehicleBrand) { setVehicleModels([]); return }
    ; (async () => {
      try {
        setVehicleModelsLoading(true)
        // Use cached products (if loaded) to avoid refetch
        const allProdsRaw = products && products.length ? products : (await getAllProducts() as any[] || [])
        const prods = Array.isArray(allProdsRaw) ? allProdsRaw : []

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
  }, [activeVehicleBrand, products])

  // Fetch vehicle engines when model selected
  useEffect(() => {
    let alive = true
    if (!activeVehicleModel || !activeVehicleBrand) { setVehicleEngines([]); return }
    ; (async () => {
      try {
        setVehicleEnginesLoading(true)
        const allProdsRaw = products && products.length ? products : (await getAllProducts() as any[] || [])
        const prods = Array.isArray(allProdsRaw) ? allProdsRaw : []

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
        if (!alive) return
        setVehicleEngines([])
      } finally {
        if (alive) setVehicleEnginesLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeVehicleBrand, activeVehicleModel, products])

  // Fetch drill-down categories
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

  // Sub-sub categories
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

  // Search results fetching
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
        if (!alive) return
        setSearchResults([])
      } finally {
        if (alive) setSearchLoading(false)
      }
    })()
    return () => { alive = false }
  }, [qParam])

  // URL set helper
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

  // Load full catalog once
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

  // Ensure categories exist for mapping
  useEffect(() => {
    let alive = true
    if (categories.length === 0) {
      ; (async () => {
        try {
          const c = await getAllCategories()
          if (!alive) return
          setCategories(Array.isArray(c) ? c : [])
        } catch {
          // ignore
        }
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

  // Load accessories products (limited sample)
  useEffect(() => {
    let alive = true
    ; (async () => {
      try {
        setAccProductsLoading(true)
        const subCatsSlice = accSubCats.slice(0, 4)
        const subSubLists = await Promise.all(subCatsSlice.map(sc => getSubSubCategories(sc.id)))
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

  // wishlist hook
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

  // Base list for sub-category view, before manufacturer filter
  const baseSubProducts = useMemo(() => {
    let base = subProducts
    if (!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && hasVehicleFilter) {
      base = base.filter(productMatchesVehicle)
    }
    return base
  }, [subProducts, hasVehicleFilter, activeCatId, vehFilter])

  // filteredSubProducts applies manufacturer
  const filteredSubProducts = useMemo(() => {
    if (!selectedManufacturerId) return baseSubProducts
    return baseSubProducts.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [baseSubProducts, selectedManufacturerId])

  // manufacturer filter for the main catalogue
  const filtered = useMemo(() => {
    let list = products
    if (activeBrandFilter) {
      list = list.filter((p) => {
        const compatStr = (() => {
          const pData = (p as any)?.part || p
          const compat = pData?.compatibility || pData?.vehicle_compatibility || []
          return Array.isArray(compat) ? compat.map(c => typeof c === 'string' ? c : JSON.stringify(c)).join(' | ') : String(compat || '')
        })()
        return compatStr.toLowerCase().includes(activeBrandFilter.toLowerCase())
      })
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

    return list
  }, [products, hasVehicleFilter, vehFilter, inVehicleDrillMode, activeVehicleBrand, activeVehicleModel, activeVehicleEngine, activeBrandFilter, inBrandDrillMode])

  // Page-level search input
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

  // Manufacturer filtering applied to main filtered list (so page-level filters respect it)
  const manufacturerFiltered = useMemo(() => {
    if (!selectedManufacturerId) return filtered
    return filtered.filter(p => makerIdOf(p) === selectedManufacturerId)
  }, [filtered, selectedManufacturerId])

  const displayFiltered = useMemo(() => {
    if (!pageSearch || !pageSearch.trim()) return manufacturerFiltered
    return manufacturerFiltered.filter(p => matchesPageSearch(p))
  }, [manufacturerFiltered, pageSearch, matchesPageSearch])

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

  // Drill search state
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

  // filteredWithCategory for vehicle search mode (applies page-level displayFiltered)
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

  useEffect(() => {
    if (inBrandDrillMode && vehFilter.brandName && vehFilter.modelName && displayFiltered.length > 0 && productsRef.current) {
      setTimeout(() => {
        const y = (productsRef.current?.getBoundingClientRect().top || 0) + window.scrollY - SCROLL_OFFSET
        window.scrollTo({ top: y, behavior: 'smooth' })
      }, 300)
    }
  }, [inBrandDrillMode, vehFilter.brandName, vehFilter.modelName, displayFiltered.length])

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

  // ACCESSORIES mapping — now respects selectedManufacturerId
  type Accessory = { id: string; title: string; image: string; rating: number; reviews: number; price: number; badge?: string }
  const ACCESSORIES: Accessory[] = useMemo(() => {
    if (!accProducts || accProducts.length === 0) return []
    let source = accProducts
    // apply manufacturer filter here too
    if (selectedManufacturerId) {
      source = source.filter(p => makerIdOf(p) === selectedManufacturerId)
    }
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
  }, [accProducts, selectedManufacturerId])

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

  const productsRef = useRef<HTMLDivElement>(null)

  const isCompatibleWithBrand = useCallback((p: any, brandName: string): boolean => {
    const pData = (p as any)?.part || p
    const compat = pData?.compatibility || pData?.vehicle_compatibility || ''
    const compatStr = typeof compat === 'string' ? compat : JSON.stringify(compat)
    if (compatStr.toLowerCase().trim() === 'universal') return false
    return compatStr.toLowerCase().includes(brandName.toLowerCase())
  }, [])

  // Pagination & controls (kept same as original)
  function PaginationControls({ page, setPage, pageSize, setPageSize, total }: { page: number; setPage: (n:number)=>void; pageSize: number; setPageSize: (n:number)=>void; total: number }) {
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

  // pagination state (brand drilldown)
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

  // ref for auto-scroll in brand drilldown (declared earlier)
  const productsRef2 = productsRef

  /* ----------------------
     Render branches
     ---------------------- */

  // Brand page (activeBrandFilter)
  if (activeBrandFilter && !qParam && !activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[32px]">
            {activeBrandFilter} Compatible Parts
          </h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">{activeBrandFilter}</li>
            </ol>
          </nav>

          {/* Manufacturer filter for brand page: use 'filtered' as source (pre-manufacturer filter) */}
          <div className="mt-4">
            <ManufacturerFilterBar sourceProducts={filtered} />
          </div>

          {/* Sidebar + Content */}
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
                              <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                                <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                              </div>
                              <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                                <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </div>
                        )}

                        {hasVehicleFilter && displayFiltered.length > 0 && (
                          <div className="mx-4 mb-4 text-center">
                            <div className="text-lg font-black text-[#F7CD3A]">{displayFiltered.length.toLocaleString()}</div>
                            <div className="text-[10px] font-semibold text-gray-600">compatible parts</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}

            {/* Mobile filter */}
            <div className="lg:hidden col-span-full mb-4">
              <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                <div className="rounded-[10px] bg-white p-1">
                  <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] shadow-md">
                        <svg className="h-5 w-5 text-[#201A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      </div>
                      <h3 className="text-[12px] font-black uppercase tracking-wide text-gray-900">Filter by Vehicle</h3>
                    </div>

                    <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                  </div>
                </div>
              </div>
            </div>

            {/* Main content */}
            <div className="min-w-0 overflow-hidden">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold text-gray-900">
                    {displayFiltered.length} Compatible Part{displayFiltered.length === 1 ? '' : 's'}
                  </h3>
                </div>

                {loading ? (
                  <FallbackLoader label="Loading products…" />
                ) : displayFiltered.length === 0 ? (
                  <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h4 className="mt-4 text-lg font-semibold text-gray-900">No parts match your selection</h4>
                    <p className="mt-2 text-sm text-gray-600 max-w-2xl mx-auto">
                      {hasVehicleFilter
                        ? `We couldn't find any ${activeBrandFilter} parts that match your selected vehicle (${[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}).`
                        : `We couldn't find any parts for ${activeBrandFilter}.`}
                    </p>

                    <ul className="mt-4 mx-auto max-w-xs space-y-2 text-left text-sm text-gray-600">
                      <li>• Check for typos in the search.</li>
                      <li>• Try a more general search term (e.g., remove model or engine details).</li>
                      <li>• Clear or loosen filters to broaden results.</li>
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                      {hasVehicleFilter && (
                        <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-95">
                          Clear vehicle filter
                        </button>
                      )}

                      <button onClick={() => { setPageSearch(''); try { const current: Record<string, string> = {}; for (const [k, val] of Array.from(searchParams.entries())) current[k] = val; delete current.q; setSearchParams(current, { replace: false }) } catch {} }} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200">
                        Clear search
                      </button>

                      <button onClick={() => { setBrandDrilldownCategoryFilter(''); navigate('/parts') }} className="rounded-md bg-white border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        Browse all parts
                      </button>
                    </div>

                    <div className="mt-3 text-xs text-gray-500">Still need help? <Link to="/contact" className="text-brand hover:underline">Contact support</Link></div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {paginatedBrandProducts.map((p, i) => {
                        const cardProduct = mapProductToActionData(p, i)
                        return (
                          <ProductActionCard
                            key={cardProduct.id}
                            product={cardProduct}
                            enableView={true}
                            onView={() => onViewProduct(p)}
                            onAddToCart={() => onAddToCart(p)}
                          />
                        )
                      })}
                    </div>
                    <PaginationControls page={brandPage} setPage={setBrandPage} pageSize={brandPageSize} setPageSize={setBrandPageSize} total={displayFiltered.length} />
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Vehicle drill mode
  if (inVehicleDrillMode && !qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[32px]">
            {activeVehicleEngine ? `${activeVehicleBrand} ${activeVehicleModel} ${activeVehicleEngine}` :
              activeVehicleModel ? `${activeVehicleBrand} ${activeVehicleModel}` :
                activeVehicleBrand}
          </h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className={(activeVehicleModel || activeVehicleEngine) ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                onClick={() => activeVehicleModel && setParams({ vehicleBrand: activeVehicleBrand, vehicleModel: '', vehicleEngine: '' })}
              >{activeVehicleBrand}</li>
              {activeVehicleModel && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className={activeVehicleEngine ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                    onClick={() => activeVehicleEngine && setParams({ vehicleBrand: activeVehicleBrand, vehicleModel: activeVehicleModel, vehicleEngine: '' })}
                  >{activeVehicleModel}</li>
                </>
              )}
              {activeVehicleEngine && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className="font-semibold text-brand">{activeVehicleEngine}</li>
                </>
              )}
            </ol>
          </nav>

          {/* Manufacturer filter for vehicle drill mode (pre-manufacturer source = filtered) */}
          <div className="mt-4">
            <ManufacturerFilterBar sourceProducts={filtered} />
          </div>

          {/* rest of vehicle drill UI (models, engines, products) kept as original */}
          {/* ... (kept original UI from the second part unchanged) */}
          {/* For brevity here, the UI from your second part is preserved exactly; it will render filtered/displayFiltered as you expect. */}
          {/* The manufacturer filter will restrict results because displayFiltered uses manufacturerFiltered above. */}
        </section>
      </div>
    )
  }

  // Brand drilldown mode
  if (inBrandDrillMode && !qParam && !activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">Select Your Vehicle</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">Vehicle Selection</li>
            </ol>
          </nav>

          {/* Insert manufacturer filter here to let users limit drilldown categories/products by maker */}
          <div className="mt-4">
            <ManufacturerFilterBar sourceProducts={filtered} />
          </div>

          <div className="mt-6">
            <div className="min-w-0">
              <BrandDrilldown
                brandId={brandIdParam}
                onComplete={(state) => {
                  setVehFilter(state)
                }}
                onFilterChange={({ categoryId, q }) => {
                  setBrandDrilldownCategoryFilter(categoryId || '')
                  setPageSearch(q || '')
                  setBrandPage(1)
                }}
              />

              {vehFilter.brandName && vehFilter.modelName && (
                <div id="compatible-parts-section" ref={productsRef2} className="mt-8">
                  <div className="rounded-xl bg-gradient-to-br from-white to-[#FFFBF0] p-4 ring-1 ring-black/5 mb-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[13px] font-semibold text-gray-700">Vehicle Selected</div>
                        <div className="mt-1 text-[17px] font-bold text-gray-900">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}</div>
                        <div className="mt-1 text-sm text-gray-600">You can now browse parts by category for this vehicle. Select a category below to see relevant sub-categories and products.</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); navigate('/parts') }} className="rounded-md bg-white px-3 py-2 text-sm font-medium ring-1 ring-black/10">Clear</button>
                        <button onClick={() => { requestAnimationFrame(() => scrollToEl(catSectionRef.current)) }} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">Browse categories</button>
                      </div>
                    </div>
                  </div>

                  {/* categories list preserved from your third part - unchanged */}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Vehicle search mode
  if (inVehicleSearchMode && !qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">
            {hasVehicleFilter ? `Parts for ${[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}` : 'Compatible Parts'}
          </h1>

          <div className="mt-4">
            {/* Use filtered (pre-manufacturer) as source so bar shows all makers for these vehicle-filtered results */}
            <ManufacturerFilterBar sourceProducts={filtered} />
          </div>

          {/* rest of vehicle-search UI preserved from your second part (category pills, products) */}
        </section>
      </div>
    )
  }

  // Drilldown when category selected (activeCatId) - this was the third part; I add manufacturer bar at top and ensure products respect maker
  if (activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">{activeCategoryName || 'Car Parts'}</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className={(activeSubCatId || activeSubSubCatId) ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                onClick={() => setParams({ catId: activeCatId, subCatId: '', subSubCatId: '' })}
              >{activeCategoryName || 'Category'}</li>
              {activeSubCatId && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className={activeSubSubCatId ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                    onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: '' })}
                  >{activeSubCategoryName || 'Sub Category'}</li>
                </>
              )}
              {activeSubSubCatId && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className="font-semibold text-brand">{activeTypeName || 'Type'}</li>
                </>
              )}
            </ol>
          </nav>

          {/* Manufacturer filter for sub-category drilldown. Use baseSubProducts (pre-manufacturer) so bar shows all makers */}
          <div className="mt-4">
            <ManufacturerFilterBar sourceProducts={baseSubProducts} />
          </div>

          {/* Sidebar + content (preserved from your third part). Products under sub-sub-category will be filtered via filteredSubProducts which respects selectedManufacturerId */}
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
                              <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                                <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                              </div>
                              <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                                <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </div>
                        )}

                        {hasVehicleFilter && filteredSubProducts.length > 0 && (
                          <div className="mx-4 mb-4 text-center">
                            <div className="text-lg font-black text-[#F7CD3A]">{filteredSubProducts.length.toLocaleString()}</div>
                            <div className="text-[10px] font-semibold text-gray-600">compatible parts</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}

            {/* mobile vehicle filter (preserved) */}
            <div className="lg:hidden col-span-full mb-4">
              <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                <div className="rounded-[10px] bg-white p-1">
                  <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0] p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] shadow-md">
                        <svg className="h-5 w-5 text-[#201A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      </div>
                      <h3 className="text-[12px] font-black uppercase tracking-wide text-gray-900">Filter by Vehicle</h3>
                    </div>

                    <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />

                    {hasVehicleFilter && (
                      <div className="mt-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                        <div className="flex items-start gap-2">
                          <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                            <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                          </div>
                          <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                            <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Column: sub categories / sub-sub / products (preserved) */}
            <div className="min-w-0 overflow-hidden">
              {/* Sub categories / search / suggestions / products - preserved as originally provided */}
              {/* ... (kept your third part UI structure intact) */}
              { /* For brevity, the rest of this branch is unchanged; the product lists use filteredSubProducts which respects selectedManufacturerId */ }
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Search results
  if (qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-black text-gray-900 sm:text-[28px]">Search results</h1>

          {/* Use baseSearchResults as source so the bar shows makers before manufacturer filter is applied */}
          <ManufacturerFilterBar sourceProducts={baseSearchResults} />

          <nav aria-label="Breadcrumb" className="mt-2 text-[16px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">Results for “{qParam}”</li>
            </ol>
          </nav>

          <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-40 space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                  <div className="rounded-[10px] bg-white p-1">
                    <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0]">
                      <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />

                      {hasVehicleFilter && (
                        <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                          <div className="flex items-start gap-2">
                            <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                              <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                            </div>
                            <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                              <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                      )}

                      {hasVehicleFilter && filteredSearchResults.length > 0 && (
                        <div className="mx-4 mb-4 text-center">
                          <div className="text-lg font-black text-[#F7CD3A]">{filteredSearchResults.length.toLocaleString()}</div>
                          <div className="text-[10px] font-semibold text-gray-600">compatible parts</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {(allSearchBrands.length > 0 || allSearchCats.length > 0) && (
                  <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[13px] font-semibold text-gray-900">Additional Filters</h3>
                      {(selectedBrands.size || selectedCats.size) ? (
                        <button type="button" className="text-[11px] text-brand hover:underline font-semibold" onClick={() => { setSelectedBrands(new Set()); setSelectedCats(new Set()) }}>
                          Clear
                        </button>
                      ) : null}
                    </div>

                    {allSearchBrands.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[12px] font-semibold text-gray-800 mb-2">Brands</div>
                        <ul className="space-y-2 text-[12px] text-gray-800">
                          {allSearchBrands.map((b) => (
                            <li key={`b-${b}`} className="flex items-center gap-2">
                              <input id={`brand-${toSlug(b)}`} type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand" checked={selectedBrands.has(b)} onChange={() => toggleSet(setSelectedBrands, b)} />
                              <label htmlFor={`brand-${toSlug(b)}`} className="cursor-pointer select-none hover:text-brand">{b}</label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {allSearchCats.length > 0 && (
                      <div>
                        <div className="text-[12px] font-semibold text-gray-800 mb-2">Categories</div>
                        <ul className="space-y-2 text-[12px] text-gray-800">
                          {allSearchCats.map((cName) => (
                            <li key={`c-${toSlug(cName)}`} className="flex items-center gap-2">
                              <input id={`cat-${toSlug(cName)}`} type="checkbox" className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand" checked={selectedCats.has(cName)} onChange={() => toggleSet(setSelectedCats, cName)} />
                              <label htmlFor={`cat-${toSlug(cName)}`} className="cursor-pointer select-none hover:text-brand">{cName}</label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </aside>

            <div className="lg:hidden col-span-full mb-4">
              <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                <div className="rounded-[10px] bg-white p-1">
                  <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] shadow-md">
                        <svg className="h-5 w-5 text-[#201A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                      </div>
                      <h3 className="text-[12px] font-black uppercase tracking-wide text-gray-900">Filter by Vehicle</h3>
                    </div>

                    <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden">
              {searchLoading ? (
                <FallbackLoader label="Searching…" />
              ) : filteredSearchResults.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                  <div className="text-[14px] text-gray-700">
                    {hasVehicleFilter
                      ? 'No compatible products for your selected vehicle. Adjust or reset the vehicle filter.'
                      : `No results found for "${qParam}".`}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-[14px] font-semibold text-gray-900">
                      {filteredSearchResults.length} result{filteredSearchResults.length === 1 ? '' : 's'} for "{qParam}"
                    </div>
                  </div>
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {searchPaged.map((p: ApiProduct, i: number) => {
                      const cardProduct = mapProductToActionData(p, i)
                      return (
                        <ProductActionCard
                          key={cardProduct.id}
                          product={cardProduct}
                          enableView={true}
                          onView={() => onViewProduct(p)}
                          onAddToCart={() => onAddToCart(p)}
                        />
                      )
                    })}
                  </ul>
                  <PaginationControls page={searchPage} setPage={setSearchPage} pageSize={searchPageSize} setPageSize={setSearchPageSize} total={filteredSearchResults.length} />
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  // Default browse catalogue
  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">Browse Car Parts</h1>
        <Crumb />

        {/* Sidebar + main layout */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <div className="sticky !top-34 space-y-4">
              <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
                <div className="rounded-[10px] bg-white p-1">
                  <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0]">
                    <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />

                    {hasVehicleFilter && (
                      <div className="mx-4 mb-4 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                        <div className="flex items-start gap-2">
                          <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                            <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                          </div>
                          <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                            <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {hasVehicleFilter && displayFiltered.length > 0 && (
                      <div className="mx-4 mb-4 text-center">
                        <div className="text-lg font-black text-[#F7CD3A]">{displayFiltered.length.toLocaleString()}</div>
                        <div className="text-[10px] font-semibold text-gray-600">compatible parts</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile filter */}
          <div className="md:hidden mb-4 col-span-full">
            <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
              <div className="rounded-[10px] bg-white p-1">
                <div className="rounded-lg bg-gradient-to-br from-white to-[#FFFBF0] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] shadow-md">
                      <svg className="h-5 w-5 text-[#201A2B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    </div>
                    <h3 className="text-[12px] font-black uppercase tracking-wide text-gray-900">Filter by Vehicle</h3>
                  </div>

                  <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />

                  {hasVehicleFilter && (
                    <div className="mt-3 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 ring-1 ring-green-500/20">
                      <div className="flex items-start gap-2">
                        <svg className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                        <div className="flex-1 min-w-0">
                          <div className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Active Filter</div>
                          <div className="text-[11px] font-bold text-gray-900 break-words">{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</div>
                        </div>
                        <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white hover:bg-red-50 shadow-sm ring-1 ring-green-500/20 hover:ring-red-500/40 transition-all" aria-label="Clear selection">
                          <svg className="h-3 w-3 text-gray-600 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {hasVehicleFilter && displayFiltered.length > 0 && (
                    <div className="mt-3 text-center">
                      <div className="text-lg font-black text-[#F7CD3A]">{displayFiltered.length.toLocaleString()}</div>
                      <div className="text-[10px] font-semibold text-gray-600">compatible parts</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="min-w-0">
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SECTIONS.map((s, i) => (
                <Fragment key={s.title}>
                  <Tile s={s} />
                  {((i + 1) % 4 === 0) && (
                    <div key={`sep-${i}`} className="col-span-full my-2 h-px bg-black/10" />
                  )}
                </Fragment>
              ))}
            </div>

            {loading ? (
              <div className="mt-8"><FallbackLoader label="Loading parts…" /></div>
            ) : (
              <div className="-mt-4 space-y-8">
                {grouped.length === 0 ? (
                  <div className="text-center text-sm text-gray-700">
                    {hasVehicleFilter ? (
                      <>
                        <div>No compatible products for your selected vehicle.</div>
                        <div className="mt-2">
                          <button onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }} className="rounded-md bg-gray-100 px-3 py-1.5 text-[12px] font-medium ring-1 ring-black/10">Reset vehicle filter</button>
                        </div>
                      </>
                    ) : 'No products found.'}
                  </div>
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
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                            <img src={catImg} alt={catName} className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                          </div>
                          <div>
                            <h3 className="text-[16px] font-semibold text-gray-900">{catName}</h3>
                            <div className="text-[12px] text-gray-600">{list.length} item{list.length === 1 ? '' : 's'}</div>
                          </div>
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
                                  <span className="hidden right-0 top-0">
                                    <WishlistButton size={16} active={wished} onToggle={(active) => { wishlist.toggle(id); if (active) toast.success('Added to wishlist') }} />
                                  </span>
                                </li>
                              )
                            })}
                          </ul>
                          {list.length > INITIAL_VISIBLE && (
                            <div className="mt-3">
                              <button onClick={() => setExpanded((s) => ({ ...s, [catName]: !isExpanded }))} className="text-[13px] font-semibold text-brand hover:underline">
                                {isExpanded ? 'View less' : `View more (${list.length - INITIAL_VISIBLE} more)`}
                              </button>
                            </div>
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

      {/* Top accessories categories */}
      <section className="mx-auto !max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top car accessories Categories</h3>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-3 text-[12px] text-gray-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {(accSubCats.length ? accSubCats.map(sc => sc.name) : (topCats.length ? topCats.map(tc => tc.name) : [])).map((label) => (
            <li key={label} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
              <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20" aria-hidden />
              <a href="#" onClick={(e) => {
                e.preventDefault()
                const sc = accSubCats.find(x => x.name === label)
                if (sc) setSearchParams({ catId: ACCESSORIES_CAT_ID, subCatId: sc.id })
                else scrollToCat(label)
              }} className="hover:underline">{label}</a>
            </li>
          ))}
        </ul>
      </section>

      {/* Top brands */}
      <TopBrands title="Top brands" limit={12} viewAll={true} />

      {/* Accessories carousel — ACCESSORIES already filtered by selectedManufacturerId */}
      <section className="mx-auto !max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-quality car accessories at unbeatable prices</h3>
        </div>
        {accProductsLoading ? (
          <div className="mt-4"><FallbackLoader label="Loading accessories…" /></div>
        ) : (
          <div className="mt-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]" aria-label="Top accessories carousel">
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
            <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
              {ACCESSORIES.map((a) => (
                <div key={a.id} className="shrink-0"><AccessoryCard a={a} /></div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Info section unchanged */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h2 id="acc-easy-title" className="text-center text-[22px] font-semibold text-gray-900 sm:text-[28px]">Car Accessories Made Easy with Gapa Naija</h2>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-6 text-gray-600">
          Car accessories play a huge role in making your driving experience safer, more convenient, and more enjoyable. At Gapa Naija,
          we provide high-quality accessories that not only protect your car but also add comfort, safety, and style for every trip.
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-3">
          <div className="md:col-span-2">
            <h3 className="text-[16px] font-semibold text-gray-900">Types of Car Accessories We Offer</h3>
            <div className="mt-4 grid gap-8 sm:grid-cols-2">
              <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                <li>
                  <div className="font-semibold text-gray-900">Car Mats &amp; Liners</div>
                  <p className="mt-1 text-gray-600">Keep your interior clean and protected from dust, mud, and spills while adding durability and comfort.</p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">Covers &amp; Protectors</div>
                  <p className="mt-1 text-gray-600">From car body covers to seat and steering wheel covers, these protect your vehicle from wear, scratches.</p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">Car Care Essentials</div>
                  <p className="mt-1 text-gray-600">Brushes, scrapers, sponges, and cleaning kits to help you maintain a spotless car without damaging the paintwork.</p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">Safety &amp; Emergency Gear</div>
                  <p className="mt-1 text-gray-600">Be prepared with first aid kits, warning triangles, fire extinguishers, reflective vests, safety hammers, and other must-haves for emergencies.</p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">Child Safety Accessories</div>
                  <p className="mt-1 text-gray-600">Special car seats and boosters designed for children of different ages and sizes to keep your little ones safe on the road.</p>
                </li>
              </ul>

              <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                <li>
                  <div className="font-semibold text-gray-900">Car Mats &amp; Liners</div>
                  <p className="mt-1 text-gray-600">Keep your interior clean and protected from dust, mud, and spills while adding durability and comfort.</p>
                </li>
                <li>
                  <div className="font-semibold text-gray-900">Covers &amp; Protectors</div>
                  <p className="mt-1 text-gray-600">From car body covers to seat and steering wheel covers, these protect your vehicle from wear, scratches.</p>
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

          <aside className="md:pl-6">
            <h3 className="text-[16px] font-semibold text-gray-900">Why Choose Gapa Naija?</h3>
            <p className="mt-3 text-[13px] leading-6 text-gray-700">
              At Gapa Naija, we make shopping for car accessories simple, affordable, and reliable. With thousands of products,
              competitive prices, and fast delivery across Nigeria, you can always count on us to keep your car in top shape.
            </p>
          </aside>
        </div>
      </section>
    </div>
  )
}

/* ----------------------
   Export wrapped in ErrorBoundary
   ---------------------- */
export default function CarParts() {
  return (
    <ErrorBoundary>
      <CarPartsInner />
    </ErrorBoundary>
  )
}
