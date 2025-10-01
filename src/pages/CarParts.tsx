import React, { useEffect, useMemo, useState, Fragment, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductCard, { type Product as UiProduct } from '../components/ProductCard'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getSubCategories, getSubSubCategories, getProductsBySubSubCategory, liveSearch, addToCartApi } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, subCategoryImageFrom, subSubCategoryImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import TopBrands from '../components/TopBrands'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, setPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'
import useWishlist from '../hooks/useWishlist'
import WishlistButton from '../components/WishlistButton'
import { toast } from 'react-hot-toast'
// import TopBrands from '../components/TopBrands'

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

// Map API product into UI product for ProductCard
function toUiProduct(p: any, i: number): UiProduct {
  // Prefer product_id (string) for details endpoint
  const id = String(p?.product_id ?? p?.id ?? i)
  // Prefer part_name as requested
  const title = String(p?.part_name || p?.name || p?.title || p?.product_name || 'Car Part')
  // Use product image base url helper
  const image = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg
  const rating = Number(p?.rating || 4)
  const brandName = String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || '')
  const categoryName = typeof p?.category === 'string' ? p.category : (p?.category?.name || p?.category?.title || p?.category_name || '')
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const brandSlug = brandName ? slug(brandName) : undefined
  const partSlug = categoryName ? slug(categoryName) : undefined
  return { id, title, image, rating, brandSlug, partSlug }
}

