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

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Helper to check for whole word matches (prevents "1.8" matching "1.8T" or "2.0" matching "12.0")
function includesWhole(textLower: string, needleLower: string) {
  if (!needleLower) return true
  // Escape special chars in needle (like dots in "2.0")
  const safeNeedle = escapeRegex(needleLower)
  const pat = new RegExp(`(^|[^a-z0-9])${safeNeedle}([^a-z0-9]|$)`, 'i')
  return pat.test(textLower)
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandName = '', modelName = '', engineName = '', brandId, modelId, engineId } = state || {}
  const hasAny = Boolean(brandName || modelName || engineName)
  if (!hasAny) return true

  // Unwrap nested product shape if necessary
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product

  // --------------------------------------------------------------------------
  // 1. Primary Filter: Check `suitability_models` array (and nested sub-models)
  // --------------------------------------------------------------------------
  const suitability = src?.suitability_models
  if (Array.isArray(suitability) && suitability.length > 0) {
    const bLower = brandName.trim().toLowerCase()
    
    // We only pass if AT LEAST ONE entry in suitability_models matches the selection
    return suitability.some((entry: any) => {
      // --- Level 1: Brand Check ---
      // The entry typically represents the Brand or a high-level Model Group
      // e.g. entry.model = "BMW", entry.brand_id = "..."
      
      let brandMatches = false
      if (brandId && entry.brand_id) {
        // Preferred: Strict ID match
        brandMatches = String(entry.brand_id) === String(brandId)
      } else if (bLower) {
        // Fallback: Text match on the entry's model/name field
        const txt = String(entry.model || '').toLowerCase()
        brandMatches = txt.includes(bLower)
      } else {
        // If no brand selected in filter (unlikely if hasAny is true), treat as match
        brandMatches = true
      }

      if (!brandMatches) return false

      // If user only selected Brand, and we matched Brand, we are good.
      if (!modelId && !modelName) return true

      // --- Level 2: Model & Engine (Sub-models) Check ---
      // Check the nested `sub_suitability_models` array
      const subList = entry.sub_suitability_models
      
      // If there are sub-models, we MUST find a match in there for the selected Model/Engine
      if (Array.isArray(subList) && subList.length > 0) {
        return subList.some((sub: any) => {
          // A. Model Match
          let modelMatches = false
          // 1. Try matching IDs (main_model_id usually maps to the Model ID)
          if (modelId && sub.main_model_id) {
             if (String(sub.main_model_id) === String(modelId)) modelMatches = true
          }
          // 2. Fallback to Name match in the sub_model string
          // e.g. sub.sub_model = "BMW 3 Saloon (F30, F80) ( 03.2011 - ... )"
          if (!modelMatches && modelName) {
             const mLower = modelName.trim().toLowerCase()
             const subTxt = String(sub.sub_model || '').toLowerCase()
             if (subTxt.includes(mLower)) modelMatches = true
          }
          // If filter has no model selected, ignore this check
          if (!modelId && !modelName) modelMatches = true

          if (!modelMatches) return false

          // B. Engine Match
          let engineMatches = false
          // 1. Try matching IDs (suit_sub_models_id usually maps to the Engine ID)
          if (engineId && sub.suit_sub_models_id) {
             if (String(sub.suit_sub_models_id) === String(engineId)) engineMatches = true
          }
          // 2. Fallback to Name match
          if (!engineMatches && engineName) {
             const eLower = engineName.trim().toLowerCase()
             const subTxt = String(sub.sub_model || '').toLowerCase()
             // Use includesWhole for engines like "2.0" to avoid matching "12.0", 
             // but fallback to simple includes if that fails (some data formats are messy)
             if (includesWhole(subTxt, eLower) || subTxt.includes(eLower)) engineMatches = true
          }
          // If filter has no engine selected, ignore this check
          if (!engineId && !engineName) engineMatches = true

          return engineMatches
        })
      }

      // If sub_suitability_models is empty but we have a Model/Engine filter active,
      // strictly speaking this entry doesn't prove compatibility. 
      // However, for data safety, if the array is missing, we treat it as a "partial match failure" 
      // and proceed to check the next suitability entry (or fallback to legacy compatibility).
      return false
    })
  }

  // --------------------------------------------------------------------------
  // 2. Fallback: Compatibility String Check
  // --------------------------------------------------------------------------
  // Used if `suitability_models` is missing or empty
  
  const rawCompatAny = (src as any)?.compatibility ?? (src as any)?.compatibilities ?? (src as any)?.vehicle_compatibility ?? (src as any)?.vehicleCompatibility ?? (src as any)?.fitment ?? (src as any)?.fitments

  const text = String(rawCompatAny || '').toLowerCase()
  
  // Treat universal compatibility as matching all vehicles
  if (text.includes('universal') || text.includes('all vehicles') || text.includes('all cars') || text.includes('fits all')) return true

  if (!text) return true

  const b = brandName.trim().toLowerCase()
  const m = modelName.trim().toLowerCase()
  const e = engineName.trim().toLowerCase()

  const bOk = b ? text.includes(b) : true
  const mOk = m ? text.includes(m) : true
  const eOk = e ? includesWhole(text, e) : true
  
  return bOk && mOk && eOk
}