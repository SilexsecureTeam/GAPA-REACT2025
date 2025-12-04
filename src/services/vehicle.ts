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

function includesWhole(textLower: string, needleLower: string) {
  if (!needleLower) return true
  const safeNeedle = escapeRegex(needleLower)
  const pat = new RegExp(`(^|[^a-z0-9])${safeNeedle}([^a-z0-9]|$)`, 'i')
  return pat.test(textLower)
}

const BRAND_ALIASES: Record<string, string[]> = {
  'vw': ['volkswagen'],
  'volkswagen': ['vw'],
  'mb': ['mercedes', 'mercedes-benz'],
  'mercedes': ['mb', 'mercedes-benz'],
  'mercedes-benz': ['mb', 'mercedes']
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandName = '', modelName = '', engineName = '', brandId, modelId, engineId } = state || {}
  const hasAny = Boolean(brandName || modelName || engineName)
  if (!hasAny) return true

  // unwrap nested shape
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product

  // --------------------------------------------------------------------------
  // 1. Primary Filter: Check suitability_models array
  // --------------------------------------------------------------------------
  const suitability = src?.suitability_models
  if (Array.isArray(suitability) && suitability.length > 0) {
    const bLower = brandName.trim().toLowerCase()
    
    // We only pass if AT LEAST ONE entry in suitability_models matches
    return suitability.some((entry: any) => {
      // --- Brand Check ---
      let brandMatches = false
      if (brandId && entry.brand_id) {
        // strict ID match preferred
        brandMatches = String(entry.brand_id) === String(brandId)
      } else if (bLower) {
        // loose name match
        const txt = String(entry.model || '').toLowerCase()
        if (txt.includes(bLower)) brandMatches = true
        else {
          const aliases = BRAND_ALIASES[bLower] || []
          if (aliases.some(a => txt.includes(a))) brandMatches = true
        }
      } else {
        brandMatches = true
      }

      if (!brandMatches) return false

      // If user only selected Brand, we are good
      if (!modelId && !modelName) return true

      // --- Sub-models Check ---
      const subList = entry.sub_suitability_models
      if (Array.isArray(subList) && subList.length > 0) {
        return subList.some((sub: any) => {
          const subTxt = String(sub.sub_model || '').toLowerCase()

          // A. Model Match
          let modelMatches = false
          // 1. ID Match (check both main_model_id and model_id)
          // Note: main_model_id usually correlates to the Model (Chassis) ID
          if (modelId && (String(sub.main_model_id) === String(modelId) || String(sub.model_id) === String(modelId))) {
             modelMatches = true
          }
          // 2. Name Match
          if (!modelMatches && modelName) {
             const mLower = modelName.trim().toLowerCase()
             // Simple includes is usually enough for Model names
             if (subTxt.includes(mLower)) modelMatches = true
          }
          // If no model selected in filter (unlikely here), pass
          if (!modelId && !modelName) modelMatches = true

          if (!modelMatches) return false

          // B. Engine/SubModel Match
          // If no engine selected, we are good (matched Model)
          if (!engineId && !engineName) return true

          let engineMatches = false
          // 1. ID Match (suit_sub_models_id or simple id)
          if (engineId && (String(sub.suit_sub_models_id) === String(engineId) || String(sub.id) === String(engineId))) {
             engineMatches = true
          }
          // 2. Name Match
          if (!engineMatches && engineName) {
             const eLower = engineName.trim().toLowerCase()
             if (subTxt.includes(eLower)) engineMatches = true
          }

          // 3. Generic/Range Match (The Fix)
          // If the entry describes a range (e.g. "95 - 340 PS"), it likely covers ALL engines for this model.
          // So if we matched the Model, and this entry is a generic range, we accept it even if specific engine ID/Name didn't match.
          if (!engineMatches) {
            const isGenericRange = /\d+\s*-\s*\d+\s*(PS|kW|hp|CV)/i.test(subTxt) || /all engines|universal/i.test(subTxt)
            if (isGenericRange) engineMatches = true
          }

          return engineMatches
        })
      }

      return false
    })
  }

  // --------------------------------------------------------------------------
  // 2. Fallback: Compatibility String Check
  // --------------------------------------------------------------------------
  const rawCompatAny = (src as any)?.compatibility ?? (src as any)?.compatibilities ?? (src as any)?.vehicle_compatibility ?? (src as any)?.vehicleCompatibility ?? (src as any)?.fitment ?? (src as any)?.fitments

  const text = String(rawCompatAny || '').toLowerCase()
  if (text.includes('universal') || text.includes('all vehicles') || text.includes('all cars') || text.includes('fits all')) return true

  if (!text) return true

  const b = brandName.trim().toLowerCase()
  const m = modelName.trim().toLowerCase()
  const e = engineName.trim().toLowerCase()

  const bOk = b ? (text.includes(b) || (BRAND_ALIASES[b]||[]).some(a => text.includes(a))) : true
  const mOk = m ? text.includes(m) : true
  const eOk = e ? includesWhole(text, e) : true
  return bOk && mOk && eOk
}