function categoryOf(p: any): string {
  const c = (p as any)?.category
  if (typeof c === 'string') return c
  return String(c?.name || c?.title || (p as any)?.category_name || 'General')
}

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Helper to extract brand from product safely
function brandOf(p: any): string {
  return String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || '').trim()
}

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
  const [vehFilter, setVehFilter] = useState<VehState>(() => getPersistedVehicleFilter())
  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  // Categories where vehicle compatibility does NOT apply (Car Care=3, Accessories=4, Tools=7)
  const NON_VEHICLE_CATEGORY_IDS = useMemo(() => new Set(['3','4','7']), [])

  // Helper to extract category id (string) from product
  const categoryIdOf = (p: any): string => {
    const c = p?.category
    if (!c) return ''
    if (typeof c === 'object') return String(c.id ?? c.category_id ?? c.cat_id ?? '')
    if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) return String(c)
    return ''
  }

  // Detect drilldown-start flag (from home search)
  const drillFlag = searchParams.get('drill')
  const inDrillMode = !!drillFlag

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
    return sharedVehicleMatches(p, vehFilter)
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
      .filter(productMatchesVehicle)
  }, [searchResults, selectedBrands, selectedCats, vehFilter])

  // Hierarchical navigation state (via query params)
  const catIdParam = searchParams.get('catId') || ''
  const subCatIdParam = searchParams.get('subCatId') || ''
  const subSubCatIdParam = searchParams.get('subSubCatId') || ''

  const [activeCatId, setActiveCatId] = useState<string>(catIdParam)
  const [activeSubCatId, setActiveSubCatId] = useState<string>(subCatIdParam)
  const [activeSubSubCatId, setActiveSubSubCatId] = useState<string>(subSubCatIdParam)

  const [subCats, setSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subCatsLoading, setSubCatsLoading] = useState(false)
  const [subSubCats, setSubSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subSubCatsLoading, setSubSubCatsLoading] = useState(false)
  const [subProducts, setSubProducts] = useState<ApiProduct[]>([])
  const [subProductsLoading, setSubProductsLoading] = useState(false)

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

  const SCROLL_OFFSET = 80 // header allowance
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
  }, [catIdParam, subCatIdParam, subSubCatIdParam])

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

  useEffect(() => {
    let alive = true
    if (!activeSubSubCatId) { setSubProducts([]); return }
    ; (async () => {
      try {
        setSubProductsLoading(true)
        const res = await getProductsBySubSubCategory(activeSubSubCatId)
        if (!alive) return
        setSubProducts(Array.isArray(res) ? res : [])
      } catch (_) {
        if (!alive) return
        setSubProducts([])
      } finally {
        if (alive) setSubProductsLoading(false)
      }
    })()
    return () => { alive = false }
  }, [activeSubSubCatId])

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
        setSearchResults(items as ApiProduct[])
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
  const setParams = (next: Partial<{ catId: string; subCatId: string; subSubCatId: string }>) => {
    const current: Record<string, string> = {}
    for (const [k, v] of Array.from(searchParams.entries())) current[k] = v
    const merged = { ...current, ...next }
    // Clean empties
    if (!merged.catId) delete merged.catId
    if (!merged.subCatId) delete merged.subCatId
    if (!merged.subSubCatId) delete merged.subSubCatId
    setSearchParams(merged, { replace: false })
  }

  // Per-category expand state (replaces global pagination)
  const INITIAL_VISIBLE = 10
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        setLoading(true)
        const [prods, c] = await Promise.all([
          getAllProducts(),
          getAllCategories(),
        ])
        if (!alive) return
        setProducts(Array.isArray(prods) ? prods : [])
        setCategories(Array.isArray(c) ? c : [])
      } catch (_) {
        if (!alive) return
        setProducts([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    // Only load full catalog when not in drill-down or search mode
    if (!catIdParam && !qParam) {
      load()
    } else {
      setLoading(false)
    }
    return () => { alive = false }
  }, [catIdParam, qParam])

  // Ensure categories are available for search/drilldown mapping (if not already loaded)
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

  // Load accessories subcategories and products (real data from category id 4)
  useEffect(() => {
    let alive = true
    ;(async () => {
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
    ;(async () => {
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

  // Apply vehicle compatibility filter globally for catalogue views
  const filtered = useMemo(() => {
    if (!hasVehicleFilter) return products
    return products.filter(productMatchesVehicle)
  }, [products, vehFilter])

  // Group by category (all filtered items)
  const grouped = useMemo(() => {
    const map = new Map<string, ApiProduct[]>()
    for (const p of filtered) {
      const key = categoryOf(p)
      const list = map.get(key) || []
      list.push(p)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  // Resolve category image using API categories when available (by id or name)
  const catInfoFor = (sample: any) => {
    const name = categoryOf(sample)
    const c = sample?.category
    let catObj: any | undefined
    let catId: string | undefined
    if (c && typeof c === 'object') {
      catObj = c
      catId = String(c?.id ?? c?.category_id ?? '')
    } else if (typeof c === 'number' || (typeof c === 'string' && /^\d+$/.test(c))) {
      // numeric id or numeric-like string
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

  // Top categories for pill section (by item count)
  const topCats = useMemo(() => {
    const rows = grouped.map(([name, list]) => {
      const info = catInfoFor(list[0] as any)
      return { name: info.name || name, count: list.length }
    })
    rows.sort((a, b) => b.count - a.count)
    return rows.slice(0, 12)
  }, [grouped, categories])

  // Anchor scroll helper
  const scrollToCat = (catName: string) => {
    const id = `cat-${toSlug(catName)}`
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Accessories UI mapping from fetched products
  type Accessory = { id: string; title: string; image: string; rating: number; reviews: number; price: number; badge?: string }
  const ACCESSORIES: Accessory[] = useMemo(() => {
    if (!accProducts || accProducts.length === 0) return []
    return accProducts.slice(0, 20).map((p, i) => {
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
          {/* Image */}
          <Link to={`/product/${a.id}`} className="block">
            <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img src={a.image} alt={a.title} className="h-[80%] w-auto object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
            </div>
          </Link>
          {/* Rating + title + price */}
          <div className="mt-3 space-y-1">
            <div className="text-[12px] text-gray-600">{(a.rating as number).toFixed ? (a.rating as any).toFixed(1) : Number(a.rating).toFixed(1)} • ({a.reviews.toLocaleString()})</div>
            <Link to={`/product/${a.id}`} className="block text-[14px] font-semibold text-gray-900 hover:underline">{a.title}</Link>
            <div className="text-[16px] font-extrabold text-brand">{formatNaira(a.price)}</div>
            <div className="text-left text-[11px] leading-3 text-gray-600">Incl. VAT</div>
          </div>
          {/* Controls */}
          <div className="mt-3 flex items-center justify-end">
            <button type="button" aria-label="Add to cart" className="inline-flex h-9 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105">
              Add to cart
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Actions for drill-down products
  const onViewProduct = (p: any) => {
    const pid = String((p as any)?.product_id ?? (p as any)?.id ?? '')
    if (!pid) return
    const brandSlug = toSlug(brandOf(p) || 'gapa')
    const partSlug = toSlug(categoryOf(p) || 'parts')
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(pid)}`)
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

  // Wishlist hook
  const wishlist = useWishlist()

  // Map product for card display (match Tools)
  const mapProduct = (p: any, i: number) => {
    const id = String((p as any)?.product_id ?? (p as any)?.id ?? i)
    const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || 'Car Part')
    // Prefer explicit img_url over generic image key (API sometimes returns plain filename in image but full path logic depends on img_url)
    const rawImgUrl = (p as any)?.img_url || (p as any)?.imgUrl
    // Force builder with only img_url so productImageFrom does not pick the shorter image field first
    const forcedFromImgUrl = rawImgUrl ? productImageFrom({ img_url: rawImgUrl }) || normalizeApiImage(rawImgUrl) : undefined
    const fallback = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg
    const image = forcedFromImgUrl || fallback || logoImg
    const rating = Number((p as any)?.rating || (p as any)?.stars || 4)
    const reviews = Number((p as any)?.reviews_count || (p as any)?.reviews || 0)
    const brand = brandOf(p) || 'GAPA'
    const price = Number((p as any)?.price || (p as any)?.selling_price || (p as any)?.amount || 0)
    return { id, title, image, rating, reviews, brand, price }
  }

  // Derived values for drill-down (must not be inside conditionals to respect Hooks rules)
  const filteredSubProducts = useMemo(() => {
    // Do not apply vehicle filter inside non-vehicle categories
    if (NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId))) return subProducts
    if (!hasVehicleFilter) return subProducts
    return subProducts.filter(productMatchesVehicle)
  }, [subProducts, vehFilter, hasVehicleFilter, activeCatId])

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

  // --- Drilldown start mode (no category selected yet) ---
  if (inDrillMode && !activeCatId && !qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">Browse by category</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">Select Category</li>
            </ol>
          </nav>

          {hasVehicleFilter && (
            <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
              Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
            </div>
          )}

          {/* Categories grid */}
          <div className="mt-6">
            {loading ? (
              <FallbackLoader label="Loading categories…" />
            ) : categories.length === 0 ? (
              <div className="text-sm text-gray-700">No categories found.</div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {categories.map((c: any, i: number) => {
                  const id = String((c?.id ?? c?.category_id ?? i))
                  const name = String(c?.title || c?.name || 'Category')
                  const image = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || logoImg
                  return (
                    <li key={id}>
                      <button
                        onClick={() => setParams({ catId: id, subCatId: '', subSubCatId: '' })}
                        className="w-full rounded-2xl bg-white p-4 text-left ring-1 ring-black/10 transition hover:shadow"
                      >
                        <div className="flex w-full flex-col items-center gap-3">
                          <div className="overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                            <img src={image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-[13px] font-semibold text-gray-900">{name}</div>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    )
  }

  // --- Drill-down UI when catId is present ---
  if (activeCatId) {
    // Removed duplicate memoized declarations (use top-level values)

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

          {hasVehicleFilter && !NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && (
            <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
              Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
            </div>
          )}

          {/* Sidebar + content */}
          <div className="mt-6 grid gap-6 md:grid-cols-[280px_1fr]">
            {/* <aside className="rounded-xl bg-white p-4 ring-1 h-max sticky top-4 self-start"> */}
            {/* <h3 className="text-[14px] font-semibold text-gray-900">Select vehicle</h3> */}
            <div className="mt-3">
              {/* Vehicle filter hidden for NON_VEHICLE categories */}
              {!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && (
                <div className="mt-3">
                  <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
                </div>
              )}
            </div>
            {/* </aside> */}

            <div>
              {/* Sub Categories */}
              <div className="mt-0" ref={catSectionRef}>
                <h3 className="text-[16px] font-semibold text-gray-900">{activeCategoryName || 'Sub Categories'}</h3>
                {subCatsLoading ? (
                  <div className="mt-3"><FallbackLoader label="Loading sub categories…" /></div>
                ) : subCats.length === 0 ? (
                  <div className="mt-3 text-sm text-gray-600">No sub categories found.</div>
                ) : (
                  <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                    {subCats.map((sc) => (
                      <li key={sc.id} className='w-full'>
                        <button
                          onClick={() => setParams({ catId: activeCatId, subCatId: sc.id, subSubCatId: '' })}
                          className={`w-full rounded-2xl bg-white p-4 text-left ring-black/10 transition hover:shadow ${activeSubCatId === sc.id ? 'outline-2 outline-[#F7CD3A]' : ''}`}
                          aria-pressed={activeSubCatId === sc.id}
                        >
                          <div className="flex w-full flex-col items-center gap-3">
                            <div className="overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                              <img src={sc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-[13px] font-semibold text-gray-900">{sc.name}</div>
                              {/* <div className="text-[12px] text-gray-500">Sub-category</div> */}
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Sub-Sub Categories */}
              {activeSubCatId && (
                <div className="mt-8" ref={subSubCatSectionRef}>
                  <h3 className="text-[16px] font-semibold text-gray-900">{activeSubCategoryName || 'Types'}</h3>
                  {subSubCatsLoading ? (
                    <div className="mt-3"><FallbackLoader label="Loading types…" /></div>
                  ) : subSubCats.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-600">No types found.</div>
                  ) : (
                    <>
                      {/* Top Types pill list (like Tools page) */}
                      <div className="mt-4">
                        <ul className="grid grid-cols-2 gap-3 text-[12px] text-gray-800 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                          {subSubCats.map((ssc) => (
                            <li key={`pill-${ssc.id}`}>
                              <button
                                onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: ssc.id })}
                                className={`w-full flex items-center gap-3 rounded-full border px-3 py-2 text-left transition ${activeSubSubCatId === ssc.id ? 'border-[#F7CD3A] bg-[#F7CD3A]/20' : 'border-black/10 hover:bg-black/5'}`}
                                aria-pressed={activeSubSubCatId === ssc.id}
                              >
                                <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-[#F6F5FA] ring-1 ring-black/10">
                                  <img src={ssc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                                </div>
                                <span className="truncate block">{ssc.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Products under sub-sub-category */}
              {activeSubSubCatId && (
                <div className="mt-10" ref={productsSectionRef}>
                  <h3 className="text-[16px] font-semibold text-gray-900">{activeTypeName || 'Products'}</h3>
                  {subProductsLoading ? (
                    <div className="mt-3"><FallbackLoader label="Loading products…" /></div>
                  ) : filteredSubProducts.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-700">
                      {(!NON_VEHICLE_CATEGORY_IDS.has(String(activeCatId)) && hasVehicleFilter) ? 'No compatible products for your selected vehicle in this type. Adjust or reset the vehicle filter.' : 'No products found under this type.'}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {filteredSubProducts.map((p, i) => {
                        const ui = mapProduct(p, i)
                        const wished = wishlist.has(ui.id)
                        return (
                          <div key={ui.id} className="relative rounded-xl bg-white ring-1 ring-black/10">
                            <div className="absolute right-3 top-3 z-10">
                              <WishlistButton size={18} active={wished} onToggle={(active) => { wishlist.toggle(ui.id); if (active) toast.success('Added to wishlist') }} />
                            </div>
                            <div className="p-4">
                              {/* Image */}
                              <button onClick={() => onViewProduct(p)} className="block w-full">
                                <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
                                  <img src={ui.image} alt={ui.title} className="h-[80%] w-auto object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                                </div>
                              </button>
                              {/* Meta */}
                              <div className="mt-3 space-y-1">
                                <div className="text-[12px] text-gray-600">{ui.rating.toFixed ? ui.rating.toFixed(1) : Number(ui.rating).toFixed(1)} • ({ui.reviews?.toLocaleString?.() || '0'})</div>
                                <button onClick={() => onViewProduct(p)} className="block text-left text-[14px] font-semibold text-gray-900 hover:underline line-clamp-2">{ui.title}</button>
                                <div className="text-[12px] text-gray-600">{brandOf(p) || 'GAPA'}</div>
                                <div className="text-[16px] font-extrabold text-brand">{formatNaira(Number((p as any)?.price || (p as any)?.selling_price || (p as any)?.amount || 0))}</div>
                                <div className="text-left text-[11px] leading-3 text-gray-600">Incl. VAT</div>
                              </div>
                              {/* Actions */}
                              <div className="mt-3 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => onViewProduct(p)} className="inline-flex h-9 items-center justify-center rounded-md border border-black/10 px-3 text-[12px] font-semibold text-gray-800 hover:bg-black/5">
                                  View
                                </button>
                                <button type="button" onClick={() => onAddToCart(p)} className="inline-flex h-9 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105">
                                  Add to cart
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
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

  // --- Search results mode ---
  if (qParam) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">Search results</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className="font-semibold text-brand">Results for “{qParam}”</li>
            </ol>
          </nav>

          {hasVehicleFilter && (
            <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
              Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
            </div>
          )}

          {/* Filters + results */}
          <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
            {/* Filters */}
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Filter</h3>
                {(selectedBrands.size || selectedCats.size) ? (
                  <button
                    type="button"
                    className="text-[12px] text-brand hover:underline"
                    onClick={() => { setSelectedBrands(new Set()); setSelectedCats(new Set()) }}
                  >
                    Clear
                  </button>
                ) : null}
              </div>

              {/* Vehicle filter available in search mode */}
              <div className="mt-4">
                <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
              </div>

              {/* Brands */}
              <div className="mt-3">
                <div className="text-[12px] font-semibold text-gray-800">Brands</div>
                <ul className="mt-2 space-y-2 text-[12px] text-gray-800">
                  {allSearchBrands.map((b) => (
                    <li key={`b-${b}`} className="flex items-center gap-2">
                      <input
                        id={`brand-${toSlug(b)}`}
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
                        checked={selectedBrands.has(b)}
                        onChange={() => toggleSet(setSelectedBrands, b)}
                      />
                      <label htmlFor={`brand-${toSlug(b)}`} className="cursor-pointer select-none">{b}</label>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Categories (names resolved via API) */}
              <div className="mt-4">
                <div className="text-[12px] font-semibold text-gray-800">Categories</div>
                <ul className="mt-2 space-y-2 text-[12px] text-gray-800">
                  {allSearchCats.map((cName) => (
                    <li key={`c-${toSlug(cName)}`} className="flex items-center gap-2">
                      <input
                        id={`cat-${toSlug(cName)}`}
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand"
                        checked={selectedCats.has(cName)}
                        onChange={() => toggleSet(setSelectedCats, cName)}
                      />
                      <label htmlFor={`cat-${toSlug(cName)}`} className="cursor-pointer select-none">{cName}</label>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>

            {/* Results list */}
            <div>
              {searchLoading ? (
                <FallbackLoader label="Searching…" />
              ) : filteredSearchResults.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                  <div className="text-[14px] text-gray-700">{hasVehicleFilter ? 'No compatible products for your selected vehicle. Adjust or reset the vehicle filter.' : `No results found for “${qParam}”.`}</div>
                </div>
              ) : (
                <>
                  <div className="mb-3 text-[13px] text-gray-700">{filteredSearchResults.length} result{filteredSearchResults.length === 1 ? '' : 's'}</div>
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredSearchResults.map((p: ApiProduct, i: number) => {
                      const ui = toUiProduct(p, i)
                      // Wishlist handled inside ProductCard; removed external duplicate heart icon
                      return (
                        <li key={ui.id}>
                          <ProductCard product={ui} />
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
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

        {hasVehicleFilter && (
          <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
            Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
          </div>
        )}

        {/* Quick vehicle filter on catalogue page */}
        <div className="mt-4 max-w-sm">
          <VehicleFilter onSearch={(url) => navigate(url)} onChange={setVehFilter} />
        </div>

        {/* Car Accessories grid (restored) */}
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

        {/* Results */}
        {loading ? (
          <div className="mt-8"><FallbackLoader label="Loading parts…" /></div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Category sections (no global pagination) */}
            {grouped.length === 0 ? (
              <div className="text-center text-sm text-gray-700">
                {hasVehicleFilter ? (
                  <>
                    <div>No compatible products for your selected vehicle.</div>
                    <div className="mt-2">
                      <button
                        onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }}
                        className="rounded-md bg-gray-100 px-3 py-1.5 text-[12px] font-medium ring-1 ring-black/10"
                      >Reset vehicle filter</button>
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
                    {/* Category card */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                        <img src={catImg} alt={catName} className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }} />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-semibold text-gray-900">{catName}</h3>
                        <div className="text-[12px] text-gray-600">{list.length} item{list.length === 1 ? '' : 's'}</div>
                      </div>
                    </div>

                    {/* Product names list with per-category expand */}
                    <div>
                      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((p, i) => {
                          // Ensure product_id is used for view details
                          const id = String((p as any)?.product_id ?? (p as any)?.id ?? i)
                          const title = String((p as any)?.part_name || (p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Car Part')
                          const brandSlug = toSlug(brandOf(p)) || 'gapa'
                          const partSlug = toSlug(categoryOf(p)) || 'parts'
                          const wished = wishlist.has(id)
                          return (
                            <li key={`${catName}-${id}-${i}`} className="truncate relative group pr-6">
                              <Link to={`/parts/${encodeURIComponent(brandSlug)}/${encodeURIComponent(partSlug)}?pid=${encodeURIComponent(id)}`} className="text-[14px] text-brand hover:underline line-clamp-2">{title}</Link>
                              <span className="absolute right-0 top-0">
                                <WishlistButton size={16} active={wished} onToggle={(active) => { wishlist.toggle(id); if (active) toast.success('Added to wishlist') }} />
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                      {list.length > INITIAL_VISIBLE && (
                        <div className="mt-3">
                          <button
                            onClick={() => setExpanded((s) => ({ ...s, [catName]: !isExpanded }))}
                            className="text-[13px] font-semibold text-brand hover:underline"
                          >
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
      </section>

      {/* Top car accessories Categories (pill links) - real data from category id 4 */}
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

      {/* Top brands (shared component) */}
      <TopBrands title="Top brands" limit={12} viewAll={true} />

      {/* Accessories carousel (real data) */}
      <section className="mx-auto !max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-quality car accessories at unbeatable prices</h3>
        </div>
        {accProductsLoading ? (
          <div className="mt-4"><FallbackLoader label="Loading accessories…" /></div>
        ) : (
          <div
            className="mt-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]"
            aria-label="Top accessories carousel"
          >
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
            <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-3 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
              {ACCESSORIES.map((a) => (
                <div key={a.id} className="shrink-0"><AccessoryCard a={a} /></div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Info section remains */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <h2 id="acc-easy-title" className="text-center text-[22px] font-semibold text-gray-900 sm:text-[28px]">Car Accessories Made Easy with Gapa Naija</h2>
        <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-6 text-gray-600">
          Car accessories play a huge role in making your driving experience safer, more convenient, and more enjoyable. At Gapa Naija,
          we provide high-quality accessories that not only protect your car but also add comfort, safety, and style for every trip.
        </p>

        <div className="mt-8 grid gap-10 md:grid-cols-3">
          {/* Types list (2 columns) */}
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