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

// Helper to normalize strings for comparison
function normalize(str: string): string {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace punctuation with space
    .replace(/\s+/g, ' ')         // Collapse whitespace
    .trim()
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
  // If no vehicle is selected in the filter, show all products
  if (!brandId && !modelId && !engineId && !brandName && !modelName && !engineName) return true

  // Unwrap nested shape if necessary
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  
  // Get the suitability array
  const suitability = src?.suitability_models

  // STRICT REQUIREMENT: Only use suitability_models. 
  // If the array is missing or empty, this product does NOT match the specific vehicle selected.
  if (!Array.isArray(suitability) || suitability.length === 0) {
    return false
  }

  const nBrand = normalize(brandName || '')
  const nModel = normalize(modelName || '')
  
  // Tokenize the selected engine filter for fuzzy matching
  // We split by space and ignore common small words to focus on chassis codes (e.g. J150) and specs
  const engineTokens = normalize(engineName || '')
    .split(' ')
    .filter(t => t.length > 1)

  // Check if ANY entry in the suitability list matches our selected vehicle
  return suitability.some((entry: any) => {
    // --- 1. Brand Check ---
    const entryBrandId = String(entry.brand_id || '')
    // In GAPA API, entry.model often holds the Brand Name (e.g., "LEXUS")
    const entryBrandStr = normalize(entry.model || entry.brand_name || '')

    let brandMatch = false
    
    // A: Try Strict ID Match
    if (brandId && entryBrandId) {
      if (entryBrandId === String(brandId)) brandMatch = true
    }
    // B: Fallback to Name Match (crucial to prevent total mismatch if ID is missing)
    else if (nBrand) {
      // Check if one contains the other (e.g. "Toyota" in "Toyota Cars")
      if (entryBrandStr.includes(nBrand) || nBrand.includes(entryBrandStr)) brandMatch = true
    }
    // C: If filter has no brand (unlikely), pass
    else if (!brandId && !nBrand) {
      brandMatch = true
    }

    if (!brandMatch) return false

    // If only Brand is filtered, we have a match
    if (!modelId && !modelName) return true

    // --- 2. Sub-Models Check (Model & Engine) ---
    const subList = entry.sub_suitability_models
    if (!Array.isArray(subList) || subList.length === 0) return false

    return subList.some((sub: any) => {
      const subMainId = String(sub.main_model_id ?? sub.model_id ?? '')
      const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '')
      // The sub_model string contains Model + Engine info (e.g. "LEXUS GX II ...")
      const subStr = normalize(sub.sub_model || sub.model || '')

      // --- A. Model Match ---
      let modelMatch = false
      if (modelId && subMainId) {
        // Strict ID
        if (subMainId === String(modelId)) modelMatch = true
      }
      
      // Fallback: If ID match failed (or ID missing), try Name match
      if (!modelMatch && nModel) {
        if (subStr.includes(nModel)) modelMatch = true
      }
      
      if (!modelMatch && !modelId && !nModel) modelMatch = true

      if (!modelMatch) return false
      
      // If only Model is filtered (no engine), we have a match
      if (!engineId && !engineName) return true

      // --- B. Engine Match (FUZZY) ---
      let engineMatch = false
      
      // 1. Strict ID Match
      if (engineId && subEngineId) {
        if (subEngineId === String(engineId)) engineMatch = true
      }

      // 2. Fuzzy Token Match (The requested fix)
      // If ID match failed, check if meaningful parts of the engine string are present
      if (!engineMatch && engineTokens.length > 0) {
        const matches = engineTokens.filter(token => subStr.includes(token))
        // Calculate match ratio (how many tokens from the filter appear in the product)
        const ratio = matches.length / engineTokens.length
        
        // If > 40% of tokens match, consider it a match. 
        // This handles cases like "2009 - 2010" (filter) vs "11.2009" (product)
        // while ensuring "J150" and "GX" match.
        if (ratio > 0.4) {
          engineMatch = true
        }
      }
      
      return engineMatch
    })
  })
}