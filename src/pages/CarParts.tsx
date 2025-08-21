import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import c1 from '../assets/c1.png'
import c2 from '../assets/c2.png'
import c3 from '../assets/c3.png'
import c4 from '../assets/c4.png'
import c5 from '../assets/c5.png'
import c6 from '../assets/c6.png'
import c7 from '../assets/c7.png'
import c8 from '../assets/c8.png'
import c9 from '../assets/c9.png'
import topImg from '../assets/top.png'
import brand1 from '../assets/brand1.png'
import brand2 from '../assets/brand2.png'
import brand3 from '../assets/brand3.png'
import brand4 from '../assets/brand4.png'
import brand5 from '../assets/brand5.png'
import brand6 from '../assets/brand6.png'

function Crumb() {
  return (
    <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
      <ol className="flex items-center gap-3 font-medium">
        <li>
          <Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link>
        </li>
        <li aria-hidden className='text-[24px] -mt-1.5'>›</li>
        <li className="font-semibold text-brand">Car Accessories</li>
      </ol>
    </nav>
  )
}

type Section = { title: string; img: string; links: string[] }

const SECTIONS: Section[] = [
  {
    title: 'Car cleaning & detailing accessories',
    img: c1,
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
    img: c2,
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
    img: c3,
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
    img: c4,
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
    img: c5,
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
    img: c6,
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
    img: c7,
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
    img: c8,
    links: [
      'Car inverter',
      'Car phone charger',
      'Car phone holder',
      'Dash camera',
    ],
  },
  {
    title: 'In-car entertainment',
    img: c9,
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
          <img src={s.img} alt="" className="h-24 w-full object-contain md:h-28" />
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

// Accessories (demo data for the carousel)
type Accessory = { id: string; title: string; image: string; rating: number; reviews: number; price: number; badge?: string }
const ACCESSORIES: Accessory[] = Array.from({ length: 10 }).map((_, i) => ({
  id: `acc-${i + 1}`,
  title: ['Seat Organizer', 'Phone Mount', 'All-weather Mats', 'Dash Cam', 'LED Bulb'][i % 5],
  image: topImg,
  rating: 3.8 + ((i % 4) * 0.3),
  reviews: 500 + i * 37,
  price: 12000 + i * 1500,
  badge: i % 3 === 0 ? 'Best Seller' : i % 3 === 1 ? 'New' : undefined,
}))

const TOP_BRANDS: { name: string; logo: string }[] = [
  { name: 'BMW', logo: brand1 },
  { name: 'Vaxhaul', logo: brand2 },
  { name: 'Audi', logo: brand3 },
  { name: 'Ford', logo: brand4 },
  { name: 'Mercedes-Benz', logo: brand5 },
  { name: 'Toyota', logo: brand6 },
]

function formatNaira(n: number) {
  return `₦${n.toLocaleString('en-NG')}`
}

function AccessoryCard({ a }: { a: Accessory }) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(a.id)
  return (
    <div className="relative rounded-xl bg-white ring-1 ring-black/10">
      {a.badge && (
        <span className="absolute left-3 top-3 z-10 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-[#201A2B] ring-1 ring-black/5">{a.badge}</span>
      )}
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton active={isFav} onToggle={() => wishlist.toggle(a.id)} ariaLabel="Add to wishlist" />
      </div>
      <div className="p-4">
        <Link to={`/product/${a.id}`} className="block">
          <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg">
            <img src={a.image} alt={a.title} className="h-full w-full object-contain" />
          </div>
        </Link>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1 text-[12px] text-gray-600">
            <Rating value={a.rating} size={12} />
            <span className="text-gray-500">({a.reviews.toLocaleString()})</span>
          </div>
          <Link to={`/product/${a.id}`} className="block text-[13px] font-semibold text-gray-900 hover:underline">{a.title}</Link>
          <div className="text-[13px] font-extrabold text-gray-900">{formatNaira(a.price)}</div>
          <div className="text-[10px] leading-3 text-gray-500">Incl. VAT • NG/ECOM tax</div>
          <div className="pt-2">
            <button type="button" className="inline-flex h-8 items-center justify-center gap-2 rounded-md bg-accent px-3 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/5 hover:brightness-105">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CarParts() {
  const accRef = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)

  const updateButtons = () => {
    const el = accRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setCanPrev(scrollLeft > 0)
    setCanNext(scrollLeft + clientWidth < scrollWidth - 1)
  }

  useEffect(() => {
    updateButtons()
    const el = accRef.current
    if (!el) return
    const onScroll = () => updateButtons()
    el.addEventListener('scroll', onScroll, { passive: true })
    const onResize = () => updateButtons()
    window.addEventListener('resize', onResize)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const scrollByAmount = (dir: -1 | 1) => {
    const el = accRef.current
    if (!el) return
    const amount = el.clientWidth * 0.9 * dir
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">Browse Car Parts</h1>
        <Crumb />

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s, i) => (
            <React.Fragment key={s.title}>
              <Tile s={s} />
              {((i + 1) % 4 === 0) && (
                <div className="col-span-full my-2 h-px bg-black/10" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Top car accessories Categories (pill links) */}
        <div className="mt-10">
          <h3 className="text-[14px] font-semibold text-gray-900">Top car accessories Categories</h3>
          <ul className="mt-3 grid grid-cols-1 gap-3 text-[12px] text-gray-800 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
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
            ].map((label) => (
              <li key={label} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
                <span className="inline-block h-3 w-3 rounded-full ring-1 ring-black/20" aria-hidden />
                <a href="#" className="hover:underline">{label}</a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Accessories carousel */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-quality car accessories at unbeatable prices</h3>
          <div className="hidden items-center gap-2 sm:flex">
            <button aria-label="Previous" className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50" onClick={() => scrollByAmount(-1)} disabled={!canPrev}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button aria-label="Next" className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-600 hover:bg-gray-50 disabled:opacity-50" onClick={() => scrollByAmount(1)} disabled={!canNext}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <div
          ref={accRef}
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
              <img src={b.logo} alt={b.name} className="h-12 w-auto object-contain" />
            </div>
          ))}
        </div>
      </section>

      {/* Info section: Car Accessories Made Easy */}
      <section aria-labelledby="acc-easy-title" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
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