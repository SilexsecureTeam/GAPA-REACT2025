import React, { useEffect, useMemo, useState, Fragment } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import FallbackLoader from '../components/FallbackLoader'
import ProductCard, { type Product as UiProduct } from '../components/ProductCard'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getSubCategories, getSubSubCategories, getProductsBySubSubCategory, liveSearch } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import TopBrands from '../components/TopBrands'

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
          <p className="mt-1 text-sm">{message}</p>
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
  // Basic mapping for SearchError suggestion/localStorage
  const id = String(p?.id ?? p?.product_id ?? i)
  const title = String(p?.name || p?.title || p?.product_name || 'Car Part')
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
  {
    title: 'Car cleaning & detailing accessories',
    img: logoImg,
    links: [
      'Car air freshener',
      'Car dehumidifier',
      'Car sponge',
      'Car washing brushes',
      'Cleaning brushes',
      'Cleaning wipes',
      'Hand cleaner',
      'Hand sanitizer',
      'Microfiber cloths',
      'Polisher heads',
      'Polishing pads',
      'Pressure washers',
      'Wheel brushes',
    ],
  },
  {
    title: 'Road Emergencies and First Aid',
    img: logoImg,
    links: [
      'Car de-icing spray',
      'Car emergency kit',
      'Warning triangle',
      'Reflective vests',
      'Tow rope',
      'Jump cables',
      'Spare bulbs',
      'Paper towels',
      'Work gloves',
      'First aid kit',
    ],
  },
  {
    title: 'Winter car accessories',
    img: logoImg,
    links: [
      'Ice scraper',
      'Jump starter',
      'Parking heater',
      'Roof box',
      'Ski bag',
      'Snow chains',
      'Universal car mats',
      'Window cleaner',
    ],
  },
  {
    title: 'Car interior Accessories',
    img: logoImg,
    links: [
      'Car armrest',
      'Car boot mats & liners',
      'Car boot hanger',
      'Car seat covers',
      'Car seat protectors',
      'Car vacuum cleaner',
      'Cool box',
      'Cooler bag',
      'Organizer bags',
      'Gear stick gaiter',
      'Car seat gap cover',
      'Headrest or seat cover',
      'Non-slip dashboard mat',
    ],
  },
  {
    title: 'PPE & disinfection products',
    img: logoImg,
    links: [
      'Face masks',
      'Disinfectant',
      'Hand sanitizer',
      'Paper towels',
      'Gloves',
    ],
  },
  {
    title: 'Camping accessories',
    img: logoImg,
    links: [
      'Camping stove',
      '12V fridge',
      'Portable heater',
      'Roof box',
      'Sleeping bag',
      'Universal car mats',
      'Window cleaner',
    ],
  },
  {
    title: 'Wheel & tyre accessories',
    img: logoImg,
    links: [
      'Car jack',
      'Foot pumps',
      'Tyre inflators',
      'Tyre pressure gauges',
      'Tyre repair kits',
      'Valve caps',
      'Wheel nuts caps',
      'Valve cores',
      'Wheel / tyre bags',
    ],
  },
  {
    title: 'Car phone accessories',
    img: logoImg,
    links: [
      'Car inverter',
      'Car phone charger',
      'Car phone holder',
      'Dash camera',
    ],
  },
  {
    title: 'In-car entertainment',
    img: logoImg,
    links: [
      'Amp wiring kit',
      'Car amplifiers',
      'Car audio accessories',
      'Car audio speakers',
      'Car multimedia systems',
      'Car subwoofers',
      'Car tweeters',
      'FM transmitter',
      'Sound deadening mats',
    ],
  },
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
          <img src={s.img} alt="" className="h-24 w-full object-contain md:h-28" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])

  // Search mode
  const qParam = (searchParams.get('q') || '').trim()
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<ApiProduct[]>([])

  // Filters for search mode
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set())
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set())

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

  const allSearchCats = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const p of searchResults) {
      const c = categoryOf(p)
      if (c) set.add(c)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [searchResults])

  const filteredSearchResults = useMemo<ApiProduct[]>(() => {
    return searchResults.filter((p) => {
      const b = brandOf(p)
      const c = categoryOf(p)
      const brandPass = selectedBrands.size === 0 || (b && selectedBrands.has(b))
      const catPass = selectedCats.size === 0 || (c && selectedCats.has(c))
      return brandPass && catPass
    })
  }, [searchResults, selectedBrands, selectedCats])

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
    ;(async () => {
      try {
        setSubCatsLoading(true)
        const res = await getSubCategories(activeCatId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        const mapped = arr.map((sc: any, i: number) => ({
          id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
          name: String(sc?.sub_title || sc?.title || sc?.name || 'Sub Category'),
          image: categoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || logoImg,
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
    ;(async () => {
      try {
        setSubSubCatsLoading(true)
        const res = await getSubSubCategories(activeSubCatId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        const mapped = arr.map((ssc: any, i: number) => ({
          id: String(ssc?.sub_sub_cat_id ?? ssc?.subsubcatID ?? ssc?.id ?? ssc?.sub_sub_category_id ?? i),
          name: String(ssc?.sub_sub_title || ssc?.title || ssc?.name || 'Type'),
          image: categoryImageFrom(ssc) || normalizeApiImage(pickImage(ssc) || '') || logoImg,
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
    ;(async () => {
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
    ;(async () => {
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

  // Categories dropdown state
  const [openIdx, setOpenIdx] = useState<number | null>(null)

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

  // No global filters now; use full list
  const filtered = products

  // Navigate to SearchError if empty catalog and not in search/drill-down
  useEffect(() => {
    if (!catIdParam && !qParam && !loading && filtered.length === 0) {
      const suggestSrc = Array.isArray(products) && products.length > 0 ? products[0] : null
      const suggest = suggestSrc ? toUiProduct(suggestSrc, 0) : undefined
      // persist suggestion for SearchError fallback
      if (suggest) localStorage.setItem('gapa:last-suggest', JSON.stringify(suggest))
      navigate('/search-error', { state: { reason: 'no_results', suggest }, replace: false })
    }
  }, [filtered.length, loading, navigate, products, catIdParam, qParam])

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

  // Build categories menu model from grouped data (now includes product images)
  const catMenu = useMemo(() => {
    return grouped.map(([name, list]) => {
      const sample = list[0]
      const info = catInfoFor(sample as any)
      return {
        name: info.name || name,
        image: info.image,
        items: list.slice(0, 12).map((p, i) => ({
          id: String((p as any)?.id ?? (p as any)?.product_id ?? i),
          title: String((p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Car Part'),
          image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg,
        }))
      }
    })
  }, [grouped, categories])

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

  // Accessories (demo data for the carousel)
  type Accessory = { id: string; title: string; image: string; rating: number; reviews: number; price: number; badge?: string }
  const ACCESSORIES: Accessory[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `acc-${i + 1}`,
    title: ['Seat Organizer', 'Phone Mount', 'All-weather Mats', 'Dash Cam', 'LED Bulb'][i % 5],
    image: logoImg,
    rating: 3.8 + ((i % 4) * 0.3),
    reviews: 500 + i * 37,
    price: 12000 + i * 1500,
    badge: i % 3 === 0 ? 'Best Seller' : i % 3 === 1 ? 'New' : undefined,
  }))

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
              <img src={a.image} alt={a.title} className="h-[80%] w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
            </div>
          </Link>
          {/* Rating + title + price */}
          <div className="mt-3 space-y-1">
            <div className="text-[12px] text-gray-600">{a.rating.toFixed(1)} • ({a.reviews.toLocaleString()})</div>
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

  // --- Drill-down UI when catId is present ---
  if (activeCatId) {
    return (
      <div className="bg-white !pt-10">
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <h1 className="text-2xl font-medium text-gray-900 sm:text-[32px]">Car Parts</h1>
          <nav aria-label="Breadcrumb" className="mt-2 text-[14px] text-gray-700">
            <ol className="flex items-center gap-2 font-medium">
              <li>
                <Link to="/parts" className="hover:underline">Parts Catalogue</Link>
              </li>
              <li aria-hidden className='text-[22px] -mt-1'>›</li>
              <li className={activeSubCatId || activeSubSubCatId ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                  onClick={() => setParams({ catId: activeCatId, subCatId: '', subSubCatId: '' })}
              >Category</li>
              {activeSubCatId && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className={activeSubSubCatId ? 'text-brand cursor-pointer hover:underline' : 'font-semibold text-brand'}
                      onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: '' })}
                  >Sub Category</li>
                </>
              )}
              {activeSubSubCatId && (
                <>
                  <li aria-hidden className='text-[22px] -mt-1'>›</li>
                  <li className="font-semibold text-brand">Type</li>
                </>
              )}
            </ol>
          </nav>

          {/* Sub Categories */}
          <div className="mt-6">
            <h3 className="text-[16px] font-semibold text-gray-900">Sub Categories</h3>
            {subCatsLoading ? (
              <div className="mt-3"><FallbackLoader label="Loading sub categories…" /></div>
            ) : subCats.length === 0 ? (
              <div className="mt-3 text-sm text-gray-600">No sub categories found.</div>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {subCats.map((sc) => (
                  <li key={sc.id}>
                    <button
                      onClick={() => setParams({ catId: activeCatId, subCatId: sc.id, subSubCatId: '' })}
                      className={`flex w-full items-center gap-3 rounded-lg p-2 ring-1 ring-black/10 hover:bg-gray-50 ${activeSubCatId===sc.id ? 'bg-gray-50' : ''}`}
                    >
                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                        <img src={sc.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                      </span>
                      <span className="truncate text-[14px] text-brand">{sc.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sub-Sub Categories */}
          {activeSubCatId && (
            <div className="mt-8">
              <h3 className="text-[16px] font-semibold text-gray-900">Types</h3>
              {subSubCatsLoading ? (
                <div className="mt-3"><FallbackLoader label="Loading types…" /></div>
              ) : subSubCats.length === 0 ? (
                <div className="mt-3 text-sm text-gray-600">No types found.</div>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {subSubCats.map((ssc) => (
                    <li key={ssc.id}>
                      <button
                        onClick={() => setParams({ catId: activeCatId, subCatId: activeSubCatId, subSubCatId: ssc.id })}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 ring-1 ring-black/10 hover:bg-gray-50 ${activeSubSubCatId===ssc.id ? 'bg-gray-50' : ''}`}
                      >
                        <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                          <img src={ssc.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                        </span>
                        <span className="truncate text-[14px] text-brand">{ssc.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Products under sub-sub-category */}
          {activeSubSubCatId && (
            <div className="mt-10">
              <h3 className="text-[16px] font-semibold text-gray-900">Products</h3>
              {subProductsLoading ? (
                <div className="mt-3"><FallbackLoader label="Loading products…" /></div>
              ) : subProducts.length === 0 ? (
                <div className="mt-3 text-sm text-gray-600">No products found under this type.</div>
              ) : (
                <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {subProducts.map((p, i) => {
                    const ui = toUiProduct(p, i)
                    return (
                      <li key={ui.id} className="rounded-xl bg-white p-3 ring-1 ring-black/10">
                        <Link to={`/product/${encodeURIComponent(ui.id)}`} className="block">
                          <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg bg-white">
                            <img src={ui.image} alt={ui.title} className="h-[80%] w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                          </div>
                          <div className="mt-2 truncate text-[13px] font-semibold text-gray-900 hover:underline">{ui.title}</div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
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

          {/* Filters + results */}
          <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
            {/* Filters */}
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Filter</h3>
                {(selectedBrands.size || selectedCats.size) ? (
                  <button onClick={() => { setSelectedBrands(new Set()); setSelectedCats(new Set()) }} className="text-[12px] text-brand underline">Clear all</button>
                ) : null}
              </div>

              {/* Brands */}
              <div className="mt-3">
                <div className="text-[13px] font-semibold text-gray-800">Brand</div>
                <ul className="mt-2 space-y-1">
                  {allSearchBrands.length === 0 && <li className="text-[12px] text-gray-500">No brand filters</li>}
                  {allSearchBrands.map((b: string) => {
                    const id = `b-${toSlug(b)}`
                    return (
                      <li key={b} className="flex items-center gap-2">
                        <input id={id} type="checkbox" className="h-3.5 w-3.5" checked={selectedBrands.has(b)} onChange={() => toggleSet(setSelectedBrands, b)} />
                        <label htmlFor={id} className="text-[13px] text-gray-700">{b}</label>
                      </li>
                    )
                  })}
                </ul>
              </div>

              {/* Categories */}
              <div className="mt-4">
                <div className="text-[13px] font-semibold text-gray-800">Category</div>
                <ul className="mt-2 space-y-1">
                  {allSearchCats.length === 0 && <li className="text-[12px] text-gray-500">No category filters</li>}
                  {allSearchCats.map((c: string) => {
                    const id = `c-${toSlug(c)}`
                    return (
                      <li key={c} className="flex items-center gap-2">
                        <input id={id} type="checkbox" className="h-3.5 w-3.5" checked={selectedCats.has(c)} onChange={() => toggleSet(setSelectedCats, c)} />
                        <label htmlFor={id} className="text-[13px] text-gray-700">{c}</label>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>

            {/* Results */}
            <div>
              {searchLoading ? (
                <FallbackLoader label="Searching…" />
              ) : filteredSearchResults.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center ring-1 ring-black/10">
                  <div className="text-[14px] text-gray-700">No results found for “{qParam}”.</div>
                </div>
              ) : (
                <>
                  <div className="mb-3 text-[13px] text-gray-700">{filteredSearchResults.length} result{filteredSearchResults.length===1?'':'s'}</div>
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    {filteredSearchResults.map((p: ApiProduct, i: number) => {
                      const ui = toUiProduct(p, i)
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

        {/* Categories hover dropdown menu */}
        {!loading && catMenu.length > 0 && (
          <nav className="relative mt-4" onMouseLeave={() => setOpenIdx(null)}>
            <div className="flex items-center gap-2 overflow-x-auto rounded-lg bg-white p-2 ring-1 ring-black/10">
              {catMenu.map((c, i) => (
                <div key={c.name} className="relative">
                  <button
                    onMouseEnter={() => setOpenIdx(i)}
                    onFocus={() => setOpenIdx(i)}
                    onClick={() => { setOpenIdx(null); scrollToCat(c.name) }}
                    className={`group inline-flex items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium ${openIdx===i ? 'bg-brand text-white' : 'text-gray-800 hover:bg-gray-100'}`}
                    aria-haspopup
                    aria-expanded={openIdx===i}
                  >
                    <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                      <img src={c.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                    </span>
                    <span>{c.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${openIdx===i ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {openIdx===i && (
                    <div className="absolute left-0 top-full z-40 mt-2 w-screen max-w-md rounded-xl bg-white p-3 text-gray-900 shadow-lg ring-1 ring-black/10 sm:max-w-lg md:max-w-xl">
                      <div role="menu" aria-label={`${c.name} items`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {c.items.map((it) => (
                          <Link
                            key={it.id}
                            role="menuitem"
                            to={`/product/${encodeURIComponent(it.id)}`}
                            className="group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-brand/5 focus:outline-none"
                          >
                            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                              <img src={it.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                            </span>
                            <span className="truncate text-brand group-hover:underline">{it.title}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </nav>
        )}

        {/* Results */}
        {loading ? (
          <div className="mt-8"><FallbackLoader label="Loading parts…" /></div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Category sections (no global pagination) */}
            {grouped.length === 0 ? (
              <div className="text-center text-sm text-gray-600">No products found.</div>
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
                        <img src={catImg} alt={catName} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-semibold text-gray-900">{catName}</h3>
                        <div className="text-[12px] text-gray-600">{list.length} item{list.length===1?'':'s'}</div>
                      </div>
                    </div>

                    {/* Product names list with per-category expand */}
                    <div>
                      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {visible.map((p, i) => {
                          const id = String((p as any)?.id ?? (p as any)?.product_id ?? i)
                          const title = String((p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Car Part')
                          return (
                            <li key={`${catName}-${id}-${i}`} className="truncate">
                              <Link to={`/product/${encodeURIComponent(id)}`} className="text-[14px] text-brand hover:underline">{title}</Link>
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

      {/* Top car accessories Categories (pill links) */}
      <section className="mx-auto !max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top car accessories Categories</h3>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-3 text-[12px] text-gray-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {(topCats.length ? topCats.map(tc => tc.name) : [
            'In-car phone chargers',
            'Satnav',
            'Dash camera',
            'Universal car floor mats',
            'Hubcaps',
            'First aid kit',
            'Car jacks',
            'Tyre compressors',
            'Car windscreen cover',
            'Microfiber cleaning cloth',
            'Car sponge',
            'Number plate surrounds',
          ]).map((label) => (
            <li key={label} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
              <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20" aria-hidden />
              <a href="#" onClick={(e)=>{e.preventDefault(); scrollToCat(label)}} className="hover:underline">{label}</a>
            </li>
          ))}
        </ul>
      </section>

      {/* Top brands (shared component) */}
      <TopBrands title="Top brands" limit={12} viewAll={true} />

      {/* Accessories carousel (no buttons) */}
      <section className="mx-auto !max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-quality car accessories at unbeatable prices</h3>
        </div>
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