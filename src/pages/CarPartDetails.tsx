import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

// Simple slug util (kept local for now)
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// Demo vehicle data (reuse from Home semantics)
const MAKERS = ['BMW', 'Audi', 'Toyota', 'Honda', 'Mercedes', 'Hyundai']
const MODELS: Record<string, string[]> = {
  BMW: ['1 Convertible (E88)', '3 Series (E90)', 'X5 (E70)'],
  Audi: ['A1', 'A3', 'Q5'],
  Toyota: ['Corolla', 'Camry'],
}
const ENGINES: Record<string, string[]> = {
  '1 Convertible (E88)': ['125 i (160kW / 218 HP)', '120 i (112kW / 150 HP)'],
  A1: ['1.0 TFSI', '1.4 TFSI'],
  Corolla: ['1.6', '1.8'],
}

// Sample brands
const BRANDS = ['Febreze', 'glade', 'P&G', 'AirspenceUSA', 'OZIUM', 'renuzit']

// Result item type
interface SpecItem { label: string; value: string }
interface ResultItem {
  id: string
  brand: string
  brandLogo: string
  image: string
  name: string
  articleNo: string
  rating: number
  ratingNote: string
  price: number
  inStock: boolean
  specs: SpecItem[]
}

const SAMPLE_RESULTS: ResultItem[] = Array.from({ length: 6 }).map((_, i) => ({
  id: `bd-${i + 1}`,
  brand: 'RIDEX',
  brandLogo: 'https://dummyimage.com/80x28/ffffff/111111.png&text=RIDEX',
  image: 'https://dummyimage.com/220x180/f6f5fa/aaaaaa.png&text=Brake+Disc',
  name: 'Brake Disc RIDEX82B0169',
  articleNo: '123456',
  rating: 4.5,
  ratingNote: '(9.0/10 based over 1000 customers)',
  price: 40000,
  inStock: true,
  specs: [
    { label: 'Fitting position', value: 'Front Axle' },
    { label: 'Diameter (mm)', value: '300' },
    { label: 'Brake Disc Type', value: 'Vented' },
    { label: 'Material', value: 'Cast Iron' },
    { label: 'Surface', value: 'Uncoated' },
    { label: 'Height(mm)', value: '78.5' },
    { label: 'Break Disc Thickness (mm):', value: '24' },
    { label: 'Centering Diameter(mm)', value: '79' },
    { label: 'Number of Holes :', value: '5/6' },
    { label: 'Wheel Bolt Bore Diameter (mm)', value: '14.6' },
    { label: 'Bolt Hole circle Ø (mm):', value: '120' },
    { label: 'Supplementary Article/ Supplementary info 2', value: 'Without Bolt/ Screws' },
  ],
}))

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-brand ring-1 ring-black/10">
      {n}
    </span>
  )
}

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
      <div ref={ref} className="mt-2 flex items-center gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
        {BRANDS.map((b) => (
          <div key={b} className="shrink-0">
            <img src={`https://dummyimage.com/110x48/ffffff/111111.png&text=${encodeURIComponent(b)}`} alt={b} className="h-10 w-auto object-contain" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FiltersSidebar() {
  return (
    <aside>
      {/* Select Vehicle card */}
      <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
        <h4 className="text-[12px] font-bold tracking-wide text-white">
          <span className="inline-block rounded bg-brand px-2 py-1">SELECT VEHICLE</span>
        </h4>
        <div className="mt-3 space-y-4">
          {/* Mimic 3-step selector */}
          <div className="space-y-3">
            {[{ label: 'BMW' }, { label: '1 Convertible E88 (03/2008 - 10/2013)' }, { label: '125 i (160KW / 218 HP)' }].map((row, idx) => (
              <div key={idx} className="grid grid-cols-[20px_1fr] items-center gap-3">
                <div className="hidden sm:block"><StepBadge n={idx + 1} /></div>
                <div className="relative">
                  <select className="h-11 w-full appearance-none rounded-md bg-gray-100 px-3 pr-10 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300">
                    <option>{row.label}</option>
                  </select>
                  <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                  </span>
                </div>
              </div>
            ))}
          </div>
          <button className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Search</button>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-700">Enter your registration below</label>
            <div className="flex gap-2">
              <input placeholder="Your Reg" className="h-10 w-full rounded-md bg-gray-100 px-3 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300" />
              <button className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-[#201A2B] ring-1 ring-black/5">Search</button>
            </div>
            <Link to="#" className="text-sm font-medium text-brand underline">Can't Find Your Car in the Catalogue?</Link>
          </div>
        </div>
      </div>

      {/* Facets */}
      <div className="mt-6 space-y-5">
        {[
          { title: 'DIAMETER (MM)', items: ['240', '300', '320', '340', '360'] },
          { title: 'BRAKE DISC TYPE', items: ['Perforated', 'Vented', 'Internally vented'] },
          { title: 'MATERIAL', items: ['Cast Iron', 'Grey Cast Iron'] },
          { title: 'SURFACE', items: ['Chrome-free passivation', 'Coated', 'Painted', 'Uncoated'] },
          { title: 'HEIGHT (MM)', items: ['66', '73.4', '78.5'] },
          { title: 'BRAKE DISC THICKNESS', items: ['20', '22', '24', '25.9', '26'] },
        ].map((f) => (
          <section key={f.title} className="rounded-lg border border-black/10">
            <div className="flex items-center justify-between rounded-t-lg border-b border-black/10 bg-white p-3">
              <h5 className="text-[12px] font-bold tracking-wide text-gray-900">{f.title}</h5>
            </div>
            <ul className="max-h-72 overflow-auto p-3 text-[13px]">
              {f.items.map((it) => (
                <li key={it} className="flex items-center gap-2 py-1.5">
                  <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
                  <span className="text-gray-800">{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  )
}

function ResultCard({ item }: { item: ResultItem }) {
  const [qty, setQty] = useState(2)
  const inc = () => setQty((v) => Math.min(v + 1, 99))
  const dec = () => setQty((v) => Math.max(v - 1, 1))
  return (
    <div className="rounded-xl bg-white ring-1 ring-black/10">
      <div className="grid grid-cols-[1fr_auto] items-stretch">
        <div className="p-4 pr-0">
          <div className="flex items-start gap-3">
            <img src={item.brandLogo} alt={item.brand} className="h-6 w-auto" />
            <div className="ml-auto pr-4 text-right text-[12px] text-gray-500">
              <div>Article No: {item.articleNo}</div>
              <div className="flex items-center justify-end gap-1 text-orange-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.431L24 9.748l-6 5.846L19.335 24 12 19.897 4.665 24 6 15.594 0 9.748l8.332-1.73z"/></svg>
                <span className="text-[12px] font-semibold text-gray-900">{item.rating.toFixed(1)}</span>
                <span className="text-[11px] text-gray-600">{item.ratingNote}</span>
              </div>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[110px_1fr] gap-3 pr-4 md:grid-cols-[140px_1fr]">
            <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA]">
              <img src={item.image} alt={item.name} className="h-28 w-auto object-contain md:h-32" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{item.name}</div>
              <div className="mt-3 grid grid-cols-1 gap-1">
                {item.specs.map((s) => (
                  <div key={s.label + s.value} className="grid grid-cols-[260px_1fr] text-[13px]">
                    <div className="rounded-l-md bg-[#FFF4E0] px-3 py-1.5 font-medium text-gray-800">{s.label}</div>
                    <div className="rounded-r-md bg-[#FFF4E0] px-3 py-1.5 text-gray-700">{s.value}</div>
                  </div>
                ))}
                <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
              </div>
            </div>
          </div>
        </div>
        <aside className="flex w-56 flex-col items-center justify-between border-l border-black/10 p-4">
          <div className="text-right">
            <div className="text-[22px] font-bold text-gray-900">₦{item.price.toLocaleString('en-NG')}</div>
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
          <div className="mt-1 text-[12px] text-purple-700">{item.inStock ? 'In Stock' : 'Out of stock'}</div>
        </aside>
      </div>
    </div>
  )
}

export default function CarPartDetails() {
  const params = useParams<{ brand?: string; part?: string }>()
  const partName = useMemo(() => {
    const fromParam = params.part ? params.part.replace(/-/g, ' ') : 'Brake Discs'
    return fromParam.replace(/\b\w/g, (c) => c.toUpperCase())
  }, [params.part])
  const brandName = useMemo(() => (params.brand ? params.brand.replace(/-/g, ' ').toUpperCase() : undefined), [params.brand])

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Title */}
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">
          {partName} {brandName ? brandName : ''} Rear And Front
        </h1>

        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
          <ol className="flex items-center gap-3 font-medium">
            <li><Link to="/parts" className="hover:underline text-gray-700">Car Parts</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li><Link to="/parts" className="hover:underline text-gray-700">Car Parts Catalogue</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li className="font-semibold text-brand">{partName}{brandName ? ' ' + brandName : ''}</li>
          </ol>
        </nav>

        {/* Toolbar */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="text-[13px] text-gray-700">Sort by:
            <select className="ml-2 rounded-md border border-black/10 bg-white px-2 py-1 text-[13px]"><option>Recommended</option><option>Price: Low to High</option><option>Price: High to Low</option></select>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-gray-600">
            <span>Items: 369</span>
            <div className="hidden gap-1 sm:flex">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10">▦</button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10">▤</button>
            </div>
          </div>
        </div>

        {/* Brand carousel */}
        <div className="mt-3">
          <div className="rounded-t-xl bg-white px-4 py-2 text-center text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Select Manufacturer</div>
          <BrandCarousel />
        </div>

        {/* Fitting position cards */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[{ label: 'FRONT AXLE' }, { label: 'REAR AXLE' }].map((c) => (
            <div key={c.label} className="rounded-xl bg-white p-5 ring-1 ring-black/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-3">
                  <img src="https://dummyimage.com/120x60/f6f5fa/aaaaaa.png&text=Axle" alt="" className="h-14 w-auto object-contain" />
                </div>
                <div className="text-center">
                  <div className="text-[12px] text-gray-700">Fitting position</div>
                  <div className="text-[13px] font-semibold text-gray-900">{c.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Layout grid */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
          <FiltersSidebar />

          {/* Results list */}
          <div className="space-y-4">
            {SAMPLE_RESULTS.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}

            {/* Pagination */}
            <div className="flex items-center justify-between pt-2 text-[12px] text-gray-700">
              <div>1-10 of 18 Pages</div>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} className={`inline-flex h-7 min-w-7 items-center justify-center rounded border border-black/10 px-2 ${n===1 ? 'bg-brand text-white' : 'bg-white text-gray-700'}`}>{n}</button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span>10</span>
                <span className="text-gray-500">Items per page</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
