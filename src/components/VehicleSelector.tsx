import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllBrands, getModelsByBrandId, getSubModelsByModelId, liveSearch, type ApiBrand } from '../services/api'

// Local helpers (aligned with Home.tsx)
function unwrap<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && Array.isArray(res.data)) return res.data as T[]
  if (res && res.data && typeof res.data === 'object') {
    for (const k of Object.keys(res.data)) {
      const v = (res.data as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}
function brandNameOf(b: any): string { return String(b?.name || b?.title || b?.brand_name || b?.brand || '').trim() || 'Brand' }
function modelNameOf(m: any): string { return String(m?.name || m?.model_name || m?.model || m?.title || '').trim() || 'Model' }
function engineNameOf(e: any): string { return String(e?.name || e?.engine || e?.trim || e?.sub_model_name || e?.submodel_name || e?.title || '').trim() || 'Engine' }

export default function VehicleSelector({ withHeader = false }: { withHeader?: boolean }) {
  const navigate = useNavigate()

  // State
  const [brands, setBrands] = useState<ApiBrand[]>([])
  const [models, setModels] = useState<any[]>([])
  const [subModels, setSubModels] = useState<any[]>([])
  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [engineId, setEngineId] = useState('')
  const [brandName, setBrandName] = useState('')
  const [modelName, setModelName] = useState('')
  const [engineName, setEngineName] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getAllBrands()
        if (!alive) return
        setBrands(unwrap<ApiBrand>(res))
      } catch (_) {
        setBrands([])
      }
    })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    if (!brandId) { setModels([]); setSubModels([]); return }
    ;(async () => {
      try {
        const res = await getModelsByBrandId(brandId)
        if (!alive) return
        setModels(unwrap<any>(res))
      } catch { setModels([]) }
    })()
    return () => { alive = false }
  }, [brandId])

  useEffect(() => {
    let alive = true
    if (!modelId) { setSubModels([]); return }
    ;(async () => {
      try {
        const res = await getSubModelsByModelId(modelId)
        if (!alive) return
        setSubModels(unwrap<any>(res))
      } catch { setSubModels([]) }
    })()
    return () => { alive = false }
  }, [modelId])

  const brandOptions = useMemo(() => (
    brands
      .map((b) => ({ value: String((b as any)?.id ?? ''), label: brandNameOf(b) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [brands])

  const modelOptions = useMemo(() => (
    models
      .map((m) => ({ value: String((m as any)?.id ?? (m as any)?.model_id ?? ''), label: modelNameOf(m) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [models])

  const engineOptions = useMemo(() => (
    subModels
      .map((e) => ({ value: String((e as any)?.id ?? (e as any)?.sub_model_id ?? ''), label: engineNameOf(e) }))
      .filter((o) => o.value && o.label)
      .sort((a,b)=>a.label.localeCompare(b.label))
  ), [subModels])

  const brandLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of brandOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [brandOptions])
  const modelLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of modelOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [modelOptions])
  const engineLabelById = useMemo(() => {
    const m = new Map<string,string>()
    for (const o of engineOptions) m.set(o.value, o.label)
    return (id: string) => m.get(id) || ''
  }, [engineOptions])

  const onSearchParts = async (e: React.FormEvent) => {
    e.preventDefault()
    const term = [brandName, modelName, engineName].filter(Boolean).join(' ').trim()
    if (!term) return
    const list = await liveSearch(term)
    const arr = Array.isArray(list) ? list : (list as any)?.data
    const items = Array.isArray(arr) ? arr : []
    const brandSlug = (brandName || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'gapa'
    const partSlug = (modelName || 'part').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
    if (items.length === 0) {
      navigate(`/parts/${brandSlug}/${partSlug}?q=${encodeURIComponent(term)}`)
      return
    }
    const first = items[0]
    const pid = String(first?.id || first?.product_id || '')
    const brand = String(first?.brand || first?.manufacturer || brandName || 'gapa')
    const part = String(first?.name || first?.product_name || modelName || 'part')
    navigate(`/parts/${brand.toLowerCase().replace(/[^a-z0-9]+/g,'-')}/${part.toLowerCase().replace(/[^a-z0-9]+/g,'-')}?pid=${encodeURIComponent(pid)}`)
  }

  const onSearchReg = (e: React.FormEvent) => {
    e.preventDefault()
    const term = [brandName, modelName, engineName].filter(Boolean).join(' ').trim()
    if (!term) return
    alert(`Searching parts for reg: ${term}`)
  }

  function StepBadge({ n }: { n: number }) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-brand ring-1 ring-black/10">{n}</span>
    )
  }

  const Inner = (
    <>
      <form onSubmit={onSearchParts} className="space-y-5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2 top-4 bottom-3 hidden w-[5px] bg-[#5A1E78] sm:block" aria-hidden />
          <div className="space-y-5 font-semibold">
            { [
              {
                label: 'Select Maker',
                value: brandId,
                options: brandOptions,
                disabled: false,
                onChange: (val: string) => {
                  setBrandId(val)
                  setBrandName(brandLabelById(val))
                  setModelId(''); setModelName('')
                  setEngineId(''); setEngineName('')
                }
              },
              {
                label: 'Select Model',
                value: modelId,
                options: modelOptions,
                disabled: !brandId,
                onChange: (val: string) => {
                  setModelId(val)
                  setModelName(modelLabelById(val))
                  setEngineId(''); setEngineName('')
                }
              },
              {
                label: 'Select Engine',
                value: engineId,
                options: engineOptions,
                disabled: !modelId,
                onChange: (val: string) => {
                  setEngineId(val)
                  setEngineName(engineLabelById(val))
                }
              }
            ].map((f, idx) => (
              <div key={idx} className="grid grid-cols-[20px_1fr] items-center gap-3">
                <div className="hidden sm:block z-20"><StepBadge n={idx + 1} /></div>
                <div className="relative">
                  <select
                    aria-label={f.label}
                    value={f.value}
                    onChange={(e) => f.onChange((e.target as HTMLSelectElement).value)}
                    disabled={f.disabled}
                    className="h-12 w-full appearance-none rounded-md bg-gray-100 px-3 pr-9 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
                  >
                    <option value="" disabled hidden>{f.label}</option>
                    {f.options.map((o: any) => (
                      <option key={`${f.label}-${o.value}`} value={o.value}>{o.label}</option>
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Search
        </button>
      </form>
      <div className="pt-4 space-y-3">
        <label className="mb-5 block text-xs font-semibold uppercase tracking-wide text-gray-700">Enter your registration below</label>
        <form onSubmit={onSearchReg} className="flex gap-2">
          <input value={[brandName, modelName, engineName].filter(Boolean).join(' ')} onChange={() => {}} placeholder="Your Reg" className="h-10 w-full rounded-md bg-gray-100 px-3 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300" readOnly />
          <button type="submit" className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-[#201A2B] ring-1 ring-black/5">Search</button>
        </form>
        <a href="#" className="mt-2 block text-sm font-medium text-brand underline">Can't Find Your Car in the Catalogue?</a>
      </div>
    </>
  )

  if (withHeader) {
    return (
      <div className="md:min-w-[400px] overflow-hidden rounded-[8px] bg-white shadow-md ring-1 ring-black/10">
        <div className="flex items-center justify-between bg-[#4B1B76] px-4 py-3 text-white">
          <div className="inline-flex items-center gap-2">
            <span className="text-[15px] font-semibold">Select Vehicle</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          <button type="button" className="rounded-md p-1.5 hover:bg-white/10" aria-label="Reset">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.13-3.36L23 10" /><path d="M20.49 15a9 9 0 01-14.13 3.36L1 14" /></svg>
          </button>
        </div>
        <div className="p-4 md:p-5">
          {Inner}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[8px] md:justify-self-end md:min-w-[400px] bg-white p-4 shadow-md ring-1 ring-black/10 md:p-5">
      {Inner}
    </div>
  )
}
