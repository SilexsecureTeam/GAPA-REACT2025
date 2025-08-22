import { useMemo, useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import airLogo from '../assets/air-freshner.png'
import brand1 from '../assets/brand1.png'
import brand2 from '../assets/brand2.png'
import brand3 from '../assets/brand3.png'
import brand4 from '../assets/brand4.png'
import brand5 from '../assets/brand5.png'
import brand6 from '../assets/brand6.png'

// Data types
type AFAttr = { label: string; value: string }
export type AFProduct = {
  id: string
  brand: string
  brandLogo: string
  articleNo: string
  name: string
  subtitle?: string
  image: string
  price: number
  rating: number
  reviews: number
  inStock: boolean
  attrs: AFAttr[]
}

const BRANDS = [
    { name: 'BMW', logo: brand1 },
  { name: 'Vaxhaul', logo: brand2 },
  { name: 'Audi', logo: brand3 },
  { name: 'Ford', logo: brand4 },
  { name: 'Mercedes-Benz', logo: brand5 },
  { name: 'Toyota', logo: brand6 },
]

const SAMPLE_PRODUCTS: AFProduct[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `af-${i + 1}`,
  brand: ['Febreze', 'glade', 'P&G', 'OZIUM'][i % 4],
  brandLogo: airLogo,
  articleNo: '123456',
  name: 'Febreze Lucky Leaf Car Air Freshener 537960',
  subtitle: 'Tutti Frutti, Bag, Orange',
  image: airLogo,
  price: 40000,
  rating: 0,
  reviews: 0,
  inStock: true,
  attrs: [
    { label: 'Scent', value: 'Tutti Frutti' },
    { label: 'Scent', value: 'Tutti Frutti' },
    { label: 'Material', value: 'Cardboard' },
    { label: 'Product line', value: 'Lucky Leaf' },
    { label: 'Packing Type', value: 'Bag' },
    { label: 'Fastening type', value: 'Suspended' },
    { label: 'Condition', value: 'New' },
  ],
}))

