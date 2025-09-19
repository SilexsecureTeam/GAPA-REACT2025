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
  const pat = new RegExp(`(^|[^a-z0-9])${escapeRegex(needleLower)}([^a-z0-9]|$)`, 'i')
  return pat.test(textLower)
}

export function vehicleMatches(product: any, state: VehicleFilterState): boolean {
  const { brandName = '', modelName = '', engineName = '' } = state || {}
  const hasAny = Boolean(brandName || modelName || engineName)
  if (!hasAny) return true

  // unwrap nested shape
  const src = (product && typeof product === 'object' && 'part' in product) ? (product as any).part : product
  const rawCompatAny = (src as any)?.compatibility ?? (src as any)?.compatibilities ?? (src as any)?.vehicle_compatibility ?? (src as any)?.vehicleCompatibility ?? (src as any)?.fitment ?? (src as any)?.fitments

  const text = String(rawCompatAny || '').toLowerCase()
  // Treat universal compatibility as matching all vehicles
  if (text.includes('universal') || text.includes('all vehicles') || text.includes('all cars') || text.includes('fits all')) return true

  if (!text) return true

  const b = brandName.trim().toLowerCase()
  const m = modelName.trim().toLowerCase()
  const e = engineName.trim().toLowerCase()

  // All provided fields must match; brand/model may be substring; engine must be whole name match
  const bOk = b ? text.includes(b) : true
  const mOk = m ? text.includes(m) : true
  const eOk = e ? includesWhole(text, e) : true
  return bOk && mOk && eOk
}
