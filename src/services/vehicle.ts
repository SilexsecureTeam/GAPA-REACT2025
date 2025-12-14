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
  if (Array.isArray(suitability) && suitability.length === 0) return true // Treat empty array as universal for now to avoid hiding too much

  // 4. Prepare Filter Tokens (Year-Insensitive)
  const searchBrand = normalize(brandName || '')
  const searchModel = stripYears(normalize(modelName || '')) 
  const cleanEngine = stripYears(normalize(engineName || ''))
  
  // Split engine into tokens (e.g. "4", "7", "v8"). 
  // We keep ALL tokens (even single chars) to support "2.0", "3", "L" etc.
  const engineTokens = cleanEngine.split(' ').filter(t => t.length > 0)

  // 5. Check against Suitability Array
  return suitability.some((entry: any) => {
    // --- Brand Match ---
    const entryBrandId = String(entry.brand_id || '')
    const entryBrandStr = normalize(entry.model || entry.brand_name || '')

    // Match by ID if available, else strict Name match
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

      // A. Model Match
      let modelMatches = false
      if (modelId && subMainId === String(modelId)) {
        modelMatches = true
      } else if (searchModel && cleanSubStr.includes(searchModel)) {
        modelMatches = true
      } else if (!modelId && !modelName) {
        modelMatches = true
      }

      if (!modelMatches) return false
      if (!engineId && !engineName) return true

      // B. Engine Match
      if (engineId && subEngineId === String(engineId)) {
        return true
      }

      // Fuzzy Token Match for Engine
      if (engineTokens.length > 0) {
        // Check how many tokens from the filter appear in the product string
        const tokensFound = engineTokens.filter(token => cleanSubStr.includes(token))
        
        // Strictness logic:
        // If filter is simple (1-2 words e.g. "V8"), require ALL to match.
        // If filter is complex (e.g. "3.5L V6 Gas"), allow some mismatch (e.g. missing "Gas").
        if (engineTokens.length <= 2) {
             return tokensFound.length === engineTokens.length
        } else {
             // For longer strings, require 90% match
             return (tokensFound.length / engineTokens.length) >= 0.90
        }
      } 
      
      // If we are here, we had engine text but no tokens (unlikely), or match failed.
      return true // If engineTokens empty (only years were stripped), assume match.
    })
  })
}