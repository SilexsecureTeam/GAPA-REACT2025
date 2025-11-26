import { useEffect, useState, useMemo, useRef } from 'react'
import { getModelsByBrandId, getSubModelsByModelId, getAllBrands, getAllCategories } from '../services/api'
import { useNavigate } from 'react-router-dom'
import { setPersistedVehicleFilter, type VehicleFilterState } from '../services/vehicle'
import { carImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

type Model = {
  id: number
  name: string
  slug?: string
  year?: number
  year_2?: number
  img_url?: string | null
  car_id: string
}

type SubModel = {
  id: number
  name: string
  slug?: string
  year?: number
  year_2?: number
  img_url?: string | null
  car_id: string
}

type BrandDrilldownProps = {
  brandId: string
  onComplete?: (state: VehicleFilterState) => void
  onFilterChange?: (filter: { categoryId?: string; q?: string }) => void
  className?: string
}

export default function BrandDrilldown({ brandId, onComplete, onFilterChange, className = '' }: BrandDrilldownProps) {
  const [brandName, setBrandName] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [subModels, setSubModels] = useState<SubModel[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const pageSize = 12
  const lastEmittedRef = useRef<string | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('')
  const navigate = useNavigate()
  
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedModelName, setSelectedModelName] = useState<string>('')
  const [selectedSubModelId, setSelectedSubModelId] = useState<string>('')
  const [selectedSubModelName, setSelectedSubModelName] = useState<string>('')
  const [showCategorySelection, setShowCategorySelection] = useState(false)
  
  const [loadingModels, setLoadingModels] = useState(true)
  const [loadingSubModels, setLoadingSubModels] = useState(false)

  // Fetch brand name
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const brands = await getAllBrands()
        const arr = Array.isArray(brands) ? brands : []
        const brand = arr.find((b: any) => String((b as any)?.car_id || (b as any)?.id || '') === brandId)
        if (!alive) return
        if (brand) setBrandName(String((brand as any)?.name || (brand as any)?.title || 'Brand'))
      } catch {
        if (!alive) return
      }
    })()
    return () => { alive = false }
  }, [brandId])

  // Fetch models when brandId changes
  useEffect(() => {
    let alive = true
    setLoadingModels(true)
    setModels([])
    setSubModels([])
    setSelectedModelId('')
    setSelectedModelName('')
    setSelectedSubModelId('')
    setSelectedSubModelName('')
    
    ;(async () => {
      try {
        const res = await getModelsByBrandId(brandId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        // Sort models alphabetically by name
        const sorted = arr.sort((a, b) => a.name.localeCompare(b.name))
        setModels(sorted)
      } catch (err) {
        console.error('Failed to fetch models:', err)
        if (!alive) return
        setModels([])
      } finally {
        if (alive) setLoadingModels(false)
      }
    })()
    
    return () => { alive = false }
  }, [brandId])

  // Fetch sub-models when a model is selected
  useEffect(() => {
    let alive = true
    if (!selectedModelId) {
      setSubModels([])
      setSelectedSubModelId('')
      setSelectedSubModelName('')
      return
    }
    
    setLoadingSubModels(true)
    setSubModels([])
    setSelectedSubModelId('')
    setSelectedSubModelName('')
    
    ;(async () => {
      try {
        const res = await getSubModelsByModelId(selectedModelId)
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        // Sort sub-models alphabetically by name
        const sorted = arr.sort((a, b) => a.name.localeCompare(b.name))
        setSubModels(sorted)
        
        // Scroll to sub-models section after loading
        setTimeout(() => {
          const subModelsElement = document.getElementById('sub-models-section')
          if (subModelsElement) {
            const yOffset = -180 // Offset for fixed header
            const y = subModelsElement.getBoundingClientRect().top + window.pageYOffset + yOffset
            window.scrollTo({ top: y, behavior: 'smooth' })
          }
        }, 100)
      } catch (err) {
        console.error('Failed to fetch sub-models:', err)
        if (!alive) return
        setSubModels([])
      } finally {
        if (alive) setLoadingSubModels(false)
      }
    })()
    
    return () => { alive = false }
  }, [selectedModelId])

  // Update vehicle filter and notify parent when selection changes
  useEffect(() => {
    if (!brandId) return
    // Wait for brandName to be fetched before updating filter
    if (!brandName) return

    const state: VehicleFilterState = {
      brandId,
      brandName,
      modelId: selectedModelId || undefined,
      modelName: selectedModelName || undefined,
      engineId: selectedSubModelId || undefined,
      engineName: selectedSubModelName || undefined,
    }

    // Avoid emitting identical state repeatedly (prevents update loops)
    try {
      const json = JSON.stringify(state)
      if (lastEmittedRef.current !== json) {
        lastEmittedRef.current = json
        console.log('🚗 BrandDrilldown updating filter:', state)
        setPersistedVehicleFilter(state)
        if (onComplete) onComplete(state)
      }
    } catch (e) {
      // fallback: always emit once
      console.log('🚗 BrandDrilldown updating filter (fallback):', state)
      setPersistedVehicleFilter(state)
      if (onComplete) onComplete(state)
    }
  }, [brandId, brandName, selectedModelId, selectedModelName, selectedSubModelId, selectedSubModelName, onComplete])

  const handleModelSelect = (model: Model) => {
    setSelectedModelId(String(model.id))
    setSelectedModelName(model.name)
    // reset pagination and search when selecting a model
    setPage(1)
    setSearchTerm('')
  }

  const handleSubModelSelect = (subModel: SubModel) => {
    setSelectedSubModelId(String(subModel.id))
    setSelectedSubModelName(subModel.name)
    setShowCategorySelection(true)
    
    // Scroll to category selection section after selection
    setTimeout(() => {
      const categorySelectionElement = document.getElementById('category-selection-section')
      if (categorySelectionElement) {
        const yOffset = -180 // Offset for fixed header
        const y = categorySelectionElement.getBoundingClientRect().top + window.pageYOffset + yOffset
        window.scrollTo({ top: y, behavior: 'smooth' })
      }
    }, 100)
  }

  // Notify parent when quick search or category selection changes
  // Notify parent when quick search or category selection changes.
  // Debounce and dedupe emissions and avoid emitting empty filters to prevent parent resets.
  const lastFilterEmittedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!onFilterChange) return
    const payload = { categoryId: selectedCategoryId || undefined, q: (searchTerm || undefined) }
    // Don't emit if both are empty
    if (!payload.categoryId && !payload.q) return
    try {
      const json = JSON.stringify(payload)
      if (lastFilterEmittedRef.current === json) return
      lastFilterEmittedRef.current = json
      const t = setTimeout(() => {
        onFilterChange(payload)
      }, 200)
      return () => clearTimeout(t)
    } catch (e) {
      // best-effort emit
      onFilterChange(payload)
    }
  }, [selectedCategoryId, searchTerm, onFilterChange])

  const getImageUrl = (model: Model | SubModel) => {
    const url = carImageFrom(model)
    return url || logoImg
  }

  const resetSelection = () => {
    setSelectedModelId('')
    setSelectedModelName('')
    setSelectedSubModelId('')
    setSelectedSubModelName('')
    setSubModels([])
    setShowCategorySelection(false)
    setSearchTerm('')
    setPage(1)
  }

  // Derived filtered models for search + pagination
  const filteredModels = useMemo(() => {
    const q = (searchTerm || '').trim().toLowerCase()
    if (!q) return models
    return models.filter(m => String(m.name || '').toLowerCase().includes(q))
  }, [models, searchTerm])

  const pagedModels = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredModels.slice(start, start + pageSize)
  }, [filteredModels, page])

  // Fetch categories when category selection is shown
  useEffect(() => {
    let alive = true
    if (!showCategorySelection) return
    ;(async () => {
      try {
        const res = await getAllCategories()
        if (!alive) return
        const arr = Array.isArray(res) ? res : []
        setCategories(arr)
      } catch (e) {
        if (!alive) return
        setCategories([])
      }
    })()
    return () => { alive = false }
  }, [showCategorySelection])

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Brand Header */}
      <div className="rounded-xl bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] p-5 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-90">Selected Brand</p>
            <h3 className="mt-1 text-[20px] font-bold">{brandName || 'Loading...'}</h3>
          </div>
          {selectedModelId && (
            <button
              onClick={resetSelection}
              className="rounded-lg bg-white/20 px-3 py-2 text-[12px] font-semibold hover:bg-white/30 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
        
        {/* Progress indicator */}
        <div className="mt-4 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${brandId ? 'bg-white' : 'bg-white/40'}`} />
          <div className="h-0.5 w-8 bg-white/40" />
          <div className={`h-2 w-2 rounded-full ${selectedModelId ? 'bg-white' : 'bg-white/40'}`} />
          <div className="h-0.5 w-8 bg-white/40" />
          <div className={`h-2 w-2 rounded-full ${selectedSubModelId ? 'bg-white' : 'bg-white/40'}`} />
        </div>
      </div>

      {/* Models Grid */}
      {loadingModels ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#F7CD3A] border-t-transparent" />
            <p className="mt-3 text-[13px] text-gray-600">Loading models...</p>
          </div>
        </div>
      ) : models.length === 0 ? (
        <div className="rounded-xl bg-gray-50 p-8 text-center ring-1 ring-black/5">
          <p className="text-[14px] text-gray-600">No models found for this brand.</p>
        </div>
      ) : (
        <div>
          <h4 className="mb-4 text-[16px] font-black text-gray-900 uppercase tracking-wide">
            {selectedModelId ? 'Selected Model' : 'Select a Model'}
          </h4>

          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="modelSearch" className="sr-only">Search models</label>
              <input id="modelSearch" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }} placeholder="Search models by name" className="h-10 w-64 rounded-md bg-gray-50 px-3 text-sm ring-1 ring-black/5" />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{filteredModels.length} model{filteredModels.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {pagedModels.map((model) => {
              const isSelected = selectedModelId === String(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model)}
                  className={`group relative overflow-hidden rounded-2xl p-2 text-left transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] ring-2 ring-[#F7CD3A] shadow-xl scale-105'
                      : 'hover:shadow-lg hover:scale-102'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F7CD3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <div className="flex flex-col items-center text-center">
                    <div className={`flex h-40 w-40 items-center justify-center overflow-hidden rounded-xl ${
                      isSelected ? 'bg-white/20' : 'bg-gray-50'
                    } ring-1 ring-black/5 mb-3`}>
                      <img
                        src={getImageUrl(model)}
                        alt={model.name}
                        className="h-full w-full object-contain p-2"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
                      />
                    </div>
                    <p className={`text-[15px] font-black ${isSelected ? 'text-[#201A2B]' : 'text-gray-900'} leading-tight`}>
                      {model.name}
                    </p>
                    {(model.year || model.year_2) && (
                      <p className={`mt-1 text-[12px] font-semibold ${isSelected ? 'text-[#201A2B]/70' : 'text-gray-600'}`}>
                        {model.year && model.year_2 ? `${model.year} - ${model.year_2}` : model.year || model.year_2}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sub-Models Grid (shown after model selection) */}
      {selectedModelId && (
        <div id="sub-models-section">
          <h4 className="mb-4 text-[16px] font-black text-gray-900 uppercase tracking-wide">
            {selectedSubModelId ? 'Selected Sub-Model' : 'Select a Sub-Model (Optional)'}
          </h4>
          {loadingSubModels ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#F7CD3A] border-t-transparent" />
                <p className="mt-3 text-[13px] text-gray-600">Loading sub-models...</p>
              </div>
            </div>
          ) : subModels.length === 0 ? (
            <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 text-center ring-1 ring-blue-200">
              <svg className="mx-auto h-12 w-12 text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[14px] font-semibold text-blue-900">No sub-models available</p>
              <p className="mt-1 text-[13px] text-blue-700">You can proceed with just the model selection</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {subModels.map((subModel) => {
                const isSelected = selectedSubModelId === String(subModel.id)
                return (
                  <button
                    key={subModel.id}
                    onClick={() => handleSubModelSelect(subModel)}
                    className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all ${
                      isSelected
                        ? 'bg-gradient-to-br from-[#F7CD3A] to-[#e6bd2a] ring-2 ring-[#F7CD3A] shadow-lg'
                        : 'bg-white ring-1 ring-black/10 hover:ring-[#F7CD3A] hover:shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F7CD3A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                        isSelected ? 'bg-white/20' : 'bg-[#F7CD3A]/10'
                      }`}>
                        <svg className={`h-6 w-6 ${isSelected ? 'text-[#201A2B]' : 'text-[#F7CD3A]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-bold ${isSelected ? 'text-[#201A2B]' : 'text-gray-900'} leading-tight`}>
                          {subModel.name}
                        </p>
                        {(subModel.year || subModel.year_2) && (
                          <p className={`mt-0.5 text-[12px] font-medium ${isSelected ? 'text-[#201A2B]/70' : 'text-gray-600'}`}>
                            {subModel.year && subModel.year_2 ? `${subModel.year} - ${subModel.year_2}` : subModel.year || subModel.year_2}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

  {/* Current Selection Summary (hidden when parent handles vehicle summary via onComplete) */}
  {selectedModelId && !showCategorySelection && !onComplete && (
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-4 ring-1 ring-green-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-green-900">
                Vehicle Selected
              </p>
              <div className="mt-1 space-y-0.5 text-[12px] text-green-800">
                <p><span className="font-semibold">Brand:</span> {brandName}</p>
                {selectedModelName && <p><span className="font-semibold">Model:</span> {selectedModelName}</p>}
                {selectedSubModelName && <p><span className="font-semibold">Sub-Model:</span> {selectedSubModelName}</p>}
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-md bg-white/60 px-3 py-2 text-[11px] text-green-900">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span className="font-medium">Select a sub-model to proceed</span>
              </div>
            </div>
          </div>
        </div>
      )}

  {/* Category Selection (shown after sub-model selection). If parent is handling drilldown filters, hide this block to avoid duplicate UI */}
  {showCategorySelection && !onFilterChange && (
        <div id="category-selection-section" className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 p-6 ring-1 ring-purple-200 shadow-sm">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-[15px] font-bold text-purple-900">
                Vehicle Selected Successfully!
              </p>
              <div className="mt-1 space-y-0.5 text-[12px] text-purple-800">
                <p><span className="font-semibold">Brand:</span> {brandName}</p>
                {selectedModelName && <p><span className="font-semibold">Model:</span> {selectedModelName}</p>}
                {selectedSubModelName && <p><span className="font-semibold">Sub-Model:</span> {selectedSubModelName}</p>}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white/60 p-4 border-2 border-dashed border-purple-300">
            <div className="flex items-center gap-2 text-purple-900 mb-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span className="font-bold text-[14px]">Vehicle Selected — Filters</span>
            </div>
            <p className="text-[13px] text-purple-800 mb-3">
              Compatible parts are now ready for <strong>{brandName} {selectedModelName}</strong>. Use the quick filters below to narrow results before viewing the parts.
            </p>

            <div className="mb-3 flex items-center gap-2">
              <label htmlFor="partsQuickSearch" className="sr-only">Search parts</label>
              <input id="partsQuickSearch" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search parts by name, brand or manufacturer" className="h-10 w-full rounded-md bg-gray-50 px-3 text-sm ring-1 ring-black/5" />
            </div>

            <div className="mb-3">
              <div className="flex flex-wrap gap-2">
                {categories.slice(0, 12).map((c) => {
                  const cid = String((c as any)?.id ?? (c as any)?.category_id ?? '')
                  const name = String((c as any)?.name || (c as any)?.title || '')
                  const active = selectedCategoryId === cid
                  return (
                    <button key={cid} type="button" onClick={() => setSelectedCategoryId(active ? '' : cid)} className={`px-3 py-1 rounded-full text-sm ${active ? 'bg-purple-600 text-white' : 'bg-white ring-1 ring-black/5 text-purple-800'}`}>
                      {name}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => {
                // Build parts link with selected vehicle + category/search
                const params = new URLSearchParams()
                if (selectedCategoryId) params.set('catId', selectedCategoryId)
                if (brandId) params.set('brandId', String(brandId))
                if (selectedModelId) params.set('modelId', String(selectedModelId))
                if (selectedSubModelId) params.set('engineId', String(selectedSubModelId))
                if (searchTerm) params.set('q', searchTerm)
                navigate(`/parts?${params.toString()}`)
              }} className="inline-flex h-10 items-center justify-center rounded-md bg-purple-600 px-4 text-sm font-semibold text-white hover:brightness-105">View parts</button>

              <button onClick={() => { setSelectedCategoryId(''); setSearchTerm('') }} className="inline-flex h-10 items-center justify-center rounded-md bg-white border px-4 text-sm">Clear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
