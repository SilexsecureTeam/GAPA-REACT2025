import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import brand1 from '../assets/brand1.png'
import brand2 from '../assets/brand2.png'
import brand3 from '../assets/brand3.png'
import brand4 from '../assets/brand4.png'
import brand5 from '../assets/brand5.png'
import brand6 from '../assets/brand6.png'
import tyreImg from '../assets/top.png'

function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-brand ring-1 ring-black/10">{n}</span>
  )
}

function formatNaira(n: number) { return `₦${n.toLocaleString('en-NG')}` }

export default function Tyres() {
  const [maker, setMaker] = useState('BMW')
  const [model, setModel] = useState('1 Convertible E88(03/..')
  const [engine, setEngine] = useState('Select Engine')
  const [width, setWidth] = useState('150')
  const [profile, setProfile] = useState('150')
  const [rim, setRim] = useState('150')
  const [season, setSeason] = useState<'all' | 'summer' | 'winter'>('all')

  const BRANDS = useMemo(() => ([
    { name: 'BMW', logo: brand1 },
    { name: 'Vaxhaul', logo: brand2 },
    { name: 'Audi', logo: brand3 },
    { name: 'Ford', logo: brand4 },
    { name: 'Mercedes-Benz', logo: brand5 },
    { name: 'Toyota', logo: brand6 },
  ]), [])

  const BEST = Array.from({ length: 4 }).map((_, i) => ({
    id: `t-${i + 1}`,
    title: 'TOYO PROXES TRI',
    size: '245/45 R18',
    price: 40000,
    rating: 4.7,
    reviews: 126771,
    image: tyreImg,
  }))

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-2 flex justify-between gap-20">
                <h1 className="text-[28px] font-semibold text-gray-900">Shop Quality Tyres Online
                  <br className="hidden sm:block"/> with Gapa Naija
                </h1>
                <p className="mt-2 text-[13px] max-w-lg leading-5 text-gray-600">Find the perfect fit for your vehicle with our wide selection of quality tyres. Durable, reliable, and built for every road condition.</p>
                
              </div>
              <hr className="!mt-3 border-black/10 mb-5" />
        <div className="grid gap-6 md:grid-cols-[340px_1fr]">
          {/* Left finder card */}
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="flex items-center justify-between">
              <h3 className="rounded bg-brand px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-white">Tyre finder: Select Vehicle</h3>
              <button className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">↻</button>
            </div>

            <div className="mt-3 space-y-3">
              {[{ label: maker, set: setMaker }, { label: model, set: setModel }, { label: engine, set: setEngine }].map((row, idx) => (
                <div key={idx} className="grid grid-cols-[18px_1fr_30px] items-center gap-2">
                  <div className="hidden sm:block"><Step n={idx + 1} /></div>
                  <div className="relative">
                    <select value={row.label} onChange={(e)=> (row.set as any)(e.target.value)} className="h-10 w-full appearance-none rounded-md bg-[#F3F1F6] px-3 pr-9 text-sm text-gray-800 outline-none ring-1 ring-black/10">
                      <option>{row.label}</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                  <div className="flex items-center justify-center">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-brand text-white">✓</span>
                  </div>
                </div>
              ))}

              <button className="mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search
              </button>

              <div className="pt-2 space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-brand">Enter your registration below</label>
                <div className="flex gap-2">
                  <input placeholder="Your Reg" className="h-10 w-full rounded-md bg-[#F3F1F6] px-3 text-sm ring-1 ring-black/10 outline-none" />
                  <button className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-[#201A2B] ring-1 ring-black/10">Search</button>
                </div>
                <Link to="#" className="text-sm font-medium text-brand underline">Can't Find Your Car In The Catalogue?</Link>
              </div>
            </div>
          </div>

          {/* Right visual + selectors */}
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="grid grid-rows-[auto_1fr] gap-3">
              
              <div className="flex items-center justify-center rounded-xl bg-black p-5">
                <img src={tyreImg} alt="Tyre" className="h-[320px] w-auto object-contain" />
              </div>
            </div>
            <div className="space-y-3">
              {['Width','Width','Width'].map((l, i) => (
                <div key={i}>
                  <label className="text-[12px] font-semibold text-gray-900">{l}</label>
                  <div className="relative mt-1">
                    <select value={[width, profile, rim][i]} onChange={(e)=> [setWidth,setProfile,setRim][i](e.target.value)} className="h-10 w-full appearance-none rounded-md bg-[#F3F1F6] px-3 pr-9 text-sm ring-1 ring-black/10 outline-none">
                      <option>150</option>
                      <option>160</option>
                      <option>170</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-700">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-6 pt-1">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'summer', label: 'Summer' },
                  { key: 'winter', label: 'Winter' },
                ].map((s) => (
                  <label key={s.key} className="inline-flex items-center gap-2 text-[13px] text-gray-800">
                    <input type="radio" name="season" checked={season===s.key} onChange={()=> setSeason(s.key as any)} className="h-4 w-4 text-brand focus:ring-brand" />
                    {s.label}
                  </label>
                ))}
              </div>
              <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Badges row */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[['RETURN AND EXCHANGE','14 DAYS'],['SAFE ORDER','100 DAYS'],['SAVE ON DELIVERY','14 DAYS'],['FAST DELIVERY','']].map(([t,d]) => (
            <div key={t} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-brand" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6l-11 11-5-5"/></svg>
              </span>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-gray-900">{t}</div>
                <div className="text-[11px] leading-4 text-gray-600">{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Payment methods */}
        <div className="mt-8">
          <h4 className="text-[16px] font-semibold text-gray-900">Payment Methods</h4>
          <div className="mt-3 flex flex-wrap items-center gap-8 rounded-xl bg-white px-4 py-4 ring-1 ring-black/10">
            {['PayPal','Mastercard','Access','PayPal','Mastercard','Access'].map((p,i)=>(
              <div key={i} className="inline-flex items-center gap-2">
                <span className="inline-block h-7 w-14 rounded bg-[#F3F1F6] ring-1 ring-black/10"/>
                <span className="text-[13px] text-gray-800">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Our Best Sellers */}
        <div className="mt-10">
          <div className="flex items-center justify-between">
            <h3 className="text-[22px] font-semibold text-gray-900">Our Best Sellers</h3>
            <Link to="#" className="text-sm text-brand">View all ⟲</Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {BEST.map((b) => (
              <div key={b.id} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="flex items-center justify-between">
                  <div className="space-x-1">
                    <span className="rounded-full border border-accent/60 bg-white px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-accent">Summer</span>
                    <span className="rounded-full border border-red-400 bg-white px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-red-500">Hot</span>
                  </div>
                </div>
                <div className="mt-3 flex h-40 items-center justify-center rounded-lg bg-[#F6F5FA]">
                  <img src={b.image} alt={b.title} className="h-[85%] object-contain" />
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex items-center gap-1 text-[12px] text-gray-600">
                    <span className="text-[#FFB400]">★★★★★</span>
                    <span className="text-gray-500">({b.reviews.toLocaleString()})</span>
                  </div>
                  <div className="text-[12px] font-semibold text-gray-900">{b.title}</div>
                  <div className="text-[11px] text-gray-500">{b.size}</div>
                  <div className="text-[14px] font-extrabold text-gray-900">{formatNaira(b.price)}</div>
                  <div className="text-[10px] text-gray-600">(Price per item)</div>
                  <div className="text-[10px] text-gray-500">Incl. 20% VAT, excl. delivery cost</div>
                  <p className="mt-1 text-[12px] leading-5 text-gray-600">Lorem ipsum dolor sit amet consectetur. In orci amet nulla euismod amet. Odio cursus egestas viverra dictum varius.</p>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <button className="inline-flex items-center gap-2 rounded-md bg-[#F7CD3A] px-3 py-2 text-[13px] font-semibold text-[#201A2B] ring-1 ring-black/10">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
                    ADD TO CARD
                  </button>
                  <div className="inline-flex overflow-hidden rounded-md ring-1 ring-black/10">
                    <button className="h-8 w-8">‹</button>
                    <div className="grid h-8 w-8 place-content-center text-[12px]">2</div>
                    <button className="h-8 w-8">›</button>
                  </div>
                  <button className="inline-flex h-8 w-8 items-center justify-center rounded-md ring-1 ring-black/10">⋯</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top brands row */}
        <div className="mx-auto mt-10 max-w-7xl">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-gray-900">Top brands</h3>
            <a href="#" className="text-xs text-brand">View all ⟲</a>
          </div>
          <div className="mt-3 flex items-center justify-between gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
            {BRANDS.map((b) => (
              <div key={b.name} className="shrink-0">
                <img src={b.logo} alt={b.name} className="h-12 w-auto object-contain" />
              </div>
            ))}
          </div>
        </div>

        {/* Weather CTA */}
        <div className="mt-6 rounded-2xl bg-[#F6F3FB] p-4 sm:p-6">
          <div className="grid gap-4 md:grid-cols-[minmax(280px,1fr)_1fr]">
            <div className="overflow-hidden rounded-lg bg-white">
              <img src={tyreImg} alt="Winter Tyres" className="h-56 w-full object-cover" />
              <div className="p-4">
                <div className="text-[14px] font-semibold text-gray-900">Winter Car Tyres</div>
                <div className="text-[22px]">❄️</div>
              </div>
            </div>
            <div className="grid content-center gap-3">
              <h3 className="text-[20px] font-semibold text-gray-900">Drive Confidently in Any Weather</h3>
              <p className="text-[13px] leading-6 text-gray-700">From blazing summers to icy winters and everything in between, Gapa offers tyres designed to deliver maximum safety, durability, and performance for every season.</p>
              <button className="w-fit rounded-md bg-brand px-5 py-2 text-[13px] font-semibold text-white">GET STARTED</button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[['Summer Car Tyres','☀️'],['All Weather Tyres','🌤️']].map(([t,icon]) => (
              <div key={t} className="overflow-hidden rounded-lg bg-white">
                <img src={tyreImg} alt={t} className="h-48 w-full object-cover" />
                <div className="p-4">
                  <div className="text-[14px] font-semibold text-gray-900">{t}</div>
                  <div className="text-[22px]">{icon}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <section className="mx-auto max-w-7xl px-1 py-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-brand ring-1 ring-black/10">Testimonial</div>
              <h2 className="text-[22px] font-semibold text-gray-900">What Our Customers Are Saying</h2>
            </div>
            <button className="rounded-md bg-[#F7CD3A] px-4 py-2 text-[13px] font-semibold text-[#201A2B]">View All →</button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-10 w-10 rounded-full bg-[#EEE]" />
                  <div>
                    <div className="text-[13px] font-semibold text-gray-900">Artemisia Udinese</div>
                    <div className="text-[11px] text-gray-500">Car Owner</div>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-5 text-gray-700">I found the exact brake pads I needed at half the price of my local store. Delivery was fast, and the parts fit perfectly. Gapa is now my go-to for car parts!</p>
                <div className="mt-2 text-[#FFB400]">★★★★★</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
