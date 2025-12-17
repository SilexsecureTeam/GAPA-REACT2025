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

// Normalize string: lowercase, replace punctuation with spaces to ensure word boundaries
function normalize(str: string): string {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') 
    .replace(/\s+/g, ' ')
    .trim()
}

// Helper to remove 4-digit years (1990-2029) to avoid year mismatch issues
function stripYears(str: string): string {
  return str.replace(/\b(19|20)\d{2}\b/g, '').replace(/\s+/g, ' ').trim()
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
  // 1. If no filter selected, match all
  if (!brandId && !modelId && !engineId && !brandName && !modelName && !engineName) return true

  // 2. Unwrap product data
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  const suitability = src?.suitability_models

  // 3. Universal Match Check:
  // If suitability array is missing or empty, assume universal fit (return true).
  if (!Array.isArray(suitability) || suitability.length === 0) {
    return true
  }

  // 4. Prepare Filter Tokens
  const searchBrand = normalize(brandName || '')
  // Strip years for strict name matching
  const searchModel = stripYears(normalize(modelName || '')) 
  const cleanEngine = stripYears(normalize(engineName || ''))
  
  // Split engine into tokens for fuzzy matching
  const engineTokens = cleanEngine.split(' ').filter(t => t.length > 0)

  // 5. Check against Suitability Array
  return suitability.some((entry: any) => {
    // --- Brand Check ---
    const entryBrandId = String(entry.brand_id || '')
    const entryBrandStr = normalize(entry.model || entry.brand_name || '')

    // Strict Match: ID must match OR Name must be included
    const brandMatches = (brandId && entryBrandId === String(brandId)) || 
                         (searchBrand && entryBrandStr.includes(searchBrand))
    
    if (!brandMatches && (brandId || searchBrand)) return false
    
    // If only Brand filtered, we are done
    if (!modelId && !modelName) return true

    // --- Sub-Model Check ---
    const subList = entry.sub_suitability_models
    // If sub-models missing but brand matched, assume generic fit
    if (!Array.isArray(subList) || subList.length === 0) return true

    return subList.some((sub: any) => {
      const subMainId = String(sub.main_model_id ?? sub.model_id ?? '')
      const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '')
      
      const rawSubStr = normalize(sub.sub_model || sub.model || '')
      const cleanSubStr = stripYears(rawSubStr)

      // A. Model Match (100% Strict)
      let modelMatches = false
      
      if (modelId && subMainId === String(modelId)) {
        modelMatches = true
      } else if (searchModel && cleanSubStr.includes(searchModel)) {
        // Strict text check: The product string MUST contain the model name 100%
        modelMatches = true
      } else if (!modelId && !modelName) {
        modelMatches = true
      }

      if (!modelMatches) return false
      
      // If no engine selected, strict model match is sufficient
      if (!engineId && !engineName) return true

      // B. Engine Match (90% Fuzzy)
      let engineMatches = false
      
      // 1. Strict ID Match (Best)
      if (engineId && subEngineId === String(engineId)) {
        return true
      }

      // 2. Fuzzy Token Match
      if (engineTokens.length > 0) {
        const tokensFound = engineTokens.filter(token => cleanSubStr.includes(token))
        const matchRatio = tokensFound.length / engineTokens.length
        
        // Requirement: 90% match for engine details
        if (matchRatio >= 0.9) {
           engineMatches = true
        }
      } else {
        // If filter was only years (and we stripped them), ignore engine constraint
        engineMatches = true
      }

      return engineMatches
    })
  })
          }