function BrandCarousel() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(true)
  const update = () => {
    const el = ref.current
    if (!el) return
    setCanPrev(el.scrollLeft > 0)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }
  useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const onScroll = () => update()
    el.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', update)
    }
  }, [])
  return (
    <div className="relative mt-3">
      <div className="flex items-center justify-between">
        <div className="flex-1" />
        <div className="hidden items-center gap-2 sm:flex">
          <button aria-label="Prev" onClick={() => ref.current?.scrollBy({ left: -280, behavior: 'smooth' })} disabled={!canPrev} className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-700 disabled:opacity-50">◀</button>
          <button aria-label="Next" onClick={() => ref.current?.scrollBy({ left: 280, behavior: 'smooth' })} disabled={!canNext} className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-black/10 text-gray-700 disabled:opacity-50">▶</button>
        </div>
      </div>
      <div ref={ref} className="mt-2 flex items-center justify-between gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
        {BRANDS.map((b) => (
          <div key={b.name} className="shrink-0">
            <img src={b.logo} alt={b.name} className="h-10 w-auto object-contain" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FilterSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-6 first:mt-0">
      <h4 className="text-[12px] font-bold tracking-wide text-gray-900">{title}</h4>
      <div className="mt-2 rounded-lg border border-black/10">
        <div className="h-1.5 rounded-t-lg bg-brand" />
        <ul className="max-h-72 overflow-auto p-3">
          {items.map((it) => (
            <li key={it} className="flex items-center gap-2 py-1.5 text-[13px]">
              <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
              <span className="text-gray-800">{it}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function AFListItem({ p }: { p: AFProduct }) {
  const [qty, setQty] = useState(2)
  const inc = () => setQty((v) => Math.min(v + 1, 99))
  const dec = () => setQty((v) => Math.max(v - 1, 1))
  return (
    <div className="rounded-xl bg-white ring-1 ring-black/10">
      <div className="grid grid-cols-[1fr_auto] items-stretch">
        <div className="p-4 pr-0">
          <div className="flex items-start gap-3">
            <img src={p.brandLogo} alt={p.brand} className="h-6 w-auto" />
            <div className="ml-auto text-right text-[12px] text-gray-500 pr-4">
              <div>Article No: {p.articleNo}</div>
              <button className="text-brand underline">(Rate this product)</button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[96px_1fr] gap-3 pr-4">
            <Link to={`/product/${p.id}`} className="flex items-center justify-center rounded-lg bg-[#F6F5FA]">
              <img src={p.image} alt={p.name} className="h-40 w-auto object-contain" />
            </Link>
            <div>
              <Link to={`/product/${p.id}`} className="font-semibold text-gray-900 hover:underline">{p.name}</Link>
              {p.subtitle && <div className="text-[13px] text-gray-600">{p.subtitle}</div>}
              <div className="mt-3 grid grid-cols-1 gap-1">
                {p.attrs.map((a) => (
                  <div key={a.label + a.value} className="grid grid-cols-[160px_1fr] text-[13px]">
                    <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                    <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700">{a.value}</div>
                  </div>
                ))}
                <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
              </div>
            </div>
          </div>
        </div>
        <aside className="flex w-56 flex-col items-center justify-between border-l border-black/10 p-4">
          <div className="text-right">
            <div className="text-[22px] font-bold text-gray-900">₦{p.price.toLocaleString('en-NG')}</div>
            <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
          </div>
          <div className="flex items-center gap-2">
            <button aria-label="Decrease" onClick={dec} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">‹</button>
            <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
            <button aria-label="Increase" onClick={inc} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">›</button>
          </div>
          <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
            Add to cart
          </button>
          <div className="mt-1 text-[12px] text-purple-700">{p.inStock ? 'In Stock' : 'Out of stock'}</div>
        </aside>
      </div>
    </div>
  )
}

export default function AirFresheners() {
  const [activeGroup, setActiveGroup] = useState(0)
  const GROUPS = useMemo(() => ['Show all', 'Car air freshener', 'Air Ioniser', 'Interior Cleanser, Ultrasonic nebuliser', 'Odour eliminator'], [])

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">Car Air Fresheners</h1>
        <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
          <ol className="flex items-center gap-3 font-medium">
            <li><Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li><Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li className="font-semibold text-brand">Car Fresheners</li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="sticky top-30 sm:top-34 self-start max-h-[calc(100vh-6rem)] overflow-auto pr-1 no-scrollbar">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6">
                <img src={airLogo} alt="Preview" className="h-72 w-auto object-contain" />
              </div>
            </div>
            <FilterSection title="SCENT" items={[ 'diamond wings yellow', 'caramel coffee', 'Alpine Meadow', 'BUBBLE GUM', 'Alpine Pine', 'New Car', 'Alaska' ]} />
            <FilterSection title="TYPE" items={[ 'Man-shaped', 'Sachet', 'Spray', 'Tin', 'Tree-shaped', 'Vent-mount' ]} />
            <FilterSection title="CONSISTENCY (property)" items={[ 'Creamy', 'Fixed', 'Granulate', 'Liquid', 'Soft', 'Thin' ]} />
            <FilterSection title="COLOUR" items={[ 'Multi-coloured', 'Orange', 'Silver', 'Sky blue', 'Turquoise', 'Anthracite', 'Biege', 'Black', 'Blue', 'Bronze' ]} />
            <FilterSection title="MATERIALS" items={[ 'Aluminium', 'Cardboard', 'Plastic', 'Silicone', 'Wood' ]} />
            <FilterSection title="CUSTOMERS ALSO SHOPPED FOR:" items={[ 'WHEEL TRIMS', 'CAR SEAT COVER', 'UNIVERSAL CAR MATS', 'BIKE RACK', 'CAR SEAT', 'CAR BOOT MATS & LINERS', 'CAR JACK', 'CAR JACK PLATE HOLDER', 'DASH CAMS', 'CAR STEREOS', 'CAR PHONE HOLDER', 'REVERSING CAMERA' ]} />
            <FilterSection title="PAYMENT METHODS" items={[ 'Aluminium', 'Cardboard', 'Plastic', 'Silicone', 'Wood' ]} />
            <FilterSection title="AUTOMOTIVE ACCESSORIES SHOP" items={[ 'Best prices', 'Wide choice', 'Save on shipping', 'Fast delivery' ]} />
            <FilterSection title="CAR CLEANING & DETAILING ACCESSORIES: CATALOGUE" items={[ 'PRESSURE WASHERS', 'MICROFIBER CLOTHES', 'CAR DEHUMIDIFIER', 'CHAMOIS LEATHER', 'CAR SPONGE', 'WINDOW SQUEEGEE', 'CLEANING BRUSHES', 'HAND SANITIZER', 'PAPER TOWELS', 'HAND CLEANER' ]} />
            <FilterSection title="TOP CATEGORIES OF THE CAR ACCESSORIES CATALOGUE" items={[ 'WHEEL TRIMS', 'CAR SEAT COVER', 'UNIVERSAL CAR MATS', 'BIKE RACK', 'CAR SEAT', 'CAR BOOT MATS & LINERS', 'CAR JACK', 'CAR JACK PLATE HOLDER', 'DASH CAMS', 'CAR STEREOS', 'CAR PHONE HOLDER', 'REVERSING CAMERA' ]} />
          </aside>

          {/* Main */}
          <div>
            {/* Groups */}
            <div className="rounded-xl ring-1 ring-black/10">
              <div className="flex items-center justify-between rounded-t-xl bg-brand px-4 py-2 text-white">
                <div className="text-[14px] font-semibold">Car fresheners: select product groups</div>
                <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white">View all
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </a>
              </div>
              <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-5">
                {GROUPS.map((g, idx) => (
                  <button key={g} onClick={() => setActiveGroup(idx)} className={`rounded-lg border border-black/10 bg:white p-3 text-left text-[13px] font-medium text-gray-800 hover:bg-gray-50 ${idx===activeGroup ? 'ring-2 ring-brand relative before:absolute before:left-0 before:top-0 before:h-1 before:w-full before:bg-brand before:rounded-t-lg' : ''}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* Search by brands */}
            <div className="mt-6 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-gray-900">Search by brands</h3>
              <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">View all
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
              </a>
            </div>
            <BrandCarousel />

            {/* Results */}
            <div className="mt-6 space-y-4">
              {SAMPLE_PRODUCTS.map((p) => (
                <AFListItem key={p.id} p={p} />
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-center gap-1 text-[12px]">
              {[1,2,3,4,5].map(n => (
                <button key={n} className={`inline-flex h-7 min-w-7 items:center justify-center rounded border border-black/10 px-2 ${n===1?'bg-brand text-white':'bg-white text-gray-700'}`}>{n}</button>
              ))}
            </div>

            {/* Similar groups */}
            <div className="mt-8 rounded-xl border border-black/10 p-4">
              <h4 className="text-[14px] font-semibold text-gray-900">Similar groups of products:</h4>
              <Link to="/parts/air-fresheners" className="mt-2 inline-flex items-center gap-1 text-[14px] text-gray-800 hover:text-gray-900">
                <span className="underline">Air Ioniser</span>
              </Link>
            </div>

            {/* Info section */}
            <section aria-labelledby="freshener-usage" className="mt-10">
              <h2 id="freshener-usage" className="text-center text-[22px] font-semibold text-gray-900 sm:text-[28px]">Easy ways to use your car Freshners</h2>
              <p className="mx-auto mt-2 max-w-3xl text-center text-[14px] leading-6 text-gray-600">
                Car accessories play a huge role in making your driving experience safer, more convenient, and more enjoyable. At Gapa Naija,
                we provide high-quality accessories that not only protect your car but also add comfort, safety, and style for every trip.
              </p>

              <div className="mt-8 grid gap-10 md:grid-cols-3">
                <div className="md:col-span-2">
                  <h3 className="text-[16px] font-semibold text-gray-900">Types of Car Freshners</h3>
                  <div className="mt-4 grid gap-8 sm:grid-cols-2">
                    <ul className="space-y-5 text-[13px] leading-5 text-gray-700">
                      <li>
                        <div className="font-semibold text-gray-900">Car Mats &amp; Liners</div>
                        <p className="mt-1 text-gray-600">Keep your interior clean and protected from dust, mud, and spills while adding durability and comfort.</p>
                      </li>
                      <li>
                        <div className="font-semibold text-gray-900">Covers &amp; Protectors</div>
                        <p className="mt-1 text-gray-600">From car body covers to seat and steering wheel covers, these protect your vehicle from wear, scratches,</p>
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
                        <p className="mt-1 text-gray-600">From car body covers to seat and steering wheel covers, these protect your vehicle from wear, scratches,</p>
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
                  <p className="mt-3 text-[13px] leading-6 text-gray-700">At Gapa Naija, we make shopping for car accessories simple, affordable, and reliable. With thousands of products, competitive prices, and fast delivery across Nigeria, you can always count on us to keep your car in top shape.</p>
                </aside>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>
  )
}
