import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/gapa-logo.png';
import icon1 from '../assets/h1.png'
import icon2 from '../assets/h2.png'
import icon3 from '../assets/h3.png'
import icon4 from '../assets/h4.png'
import icon5 from '../assets/h5.png'
import icon6 from '../assets/h6.png'
import icon7 from '../assets/h7.png'
import { useAuth } from '../services/auth'
import { getAllCategories, getAllProducts, type ApiCategory, type ApiProduct, getAllBrands, type ApiBrand } from '../services/api'
import { categoryImageFrom, normalizeApiImage, pickImage, productImageFrom, brandImageFrom } from '../services/images'

type Category = {
  label: string;
  caret?: boolean;
  items?: string[];
  icon?: string;
};

export default function Header() {
  // Live timer to Sept 1, 12am displayed as HH:MM:SS (no labels)
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date()
    const target = new Date(now.getFullYear(), 8, 1, 0, 0, 0, 0)
    const diff = Math.max(0, target.getTime() - now.getTime())
    const h = Math.floor(diff / (60 * 60 * 1000))
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
    const s = Math.floor((diff % (60 * 1000)) / 1000)
    return { h, m, s }
  })
  const [query, setQuery] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  // Mega menu state for Car Parts
  const [carPartsOpen, setCarPartsOpen] = useState(false)
  const [catMenuLoading, setCatMenuLoading] = useState(false)
  const [catMenu, setCatMenu] = useState<Array<{ name: string; image: string; items: { id: string; title: string; image: string }[] }>>([])
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const [apiCategories, setApiCategories] = useState<ApiCategory[]>([])

  // Dropdown state for Car Brands
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [brandsMenu, setBrandsMenu] = useState<Array<{ id: string; name: string; image: string }>>([])

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      const target = new Date(now.getFullYear(), 8, 1, 0, 0, 0, 0)
      const diff = Math.max(0, target.getTime() - now.getTime())
      const h = Math.floor(diff / (60 * 60 * 1000))
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
      const s = Math.floor((diff % (60 * 1000)) / 1000)
      setTimeLeft({ h, m, s })
      if (diff === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const categories: Category[] = [
    { label: 'Car Brands', caret: true, icon: icon1, items: ['Toyota', 'Honda', 'BMW', 'Mercedes', 'Kia', 'Hyundai'] },
    { label: 'Car Parts', caret: true, icon: icon2, items: ['Brake Pad Set', 'Brake Discs', 'Suspension', 'Brakes', 'Electrical', 'Body', 'Cooling'] },
    { label: 'Tyres', icon: icon3 },
    { label: 'Car Accessories', icon: icon4 },
    { label: 'Engine Oil', icon: icon5 },
    { label: 'Tools', icon: icon6 },
    { label: 'Brakes', icon: icon7 },
  ]

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    // TODO: integrate real search routing. For now, log and show a basic feedback.
    console.log('Searching for:', query)
    alert(`Searching for: ${query}`)
  }

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const pad2 = (n: number) => n.toString().padStart(2, '0')

  // Helpers to derive category and images from products (mirrors CarParts.tsx)
  function categoryOf(p: any): string {
    const c = (p as any)?.category
    if (typeof c === 'string') return c
    return String(c?.name || c?.title || (p as any)?.category_name || 'General')
  }
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
      catObj = (apiCategories as any[]).find((x: any) => String(x?.id ?? x?.category_id ?? '') === catId)
    }
    if (!catObj && name) {
      const nLower = name.toLowerCase()
      catObj = (apiCategories as any[]).find((x: any) => String(x?.name || x?.title || '').toLowerCase() === nLower)
    }
    let img: string | undefined
    if (catObj) {
      img = categoryImageFrom(catObj) || normalizeApiImage(pickImage(catObj) || '')
    }
    if (!img && c && typeof c === 'object') {
      img = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '')
    }
    const displayName = catObj ? String(catObj?.title || catObj?.name || name || 'Category') : (name || 'Category')
    return { name: displayName, image: img || '/gapa-logo.png' }
  }

  async function ensureCatMenuLoaded() {
    if (catMenu.length || catMenuLoading) return
    try {
      setCatMenuLoading(true)
      const [prods, cats] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
      ])
      setApiCategories(Array.isArray(cats) ? cats : [])

      const grouped = new Map<string, ApiProduct[]>();
      for (const p of (prods || [])) {
        const key = categoryOf(p)
        const list = grouped.get(key) || []
        list.push(p)
        grouped.set(key, list)
      }

      const menu = Array.from(grouped.entries()).map(([name, list]) => {
        const sample = list[0]
        const info = catInfoFor(sample as any)
        return {
          name: info.name || name,
          image: info.image,
          items: list.slice(0, 12).map((p: ApiProduct, i: number) => ({
            id: String((p as any)?.id ?? (p as any)?.product_id ?? i),
            title: String((p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Car Part'),
            image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || '/gapa-logo.png',
          }))
        }
      }).sort((a, b) => a.name.localeCompare(b.name))

      setCatMenu(menu)
      setActiveCatIdx(0)
    } catch (_) {
      // Soft-fail: keep menu empty
    } finally {
      setCatMenuLoading(false)
    }
  }

  async function ensureBrandsMenuLoaded() {
    if (brandsMenu.length || brandsLoading) return
    try {
      setBrandsLoading(true)
      const res = await getAllBrands()
      const arr = Array.isArray(res) ? res as ApiBrand[] : []
      const menu = (arr || []).map((b, i) => {
        const id = String((b as any)?.id ?? i)
        const name = String((b as any)?.name || (b as any)?.title || 'Brand')
        const img = brandImageFrom(b) || normalizeApiImage(pickImage(b) || '') || '/gapa-logo.png'
        return { id, name, image: img }
      }).sort((a, b) => a.name.localeCompare(b.name))
      setBrandsMenu(menu)
    } catch (_) {
      // ignore
    } finally {
      setBrandsLoading(false)
    }
  }

  // Close all menus helper
  const closeMenus = () => { setOpenIdx(null); setCarPartsOpen(false); setBrandsOpen(false) }

  return (
    <header className="fixed w-full top-0 z-50 shadow-sm" onKeyDown={(e) => { if (e.key === 'Escape') closeMenus() }}>
      {/* Top promo strip */}
      <div className="bg-brand text-white py-1">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div />
          <p className="text-[14px] font-normal tracking-wide hidden sm:block">
            Free Delivery on Orders Over ₦50,000 – Limited Time!
          </p>
          <div className="flex items-center gap-3 sm:flex" aria-live="polite">
            <span className="hidden sm:inline text-[12px] font-semibold tracking-wider text-white/90">OFFER ENDS IN:</span>
            <div className="flex items-center gap-1.5">
              {/* HH:MM:SS boxes with colons like before */}
              {[pad2(timeLeft.h), pad2(timeLeft.m), pad2(timeLeft.s)].map((v, i, arr) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg:white/10 bg-white/10 px-1.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/15">
                    {v}
                  </span>
                  {i < arr.length - 1 && (
                    <span className="text-white/80">:</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main bar: logo + search + actions */}
      <div className="bg-[#F7CD3A] py-2">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-3 px-4 py-3 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 brand-logo" aria-label="Gapa Naija home">
            <img
              src={logo}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }}
              alt="Gapa Naija"
              className="h-7 w-auto md:h-9"
            />
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} className="w-full">
            <div className="relative flex h-10 sm:h-11 w-full md:w-[80%] md:ml-20 overflow-hidden rounded-md bg-white ring-1 ring-black/10 focus-within:ring-black/20">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                {/* Magnifier icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Enter the part number or name"
                className="h-full w-full pl-10 pr-28 text-[14px] outline-none placeholder:text-gray-400"
                aria-label="Search parts"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 rounded-md h-full px-4 sm:px-5 text-[13px] font-semibold text-white transition-colors bg-brand hover:brightness-110"
              >
                Search
              </button>
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 sm:gap-4">
            {/* Gapa Fix */}
            <a href="#" className="hidden md:inline-flex items-center gap-2 text-[14px] text-gray-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <path d="M14.7 6.3a2 2 0 0 1 2.8 2.8L10 16.6 7 17l.4-3 7.3-7.7z" />
                <path d="M16 7l1 1" />
              </svg>
              <span className="font-medium">Gapa Fix</span>
              <span className="mx-2 inline-block h-5 w-px bg-black/20" aria-hidden />
            </a>

            {/* Cart */}
            <a href="#cart" className="hidden md:inline-flex items-center gap-2 text-[14px] text-gray-900">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <circle cx="9" cy="21" r="1" />
                <circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              <span className="font-medium">My Cart</span>
            </a>

            {/* Auth */}
            {user ? (
              <Link to="/profile" className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-white/90">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="truncate max-w-[120px]">{user.name || user.email}</span>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-white/90"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>Sign In</span>
                </Link>
                <Link to="/signup" className="text-[14px] font-medium text-white hover:underline">Create account</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category bar with dropdowns */}
      <nav className="relative bg-brand overflow-visible text-white" onMouseLeave={() => { setOpenIdx(null); setCarPartsOpen(false); setBrandsOpen(false) }}>
        <div
          className="mx-auto flex h-11 sm:h-12 max-w-7xl items-center justify-between gap-4 overflow-x-auto px-2 sm:px-4"
        >
          {categories.map((cat, i) => {
            const isCarParts = cat.label === 'Car Parts'
            const isCarBrands = cat.label === 'Car Brands'
            return (
              <div key={cat.label} className="relative">
                <button
                  onMouseEnter={() => { if (!isCarParts && !isCarBrands) setOpenIdx(cat.items ? i : null) }}
                  onFocus={() => { if (!isCarParts && !isCarBrands) setOpenIdx(cat.items ? i : null) }}
                  onClick={async (e) => {
                    if (isCarParts) {
                      e.preventDefault()
                      const willOpen = !carPartsOpen
                      setCarPartsOpen(willOpen)
                      setBrandsOpen(false)
                      setOpenIdx(null)
                      if (willOpen) await ensureCatMenuLoaded()
                    } else if (isCarBrands) {
                      e.preventDefault()
                      const willOpen = !brandsOpen
                      setBrandsOpen(willOpen)
                      setCarPartsOpen(false)
                      setOpenIdx(null)
                      if (willOpen) await ensureBrandsMenuLoaded()
                    } else {
                      setCarPartsOpen(false)
                      setBrandsOpen(false)
                      setOpenIdx(null)
                      // Navigate to mapped routes for non-car-parts/brands
                      if (cat.label === 'Tyres') navigate('/tyres')
                      else if (cat.label === 'Engine Oil') navigate('/engine-oil')
                      else navigate('/parts')
                    }
                  }}
                  className={`group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${
                    (isCarParts && carPartsOpen) || (isCarBrands && brandsOpen) || (!isCarParts && !isCarBrands && openIdx===i) ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                  aria-haspopup={!!cat.items}
                  aria-expanded={isCarParts ? carPartsOpen : (isCarBrands ? brandsOpen : openIdx === i)}
                >
                  {cat.icon && (
                    <img src={cat.icon} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  <span>{cat.label}</span>
                  {cat.caret && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  )}
                </button>

                {/* Simple dropdown for non-Car Parts/Brands */}
                {!isCarParts && !isCarBrands && openIdx === i && cat.items && (
                  <div className="absolute left-0 top-full z-40 mt-2 w-screen max-w-md rounded-xl bg-white p-3 text-gray-900 shadow-lg ring-1 ring-black/10 sm:max-w-lg md:max-w-xl">
                    <div role="menu" aria-label={`${cat.label} menu`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {cat.items.map((item) => {
                        const to = i === 0
                          ? `/parts/${toSlug(item)}/brake-discs`
                          : `/parts/${toSlug(item)}`
                        return (
                          <Link
                            key={item}
                            role="menuitem"
                            to={to}
                            className="block rounded-md px-3 py-2 text-sm text-gray-800 hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            onClick={() => setOpenIdx(null)}
                          >
                            {item}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Mega dropdown for Car Parts */}
        {carPartsOpen && (
          <div className="absolute inset-x-0 top-full z-40">
            <div className="mx-auto max-w-7xl px-2 sm:px-4">
              <div className="mt-2 grid max-h-[70vh] grid-cols-1 overflow-hidden rounded-xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/10 md:grid-cols-[280px_1fr]">
                {/* Left: category list */}
                <aside className="border-b border-gray-100 p-2 md:border-b-0 md:border-r md:p-3">
                  {catMenuLoading ? (
                    <div className="p-4 text-sm text-gray-600">Loading categories…</div>
                  ) : catMenu.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">No categories available.</div>
                  ) : (
                    <ul className="max-h-[60vh] overflow-y-auto">
                      {catMenu.map((c, idx) => (
                        <li key={c.name}>
                          <button
                            onMouseEnter={() => setActiveCatIdx(idx)}
                            onFocus={() => setActiveCatIdx(idx)}
                            onClick={() => { setActiveCatIdx(idx); /* Keep open */ }}
                            className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[14px] hover:bg-gray-50 ${activeCatIdx===idx ? 'bg-gray-50 text-brand' : 'text-gray-800'}`}
                            aria-current={activeCatIdx===idx}
                          >
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                              <img src={c.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                            </span>
                            <span className="truncate">{c.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </aside>

                {/* Right: items for active category */}
                <section className="p-3 md:p-5">
                  {catMenuLoading ? (
                    <div className="p-4 text-sm text-gray-600">Preparing items…</div>
                  ) : catMenu.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">Select a category to see items.</div>
                  ) : (
                    <div className="flex h-full flex-col">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                            <img src={catMenu[activeCatIdx]?.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                          </div>
                          <h3 className="text-[16px] font-semibold text-gray-900">{catMenu[activeCatIdx]?.name}</h3>
                        </div>
                        <Link
                          to={`/parts#cat-${toSlug(catMenu[activeCatIdx]?.name || '')}`}
                          className="text-[13px] font-semibold text-brand hover:underline"
                          onClick={() => setCarPartsOpen(false)}
                        >
                          View all
                        </Link>
                      </div>

                      <div className="min-h-0 flex-1 overflow-y-auto">
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(catMenu[activeCatIdx]?.items || []).map((it, i) => (
                            <li key={`${it.id}-${i}`} className="">
                              <Link
                                to={`/product/${encodeURIComponent(it.id)}`}
                                className="group flex items-center gap-3 rounded-md p-2 ring-1 ring-black/5 hover:bg-gray-50"
                                onClick={() => setCarPartsOpen(false)}
                              >
                                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                                  <img src={it.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                                </span>
                                <span className="text-[14px] text-brand group-hover:underline truncate">{it.title}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown for Car Brands: grid of logos */}
        {brandsOpen && (
          <div className="absolute inset-x-0 top-full z-40">
            <div className="mx-auto max-w-7xl px-2 sm:px-4">
              <div className="mt-2 overflow-hidden rounded-xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/10">
                <div className="p-4">
                  {brandsLoading ? (
                    <div className="p-2 text-sm text-gray-600">Loading brands…</div>
                  ) : brandsMenu.length === 0 ? (
                    <div className="p-2 text-sm text-gray-600">No brands available.</div>
                  ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                      {brandsMenu.map((b) => {
                        const brandSlug = toSlug(b.name)
                        const href = `/parts/${brandSlug}/brake-discs`
                        return (
                          <li key={b.id}>
                            <Link
                              to={href}
                              className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-black/5 hover:bg-gray-50"
                              onClick={() => setBrandsOpen(false)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                                <img src={b.image} alt={b.name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                              </span>
                              <span className="truncate text-[14px] text-gray-800">{b.name}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
