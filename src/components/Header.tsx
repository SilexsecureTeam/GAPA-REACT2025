import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useCurrency } from '../context/CurrencyContext'
import logo from '../assets/gapa-logo.png';
import icon1 from '../assets/h1.png'
import gapafix from '../assets/gapa-fix.svg'
import cartImg from '../assets/cart.svg'

// Removed unused icons h2-h7
import { useAuth } from '../services/auth'
import { getAllCategories, type ApiCategory, getAllBrands, type ApiBrand, getSubCategories, getSubSubCategories, getCartForUser, logout as apiLogout, getAllProducts } from '../services/api'
// added getCartForUser import
import { categoryImageFrom, normalizeApiImage, pickImage, brandImageFrom, subCategoryImageFrom, subSubCategoryImageFrom } from '../services/images'
import { getGuestCart } from '../services/cart'

export default function Header() {
  // Live timer to Dec 1, 12am displayed as HH:MM:SS (no labels)
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date()
    const target = new Date(now.getFullYear(), 11, 1, 0, 0, 0, 0)
    const diff = Math.max(0, target.getTime() - now.getTime())
    const h = Math.floor(diff / (60 * 60 * 1000))
    const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
    const s = Math.floor((diff % (60 * 1000)) / 1000)
    return { h, m, s }
  })
  const [query, setQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [productNames, setProductNames] = useState<string[]>([]) // Dynamic names from catalog

  const searchRef = useRef<HTMLDivElement>(null)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const { user, logout: authLogout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { formatPrice } = useCurrency()

  const { currency, setCurrencyByCountry, availableCurrencies } = useCurrency()
  const [currencyOpen, setCurrencyOpen] = useState(false)
  const currencyRef = useRef<HTMLDivElement>(null)

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
  const [brandsMenu, setBrandsMenu] = useState<Array<{ id: string; name: string; image: string; car_id: string }>>([])

  // Cart count state (now uses API for authenticated users)
  const [cartCount, setCartCount] = useState<number>(0)

  // NEW: Mobile responsive UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [mobileBrandsOpen, setMobileBrandsOpen] = useState(false)
  const [mobileCatsOpen, setMobileCatsOpen] = useState(true)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when overlays open
  useEffect(() => {
    if (mobileMenuOpen || mobileSearchOpen) {
      document.documentElement.style.overflow = 'hidden'
    } else {
      document.documentElement.style.overflow = ''
    }
  }, [mobileMenuOpen, mobileSearchOpen])

  const closeAllMobile = () => {
    setMobileMenuOpen(false)
    setMobileSearchOpen(false)
    setMobileBrandsOpen(false)
  }
  // Close mobile panels on route change
  useEffect(() => { closeAllMobile() }, [location.pathname, location.hash])

  // Load product names for search suggestions on mount
  useEffect(() => {
    let alive = true
    ;(async () => {
      // ... inside the useEffect ...
try {
  const prods = await getAllProducts()
  if (!alive) return
  
  const list = Array.isArray(prods) ? prods : (prods as any)?.data || []
  
  // CHANGE STARTS HERE
  const seenLower = new Set<string>() // To track lowercase versions
  const finalNames: string[] = []     // To store the display names

  list.forEach((p: any) => {
     const raw = p?.part || p
     const name = raw?.part_name || raw?.name || raw?.title || raw?.product_name
     
     if (name && typeof name === 'string' && name.trim().length > 2) {
        const originalName = name.trim()
        const lowerName = originalName.toLowerCase()

        // Only add if we haven't seen this name (case-insensitive) yet
        if (!seenLower.has(lowerName)) {
           seenLower.add(lowerName)
           finalNames.push(originalName) // Keep the original casing for display
        }
     }
  })
  
  setProductNames(finalNames)
  // CHANGE ENDS HERE

} catch (e) {

        console.error('Failed to load search suggestions', e)
      }
    })()
    return () => { alive = false }
  }, [])

  // Hover-delay timer for category dropdown (1 seconds)
  const hoverTimerRef = useRef<number | null>(null)
  const clearHoverTimer = () => { if (hoverTimerRef.current) { window.clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null } }
  const openCategoryWithDelay = (idx: number, catId: string | number) => {
    clearHoverTimer()
    hoverTimerRef.current = window.setTimeout(async () => {
      setBrandsOpen(false)
      setCarPartsOpen(true)
      setActiveCatIdx(idx)
      await fetchSubCats(catId)
    }, 1000)
  }

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      const target = new Date(now.getFullYear(), 11, 1, 0, 0, 0, 0)
      const diff = Math.max(0, target.getTime() - now.getTime())
      const h = Math.floor(diff / (60 * 60 * 1000))
      const m = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
      const s = Math.floor((diff % (60 * 1000)) / 1000)
      setTimeLeft({ h, m, s })
      if (diff === 0) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Filter suggestions based on query
  useEffect(() => {
    const term = query.trim().toLowerCase()
    if (!term || term.length < 2) {
      setFilteredSuggestions([])
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
      return
    }

    // Use dynamic product names instead of hardcoded list
    const source = productNames.length > 0 ? productNames : []
    
    // Smart filtering: prioritize matches at start of string, then word boundaries
    const matches = source.filter(suggestion => {
      const lower = suggestion.toLowerCase()
      return lower.includes(term)
    }).sort((a, b) => {
      const aLower = a.toLowerCase()
      const bLower = b.toLowerCase()
      const aStarts = aLower.startsWith(term)
      const bStarts = bLower.startsWith(term)

      // Prioritize starts-with matches
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1

      // Then by word boundary matches
      const aWordMatch = new RegExp(`\\b${term}`, 'i').test(a)
      const bWordMatch = new RegExp(`\\b${term}`, 'i').test(b)
      if (aWordMatch && !bWordMatch) return -1
      if (!aWordMatch && bWordMatch) return 1

      // Finally alphabetically
      return a.localeCompare(b)
    }).slice(0, 8) // Limit to 8 suggestions

    setFilteredSuggestions(matches)
    setShowSuggestions(matches.length > 0)
    setActiveSuggestionIndex(-1)
  }, [query, productNames])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target as Node) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
      }
      // Close profile dropdown when clicking outside
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = query.trim()
    if (!term) return
    // Navigate to CarParts with the query param; actual search happens on that page
    setCarPartsOpen(false)
    setBrandsOpen(false)
    setShowSuggestions(false)
    navigate(`/parts?q=${encodeURIComponent(term)}`)
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
    navigate(`/parts?q=${encodeURIComponent(suggestion)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveSuggestionIndex(prev =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        if (activeSuggestionIndex >= 0) {
          e.preventDefault()
          handleSuggestionClick(filteredSuggestions[activeSuggestionIndex])
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setActiveSuggestionIndex(-1)
        break
    }
  }

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
        const car_id = String((b as any)?.car_id || (b as any)?.id || i)
        const name = String((b as any)?.name || (b as any)?.title || 'Brand')
        const img = brandImageFrom(b) || normalizeApiImage(pickImage(b) || '') || '/gapa-logo.png'
        return { id, name, image: img, car_id }
      }).sort((a, b) => a.name.localeCompare(b.name))
      setBrandsMenu(menu)
    } catch (_) {
      // ignore
    } finally {
      setBrandsLoading(false)
    }
  }

  // Load and update cart count (API for logged-in, local for guest)
  useEffect(() => {
    let cancelled = false
    async function recompute() {
      try {
        if (user && user.id) {
          const items = await getCartForUser(user.id)
          const count = Array.isArray(items) ? items.length : 0
          if (!cancelled) setCartCount(count)
        } else {
          const guest = getGuestCart()
          const total = guest.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
          if (!cancelled) setCartCount(total)
        }
      } catch {
        if (!cancelled) setCartCount(0)
      }
    }
    recompute()

    const onStorage = (e: StorageEvent) => { if (e.key === 'guestCart') recompute() }
    const onCustom = () => recompute()
    window.addEventListener('storage', onStorage)
    window.addEventListener('cart-updated', onCustom as any)
    return () => { cancelled = true; window.removeEventListener('storage', onStorage); window.removeEventListener('cart-updated', onCustom as any) }
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

  const handleSignOut = async () => {
    setProfileDropdownOpen(false)
    // Clear client session first so other components stop using the token/user immediately
    try { await authLogout() } catch (e) { /* ignore */ }
    // Notify server of logout (best-effort)
    try { await apiLogout() } catch (e) { /* ignore */ }
    navigate('/login')
  }

  const amount = 500000;

  return (
    <header className="fixed w-full top-0 z-50 shadow-sm" onKeyDown={(e) => { if (e.key === 'Escape') { closeMenus(); closeAllMobile() } }}>
      {/* Mobile backdrop */}
      {(mobileMenuOpen || mobileSearchOpen) && (
        <div onClick={closeAllMobile} className="md:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" />
      )}
      {/* Top promo strip */}
      <div className="bg-brand text-white py-1">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6">
          
          

          {/* Center Text */}
          <p className="text-[14px] font-normal tracking-wide hidden md:block">
            Free Delivery on Orders Over {formatPrice(amount)} – Limited Time!
          </p>

          {/* Timer (Right Aligned) */}
          <div className="flex items-center gap-3" aria-live="polite">
            <span className="hidden lg:inline text-[12px] font-semibold tracking-wider text-white/90">OFFER ENDS IN:</span>
            <div className="flex items-center gap-1.5">
              {[pad2(timeLeft.h), pad2(timeLeft.m), pad2(timeLeft.s)].map((v, i, arr) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg:white/10 bg-white/10 px-1.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/15">
                    {v}
                  </span>
                  {i < arr.length - 1 && <span className="text-white/80">:</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main bar: logo + search + actions (mobile redesigned) */}
      <div className="bg-[#F7CD3A] py-5 relative">
        <div className="mx-auto grid max-w-7xl grid-cols-3 items-center gap-3 px-3 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          {/* Mobile: Hamburger */}
          <div className="flex items-center md:hidden">
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileMenuOpen(o => !o)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/70 ring-1 ring-black/10 text-gray-800 hover:bg-white"
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              )}
            </button>
          </div>
          {/* Logo (center on mobile) */}
          <Link to="/" className="flex items-center gap-2 justify-center md:justify-start" aria-label="Gapa Naija home">
            <img
              src={logo}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }}
              alt="Gapa Naija"
              className="h-8 w-auto md:h-10"
            />
          </Link>

          {/* Desktop Search */}
          <div ref={searchRef} className="hidden md:block w-[90%] mx-auto relative">
            <form onSubmit={onSearch} className="relative">
              <div className="relative flex h-10 sm:h-11 w-full overflow-hidden rounded-md bg-white ring-1 ring-black/10 focus-within:ring-black/20">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => query.trim().length >= 2 && filteredSuggestions.length > 0 && setShowSuggestions(true)}
                  type="text"
                  placeholder="Enter the part number or name"
                  className="h-full w-full pl-10 pr-28 text-[14px] outline-none placeholder:text-gray-400"
                  aria-label="Search parts"
                  autoComplete="off"
                />
                <button type="submit" className="absolute right-0 top-0 rounded-md h-full px-5 text-[13px] font-semibold text-white transition-colors bg-brand hover:brightness-110">Search</button>
              </div>
            </form>

            {/* Search Suggestions Dropdown */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg ring-1 ring-black/10 max-h-[400px] overflow-y-auto z-50">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${index === activeSuggestionIndex ? 'bg-gray-50' : ''
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <span className="text-gray-700">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions (desktop) */}
          <div className="hidden md:flex items-center justify-end gap-3 sm:gap-4">
            {/* Gapa Fix */}
            <a href="https://gapafix.com.ng/" rel='noreferrer' target='_blank' className="hidden md:inline-flex items-center gap-2 text-[14px] text-gray-900">
              <img src={gapafix} alt="" className='w-[22px]' />
              <span className="font-medium">Gapa Fix</span>
              <span className="mx-2 inline-block h-5 w-px bg-black/20" aria-hidden />
            </a>
            {/* Cart */}
            <Link to={{ pathname: location.pathname, search: location.search, hash: '#cart' }} replace className="hidden md:inline-flex items-center gap-2 text-[14px] text-gray-900 relative">
              <img src={cartImg} alt="" className='w-[22px]' />
              <span className="font-medium">My Cart</span>
              {cartCount > 0 && (
                <span aria-label={`Cart item count: ${cartCount}`} className="absolute -right-3 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-purple-600 px-1.5 text-[11px] font-bold text-white ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </Link>

            {/* Country Selector (Left Aligned) */}
          <div className="relative" ref={currencyRef}>
            <button
              onClick={() => setCurrencyOpen(!currencyOpen)}
              className="flex items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[12px] font-semibold text-white hover:bg-white/20 transition-colors"
            >
              <img src={currency.flag} alt={currency.countryCode} className="h-4 w-6 rounded-sm object-cover" />
              
              <span className="inline sm:hidden">{currency.code}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown */}
            {currencyOpen && (
              <div className="absolute left-0 top-full mt-2 max-h-[60vh] w-64 overflow-y-auto rounded-lg bg-white p-1 shadow-xl ring-1 ring-black/10 z-50">
                <div className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 mb-1">Select Region</div>
                {availableCurrencies.map((c) => (
                  <button
                    key={c.countryCode}
                    onClick={() => { setCurrencyByCountry(c.countryCode); setCurrencyOpen(false) }}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors ${
                      currency.countryCode === c.countryCode ? 'bg-brand/10 text-brand font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <img src={c.flag} alt="" className="h-4 w-6 rounded-sm shadow-sm object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{c.countryName}</div>
                      <div className="text-[10px] text-gray-500">{c.code} ({c.symbol})</div>
                    </div>
                    {currency.countryCode === c.countryCode && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

            {/* Auth - Desktop Dropdown */}
            {user ? (
              <div ref={profileDropdownRef} className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="inline-flex items-center gap-2 bg-white px-3 py-2 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 transition-all hover:shadow-md"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand to-yellow-500 text-white font-bold text-[13px] ring-2 ring-white shadow-sm">
                    {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[100px]">{user.name || user.email}</span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform ${profileDropdownOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 rounded-xl bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info Header */}
                    <div className="bg-gradient-to-br from-brand/10 to-yellow-50 p-4 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-yellow-500 text-white font-bold text-[16px] ring-2 ring-white shadow-md">
                          {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-bold text-gray-900 truncate">{user.name || 'Guest User'}</p>
                          <p className="text-[12px] text-gray-600 truncate">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-2">
                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span className="font-medium">My Profile</span>
                      </Link>

                      <Link
                        to="/order-history"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                          <line x1="12" y1="22.08" x2="12" y2="12" />
                        </svg>
                        <span className="font-medium">Order History</span>
                      </Link>

                      <Link
                        to="/wishlist"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                        </svg>
                        <span className="font-medium">My Wishlist</span>
                      </Link>

                      <Link
                        to="/account-settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 1v6m0 6v6m5.657-13.657l-4.243 4.243m-6.364 0L2.808 5.343M23 12h-6m-6 0H5m13.657 5.657l-4.243-4.243m-6.364 0l-4.242 4.243" />
                        </svg>
                        <span className="font-medium">Settings</span>
                      </Link>

                      {/* <Link
                        to="/help"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-[14px] text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span className="font-medium">Help & Support</span>
                      </Link> */}

                      <div className="my-2 border-t border-gray-100" />

                      <button
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-[14px] text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        <span className="font-semibold">Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-gray-50 hover:shadow-md transition-all"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  <span>Sign In</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile right actions */}
          <div className="flex md:hidden items-center justify-end gap-2">
            <button onClick={() => { setMobileSearchOpen(o => !o); if (!mobileSearchOpen) setTimeout(() => { const inp = document.getElementById('mobile-search-input') as HTMLInputElement | null; inp?.focus() }, 50) }} aria-label={mobileSearchOpen ? 'Close search' : 'Open search'} className="relative inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/70 ring-1 ring-black/10 text-gray-700 hover:bg-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
            <Link to={{ pathname: location.pathname, search: location.search, hash: '#cart' }} replace aria-label="Cart" className="relative inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/70 ring-1 ring-black/10 text-gray-700 hover:bg-white">
              <img src={cartImg} alt="Cart" className='w-[20px]' />
              {cartCount > 0 && (<span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-purple-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">{cartCount}</span>)}
            </Link>
            {user ? (
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Profile menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-yellow-500 text-white font-bold text-[14px] ring-2 ring-white shadow-md hover:shadow-lg transition-all"
              >
                {(user.name || user.email || 'U').charAt(0).toUpperCase()}
              </button>
            ) : (
              <Link to="/login" aria-label="Sign in" className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/70 ring-1 ring-black/10 text-gray-700 hover:bg-white">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile sliding search */}
        <div className={`md:hidden absolute left-0 right-0 z-40 origin-top transition-all duration-300 ${mobileSearchOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0 pointer-events-none'}`}>
          <div ref={mobileSearchRef} className="px-3 pb-3">
            <form onSubmit={(e) => { onSearch(e); setMobileSearchOpen(false) }} className="relative">
              <div className="relative flex h-11 w-full overflow-hidden rounded-lg bg-white ring-1 ring-black/10 focus-within:ring-black/20 shadow">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                </div>
                <input
                  id="mobile-search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => query.trim().length >= 2 && filteredSuggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Search parts"
                  className="h-full w-full pl-10 pr-24 text-[14px] outline-none"
                  autoComplete="off"
                />
                <div className="absolute right-0 top-0 flex h-full items-center gap-1 pr-1">
                  <button type="button" onClick={() => setMobileSearchOpen(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100" aria-label="Close search">
                    <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                  </button>
                  <button type="submit" className="h-8 px-3 rounded-md bg-brand text-[12px] font-semibold text-white hover:brightness-110">Go</button>
                </div>
              </div>
            </form>

            {/* Mobile Search Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="mt-2 bg-white rounded-lg shadow-lg ring-1 ring-black/10 max-h-[300px] overflow-y-auto">
                {filteredSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => { handleSuggestionClick(suggestion); setMobileSearchOpen(false) }}
                    onMouseEnter={() => setActiveSuggestionIndex(index)}
                    className={`w-full text-left px-4 py-2.5 text-[14px] hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${index === activeSuggestionIndex ? 'bg-gray-50' : ''
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <span className="text-gray-700">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category bar hidden on mobile */}
      <nav className="relative bg-brand overflow-visible text-white hidden md:block" onMouseLeave={() => { clearHoverTimer(); setCarPartsOpen(false); setBrandsOpen(false) }}>
        <div
          className="mx-auto flex h-11 sm:h-12 max-w-7xl items-center justify-between gap-4 overflow-x-auto px-2 sm:px-4"
        >
          {/* Car Brands first */}
          <div className="relative">
            <button
              onMouseEnter={async () => { clearHoverTimer(); setBrandsOpen(true); setCarPartsOpen(false); await ensureBrandsMenuLoaded() }}
              onFocus={async () => { clearHoverTimer(); setBrandsOpen(true); setCarPartsOpen(false); await ensureBrandsMenuLoaded() }}
              onClick={async (e) => { e.preventDefault(); clearHoverTimer(); const willOpen = !brandsOpen; setBrandsOpen(willOpen); setCarPartsOpen(false); if (willOpen) await ensureBrandsMenuLoaded() }}
              className={`group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${brandsOpen ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
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
                  className={`group capitalized inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] sm:text-[14px] font-medium ${isActive ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
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
                            className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-[14px] hover:bg-gray-50 ${activeCatIdx === idx ? 'bg-gray-50 text-brand' : 'text-gray-800'}`}
                            aria-current={activeCatIdx === idx}
                          >
                            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                              <img src={c.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }} />
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
                                    <img src={sc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }} />
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
                                        <img src={ssc.image} alt="" className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }} />
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
                        const href = `/parts?brandId=${encodeURIComponent(b.car_id)}`
                        return (
                          <li key={b.id}>
                            <Link
                              to={href}
                              className="flex items-center gap-3 rounded-lg p-2 ring-1 ring-black/5 hover:bg-gray-50"
                              onClick={() => setBrandsOpen(false)}
                            >
                              <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10">
                                <img src={b.image} alt={b.name} className="h-full w-full object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }} />
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

      {/* Mobile menu panel */}
      <div className={`md:hidden absolute left-0 right-0 top-full z-40 origin-top bg-white text-gray-900 shadow-2xl ring-1 ring-black/10 transition-all duration-300 ${mobileMenuOpen ? 'scale-y-100 opacity-100' : 'scale-y-95 opacity-0 pointer-events-none'} `} style={{ transformOrigin: 'top center' }}>
        <div className="max-h-[70vh] overflow-y-auto p-4 space-y-6">
          {/* Quick links */}
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Browse</h3>
            <button onClick={closeAllMobile} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100" aria-label="Close menu">
              <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Link to="/" onClick={closeAllMobile} className="rounded-lg bg-[#F6F5FA] p-3 text-center text-[12px] font-medium ring-1 ring-black/5 hover:bg-gray-100">Home</Link>
            <Link to="/parts" onClick={closeAllMobile} className="rounded-lg bg-[#F6F5FA] p-3 text-center text-[12px] font-medium ring-1 ring-black/5 hover:bg-gray-100">All Parts</Link>
            <a href="https://gapafix.com.ng/" target="_blank" rel="noreferrer" className="rounded-lg bg-[#F6F5FA] p-3 text-center text-[12px] font-medium ring-1 ring-black/5 hover:bg-gray-100">Gapa Fix</a>
            <Link to={{ pathname: location.pathname, search: location.search, hash: '#cart' }} replace onClick={closeAllMobile} className="rounded-lg bg-[#F6F5FA] p-3 text-center text-[12px] font-medium ring-1 ring-black/5 hover:bg-gray-100">Cart ({cartCount})</Link>
          </div>

          {/* Categories toggle */}
          <div>
            <button onClick={() => setMobileCatsOpen(o => !o)} className="flex w-full items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-[13px] font-semibold ring-1 ring-black/5">
              <span>Categories</span>
              <span className={`transition-transform ${mobileCatsOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {mobileCatsOpen && (
              <ul className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-100 rounded-md border border-gray-100">
                {catMenuLoading ? <li className="p-3 text-[12px] text-gray-500">Loading…</li> : catMenu.slice(0, 30).map((c) => (
                  <li key={c.id}>
                    <button onClick={() => { navigate(`/parts?catId=${encodeURIComponent(c.id)}`); closeAllMobile() }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-gray-50">
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10"><img src={c.image} alt="" className="h-full w-full object-contain" /></span>
                      <span className="truncate">{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Brands toggle */}
          <div>
            <button onClick={() => { setMobileBrandsOpen(o => !o); if (!brandsMenu.length) ensureBrandsMenuLoaded() }} className="flex w-full items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-[13px] font-semibold ring-1 ring-black/5">
              <span>Car Brands</span>
              <span className={`transition-transform ${mobileBrandsOpen ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {mobileBrandsOpen && (
              <ul className="mt-2 max-h-72 overflow-y-auto grid grid-cols-2 gap-2">
                {brandsLoading ? <li className="p-3 col-span-2 text-[12px] text-gray-500">Loading…</li> : brandsMenu.slice(0, 40).map((b) => {
                  return (
                    <li key={b.id}>
                      <Link to={`/parts?brandId=${encodeURIComponent(b.car_id)}`} onClick={closeAllMobile} className="flex items-center gap-2 rounded-md border border-gray-100 bg-white p-2 hover:bg-gray-50">
                        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-[#F6F5FA] ring-1 ring-black/10"><img src={b.image} alt={b.name} className="h-full w-full object-contain" /></span>
                        <span className="truncate text-[12px] font-medium">{b.name}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Auth quick action - Mobile */}
          <div className="pt-1 border-t border-gray-100">
            {user ? (
              <div className="space-y-2">
                {/* User Info Card */}
                <div className="rounded-xl bg-gradient-to-br from-brand/10 to-yellow-50 p-4 ring-1 ring-black/5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand to-yellow-500 text-white font-bold text-[16px] ring-2 ring-white shadow-md">
                      {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-gray-900 truncate">{user.name || 'Guest User'}</p>
                      <p className="text-[12px] text-gray-600 truncate">{user.email}</p>
                    </div>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/profile"
                    onClick={closeAllMobile}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-900">Profile</span>
                  </Link>

                  <Link
                    to="/order-history"
                    onClick={closeAllMobile}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-900">Orders</span>
                  </Link>

                  <Link
                    to="/wishlist"
                    onClick={closeAllMobile}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-900">Wishlist</span>
                  </Link>

                  <Link
                    to="/account-settings"
                    onClick={closeAllMobile}
                    className="flex flex-col items-center gap-2 rounded-lg bg-white p-3 ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v6m0 6v6m5.657-13.657l-4.243 4.243m-6.364 0L2.808 5.343M23 12h-6m-6 0H5m13.657 5.657l-4.243-4.243m-6.364 0l-4.242 4.243" />
                    </svg>
                    <span className="text-[12px] font-semibold text-gray-900">Settings</span>
                  </Link>
                </div>

                {/* Help & Sign Out */}
                <div className="space-y-2">
                  {/* <Link
                    to="/help"
                    onClick={closeAllMobile}
                    className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-900 ring-1 ring-black/5 hover:bg-gray-50 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Help & Support</span>
                  </Link> */}

                  <button
                    onClick={() => {
                      closeAllMobile()
                      navigate('/login')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-[13px] font-bold text-red-600 ring-1 ring-red-200 hover:bg-red-100 transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={closeAllMobile}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-yellow-500 px-4 py-3.5 text-[14px] font-bold text-white shadow-lg hover:shadow-xl hover:brightness-110 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
                <span>Sign In to Your Account</span>
              </Link>
            )}
          </div>
        </div>
      </div>
     
    </header>
  )
        }
