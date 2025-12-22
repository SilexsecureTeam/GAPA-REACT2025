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
// Example: "3.5L V6" -> "3 5l v6", "C-Class" -> "c class"
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
  
  // Model tokens: Strict word-based. "3" -> ["3"]
  const searchModel = stripYears(normalize(modelName || '')) 
  const modelTokens = searchModel.split(' ').filter(t => t.length > 0)

  // Engine tokens: Fuzzy. "3.5L V6" -> ["3", "5l", "v6"]
  const cleanEngine = stripYears(normalize(engineName || ''))
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
      
      // Tokenize product string: "bmw 3 series" -> ["bmw", "3", "series"]
      const subTokens = cleanSubStr.split(' ')

      // A. Model Match (Strict Word Match)
      let modelMatches = false
      if (modelId && subMainId === String(modelId)) {
        modelMatches = true
      } else if (modelTokens.length > 0) {
        // ESSENTIAL FIX: Every word in the filter model must appear as a WHOLE WORD in the product.
        // This prevents "3" from matching "X3" or "320i".
        // "3" === "3" (Match)
        // "3" !== "x3" (No match)
        modelMatches = modelTokens.every(token => subTokens.includes(token))
      } else if (!modelId && !modelName) {
        modelMatches = true
      }

      if (!modelMatches) return false
      if (!engineId && !engineName) return true

      // B. Engine Match (90% Fuzzy Match)
      if (engineId && subEngineId === String(engineId)) {
        return true
      }

      // Fuzzy Token Match for Engine
      if (engineTokens.length > 0) {
        // Check how many filter tokens exist in the product string
        const tokensFound = engineTokens.filter(token => cleanSubStr.includes(token))
        
        // If filter is very short (e.g. "V6"), it must match exactly.
        if (engineTokens.length === 1) {
             return tokensFound.length === 1
        }
        
        // For longer specs, allow slight variation (90% match)
        // e.g. Filter: "3.5L V6 DOHC" (3 tokens), Product: "3.5L V6" (2 matches). 2/3 = 0.66 (Fail)
        // Product: "3.5L V6 DOHC Turbo" (3 matches). 3/3 = 1.0 (Pass)
        if ((tokensFound.length / engineTokens.length) >= 0.9) {
           return true
        }
      } else {
        // If engine filter was only years (and we stripped them), ignore engine constraint
        return true
      }

      return false
    })
  })
}
