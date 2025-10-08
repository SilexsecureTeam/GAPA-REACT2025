import { useEffect, useState } from 'react'
import { getModelsByBrandId, getSubModelsByModelId, getAllBrands } from '../services/api'
import { setPersistedVehicleFilter, type VehicleFilterState } from '../services/vehicle'
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
  className?: string
}

export default function BrandDrilldown({ brandId, onComplete, className = '' }: BrandDrilldownProps) {
  const [brandName, setBrandName] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [subModels, setSubModels] = useState<SubModel[]>([])
  
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [selectedModelName, setSelectedModelName] = useState<string>('')
  const [selectedSubModelId, setSelectedSubModelId] = useState<string>('')
  const [selectedSubModelName, setSelectedSubModelName] = useState<string>('')
  
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
        setModels(arr)
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
        setSubModels(arr)
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
    
    console.log('🚗 BrandDrilldown updating filter:', state)
    
    // Persist to localStorage
    setPersistedVehicleFilter(state)
    
    // Notify parent
    if (onComplete) onComplete(state)
  }, [brandId, brandName, selectedModelId, selectedModelName, selectedSubModelId, selectedSubModelName, onComplete])

  const handleModelSelect = (model: Model) => {
    setSelectedModelId(String(model.id))
    setSelectedModelName(model.name)
  }

  const handleSubModelSelect = (subModel: SubModel) => {
    setSelectedSubModelId(String(subModel.id))
    setSelectedSubModelName(subModel.name)
  }

  const getImageUrl = (imgPath: string | null | undefined) => {
    if (!imgPath) return logoImg
    // Handle both absolute and relative paths
    if (imgPath.startsWith('http://') || imgPath.startsWith('https://')) return imgPath
    if (imgPath.startsWith('/')) return imgPath
    // Use the uploads/cars/ prefix
    return `/uploads/cars/${imgPath}`
  }

  const resetSelection = () => {
    setSelectedModelId('')
    setSelectedModelName('')
    setSelectedSubModelId('')
    setSelectedSubModelName('')
    setSubModels([])
  }

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
          <h4 className="mb-3 text-[14px] font-bold text-gray-900">
            {selectedModelId ? 'Selected Model' : 'Select a Model'}
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => {
              const isSelected = selectedModelId === String(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => handleModelSelect(model)}
                  className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all ${
                    isSelected
                      ? 'bg-[#F7CD3A] ring-2 ring-[#F7CD3A] shadow-lg'
                      : 'bg-white ring-1 ring-black/10 hover:ring-[#F7CD3A]/50 hover:shadow-md'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5">
                      <img
                        src={getImageUrl(model.img_url)}
                        alt={model.name}
                        className="h-full w-full object-contain"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[14px] font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {model.name}
                      </p>
                      {(model.year || model.year_2) && (
                        <p className={`mt-0.5 text-[12px] ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
                          {model.year && model.year_2 ? `${model.year} - ${model.year_2}` : model.year || model.year_2}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Sub-Models Grid (shown after model selection) */}
      {selectedModelId && (
        <div>
          <h4 className="mb-3 text-[14px] font-bold text-gray-900">
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
            <div className="rounded-xl bg-gray-50 p-6 text-center ring-1 ring-black/5">
              <p className="text-[13px] text-gray-600">No sub-models available. You can proceed with just the model selection.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subModels.map((subModel) => {
                const isSelected = selectedSubModelId === String(subModel.id)
                return (
                  <button
                    key={subModel.id}
                    onClick={() => handleSubModelSelect(subModel)}
                    className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all ${
                      isSelected
                        ? 'bg-[#F7CD3A] ring-2 ring-[#F7CD3A] shadow-lg'
                        : 'bg-white ring-1 ring-black/10 hover:ring-[#F7CD3A]/50 hover:shadow-md'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5">
                        <img
                          src={getImageUrl(subModel.img_url)}
                          alt={subModel.name}
                          className="h-full w-full object-contain"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[14px] font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {subModel.name}
                        </p>
                        {(subModel.year || subModel.year_2) && (
                          <p className={`mt-0.5 text-[12px] ${isSelected ? 'text-white/80' : 'text-gray-600'}`}>
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

      {/* Current Selection Summary */}
      {selectedModelId && (
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
                <span className="font-medium">Compatible parts are displayed below</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
