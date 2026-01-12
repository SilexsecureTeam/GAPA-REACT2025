import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllBrands, getModelsByBrandId, getSubModelsByModelId } from '../services/api'
import { VEHICLE_FILTER_KEY, getPersistedVehicleFilter, setPersistedVehicleFilter, type VehicleFilterState } from '../services/vehicle'

export type VehicleFilterProps = {
  onSearch?: (url: string) => void
  onChange?: (state: VehicleFilterState) => void
  className?: string
}

export default function VehicleFilter({ onSearch, onChange, className = '' }: VehicleFilterProps) {
  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false)

  const [loadingBrands, setLoadingBrands] = useState(true)
  const [brands, setBrands] = useState<any[]>([])
  const [models, setModels] = useState<any[]>([])
  const [subModels, setSubModels] = useState<any[]>([])

  const [brandId, setBrandId] = useState('')
  const [modelId, setModelId] = useState('')
  const [engineId, setEngineId] = useState('')
  const [brandName, setBrandName] = useState('')
  const [modelName, setModelName] = useState('')
  const [engineName, setEngineName] = useState('')

  const [busy] = useState(false)

  // Track previous selections to distinguish hydration vs. user changes
  const prevBrandIdRef = useRef<string>('')
  const prevModelIdRef = useRef<string>('')

  // Hydrate initial state
  useEffect(() => {
    const saved = getPersistedVehicleFilter()
    if (saved.brandId) setBrandId(saved.brandId)
    if (saved.modelId) setModelId(saved.modelId)
    if (saved.engineId) setEngineId(saved.engineId)
    if (saved.brandName) setBrandName(saved.brandName)
    if (saved.modelName) setModelName(saved.modelName)
    if (saved.engineName) setEngineName(saved.engineName)
  }, [])

  // Persist on change + notify parent
  useEffect(() => {
    const next: VehicleFilterState = { brandId, modelId, engineId, brandName, modelName, engineName }
    setPersistedVehicleFilter(next)
    if (onChange) onChange(next)
  }, [brandId, modelId, engineId, brandName, modelName, engineName, onChange])

  // Load brands
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoadingBrands(true)
        const res = await getAllBrands()
        if (!alive) return
        setBrands(Array.isArray(res) ? res : [])
      } catch {
        if (!alive) return
        setBrands([])
      } finally {
        if (alive) setLoadingBrands(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Load models on brand change (reset dependents only on true user change)
  useEffect(() => {
    let alive = true
    const brandChangedByUser = prevBrandIdRef.current && prevBrandIdRef.current !== brandId
    if (brandChangedByUser) {
      setModels([]); setSubModels([]); setModelId(''); setEngineId(''); setModelName(''); setEngineName('')
    }
    prevBrandIdRef.current = brandId
    if (!brandId) return () => { alive = false }
    ;(async () => {
      try {
        const res = await getModelsByBrandId(brandId)
        if (!alive) return
        setModels(Array.isArray(res) ? res : [])
      } catch {
        if (!alive) return
        setModels([])
      }
    })()
    return () => { alive = false }
  }, [brandId])

  // Validate saved model against fetched models (only validate once models are loaded)
  useEffect(() => {
    if (!brandId || !modelId || models.length === 0) return
    const exists = (models || []).some((m: any) => String((m?.id ?? m?.model_id) ?? '') === modelId)
    if (!exists) { setModelId(''); setModelName(''); setEngineId(''); setEngineName('') }
  }, [brandId, models, modelId])

  // Load engines on model change (reset engine only on true user change)
  useEffect(() => {
    let alive = true
    const modelChangedByUser = prevModelIdRef.current && prevModelIdRef.current !== modelId
    if (modelChangedByUser) { setSubModels([]); setEngineId(''); setEngineName('') }
    prevModelIdRef.current = modelId
    if (!modelId) return () => { alive = false }
    ;(async () => {
      try {
        const res = await getSubModelsByModelId(modelId)
        if (!alive) return
        setSubModels(Array.isArray(res) ? res : [])
      } catch {
        if (!alive) return
        setSubModels([])
      }
    })()
    return () => { alive = false }
  }, [modelId])

  // Validate saved engine against fetched engines (do not clear saved engine name)
  useEffect(() => {
    if (!modelId || !engineId) return
    const exists = (subModels || []).some((e: any) => String((e?.id ?? e?.sub_model_id) ?? '') === engineId)
    if (!exists) { setEngineId('') /* keep engineName as placeholder */ }
  }, [modelId, subModels, engineId])

  const brandOptions = useMemo(() => (
    (brands || [])
      .map((b: any) => ({ value: String(b?.id ?? b?.brand_id ?? ''), label: String(b?.name || b?.title || '') }))
      .filter((o: any) => o.value && o.label)
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  ), [brands])

  const modelOptions = useMemo(() => (
    (models || [])
      .map((m: any) => ({ value: String(m?.id ?? m?.model_id ?? ''), label: String(m?.name || m?.model_name || m?.model || '') }))
      .filter((o: any) => o.value && o.label)
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  ), [models])

  const engineOptions = useMemo(() => (
    (subModels || [])
      .map((e: any) => {
        const name = String(e?.name || e?.engine || e?.trim || e?.submodel_name || e?.sub_model_name || '')
        const year = e?.year
        const year2 = e?.year_2
        let yearLabel = ''
        
        if (year && year2) {
          yearLabel = year === year2 ? ` (${year})` : ` (${year} - ${year2})`
        } else if (year) {
          yearLabel = ` (${year})`
        }
        
        return { 
          value: String(e?.id ?? e?.sub_model_id ?? ''), 
          label: name + yearLabel
        }
      })
      .filter((o: any) => o.value && o.label)
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  ), [subModels])

  const brandLabelById = useMemo(() => { const m = new Map<string,string>(); for (const o of brandOptions) m.set(o.value, o.label); return (id: string) => m.get(id) || '' }, [brandOptions])
  const modelLabelById = useMemo(() => { const m = new Map<string,string>(); for (const o of modelOptions) m.set(o.value, o.label); return (id: string) => m.get(id) || '' }, [modelOptions])
  const engineLabelById = useMemo(() => { const m = new Map<string,string>(); for (const o of engineOptions) m.set(o.value, o.label); return (id: string) => m.get(id) || '' }, [engineOptions])

  useEffect(() => { if (brandId && !brandName) setBrandName(brandLabelById(brandId)) }, [brandId, brandName, brandLabelById])
  useEffect(() => { if (modelId && !modelName) setModelName(modelLabelById(modelId)) }, [modelId, modelName, modelLabelById])
  useEffect(() => { if (engineId && !engineName) setEngineName(engineLabelById(engineId)) }, [engineId, engineName, engineLabelById])

  const handleReset = () => {
    setBrandId(''); setModelId(''); setEngineId('')
    setBrandName(''); setModelName(''); setEngineName('')
    try { localStorage.removeItem(VEHICLE_FILTER_KEY) } catch {}
  }

  const handleSearch = async () => {
    setMobileOpen(false) // Close drawer on mobile search
    const url = `/parts?drill=1`
    if (onSearch) onSearch(url)
  }

  // Calculate progress (0-100%)
  const progress = useMemo(() => {
    let completed = 0
    if (brandId) completed += 33.33
    if (modelId) completed += 33.33
    if (engineId) completed += 33.34
    return Math.round(completed)
  }, [brandId, modelId, engineId])

  // Reusable Form Logic
  const FilterForm = () => (
    <div className="space-y-3">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[13px] font-extrabold tracking-wide text-[#201A2B] uppercase">
              SELECT YOUR VEHICLE
            </h4>
            <span className="text-[11px] font-bold text-gray-600">{progress}%</span>
          </div>
          
          {/* Progress Bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div 
              className="h-full bg-gradient-to-r from-[#F7CD3A] to-[#e6bd2a] transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step 1: Maker */}
        <div className="relative group">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${brandId ? 'bg-[#F7CD3A] text-[#201A2B]' : 'bg-gray-300 text-gray-600'}`}>1</span>
              Maker
            </span>
          </label>
          <select
            value={brandId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setBrandId(v); setBrandName(brandLabelById(v)) }}
            disabled={loadingBrands}
            className="h-11 w-full appearance-none rounded-lg border-2 border-gray-300 bg-white px-3 pr-10 text-[13px] font-medium text-gray-900 outline-none transition-all focus:border-[#F7CD3A] focus:ring-2 focus:ring-[#F7CD3A]/20 disabled:opacity-60 disabled:cursor-not-allowed group-hover:border-gray-400"
          >
            <option value="" disabled hidden>{brandName || 'Select Maker'}</option>
            {brandOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute right-3 bottom-[10px] inline-flex items-center text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>

        {/* Step 2: Model */}
        <div className="relative group">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${modelId ? 'bg-[#F7CD3A] text-[#201A2B]' : 'bg-gray-300 text-gray-600'}`}>2</span>
              Model
            </span>
          </label>
          <select
            value={modelId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setModelId(v); setModelName(modelLabelById(v)) }}
            disabled={!brandId}
            className="h-11 w-full appearance-none rounded-lg border-2 border-gray-300 bg-white px-3 pr-10 text-[13px] font-medium text-gray-900 outline-none transition-all focus:border-[#F7CD3A] focus:ring-2 focus:ring-[#F7CD3A]/20 disabled:opacity-60 disabled:cursor-not-allowed group-hover:border-gray-400"
          >
            <option value="" disabled hidden>{modelName || 'Select Model'}</option>
            {modelOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute right-3 bottom-[10px] inline-flex items-center text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>

        {/* Step 3: Engine */}
        <div className="relative group">
          <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-gray-700">
            <span className="inline-flex items-center gap-1.5">
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${engineId ? 'bg-[#F7CD3A] text-[#201A2B]' : 'bg-gray-300 text-gray-600'}`}>3</span>
              Engine
            </span>
          </label>
          <select
            value={engineId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setEngineId(v); setEngineName(engineLabelById(v)) }}
            disabled={!brandId || !modelId}
            className="h-11 w-full appearance-none rounded-lg border-2 border-gray-300 bg-white px-3 pr-10 text-[13px] font-medium text-gray-900 outline-none transition-all focus:border-[#F7CD3A] focus:ring-2 focus:ring-[#F7CD3A]/20 disabled:opacity-60 disabled:cursor-not-allowed group-hover:border-gray-400"
          >
            <option value="" disabled hidden>{engineName || (engineOptions.length ? 'Select Engine' : 'Base')}</option>
            {engineOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute right-3 bottom-[10px] inline-flex items-center text-gray-600">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {onSearch && (
            <button 
              onClick={handleSearch} 
              disabled={busy || !brandId || !modelId} 
              className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#F7CD3A] to-[#e6bd2a] text-[13px] font-bold uppercase tracking-wide text-[#201A2B] shadow-md ring-1 ring-[#F7CD3A]/50 transition-all hover:shadow-lg hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {busy ? 'Loading…' : 'Select Category'}
            </button>
          )}
          
          <button 
            onClick={handleReset} 
            className="flex-shrink-0 h-10 px-3 rounded-lg border-2 border-gray-300 bg-white text-[13px] font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
            title="Reset vehicle selection"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
    </div>
  )

  return (
    <>
      <div className="lg:hidden w-full mb-6 px-1">
         <button
            onClick={() => setMobileOpen(true)}
            className={`group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-[#201A2B] p-4 text-left shadow-xl shadow-[#201A2B]/20 ring-1 ring-white/10 transition-all active:scale-[0.98] ${className}`}
         >
            {/* Decorator background element */}
            <div className="absolute top-0 right-0 -mt-4 -mr-4 h-24 w-24 rounded-full bg-white/5 blur-xl transition-all group-hover:bg-white/10"></div>
            
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#F7CD3A] text-[#201A2B] shadow-sm ring-2 ring-[#201A2B] ring-offset-2 ring-offset-[#F7CD3A]/50">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F7CD3A]">Vehicle Filter</span>
                <span className="font-bold text-white text-[15px] leading-tight truncate max-w-[200px]">
                   {brandName ? (
                     <span className="flex items-center gap-1">
                       {brandName} <span className="opacity-50">•</span> {modelName || 'Any Model'}
                     </span>
                   ) : 'Select your vehicle'}
                </span>
              </div>
            </div>
            
            <div className="relative rounded-full bg-white/10 p-2 text-white/70 transition-colors group-hover:bg-white/20 group-hover:text-white">
               <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                 <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
               </svg>
            </div>
         </button>
      </div>

      {/* MOBILE DRAWER: Fixed Overlay (Hidden on Desktop) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
             <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
               <h3 className="text-lg font-bold text-gray-900">Select Vehicle</h3>
               <button onClick={() => setMobileOpen(false)} className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200">
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
               </button>
             </div>
             <div className="flex-1 overflow-y-auto px-5 py-6">
                {FilterForm()}
             </div>
          </div>
        </div>
      )}
      {/* DESKTOP VIEW: Sidebar Card (Hidden on Mobile) */}
      <div className={`hidden lg:block rounded-xl bg-gradient-to-br from-white via-[#FFFBF0] to-white p-5 ring-2 ring-[#F7CD3A]/40 shadow-md ${className}`}>
        {FilterForm()}
      </div>
    </>
  )
}
