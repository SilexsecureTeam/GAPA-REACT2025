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

// Helper: lowercase, punctuation to space, trim
function normalize(str: string): string {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') 
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper: Remove 4-digit years to compare mechanical specs only
function stripYears(str: string): string {
  // Removes 19xx and 20xx patterns
  return str.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
  // 1. If no filter, everything fits
  if (!brandId && !modelId && !engineId && !brandName && !modelName && !engineName) return true

  // 2. Unwrap product data
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  const suitability = src?.suitability_models

  // 3. Universal Match Check: 
  // If product has NO suitability data array at all, assume it fits everything (Universal).
  // If it has an empty array [], it fits nothing specific (unless filter is empty).
  if (!suitability) return true
  if (Array.isArray(suitability) && suitability.length === 0) return true 

  // 4. Prepare Filter Tokens (Year-Insensitive)
  const searchBrand = normalize(brandName || '')
  // Strip years for model to ensure strict name match doesn't fail on "2010"
  const searchModel = stripYears(normalize(modelName || '')) 
  const cleanEngine = stripYears(normalize(engineName || ''))
  
  // Split engine into tokens for fuzzy matching
  const engineTokens = cleanEngine.split(' ').filter(t => t.length > 0)

  // 5. Check against Suitability Array
  return suitability.some((entry: any) => {
    // --- Brand Match ---
    const entryBrandId = String(entry.brand_id || '')
    const entryBrandStr = normalize(entry.model || entry.brand_name || '')

    // Strict ID or Strict Name Inclusion
    const brandMatches = (brandId && entryBrandId === String(brandId)) || 
                         (searchBrand && entryBrandStr.includes(searchBrand))
    
    if (!brandMatches && (brandId || searchBrand)) return false
    
    // If only Brand filtered, we are done
    if (!modelId && !modelName) return true

    // --- Sub-Model Match (Model & Engine) ---
    const subList = entry.sub_suitability_models
    // If sub-models missing but brand matched, assume generic fit for brand
    if (!Array.isArray(subList) || subList.length === 0) return true

    return subList.some((sub: any) => {
      const subMainId = String(sub.main_model_id ?? sub.model_id ?? '')
      const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '')
      
      // Normalize product string and strip years for fair comparison
      const rawSubStr = normalize(sub.sub_model || sub.model || '')
      const cleanSubStr = stripYears(rawSubStr)

      // A. Model Match (Strict 100% requirement as requested)
      let modelMatches = false
      if (modelId && subMainId === String(modelId)) {
        modelMatches = true
      } else if (searchModel) {
        // Strict text check: The product string MUST contain the model name 
        // (after years are stripped).
        if (cleanSubStr.includes(searchModel)) {
            modelMatches = true
        }
      } else if (!modelId && !modelName) {
        modelMatches = true
      }

      if (!modelMatches) return false
      
      // If no engine selected, the strict model match is sufficient (100% match condition met)
      if (!engineId && !engineName) return true

      // B. Engine Match
      let engineMatches = false
      
      // 1. Strict ID Match
      if (engineId && subEngineId === String(engineId)) {
        return true
      }

      // 2. Fuzzy Token Match for Engine (90% threshold as requested)
      if (engineTokens.length > 0) {
        // Check how many tokens from the filter appear in the product string
        const tokensFound = engineTokens.filter(token => cleanSubStr.includes(token))
        const matchRatio = tokensFound.length / engineTokens.length
        
        // If 90% or more of the words match, allow it.
        // This allows very minor differences but enforces the specific engine code.
        if (matchRatio >= 0.9) return true
      } else {
        // If engine filter was only years (and we stripped them), ignore engine constraint
        return true
      }

      return false
    })
  })
}
