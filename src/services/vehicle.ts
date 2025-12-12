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

// Helper to normalize strings for comparison (remove special chars, lowercase, trim)
function normalize(str: string): string {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // Remove punctuation like () - ,
    .replace(/\s+/g, ' ')        // Collapse whitespace
    .trim()
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
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

  // Pre-calculate normalized filter terms for fuzzy matching fallback
  const searchBrand = normalize(brandName || '')
  const searchModel = normalize(modelName || '')
  // For engine, we might only want to match key parts if the full string is complex
  const searchEngine = normalize(engineName || '')

  // Check if ANY entry in the suitability list matches our selected vehicle
  return suitability.some((entry: any) => {
    // --- 1. Brand Check ---
    // Try Strict ID Match
    if (brandId) {
      const entryBrandId = String(entry.brand_id || '')
      if (entryBrandId && entryBrandId !== String(brandId)) return false
    }

    // If we are only filtering by Brand, and it matched above, this product is a match.
    if (!modelId && !engineId) return true

    // --- 2. Sub-Models Check (Model & Engine) ---
    const subList = entry.sub_suitability_models
    if (!Array.isArray(subList) || subList.length === 0) {
      return false
    }

    return subList.some((sub: any) => {
      // Data from product
      const subMainModelId = String(sub.main_model_id ?? sub.model_id ?? '')
      const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '') // Fallback to 'id' if suit_sub_models_id is null
      const subModelStr = normalize(sub.sub_model || sub.model || '')

      // --- A. Model Match ---
      let modelMatches = true
      if (modelId) {
        // 1. Try Strict ID Match
        if (subMainModelId && subMainModelId === String(modelId)) {
          modelMatches = true
        } 
        // 2. Fallback: Fuzzy Text Match
        // If IDs are missing/null or didn't match, check if the selected model name exists in the product's sub_model string
        else if (searchModel && subModelStr.includes(searchModel)) {
          modelMatches = true
        }
        else {
          modelMatches = false
        }
      }

      if (!modelMatches) return false
      
      // If we are only filtering by Model (no engine selected), and it matched above, it's a match.
      if (!engineId) return true

      // --- B. Engine Match ---
      let engineMatches = true
      if (engineId) {
        // 1. Try Strict ID Match
        if (subEngineId && subEngineId === String(engineId)) {
          engineMatches = true
        }
        // 2. Fallback: Fuzzy Text Match
        // Check if the engine selection is roughly contained in the text
        // We check if the searchModel is in the string (re-verify) AND if parts of the engine string are there
        else if (searchModel && subModelStr.includes(searchModel)) {
          // If the product text contains the Model Name, it's a strong candidate.
          // We can optionally check for engine specifics (like year or "V8") if available.
          // Given the user request: "differ a bit but referring to the same vehicle", 
          // we accept the match if the Model Name is strongly present in the description string.
          // For higher precision, we could check `searchEngine` inclusion, but often 
          // the database string formats (e.g. "11.2009 - ...") differ wildly from dropdowns ("2009 - 2010").
          // Defaulting to TRUE here if Model matched via text allows the user to see results rather than 0 results.
          engineMatches = true
        } 
        else {
          engineMatches = false
        }
      }

      return engineMatches
    })
  })
}