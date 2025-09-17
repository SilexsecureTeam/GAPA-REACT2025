import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/gapa-logo.png';
import icon1 from '../assets/h1.png'
import gapafix from '../assets/gapa-fix.svg'
import cartImg from '../assets/cart.svg'

// Removed unused icons h2-h7
import { useAuth } from '../services/auth'
import { getAllCategories, type ApiCategory, getAllBrands, type ApiBrand, getSubCategories, getSubSubCategories, getUserCartTotal } from '../services/api'
import { categoryImageFrom, normalizeApiImage, pickImage, brandImageFrom, subCategoryImageFrom, subSubCategoryImageFrom } from '../services/images'
import { getGuestCart } from '../services/cart'

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
  // Removed live search UI state: searching, suggestions, showSuggest
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Mega menu state for Category drill-down (formerly Car Parts)
  const [carPartsOpen, setCarPartsOpen] = useState(false)
  const [catMenuLoading, setCatMenuLoading] = useState(false)
  const [catMenu, setCatMenu] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [activeCatIdx, setActiveCatIdx] = useState(0)
  const [subCats, setSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subCatsLoading, setSubCatsLoading] = useState(false)
  const [activeSubCat, setActiveSubCat] = useState<{ id: string; name: string } | null>(null)
  const [subSubCats, setSubSubCats] = useState<Array<{ id: string; name: string; image: string }>>([])
  const [subSubCatsLoading, setSubSubCatsLoading] = useState(false)

  // Dropdown state for Car Brands
  const [brandsOpen, setBrandsOpen] = useState(false)
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [brandsMenu, setBrandsMenu] = useState<Array<{ id: string; name: string; image: string }>>([])

  // Cart count state (online + guest)
  const [cartCount, setCartCount] = useState<number>(0)

  // Hover-delay timer for category dropdown (2 seconds)
  const hoverTimerRef = useRef<number | null>(null)
  const clearHoverTimer = () => { if (hoverTimerRef.current) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null } }
  const openCategoryWithDelay = (idx: number, catId: string | number) => {
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(async () => {
      setBrandsOpen(false)
      setCarPartsOpen(true)
      setActiveCatIdx(idx)
      await fetchSubCats(catId)
    }, 2000)
  }

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

  // Removed static categories; we now render Car Brands + dynamic API categories

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    // Navigate to CarParts with the query param; actual search happens on that page
    setCarPartsOpen(false)
    setBrandsOpen(false)
    navigate(`/parts?q=${encodeURIComponent(term)}`)
  }

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const pad2 = (n: number) => n.toString().padStart(2, '0')

  // Helpers to derive category and images from products (mirrors CarParts.tsx)
  // Removed unused categoryOf helper

  async function ensureCatMenuLoaded() {
    if (catMenu.length || catMenuLoading) return
    try {
      setCatMenuLoading(true)
      const cats = await getAllCategories()
      const arr = Array.isArray(cats) ? (cats as ApiCategory[]) : []
      const list = arr.map((c, i) => ({
        id: String((c as any)?.id ?? (c as any)?.category_id ?? i),
        name: capitalizeTitle(String((c as any)?.title || (c as any)?.name || 'Category')),
        image: categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || '/gapa-logo.png'
      }))
      // Keep API order (no sorting)
      setCatMenu(list)
      setActiveCatIdx(0)
      if (list.length) void fetchSubCats(list[0].id)
    } catch (_) {
      // ignore
    } finally {
      setCatMenuLoading(false)
    }
  }

  async function fetchSubCats(catId: string | number) {
    try {
      setSubCatsLoading(true)
      setActiveSubCat(null)
      setSubSubCats([])
      const res = await getSubCategories(catId)
      const arr = Array.isArray(res) ? res : []
      const mapped = arr.map((sc: any, i: number) => ({
        id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
        name: String(sc?.sub_title || sc?.title || sc?.name || 'Sub Category'),
        image: subCategoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || '/gapa-logo.png'
      }))
      setSubCats(mapped)
    } catch (_) {
      setSubCats([])
    } finally {
      setSubCatsLoading(false)
    }
  }

  async function fetchSubSubCats(subCatId: string | number) {
    try {
      setSubSubCatsLoading(true)
      const res = await getSubSubCategories(subCatId)
      const arr = Array.isArray(res) ? res : []
      const mapped = arr.map((ssc: any, i: number) => ({
        id: String(ssc?.sub_sub_cat_id ?? ssc?.id ?? ssc?.sub_sub_category_id ?? ssc?.subsubcatID ?? i),
        name: String(ssc?.sub_sub_title || ssc?.title || ssc?.name || 'Type'),
        image: subSubCategoryImageFrom(ssc) || normalizeApiImage(pickImage(ssc) || '') || '/gapa-logo.png'
      }))
      setSubSubCats(mapped)
    } catch (_) {
      setSubSubCats([])
    } finally {
      setSubSubCatsLoading(false)
    }
  }

  // Load brands menu when needed
  async function ensureBrandsMenuLoaded() {
    if (brandsMenu.length || brandsLoading) return
    try {
      setBrandsLoading(true)
      const res = await getAllBrands()
      const arr = Array.isArray(res) ? (res as ApiBrand[]) : []
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

  // Load and update cart count
  useEffect(() => {
    let cancelled = false
    async function refreshCartCount() {
      try {
        if (user && user.id) {
          const res = await getUserCartTotal()
          // API may return { total_cart: number } or { total: number } or raw number
          let total = 0
          if (typeof res === 'number') total = res
          else if (res && typeof res === 'object') {
            const anyRes: any = res
            total = Number(anyRes.total_cart ?? anyRes.total ?? anyRes.count ?? 0)
          }
          if (!cancelled) setCartCount(Number.isFinite(total) ? total : 0)
        } else {
          const guest = getGuestCart()
          const total = guest.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
          if (!cancelled) setCartCount(total)
        }
      } catch {
        if (!cancelled) setCartCount(0)
      }
    }

    refreshCartCount()

    // Also listen for changes in localStorage for guest cart updates
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'guestCart') refreshCartCount()
    }
    window.addEventListener('storage', onStorage)
    return () => { cancelled = true; window.removeEventListener('storage', onStorage) }
  }, [user])

  useEffect(() => {
    ensureCatMenuLoaded()
  }, [])

  useEffect(() => {
    if (!brandsOpen) return
    setTimeout(() => {
      const el = document.getElementById('brands-menu')
      el?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 50)
  }, [brandsOpen])

  // Close menus on route change using location instead of navigate.listen
  useEffect(() => {
    // Close menus when the pathname or hash changes
    clearHoverTimer()
    setCarPartsOpen(false)
    setBrandsOpen(false)
  }, [location.pathname, location.hash])

  // Close all menus helper
  const closeMenus = () => { clearHoverTimer(); setCarPartsOpen(false); setBrandsOpen(false) }

  // Helper: capitalize first letter and lower-case rest
  const capitalizeTitle = (s: string) => {
    const lower = (s || '').toLowerCase()
    return lower ? lower.charAt(0).toUpperCase() + lower.slice(1) : s
  }

  return (
    <header className="fixed w-full top-0 z-50 shadow-sm" onKeyDown={(e) => { if (e.key === 'Escape') { closeMenus() } }}>
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
          <form onSubmit={onSearch} className="w-full relative">
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
              <img src={gapafix} alt="" />
              <span className="font-medium">Gapa Fix</span>
              <span className="mx-2 inline-block h-5 w-px bg-black/20" aria-hidden />
            </a>

            {/* Cart */}
            <Link to={{ pathname: location.pathname, search: location.search, hash: '#cart' }} replace className="hidden md:inline-flex items-center gap-2 text-[14px] text-gray-900 relative">
              <img src={cartImg} alt="" />
              <span className="font-medium">My Cart</span>
              {cartCount > 0 && (
                <span aria-label={`Cart item count: ${cartCount}`} className="absolute -right-3 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>

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
                {/* <Link to="/signup" className="text:[14px] font-medium text-white hover:underline">Create account</Link> */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category bar with dropdowns */}
      <nav className="relative bg-brand overflow-visible text-white" onMouseLeave={() => { clearHoverTimer(); setCarPartsOpen(false); setBrandsOpen(false) }}>
        <div
          className="mx-auto flex h-11 sm:h-12 max-w-7xl items-center justify-between gap-4 overflow-x-auto px-2 sm:px-4"
        >
          {/* Car Brands first */}
          <div className="relative">
            <button
              onMouseEnter={async () => { clearHoverTimer(); setBrandsOpen(true); setCarPartsOpen(false); await ensureBrandsMenuLoaded() }}
              onFocus={async () => { clearHoverTimer(); setBrandsOpen(true); setCarPartsOpen(false); await ensureBrandsMenuLoaded() }}
              onClick={async (e) => { e.preventDefault(); clearHoverTimer(); const willOpen = !brandsOpen; setBrandsOpen(willOpen); setCarPartsOpen(false); if (willOpen) await ensureBrandsMenuLoaded() }}
              className={`group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${
                brandsOpen ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              aria-haspopup
              aria-expanded={brandsOpen}
            >
              <img src={icon1} alt="" className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>Car Brands</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          </div>

          {/* Dynamic categories from API */}
          {catMenu.map((c, idx) => {
            const nameLower = c.name.toLowerCase()
            const isBrakes = /brakes?/.test(nameLower)
            const isTyres = /tyres?|tires?/.test(nameLower)
            const isActive = carPartsOpen && activeCatIdx === idx
            return (
              <div key={c.id} className="relative">
                <button
                  onMouseEnter={() => { openCategoryWithDelay(idx, c.id) }}
                  onFocus={() => { openCategoryWithDelay(idx, c.id) }}
                  onClick={(e) => {
                    e.preventDefault()
                    clearHoverTimer()
                    setBrandsOpen(false)
                    // Brakes and Tyres keep special routes; others use drilldown
                    if (isBrakes) navigate('/brakes')
                    else if (isTyres) navigate('/tyres')
                    else navigate(`/parts?catId=${encodeURIComponent(c.id)}`)
                    setCarPartsOpen(false)
                  }}
                  className={`group capitalized inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${
                    isActive ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                  aria-haspopup
                  aria-expanded={isActive}
                >
                  <span className='capitalized'>{c.name}</span>
                </button>
              </div>
            )
          })}
        </div>

        {/* Mega dropdown for Category drill-down */}
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
                        <li key={c.id}>
                          <button
                            onMouseEnter={() => { setActiveCatIdx(idx); fetchSubCats(c.id) }}
                            onFocus={() => { setActiveCatIdx(idx); fetchSubCats(c.id) }}
                            onClick={() => { setActiveCatIdx(idx); fetchSubCats(c.id); navigate(`/parts?catId=${encodeURIComponent(c.id)}`); setCarPartsOpen(false) }}
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

                {/* Right: sub categories and sub-sub categories */}
                <section className="p-3 md:p-5">
                  {subCatsLoading ? (
                    <div className="p-4 text-sm text-gray-600">Loading sub categories…</div>
                  ) : subCats.length === 0 ? (
                    <div className="p-4 text-sm text-gray-600">Select a category to see sub categories.</div>
                  ) : (
                    <div className="flex h-full flex-col gap-4">
                      <div className="min-h-0 overflow-y-auto">
                        <h4 className="mb-2 text-[14px] font-semibold text-gray-900">Sub Categories</h4>
                        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {subCats.map((sc) => {
                            const activeCatId = catMenu[activeCatIdx]?.id
                            return (
                              <li key={sc.id}>
                                <button
                                  onClick={() => { setActiveSubCat({ id: sc.id, name: sc.name }); fetchSubSubCats(sc.id); if (activeCatId) navigate(`/parts?catId=${encodeURIComponent(activeCatId)}&subCatId=${encodeURIComponent(sc.id)}`) }}
                                  className="group flex items-center gap-3 rounded-md p-2 ring-1 ring-black/5 hover:bg-gray-50 w-full text-left"
                                >
                                  <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                                    <img src={sc.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                                  </span>
                                  <span className="text-[14px] text-brand group-hover:underline truncate">{sc.name}</span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </div>

                      {activeSubCat && (
                        <div className="min-h-0 overflow-y-auto">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-[14px] font-semibold text-gray-900">{activeSubCat.name} – Types</h4>
                            <button onClick={() => { setActiveSubCat(null); setSubSubCats([]) }} className="text-[12px] text-brand underline">Back</button>
                          </div>
                          {subSubCatsLoading ? (
                            <div className="p-2 text-sm text-gray-600">Loading types…</div>
                          ) : subSubCats.length === 0 ? (
                            <div className="p-2 text-sm text-gray-600">No types found.</div>
                          ) : (
                            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {subSubCats.map((ssc) => {
                                const activeCatId = catMenu[activeCatIdx]?.id
                                const subId = activeSubCat?.id
                                const href = activeCatId && subId
                                  ? `/parts?catId=${encodeURIComponent(activeCatId)}&subCatId=${encodeURIComponent(subId)}&subSubCatId=${encodeURIComponent(ssc.id)}`
                                  : '/parts'
                                return (
                                  <li key={ssc.id}>
                                    <Link
                                      to={href}
                                      className="group flex items-center gap-3 rounded-md p-2 ring-1 ring-black/5 hover:bg-gray-50"
                                      onClick={() => setCarPartsOpen(false)}
                                    >
                                      <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                                        <img src={ssc.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                                      </span>
                                      <span className="text-[14px] text-brand group-hover:underline truncate">{ssc.name}</span>
                                    </Link>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </div>
                      )}
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
                <div className="p-4" id="brands-menu">
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
