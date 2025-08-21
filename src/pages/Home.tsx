import { useMemo, useState, useEffect, useRef } from 'react'
import ProductCard, { type Product } from '../components/ProductCard'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import cp1 from '../assets/cp1.png'
import cp2 from '../assets/cp2.png'
import cp3 from '../assets/cp3.png'
import cp4 from '../assets/cp4.png'
import cp5 from '../assets/cp5.png'
import tcp1 from '../assets/tcp1.png'
import tcp2 from '../assets/tcp2.png'
import tcp3 from '../assets/tcp3.png'
import sec1 from '../assets/sec1.png'
import sec2 from '../assets/sec2.png'
import sec3 from '../assets/sec3.png'
import sec4 from '../assets/sec4.png'
import sec5 from '../assets/sec5.png'
import sec6 from '../assets/sec6.png'
import sec7 from '../assets/sec7.png'
import sec8 from '../assets/sec8.png'
import brand1 from '../assets/brand1.png'
import brand2 from '../assets/brand2.png'
import brand3 from '../assets/brand3.png'
import brand4 from '../assets/brand4.png'
import brand5 from '../assets/brand5.png'
import brand6 from '../assets/brand6.png'
import specialImg from '../assets/special.png'
import carShop from '../assets/car-shop.png'

const MAKERS = ['Audi', 'BMW', 'Toyota', 'Honda', 'Mercedes', 'Hyundai']
const MODELS: Record<string, string[]> = {
  Audi: ['A1', 'A3', 'A4', 'Q5'],
  BMW: ['3 Series', '5 Series', 'X5'],
  Toyota: ['Corolla', 'Camry', 'RAV4'],
  Honda: ['Civic', 'Accord', 'CR-V'],
  Mercedes: ['C-Class', 'E-Class', 'GLA'],
  Hyundai: ['Elantra', 'Sonata', 'Tucson'],
}
const ENGINES: Record<string, string[]> = {
  A1: ['1.0 TFSI', '1.4 TFSI'],
  A3: ['1.6 TDI', '2.0 TDI'],
  Corolla: ['1.6', '1.8'],
  Civic: ['1.5T', '2.0'],
}

// Demo products powering grids
const demoProducts: Product[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `p-${i + 1}`,
  title: ['Audi A1', 'Engine Block', 'Sensor', 'Filters', 'Steering'][i % 5],
  image: [cp1, cp2, cp3, cp4, cp5][i % 5],
  rating: 3.5 + ((i % 5) * 0.3),
}))

// Top brands row
const TOP_BRANDS: { name: string; logo: string }[] = [
  { name: 'BMW', logo: brand1 },
  { name: 'Vaxhaul', logo: brand2 },
  { name: 'Audi', logo: brand3 },
  { name: 'Ford', logo: brand4 },
  { name: 'Mercedes-Benz', logo: brand5 },
  { name: 'Toyota', logo: brand6 },
]

