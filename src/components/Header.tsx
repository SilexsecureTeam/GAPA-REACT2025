import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/gapa-logo.png';
import icon1 from '../assets/h1.png'
import icon2 from '../assets/h2.png'
import icon3 from '../assets/h3.png'
import icon4 from '../assets/h4.png'
import icon5 from '../assets/h5.png'
import icon6 from '../assets/h6.png'
import icon7 from '../assets/h7.png'
import { useAuth } from '../services/auth'

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

  return (
    <header className="fixed w-full top-0 z-50 shadow-sm">
      {/* Top promo strip */}
      <div className="bg-brand text-white py-1">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div />
          <p className="text-[14px] font-normal tracking-wide">
            Free Delivery on Orders Over ₦50,000 – Limited Time!
          </p>
          <div className="hidden items-center gap-3 sm:flex" aria-live="polite">
            <span className="text-[12px] font-semibold tracking-wider text-white/90">OFFER ENDS IN:</span>
            <div className="flex items-center gap-1.5">
              {/* HH:MM:SS boxes with colons like before */}
              {[pad2(timeLeft.h), pad2(timeLeft.m), pad2(timeLeft.s)].map((v, i, arr) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="inline-flex h-6 min-w-7 items-center justify-center rounded-md bg-white/10 px-1.5 text-[12px] font-bold leading-none text-white ring-1 ring-white/15">
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
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-4 px-4 py-3 sm:px-6 md:grid-cols-[auto_minmax(0,1fr)_auto]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 brand-logo" aria-label="Gapa Naija home">
            <img
              src={logo}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/gapa-logo.png' }}
              alt="Gapa Naija"
              className="h-8 w-auto md:h-9"
            />
          </Link>

          {/* Search */}
          <form onSubmit={onSearch} className="w-full">
            <div className="relative flex h-11 w-[80%] ml-20 overflow-hidden rounded-md bg-white ring-1 ring-black/10 focus-within:ring-black/20">
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
                className="absolute right-0 top-0 rounded-md h-full px-5 text-[13px] font-semibold text-white transition-colors bg-brand hover:brightness-110"
              >
                Search
              </button>
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            {/* Gapa Fix */}
            <a href="#" className="hidden items-center gap-2 text-[14px] text-gray-900 md:flex">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <path d="M14.7 6.3a2 2 0 0 1 2.8 2.8L10 16.6 7 17l.4-3 7.3-7.7z" />
                <path d="M16 7l1 1" />
              </svg>
              <span className="font-medium">Gapa Fix</span>
              <span className="mx-2 inline-block h-5 w-px bg-black/20" aria-hidden />
            </a>

            {/* Cart */}
            <a href="#cart" className="hidden items-center gap-2 text-[14px] text-gray-900 md:flex">
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
      <nav className="relative bg-brand overflow-y-hidden text-white" onMouseLeave={() => setOpenIdx(null)} onKeyDown={(e) => { if (e.key === 'Escape') setOpenIdx(null) }}>
        <div
          className="mx-auto flex h-12 overflow-y-hidden max-w-7xl items-center justify-between gap-6 overflow-x-auto px-4 sm:px-6"
        >
          {categories.map((cat, i) => (
            <div key={cat.label} className="relative overflow-y-hidden overflow-x-hidden">
              <Link
                to={cat.label === 'Car Parts' ? '/parts' : (cat.label === 'Tyres' ? '/tyres' : (cat.label === 'Engine Oil' ? '/engine-oil' : '/parts'))}
                onMouseEnter={() => setOpenIdx(cat.items ? i : null)}
                onFocus={() => setOpenIdx(cat.items ? i : null)}
                onClick={() => setOpenIdx(null)}
                className={`group inline-flex shrink-0 overflow-x-hidden items-center gap-2 whitespace-nowrap rounded-md px-2 py-1.5 text-[14px] font-medium ${openIdx===i ? 'bg-white/10 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'}`}
                aria-haspopup={!!cat.items}
                aria-expanded={openIdx === i}
              >
                {cat.icon && (
                  <img src={cat.icon} alt="" />
                )}
                <span>{cat.label}</span>
                {cat.caret && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </Link>

              {/* Dropdown panel opens on hover, links clickable */}
              {openIdx === i && cat.items && (
                <div className="absolute left-0 top-full z-40 mt-2 w-screen max-w-md rounded-xl bg-white p-3 text-gray-900 shadow-lg ring-1 ring-black/10 sm:max-w-lg md:max-w-xl">
                  <div role="menu" aria-label={`${cat.label} menu`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {cat.items.map((item) => {
                      // For Car Brands (index 0), navigate to brand + default part
                      // For Car Parts (index 1), navigate to strict category-only route
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
          ))}
        </div>
      </nav>
    </header>
  )
}
