import { useEffect, useMemo, useRef, useState } from 'react'
import { getAllBrands, getModelsByBrandId, getSubModelsByModelId } from '../services/api'
import { VEHICLE_FILTER_KEY, getPersistedVehicleFilter, setPersistedVehicleFilter, type VehicleFilterState } from '../services/vehicle'

export type VehicleFilterProps = {
  onSearch?: (url: string) => void
  onChange?: (state: VehicleFilterState) => void
  className?: string
}

export default function VehicleFilter({ onSearch, onChange, className = '' }: VehicleFilterProps) {
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

  // Validate saved model against fetched models (do not clear the saved names; only clear invalid IDs)
  useEffect(() => {
    if (!brandId || !modelId) return
    const exists = (models || []).some((m: any) => String((m?.id ?? m?.model_id) ?? '') === modelId)
    if (!exists) { setModelId(''); /* keep modelName as placeholder */ setEngineId(''); /* keep engineName */ }
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
      .map((b: any) => ({ value: String((b?.brand_id ?? b?.id) ?? ''), label: String(b?.name || b?.title || '') }))
      .filter((o: any) => o.value && o.label)
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  ), [brands])

  const modelOptions = useMemo(() => (
    (models || [])
      .map((m: any) => ({ value: String((m?.id ?? m?.model_id) ?? ''), label: String(m?.name || m?.model_name || m?.model || '') }))
      .filter((o: any) => o.value && o.label)
      .sort((a: any, b: any) => a.label.localeCompare(b.label))
  ), [models])

  const engineOptions = useMemo(() => (
    (subModels || [])
      .map((e: any) => ({ value: String((e?.id ?? e?.sub_model_id) ?? ''), label: String(e?.name || e?.engine || e?.trim || e?.submodel_name || e?.sub_model_name || '') }))
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
    const term = [brandName, modelName, engineName].filter(Boolean).join(' ').trim()
    if (!term) return
    const url = `/parts?drill=1`
    if (onSearch) onSearch(url)
  }

  return (
    <div className={`rounded-xl bg-white p-4 ring-1 ring-black/10 ${className}`}>
      <h4 className="text-[12px] font-bold tracking-wide text-white">
        <span className="inline-block rounded bg-brand px-2 py-1">SELECT VEHICLE</span>
      </h4>
      <div className="mt-3 space-y-3">
        <div className="relative">
          <select
            value={brandId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setBrandId(v); setBrandName(brandLabelById(v)) }}
            disabled={loadingBrands}
            className="h-11 w-full appearance-none rounded-md bg-gray-100 px-3 pr-10 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
          >
            <option value="" disabled hidden>{brandName || 'Select Maker'}</option>
            {brandOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
        <div className="relative">
          <select
            value={modelId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setModelId(v); setModelName(modelLabelById(v)) }}
            disabled={!brandId}
            className="h-11 w-full appearance-none rounded-md bg-gray-100 px-3 pr-10 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
          >
            <option value="" disabled hidden>{modelName || 'Select Model'}</option>
            {modelOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
        <div className="relative">
          <select
            value={engineId}
            onChange={(e)=>{ const v=(e.target as HTMLSelectElement).value; setEngineId(v); setEngineName(engineLabelById(v)) }}
            disabled={!brandId || !modelId}
            className="h-11 w-full appearance-none rounded-md bg-gray-100 px-3 pr-10 text-sm text-gray-800 outline-none ring-1 ring-gray-200 focus:bg-white focus:ring-gray-300 disabled:opacity-60"
          >
            <option value="" disabled hidden>{engineName || (engineOptions.length ? 'Select Engine' : 'Base')}</option>
            {engineOptions.map((o)=> (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-gray-500">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </span>
        </div>
        {onSearch && (
          <button onClick={handleSearch} disabled={busy || !brandId || !modelId} className="mt-1 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 disabled:opacity-60">{busy ? 'Searching…' : 'Search'}</button>
        )}
        <button onClick={handleReset} className="h-9 w-full rounded-md bg-gray-100 text-[12px] font-medium ring-1 ring-black/10">Reset vehicle</button>
      </div>
    </div>
  )
}
