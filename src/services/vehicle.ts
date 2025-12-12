export type VehicleFilterState = {
  brandId?: string
  modelId?: string
  engineId?: string
  brandName?: string
  modelName?: string
  engineName?: string
}

export const VEHICLE_FILTER_KEY = 'gapa:veh-filter'

export function getPersistedVehicleFilter(): VehicleFilterState {
  try {
    const raw = localStorage.getItem(VEHICLE_FILTER_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {}
  return {}
}

export function setPersistedVehicleFilter(v: VehicleFilterState) {
  try { localStorage.setItem(VEHICLE_FILTER_KEY, JSON.stringify(v)) } catch {}
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId } = state || {}
  
  // If no vehicle is selected in the filter, show all products
  if (!brandId && !modelId && !engineId) return true

  // Unwrap nested shape if necessary
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  
  // Get the suitability array
  const suitability = src?.suitability_models

  // STRICT REQUIREMENT: Only use suitability_models. 
  // If the array is missing or empty, this product does NOT match the specific vehicle selected.
  if (!Array.isArray(suitability) || suitability.length === 0) {
    return false
  }

  // Check if ANY entry in the suitability list matches our selected vehicle
  return suitability.some((entry: any) => {
    // 1. Check Brand
    if (brandId) {
      const entryBrandId = String(entry.brand_id || '')
      // Strict ID match is required for accuracy
      if (entryBrandId !== String(brandId)) return false
    }

    // If we are only filtering by Brand, and it matched above, this product is a match.
    if (!modelId && !engineId) return true

    // 2. Check Sub-Models (Model & Engine)
    const subList = entry.sub_suitability_models
    if (!Array.isArray(subList) || subList.length === 0) {
      // If we need a specific model/engine but none are listed, it's not a match
      return false
    }

    return subList.some((sub: any) => {
      // A. Check Model Match
      if (modelId) {
        // main_model_id is the standard key for Model ID in this structure, but check model_id too
        const subMainModelId = String(sub.main_model_id ?? sub.model_id ?? '')
        if (subMainModelId !== String(modelId)) return false
      }

      // If we are only filtering by Model (no engine selected), and it matched above, it's a match.
      if (!engineId) return true

      // B. Check Engine Match
      if (engineId) {
        // suit_sub_models_id corresponds to the specific Engine/SubModel ID
        const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '')
        if (subEngineId !== String(engineId)) return false
      }

      return true
    })
  })
}
