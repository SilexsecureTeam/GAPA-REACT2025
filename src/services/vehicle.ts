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
  return str.replace(/\b(19|20)\d{2}\b/g, '')
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
  // No filter selected = match all
  if (!brandId && !modelId && !engineId && !brandName && !modelName && !engineName) return true

  // Unwrap product
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  const suitability = src?.suitability_models

  // UPDATE: If suitability data is missing or empty, assume Universal Fit -> Return TRUE
  if (!Array.isArray(suitability) || suitability.length === 0) {
    return true
  }

  // Prepare tokens for name-based fallback matching
  const searchBrand = normalize(brandName || '')
  const modelTokens = normalize(modelName || '').split(' ').filter(t => t.length > 0)
  
  // Engine tokens: Normalize -> Strip Years -> Split -> Filter tiny words
  // This ensures "2009 - 2010" in filter doesn't clash with "11.2009" in product
  const cleanEngineName = stripYears(normalize(engineName || ''))
  const engineTokens = cleanEngineName.split(' ').filter(t => t.length > 1) 

  // Check if ANY suitability entry matches
  return suitability.some((entry: any) => {
    // --- 1. Brand Check ---
    const entryBrandId = String(entry.brand_id || '')
    
    // A: Strict ID Match
    if (brandId && entryBrandId) {
      if (entryBrandId !== String(brandId)) return false
    }
    // B: Fallback Name Match (substring is usually safe for Brand)
    else if (searchBrand) {
      const entryBrandStr = normalize(entry.model || entry.brand_name || '')
      if (!entryBrandStr.includes(searchBrand)) return false
    }

    // If only brand filtered, match found
    if (!modelId && !engineId && !modelName) return true

    // --- 2. Sub-Models Check ---
    const subList = entry.sub_suitability_models
    if (!Array.isArray(subList) || subList.length === 0) return false

    return subList.some((sub: any) => {
      const subMainId = String(sub.main_model_id ?? sub.model_id ?? '')
      const subEngineId = String(sub.suit_sub_models_id ?? sub.id ?? '')
      const subStr = normalize(sub.sub_model || sub.model || '')
      
      // Tokenize product string for word-based matching
      const subTokens = subStr.split(' ')

      // --- A. Model Match ---
      let modelMatches = false
      
      // 1. Strict ID Match
      if (modelId && subMainId) {
        if (subMainId === String(modelId)) modelMatches = true
      }
      // 2. Fallback: Token-based Match (Fixes "X5" matching "X50")
      // All words in selected model name must exist as whole words in product string
      else if (modelTokens.length > 0) {
        const allTokensFound = modelTokens.every(token => subTokens.includes(token))
        if (allTokensFound) modelMatches = true
      }
      // 3. Fallback to simple substring if no tokens (unlikely)
      else if (!modelId && !modelName) {
        modelMatches = true
      }

      if (!modelMatches) return false
      
      // If only model filtered, match found
      if (!engineId && !engineName) return true

      // --- B. Engine Match ---
      let engineMatches = false
      
      // 1. Strict ID Match
      if (engineId && subEngineId) {
        if (subEngineId === String(engineId)) engineMatches = true
      }
      // 2. Fuzzy Token Match (WITHOUT YEARS)
      // Check if critical tokens (like "J150" or "GX") exist in the product string
      else if (engineTokens.length > 0) {
        const hits = engineTokens.filter(token => subStr.includes(token))
        
        // If we have meaningful tokens (like J150), require a high match rate.
        // If the engine string was mostly years (which we stripped), this list might be empty or short,
        // in which case we fall back to logic below.
        if (hits.length === engineTokens.length) {
           engineMatches = true
        } else if (hits.length > 0 && (hits.length / engineTokens.length) > 0.6) {
           // Allow slight mismatch if mostly matching (e.g. extra words)
           engineMatches = true
        }
      } 
      // 3. Simple Substring fallback (using original string if token logic was skipped)
      else if (normalize(engineName || '') && subStr.includes(normalize(engineName || ''))) {
        engineMatches = true
      }
      else if (!engineId && !engineName) {
        engineMatches = true
      }

      return engineMatches
    })
  })
}