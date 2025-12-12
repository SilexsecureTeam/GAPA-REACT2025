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

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandId, modelId, engineId, brandName, modelName, engineName } = state || {}
  
  // No filter selected = match all
  if (!brandId && !modelId && !engineId && !brandName && !modelName && !engineName) return true

  // Unwrap product
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  const suitability = src?.suitability_models

  // Strict check: if suitability data is missing/empty, we cannot verify fit -> hide product
  if (!Array.isArray(suitability) || suitability.length === 0) {
    return false
  }

  // Prepare tokens for name-based fallback matching
  const searchBrand = normalize(brandName || '')
  const modelTokens = normalize(modelName || '').split(' ').filter(t => t.length > 0)
  const engineTokens = normalize(engineName || '').split(' ').filter(t => t.length > 1) // Ignore single chars for engine

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
        // e.g. Filter "X5" -> tokens ["x5"]. Product "BMW X50" -> tokens ["bmw", "x50"]. 
        // "x5" !== "x50", so NO match. Correct.
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
      // 2. Fuzzy Token Match (Requested behavior)
      // Allows "2009 - 2010" to match "11.2009" by checking for overlap
      else if (engineTokens.length > 0) {
        const hits = engineTokens.filter(token => subStr.includes(token))
        // Match if > 40% of filter words are found in product description
        if ((hits.length / engineTokens.length) > 0.4) {
          engineMatches = true
        }
      } 
      // 3. Simple Substring fallback
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
