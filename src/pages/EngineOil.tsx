import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import brand1 from '../assets/brand1.png'
import brand2 from '../assets/brand2.png'
import brand3 from '../assets/brand3.png'
import brand4 from '../assets/brand4.png'
import brand5 from '../assets/brand5.png'
import brand6 from '../assets/brand6.png'

function Step({ n }: { n: number }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-brand ring-1 ring-black/10">{n}</span>
  )
}

export default function EngineOil() {
  // Left requirements
  const [sae, setSae] = useState('All')
  const [brand, setBrand] = useState('All')
  const [oem, setOem] = useState('All')
  const [spec, setSpec] = useState('All')

  // Right finder
  const [maker, setMaker] = useState('BMW')
  const [model, setModel] = useState('1 Convertible E88(03/..')
  const [engine, setEngine] = useState('Select Engine')

  const BRANDS = useMemo(() => ([
    { name: 'BMW', logo: brand1 },
    { name: 'Vaxhaul', logo: brand2 },
    { name: 'Audi', logo: brand3 },
    { name: 'Ford', logo: brand4 },
    { name: 'Mercedes-Benz', logo: brand5 },
    { name: 'Toyota', logo: brand6 },
  ]), [])

  const onSearchRequirements = (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Searching engine oils: SAE=${sae}, Brand=${brand}, OEM=${oem}, Spec=${spec}`)
  }

  const onSearchFinder = (e: React.FormEvent) => {
    e.preventDefault()
    alert(`Finding oils for: ${maker} • ${model} • ${engine}`)
  }

  const resetReq = () => { setSae('All'); setBrand('All'); setOem('All'); setSpec('All') }
  const resetFinder = () => { setMaker('BMW'); setModel('1 Convertible E88(03/..'); setEngine('Select Engine') }

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6">
        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[26px] font-semibold text-gray-900 sm:text-[28px]">Premium Engine Oils for Diesel & Petrol Cars</h1>
          <p className="mx-auto mt-2 max-w-3xl text-[13px] leading-5 text-gray-600">Keep your engine running smoothly with high-performance oils designed for maximum protection, efficiency, and durability.</p>
        </div>

        {/* Two column layout */}
        <div className="mt-7 grid gap-8 md:grid-cols-2">
          {/* Left: requirements */}
          <form onSubmit={onSearchRequirements} className="rounded-2xl bg-white p-5 ring-1 ring-black/10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-gray-900">Select engine oil requirements</h2>
              <button type="button" onClick={resetReq} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand hover:bg-brand/10" aria-label="Reset filters">↻</button>
            </div>

            {/* Fields */}
            <div className="space-y-4">
              {[{ label: 'SAE viscosity grade', value: sae, set: setSae }, { label: 'Brand', value: brand, set: setBrand }, { label: 'OEM recommendations', value: oem, set: setOem }, { label: 'Specification', value: spec, set: setSpec }].map((f) => (
                <div key={f.label}>
                  <label className="text-[12px] font-semibold text-gray-900">{f.label}</label>
                  <div className="relative mt-1">
                    <select value={f.value} onChange={(e)=> (f.set as any)(e.target.value)} className="h-10 w-full appearance-none rounded-md bg-[#F3F1F6] px-3 pr-9 text-sm ring-1 ring-black/10 outline-none">
                      <option>All</option>
                      <option>5W-30</option>
                      <option>10W-40</option>
                      <option>0W-20</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-700">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </span>
                  </div>
                </div>
              ))}

              <button type="submit" className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search
              </button>
            </div>
          </form>

          {/* Right: finder card (mirrors tyres finder styling) */}
          <form onSubmit={onSearchFinder} className="rounded-2xl bg-[#F7F5FB] p-0 ring-1 ring-black/10">
            <div className="flex items-center justify-between rounded-t-xl bg-brand px-4 py-2 text-white">
              <div className="flex items-center gap-2 text-[13px] font-bold">Tyre finder: Select Vehicle <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg></div>
              <button type="button" onClick={resetFinder} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15" aria-label="Reset finder">↻</button>
            </div>
            <div className="px-4 py-4">
              {[{ label: maker, set: setMaker }, { label: model, set: setModel }, { label: engine, set: setEngine }].map((row, idx) => (
                <div key={idx} className="mb-3 grid grid-cols-[18px_1fr_34px] items-center gap-2">
                  <div className="hidden sm:block"><Step n={idx + 1} /></div>
                  <div className="relative">
                    <select value={row.label} onChange={(e)=> (row.set as any)(e.target.value)} className="h-10 w-full appearance-none rounded-md bg-white/70 px-3 pr-9 text-sm text-gray-800 outline-none ring-1 ring-black/10">
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

              <button type="submit" className="mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Search
              </button>

              <hr className="my-4 border-black/10" />

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wide text-brand">Enter your registration below</label>
                <div className="flex gap-2">
                  <input placeholder="Your Reg" className="h-10 w-full rounded-md bg-white px-3 text-sm ring-1 ring-black/10 outline-none" />
                  <button type="button" className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-[#201A2B] ring-1 ring-black/10">Search</button>
                </div>
                <Link to="#" className="text-sm font-medium text-brand underline">Can't Find Your Car In The Catalogue?</Link>
              </div>
            </div>
          </form>
        </div>

        {/* Top brands */}
        <div className="mt-8">
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
      </section>
    </div>
  )
}
