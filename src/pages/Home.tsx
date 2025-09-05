import { useMemo, useState, useEffect, useRef } from 'react'
import ProductCard, { type Product } from '../components/ProductCard'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import carShop from '../assets/car-shop.png'
import FallbackLoader from '../components/FallbackLoader'
import { getAllBrands, getAllCategories, getFeaturedProducts, getManufacturers, getPartners, type ApiBrand, type ApiCategory, type ApiManufacturer, type ApiPartner, type ApiProduct, liveSearch, getModelsByBrandId, getSubModelsByModelId } from '../services/api'
import { pickImage, normalizeApiImage, productImageFrom, categoryImageFrom, partnerImageFrom } from '../services/images'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import TopBrands from '../components/TopBrands'
import logoImg from '../assets/gapa-logo.png'

// Remove static MAKERS/MODELS/ENGINES and derive from API drill-down (brands -> models -> engines)
// Helpers to unwrap API shapes and map images safely
function unwrap<T = any>(res: any): T[] {
  // Direct array
  if (Array.isArray(res)) return res as T[]
  // data is array
  if (res && Array.isArray(res.data)) return res.data as T[]
  // data is object containing an array under some key
  if (res && res.data && typeof res.data === 'object') {
    for (const k of Object.keys(res.data)) {
      const v = (res.data as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  // top-level object contains an array under some key (e.g., "top-products")
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}
function imgOf(obj: any): string | undefined { return pickImage(obj) }

// Name helpers for vehicle drill-down
function brandNameOf(b: any): string {
  return String(b?.name || b?.title || b?.brand_name || b?.brand || '').trim() || 'Brand'
}
function modelNameOf(m: any): string {
  return String(m?.name || m?.model_name || m?.model || m?.title || '').trim() || 'Model'
}
function engineNameOf(e: any): string {
  return String(e?.name || e?.engine || e?.trim || e?.sub_model_name || e?.submodel_name || e?.title || '').trim() || 'Engine'
}

// Special offers demo type reused by API mapping
type Offer = Product & { price: number; reviews: number }

function formatNaira(n: number) { return `\u20a6${n.toLocaleString('en-NG')}` }

function OfferCard({ offer }: { offer: Offer }) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(offer.id)
  return (
    <div className="relative rounded-xl bg-white ring-1 ring-black/10">
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton active={isFav} onToggle={() => wishlist.toggle(offer.id)} ariaLabel="Add to wishlist" />
      </div>
      <div className="p-4">
        <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg ">
          <img src={normalizeApiImage(offer.image) || logoImg} alt={offer.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1 text-[12px] text-gray-600">
            <Rating value={offer.rating} size={12} />
            <span className="text-gray-500">({offer.reviews.toLocaleString()})</span>
          </div>
          <a href="#" className="block text-[13px] font-semibold text-gray-900 hover:underline">{offer.title}</a>
          <div className="text-[13px] font-extrabold text-gray-900">{formatNaira(offer.price)}</div>
          <div className="text-[10px] leading-3 text-gray-500">NG/ECOM tax</div>
          <div className="text-[10px] leading-3 text-gray-500">Incl. 30% VAT</div>
        </div>
      </div>
    </div>
  )
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-brand ring-1 ring-black/10">
      {n}
    </span>
  )
}

const TAB_LABELS: [string, string, string] = ['Top Car Parts', 'Top Manufacturers', 'Top Sellers']

export default function Home() {
  const navigate = useNavigate()
  // API state
  const [loading, setLoading] = useState(true)
  const [featured, setFeatured] = useState<ApiProduct[]>([])
  const [brands, setBrands] = useState<ApiBrand[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [manufacturers, setManufacturers] = useState<ApiManufacturer[]>([])
  const [partners, setPartners] = useState<ApiPartner[]>([])
  // Vehicle drill-down state
  const [models, setModels] = useState<any[]>([])
  const [subModels, setSubModels] = useState<any[]>([])
  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [engineId, setEngineId] = useState('')
  const [brandName, setBrandName] = useState('')
  const [modelName, setModelName] = useState('')
  const [engineName, setEngineName] = useState('')
  // Tabs state
  const [tab, setTab] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [f, b, c, m, p] = await Promise.allSettled([
          getFeaturedProducts(),
          getAllBrands(),
          getAllCategories(),
          getManufacturers(),
          getPartners(),
        ])
        if (!alive) return
        setFeatured(unwrap<ApiProduct>(f.status === 'fulfilled' ? f.value : []))
        setBrands(unwrap<ApiBrand>(b.status === 'fulfilled' ? b.value : []))
        setCategories(unwrap<ApiCategory>(c.status === 'fulfilled' ? c.value : []))
        setManufacturers(unwrap<ApiManufacturer>(m.status === 'fulfilled' ? m.value : []))
        setPartners(unwrap<ApiPartner>(p.status === 'fulfilled' ? p.value : []))
      } catch (e: any) {
        // ignore for now; loaders will show
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Fetch models when brand changes
  useEffect(() => {
    let alive = true
    if (!brandId) { setModels([]); setSubModels([]); return }
    ;(async () => {
      try {
        const res = await getModelsByBrandId(brandId)
        if (!alive) return
        setModels(unwrap<any>(res))
      } catch (_) {
        setModels([])
      }
    })()
    return () => { alive = false }
  }, [brandId])

  // Fetch engines (sub-models) when model changes
  useEffect(() => {
    let alive = true
    if (!modelId) { setSubModels([]); return }
    ;(async () => {
      try {
        const res = await getSubModelsByModelId(modelId)
        if (!alive) return
        setSubModels(unwrap<any>(res))
      } catch (_) {
        setSubModels([])
      }
    })()
    return () => { alive = false }
  }, [modelId])

  // Helper to slugify
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Derived UI models
  const featuredAsProducts: Product[] = featured.slice(0, 10).map((it, i) => {
    const brandNameLocal = String((it as any)?.brand?.name || (it as any)?.brand || (it as any)?.manufacturer || (it as any)?.maker || '')
    const catName = typeof (it as any)?.category === 'string' ? (it as any)?.category : ((it as any)?.category?.name || (it as any)?.category?.title || (it as any)?.category_name || '')
    return {
      id: String((it as any)?.id ?? (it as any)?.product_id ?? i),
      title: (it as any)?.name || (it as any)?.title || (it as any)?.product_name || 'Car Part',
      image: productImageFrom(it) || normalizeApiImage(pickImage(it) || '') || logoImg,
      rating: Number((it as any)?.rating || 4),
      brandSlug: brandNameLocal ? toSlug(brandNameLocal) : undefined,
      partSlug: catName ? toSlug(catName) : undefined,
    }
  })

  const offers: Offer[] = featured.slice(0, 8).map((it, i) => ({
    id: String((it as any)?.id ?? (it as any)?.product_id ?? i),
    title: (it as any)?.name || (it as any)?.title || (it as any)?.product_name || 'Car Part',
    image: productImageFrom(it) || normalizeApiImage(pickImage(it) || '') || logoImg,
    rating: Number((it as any)?.rating || 4.2),
    price: Number((it as any)?.price || (it as any)?.selling_price || (it as any)?.amount || 40000),
    reviews: Number((it as any)?.reviews_count || (it as any)?.reviews || 0),
    // In offers we don't navigate, but include for consistency
    brandSlug: undefined,
    partSlug: undefined,
  })) as Offer[]

  // Form state and options using API drill-down
  const brandOptions = useMemo(() => (
    brands
      .map((b) => ({ value: String((b as any)?.id ?? ''), label: brandNameOf(b) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [brands])

  const modelOptions = useMemo(() => (
    models
      .map((m) => ({ value: String((m as any)?.id ?? (m as any)?.model_id ?? ''), label: modelNameOf(m) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [models])

  const engineOptions = useMemo(() => (
    subModels
      .map((e) => ({ value: String((e as any)?.id ?? (e as any)?.sub_model_id ?? ''), label: engineNameOf(e) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [subModels])

  // Lookup maps for labels by id
  const brandLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of brandOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [brandOptions])
  const modelLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of modelOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [modelOptions])
  const engineLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of engineOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [engineOptions])

  const onSearchParts = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = [brandName, modelName, engineName].filter(Boolean).join(' ').trim()
    if (!term) return
    const list = await liveSearch(term)
    const arr = Array.isArray(list) ? list : (list as any)?.data
    const items = Array.isArray(arr) ? arr : []
    const brandSlug = (brandName || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'gapa'
    const partSlug = (modelName || 'part').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
    if (items.length === 0) {
      // Cache a suggestion from featured for SearchError/inline use
      const s = featuredAsProducts[0]
      const suggest = s
        ? { id: s.id, title: s.title, image: s.image, rating: s.rating, brandSlug: s.brandSlug, partSlug: s.partSlug }
        : undefined
      if (suggest) {
        try { localStorage.setItem('gapa:last-suggest', JSON.stringify(suggest)) } catch {}
      }
      // Navigate to CarPartDetails to handle inline error and related suggestions
      navigate(`/parts/${brandSlug}/${partSlug}?q=${encodeURIComponent(term)}`)
      return
    }
    const first = items[0]
    const pid = String(first?.id || first?.product_id || '')
    const brand = String(first?.brand || first?.manufacturer || brandName || 'gapa')
    const part = String(first?.name || first?.product_name || modelName || 'part')
    navigate(`/parts/${brand.toLowerCase().replace(/[^a-z0-9]+/g,'-')}/${part.toLowerCase().replace(/[^a-z0-9]+/g,'-')}?pid=${encodeURIComponent(pid)}`)
  }
  const onSearchReg = (e: React.FormEvent) => {
    e.preventDefault()
    // Placeholder: Registration search not yet defined in API
    // Keep UX consistent
    const term = [brandName, modelName, engineName].filter(Boolean).join(' ').trim()
    if (!term) return
    alert(`Searching parts for reg: ${term}`)
  }

  // Tabs a11y helpers
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tab
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (current + 1) % TAB_LABELS.length as 0 | 1 | 2
      setTab(next)
      tabRefs.current[next]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (current - 1 + TAB_LABELS.length) % TAB_LABELS.length as 0 | 1 | 2
      setTab(prev)
      tabRefs.current[prev]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setTab(0)
      tabRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setTab(2)
      tabRefs.current[2]?.focus()
    }
  }

  // Simplified renderer for tab panel content to avoid nested JSX/paren issues
  const renderTabContent = () => {
    if (tab === 0) {
      return (
        <>
          {categories.slice(0, 4).map((c, idx) => {
            const name = (c as any)?.name || (c as any)?.title || 'Category'
            const icon = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || logoImg
            const links = [name, 'Popular', 'New', 'Top Rated', 'Budget']
            return (
              <div key={`cat-${idx}`} className="rounded-xl bg-white p-4 ">
                <div className="flex justify-center gap-4">
                  <div className="flex h-auto sm:w-40 ring-1 ring-black/10 p-4 items-center justify-center rounded-lg">
                    <img src={icon} alt={name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                  </div>
                  <div>
                    <h5 className="text-[14px] font-semibold text-gray-900">{name}</h5>
                    <ul className="mt-2 space-y-1.5 text-[13px] text-[#333333]">
                      {links.map((l) => (
                        <li key={l}><a href="#" className="text-brand !underline !hover:underline">{l}</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )
    }
    if (tab === 1) {
      return loading ? (
        <FallbackLoader label="Loading manufacturers…" />
      ) : (
        <>
          {manufacturers.slice(0, 6).map((m, idx) => {
            const name = (m as any)?.name || (m as any)?.title || 'Manufacturer'
            return (
              <div key={`manu-${idx}`} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Trusted OEM quality</div>
              </div>
            )
          })}
        </>
      )
    }
    if (tab === 2) {
      return loading ? (
        <FallbackLoader label="Loading brands…" />
      ) : (
        <>
          {brands.slice(0, 6).map((b, idx) => {
            const name = brandNameOf(b)
            return (
              <div key={`brand-${String((b as any)?.id ?? idx)}-${idx}`} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Popular seller</div>
              </div>
            )
          })}
        </>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero: left promo + right form */}
      <section className="bg-gradient-brand">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-4 py-10 sm:px-6 md:grid-cols-2 md:py-14">
          {/* Left copy */}
          <div className="text-white">
            <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl md:text-[42px]">
              LOOKING FOR THE BEST CAR PARTS FOR YOUR CAR?
              <br /> <span className='font-semibold'>WE'VE GOT YOU COVERED! </span>
            </h1>
            <p className="mt-3 font-semibold text-[16px] max-w-md text-white/90">
              Over 20,000 genuine parts with free delivery above ₦50,000
            </p>
            <a href="#" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#F7CD3A] px-6 text-sm font-semibold text-[#201A2B] shadow hover:brightness-105">
              START SHOPPING
            </a>
          </div>

          {/* Right form card */}
          <div className="rounded-[8px] md:justify-self-end md:min-w-[400px] bg-white p-4 shadow-md ring-1 ring-black/10 md:p-5">
            {/* Parts search form */}
            <form onSubmit={onSearchParts} className="space-y-5">
              <div className="relative">
                {/* vertical guide */}
                <span className="pointer-events-none absolute left-2 top-4 bottom-3 hidden w-[5px] bg-[#5A1E78] sm:block" aria-hidden />

                {/* Rows */}
                <div className="space-y-5 font-semibold">
                  {[
                    {
                      label: 'Select Maker',
                      value: brandId,
                      options: brandOptions,
                      disabled: false,
                      onChange: (val: string) => {
                        setBrandId(val)
                        setBrandName(brandLabelById(val))
                        // Reset downstream selections
                        setModelId(''); setModelName('')
                        setEngineId(''); setEngineName('')
                      }
                    },
                    {
                      label: 'Select Model',
                      value: modelId,
                      options: modelOptions,
                      disabled: !!(!brandId),
                      onChange: (val: string) => {
                        setModelId(val)
                        setModelName(modelLabelById(val))
                        setEngineId(''); setEngineName('')
                      }
                    },
                    {
                      label: 'Select Engine',
                      value: engineId,
                      options: engineOptions,
                      disabled: !!(!modelId),
                      onChange: (val: string) => {
                        setEngineId(val)
                        setEngineName(engineLabelById(val))
                      }
                    },
                  ].map((f, idx) => (
                      <div key={idx} className="grid grid-cols-[20px_1fr] items-center gap-3">
                        <div className="hidden sm:block z-20">
                          <StepBadge n={idx + 1} />
                        </div>
                        <div className="relative">
                          <select
                            aria-label={f.label}
                            value={f.value}
                            onChange={(e) => f.onChange((e.target as HTMLSelectElement).value)}
                            disabled={f.disabled}
                            className="h-12 w-full appearance-none rounded-md bg-gray-100 px-3 pr-9 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
                          >
                            <option value="" disabled hidden>
                              {f.label}
                            </option>
                            {f.options.map((o: any) => (
                              <option key={`${f.label}-${o.value}`} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-gray-500">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <button type="submit" className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-sm font-semibold text-[#201A2B] ring-1 ring-black/5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search
              </button>
            </form>

            {/* Reg search (separate form to avoid nesting) */}
            <div className="pt-4 space-y-3">
              <label className="mb-5 block text-xs font-semibold uppercase tracking-wide text-gray-700">Enter your registration below</label>
              <form onSubmit={onSearchReg} className="flex gap-2">
                <input
                  value={[brandName, modelName, engineName].filter(Boolean).join(' ')}
                  onChange={() => { /* read-only from drill-down; keep UX simple */ }}
                  placeholder="Your Reg"
                  className="h-10 w-full rounded-md bg-gray-100 px-3 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300"
                  readOnly
                />
                <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-[#201A2B] ring-1 ring-black/5">
                  Search
                </button>
              </form>
              <a href="#" className="mt-2 block text-sm font-medium text-brand underline">Can't Find Your Car in the Catalogue?</a>
            </div>
          </div>
        </div>
      </section>

      {/* Browse grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Browse Car Parts</h2>
          <a href="/parts" className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900">
            View all
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Cards grid */}
        {loading ? (
          <FallbackLoader label="Loading products…" />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {featuredAsProducts.length === 0 ? (
              <div className="col-span-full text-center text-sm text-gray-600">No products found.</div>
            ) : (
              featuredAsProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))
            )}
          </div>
        )}
      </section>

      {/* Shop by Section (Categories) */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6">
        <h3 className="text-[20px] font-semibold text-gray-900">Shop by Section</h3>
        {loading ? (
          <FallbackLoader label="Loading categories…" />
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-10 md:grid-cols-4">
            {categories.slice(0, 8).map((c) => {
              const name = (c as any)?.name || (c as any)?.title || 'Category'
              const img = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || logoImg
              const partSlug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
              return (
                <Link key={String((c as any)?.id || name)} to={`/parts/${partSlug}`} className="group rounded-xl p-3 transition">
                  <div className="flex h-42 w-full ring-1 ring-black/10 py-2 items-center justify-center overflow-hidden rounded-lg">
                    <img src={img} alt={name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                  </div>
                  <p className="mt-3 text-center text-[12px] font-semibold uppercase tracking-wide text-gray-800">{name}</p>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
        <h3 className="text-[22px] font-semibold text-gray-900">Making Car Part Shopping Easy</h3>
        <p className="mt-1 text-sm text-gray-600">Find the right parts, save on shipping, and get back on the road in no time.</p>
        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-4">
          { [
            { title: 'Best Prices', desc: 'Get top-quality parts at unbeatable rates.', icon: (
              <path d="M20 6l-11 11-5-5" />
            ) },
            { title: 'Save on Shipping', desc: 'Cut delivery costs with our affordable shipping options.', icon: (
              <path d="M3 12h15l3 6H6z" />
            ) },
            { title: 'Wide Choice', desc: 'Choose from thousands of car parts for any make or model.', icon: (
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            ) },
            { title: 'Fast Delivery', desc: 'Get your order quickly and keep your vehicle running smoothly.', icon: (
              <>
                <path d="M3 13h11l3 5H6z" />
                <path d="M13 6l-1 7" />
              </>
            ) },
          ].map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900">{f.title}</h4>
              <p className="mt-1 text-[12px] leading-5 text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs: Top Car Parts / Manufacturers / Sellers */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div
          className="flex items-center justify-center gap-6"
          role="tablist"
          aria-label="Homepage top lists"
          onKeyDown={handleTabKeyDown}
        >
          {TAB_LABELS.map((t, i) => (
            <button
              key={t}
              ref={(el) => { tabRefs.current[i] = el }}
              onClick={() => setTab(i as 0 | 1 | 2)}
              role="tab"
              id={`home-tab-${i}`}
              aria-controls={`home-tabpanel-${i}`}
              aria-selected={tab === i}
              tabIndex={tab === i ? 0 : -1}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${tab === i ? 'bg-white ring-2 ring-accent text-[#F7CD3A]' : 'bg-[#F6F5FA] text-gray-700 ring-1 ring-black/5 hover:bg-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab panel */}
        <div
          id={`home-tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`home-tab-${tab}`}
          className="mt-6 grid grid-cols-1 gap-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
        >
          {renderTabContent()}
        </div>

        <button className='bg-[#F7CD3A] px-10 rounded-md flex mt-5 w-fit mx-auto justify-center py-2'>View Catalogue</button>
      </section>

      {/* Top brands (from API) */}
      <TopBrands />

      {/* Special Offers on Car Parts (no buttons) */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Special Offers on Car Parts</h3>
        </div>
        {/* Carousel */}
        {loading ? (
          <FallbackLoader label="Loading offers…" />
        ) : (
          <div className="mt-4 py-4 pl-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]" aria-label="Special offers carousel">
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
            <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-6 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
              {offers.length === 0 ? (
                <div className="text-sm text-gray-600">No offers available.</div>
              ) : offers.map((o) => (
                <div key={o.id} className="shrink-0"><OfferCard offer={o} /></div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Gapa Car Parts Shop */}
      <section className="mx-auto mt-10 max-w-7xl grid grid-cols-1 gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6">
          <h3 className="text-[24px] font-semibold text-gray-900 mb-5">Gapa Car Parts Shop</h3>
          <div className="mt-4 space-y-5">
            { [
              { title: 'Fast Delivery', desc: 'Items in stock are shipped within 4–5 days of payment, so you can get back on the road without delays.' },
              { title: 'High-Quality Branded Auto Parts', desc: 'Our wide selection of genuine and branded auto parts keeps your car running smoothly and safely. Count on Gapa Naija as your reliable car parts supplier' },
              { title: 'Original Equipment Quality', desc: 'We stock only authentic parts from certified manufacturers. Our expert team is always ready to help you find the perfect fit for your vehicle.' },
            ].map((f, i, arr) => (
              <div key={f.title}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-8 !w-10 items-center justify-center rounded-full bg-accent/25 text-brand ring-1 ring-black/5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6l-11 11-5-5"/></svg>
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">{f.title}</p>
                    <p className="mt-1 text-[14px] leading-6 text-gray-600">{f.desc}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <div className="my-4 h-px bg-black/10" />}
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden max-h-[450px] rounded-2xl ring-1 ring-black/10">
          <img src={carShop} alt="Courier delivering parts" className="h-full w-full object-cover" />
        </div>
      </section>

      {/* Partners */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <h3 className="text-[16px] font-semibold text-gray-900">Our Partners</h3>
        {loading ? (
          <FallbackLoader label="Loading partners…" />
        ) : (
          <div className="mt-3 flex items-center gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
            {partners.slice(0, 12).map((p, i) => {
              const name = String((p as any)?.name || (p as any)?.title || 'Partner')
              const logo = partnerImageFrom(p) || imgOf(p)
              return (
                <div key={`partner-logo-${String((p as any)?.id ?? i)}-${i}`} className="shrink-0">
                  {logo ? <img src={normalizeApiImage(logo) || logoImg} alt={name} className="h-10 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} /> : <span className="text-[13px] font-medium">{name}</span>}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