// Special offers demo
type Offer = Product & { price: number; reviews: number }
const OFFERS: Offer[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `o-${i + 1}`,
  title: 'Car Maintenance',
  image: specialImg,
  rating: 4.2,
  price: 40000,
  reviews: 68267,
}))

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

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
          <img src={offer.image} alt={offer.title} className="h-full w-full object-contain" />
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
  // Form state
  const [maker, setMaker] = useState<string>('')
  const [model, setModel] = useState<string>('')
  const [engine, setEngine] = useState<string>('')
  const [reg, setReg] = useState('')
  const [tab, setTab] = useState<0 | 1 | 2>(0)

  const availableModels = useMemo(() => (maker ? MODELS[maker] ?? [] : []), [maker])
  const availableEngines = useMemo(() => (model ? ENGINES[model] ?? ['Base', 'Sport'] : []), [model])

  const onSearchParts = (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Search:\nMaker: ${maker || '-'}\nModel: ${model || '-'}\nEngine: ${engine || '-'}`)
  }
  const onSearchReg = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reg.trim()) return
    alert(`Searching parts for reg: ${reg}`)
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

  // Offers carousel state
  const offersRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const updateOfferButtons = () => {
    const el = offersRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanPrev(scrollLeft > 0)
    setCanNext(scrollLeft + clientWidth < scrollWidth - 1)
  }

  useEffect(() => {
    updateOfferButtons()
    const el = offersRef.current
    if (!el) return
    const onScroll = () => updateOfferButtons()
    el.addEventListener('scroll', onScroll, { passive: true })
    const onResize = () => updateOfferButtons()
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const scrollByAmount = (dir: -1 | 1) => {
    const el = offersRef.current
    if (!el) return
    const amount = el.clientWidth * 0.9 * dir
    el.scrollBy({ left: amount, behavior: 'smooth' })
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
          <div className="rounded-[8px] justify-self-end min-w-[400px] bg-white p-4 shadow-md ring-1 ring-black/10 md:p-5">
            {/* Parts search form */}
            <form onSubmit={onSearchParts} className="space-y-5">
              <div className="relative">
                {/* vertical guide */}
                <span className="pointer-events-none absolute left-2 top-4 bottom-3 hidden w-[5px] bg-[#5A1E78] sm:block" aria-hidden />

                {/* Rows */}
                <div className="space-y-5 font-semibold">
                  {[
                    { label: 'Select Maker', value: maker, set: setMaker, options: MAKERS },
                    { label: 'Select Model', value: model, set: setModel, options: availableModels, disabled: !maker },
                    { label: 'Select Engine', value: engine, set: setEngine, options: availableEngines, disabled: !model },
                  ].map((f, idx) => (
                    <div key={idx} className="grid grid-cols-[20px_1fr] items-center gap-3">
                      <div className="hidden sm:block z-20">
                        <StepBadge n={idx + 1} />
                      </div>
                      <div className="relative">
                        <select
                          aria-label={f.label}
                          value={f.value}
                          onChange={(e) => f.set((e.target as HTMLSelectElement).value)}
                          disabled={(f as any).disabled}
                          className="h-12 w-full appearance-none rounded-md bg-gray-100 px-3 pr-9 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
                        >
                          <option value="" disabled hidden>
                            {f.label}
                          </option>
                          {f.options.map((o) => (
                            <option key={o} value={o}>{o}</option>
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
                  value={reg}
                  onChange={(e) => setReg(e.target.value)}
                  placeholder="Your Reg"
                  className="h-10 w-full rounded-md bg-gray-100 px-3 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300"
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
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {demoProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>

        {/* Bottom row of cards to mirror design spacing */}
        {/* <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {demoProducts.slice(0, 5).map((p) => (
            <ProductCard key={`b-${p.id}`} product={p} />
          ))}
        </div> */}
      </section>

      {/* Shop by Section */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6">
        <h3 className="text-[20px] font-semibold text-gray-900">Shop by Section</h3>
        <div className="mt-4 grid grid-cols-2 gap-10 md:grid-cols-4">
          { [
            { label: 'Car Accessories', icon: sec1 },
            { label: 'Car Care & Cleaning', icon: sec2 },
            { label: 'Tools & Equipment', icon: sec3 },
            { label: 'Car Bulbs', icon: sec4 },
            { label: 'Engine Oil', icon: sec5 },
            { label: 'Brake Discs', icon: sec6 },
            { label: 'Brake Pads', icon: sec7 },
            { label: 'Tyres', icon: sec8 },
          ].map((s) => (
            <a key={s.label} href="#" className="group rounded-xl p-3 transition">
              <div className="flex h-42 w-full ring-1 ring-black/10 py-2 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src={s.icon}
                  alt={s.label}
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="mt-3 text-center text-[12px] font-semibold uppercase tracking-wide text-gray-800">{s.label}</p>
            </a>
          ))}
        </div>
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
          {(() => {
            const groups = tab === 0
              ? [
                  { title: 'Brake System', icon: tcp1, links: ['Brake Pads', 'Brake Disc', 'Brake Caliper', 'Brake Shoe', 'Dot 4', 'Brake Drum', 'Brake Hose'] },
                  { title: 'Suspension and Arms', icon: tcp2, links: ['Wheel Bearing Hub', 'Shock Absorber', 'Upper Arm', 'Shaft', 'Lower Arm', 'Ball Joint'] },
                  { title: 'Filters', icon: tcp3, links: ['Cabin Filter', 'Air Filter', 'Engine Oil Filter', 'Fuel Filter', 'Brake Shoe'] },
                  { title: 'Engine', icon: tcp1, links: ['Engine Block', 'Piston', 'Rings', 'Gasket', 'Oil Pump', 'Camshaft'] },
                ]
              : tab === 1
              ? [
                  { title: 'Top Manufacturers', icon: tcp1, links: ['Bosch', 'Denso', 'NGK', 'Sachs', 'Ferodo', 'KYB', 'MANN-FILTER'] },
                  { title: 'Popular Brands', icon: tcp2, links: ['Aisin', 'Valeo', 'Brembo', 'Shell', 'Castrol', 'Mobil 1'] },
                  { title: 'OEM Partners', icon: tcp3, links: ['Toyota', 'Honda', 'BMW', 'Mercedes-Benz'] },
                  { title: 'Local Favorites', icon: tcp1, links: ['GAPA Premium', 'SuperParts', 'Naija Filters'] },
                ]
              : [
                  { title: 'Best Sellers', icon: tcp1, links: ['Brake Pads', 'Oil Filter', 'Shock Absorber', 'Spark Plug', 'Wiper Blade'] },
                  { title: 'Trending Now', icon: tcp2, links: ['LED Headlight', 'Alloy Wheels', 'Engine Oil 5W-30', 'Car Scanner'] },
                  { title: 'Most Reviewed', icon: tcp3, links: ['Air Filter', 'Cabin Filter', 'Battery', 'Timing Belt'] },
                  { title: 'Recommended', icon: tcp1, links: ['Brake Disc', 'Wheel Hub', 'Control Arm', 'Fuel Pump'] },
                ]

            return groups.map((g, idx) => (
              <div key={`${tab}-${g.title}-${idx}`} className="rounded-xl bg-white p-4 ">
                <div className="flex justify-center gap-4">
                  <div className="flex h-auto sm:w-40 ring-1 ring-black/10 p-4 items-center justify-center rounded-lg">
                    <img
                      src={g.icon}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div>
                    <h5 className="text-[14px] font-semibold text-gray-900">{g.title}</h5>
                    <ul className="mt-2 space-y-1.5 text-[13px] text-[#333333]">
                      {g.links.map((l) => (
                        <li key={l}>
                          <a href="#" className="text-brand !underline !hover:underline">{l}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))
          })()}
        </div>

        <button className='bg-[#F7CD3A] px-10 rounded-md flex mt-5 w-fit mx-auto justify-center py-2'>View Catalogue</button>
      </section>

      {/* Top brands */}
      <section className="mx-auto max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top brands</h3>
          <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
        <div className="mt-3 flex items-center justify-between gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
          {TOP_BRANDS.map((b) => (
            <div key={b.name} className="shrink-0">
              <img src={b.logo} alt={b.name} className="max-h-12 w-auto object-contain" />
            </div>
          ))}
        </div>
      </section>

      {/* Special Offers on Car Parts */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Special Offers on Car Parts</h3>
          <div className="hidden items-center gap-2 sm:flex">
            <button aria-label="Previous" className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50" onClick={() => scrollByAmount(-1)} disabled={!canPrev}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button aria-label="Next" className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50" onClick={() => scrollByAmount(1)} disabled={!canNext}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        {/* Carousel */}
        <div
          ref={offersRef}
          className="mt-4 py-4 pl-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]"
          aria-label="Special offers carousel"
        >
          <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
          <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-6 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
            {OFFERS.map((o) => (
              <div key={o.id} className="shrink-0">
                <OfferCard offer={o} />
              </div>
            ))}
          </div>
        </div>
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
    </div>
  )
}
