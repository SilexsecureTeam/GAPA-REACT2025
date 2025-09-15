import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getAllProducts, liveSearch, getRelatedProducts, type ApiProduct, getProductById, getAllCategories, type ApiCategory, addToCartApi } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import TopBrands from '../components/TopBrands'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, setPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'

// Helpers
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

// Derive brand and category names from product
function brandOf(p: any): string {
  return String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || p?.brand_name || '').trim()
}
function categoryOf(p: any): string {
  const c = (p as any)?.category
  if (typeof c === 'string') return c
  return String(c?.name || c?.title || (p as any)?.category_name || '').trim()
}

// Small helpers to read attributes/specs consistently
type Attr = { label: string; value: string }
function attrsFrom(p: any): Attr[] {
  // Unwrap nested `part` if present
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const out: Attr[] = []
  if (src?.properties && typeof src.properties === 'object') {
    for (const k of Object.keys(src.properties)) {
      const v = (src.properties as any)[k]
      const label = String(k).trim()
      const value = String(v ?? '').trim()
      if (label && value) out.push({ label, value })
    }
  }
  if (Array.isArray(src?.specs)) {
    for (const s of src.specs) {
      const label = String(s?.label || s?.name || '').trim()
      const value = String(s?.value || s?.val || '').trim()
      if (label && value) out.push({ label, value })
    }
  }
  // Common flat fields we can surface as attributes
  const extra: Record<string, any> = {
    EAN: (src as any)?.EAN,
    Weight: (src as any)?.weight_in_kg,
    Pairs: (src as any)?.pairs,
  }
  for (const [k, v] of Object.entries(extra)) {
    const val = String(v ?? '').trim()
    if (val) out.push({ label: k, value: val })
  }
  return out
}

function mapApiToUi(p: any) {
  // Unwrap nested `part` payloads
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  // Prefer product_id (string)
  const id = String(src?.product_id ?? src?.id ?? '')
  const brandName = String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || 'GAPA')
  const brandLogo = normalizeApiImage(pickImage(src?.brand)) || normalizeApiImage(src?.brand_logo) || normalizeApiImage(pickImage(src)) || logoImg
  // Prefer part_name
  const name = String(src?.part_name || src?.name || src?.title || src?.product_name || 'Car Part')
  const articleNo = String(src?.article_no || src?.article_number || src?.article || src?.sku || src?.code || 'N/A')
  const price = Number(src?.price || src?.selling_price || src?.amount || 0)
  const image = productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  // Build gallery from known image fields and arrays (respect product image base URL)
  const galleryFields = [src?.img_url, src?.img_url_1, src?.img_url_2].filter(Boolean) as string[]
  const galleryFromFields = galleryFields.map((s) => productImageFrom({ img_url: s }) || normalizeApiImage(s) || '').filter(Boolean)
  const rawImages: any[] = Array.isArray(src?.images) ? src.images : Array.isArray(src?.gallery) ? src.gallery : []
  const builtGallery = rawImages.map((x) => {
    if (typeof x === 'string') return productImageFrom({ img_url: x }) || normalizeApiImage(x) || ''
    return productImageFrom(x) || normalizeApiImage(pickImage(x) || '') || ''
  })
  const gallery = Array.from(new Set([image, ...galleryFromFields, ...builtGallery].filter(Boolean)))
  const rating = Number(src?.rating || src?.stars || 4)
  const reviews = Number(src?.reviews_count || src?.reviews || 0)
  const inStock = Boolean((src as any)?.in_stock ?? (src as any)?.live_status ?? true)
  const attributes = attrsFrom(src)
  const description = String(src?.description || src?.details || '')
  return { id, brand: brandName, brandLogo: brandLogo || logoImg, name, articleNo, price, image, gallery: gallery.length ? gallery : [image], rating, reviews, inStock, attributes, description }
}

export default function CarPartDetails() {
  const navigate = useNavigate()
  const { brand, part } = useParams<{ brand?: string; part?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') || ''
  const pid = searchParams.get('pid') || ''

  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ApiProduct[]>([])
  const [related, setRelated] = useState<ApiProduct[]>([])
  const [selected, setSelected] = useState<ReturnType<typeof mapApiToUi> | null>(null)
  const [selectedRaw, setSelectedRaw] = useState<any | null>(null)
  const [categories, setCategories] = useState<ApiCategory[]>([])

  // NEW: shared vehicle filter state
  const [vehFilter, setVehFilter] = useState<VehState>(() => getPersistedVehicleFilter())
  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  const productMatchesVehicle = (p: any) => sharedVehicleMatches(p, vehFilter)

  // Load catalog + categories
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const [all, cats] = await Promise.allSettled([getAllProducts(), getAllCategories()])
        if (!alive) return
        if (all.status === 'fulfilled') setProducts(Array.isArray(all.value) ? all.value : [])
        if (cats.status === 'fulfilled') setCategories(Array.isArray(cats.value) ? cats.value : [])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Attempt live search when q is present and no selected product yet
  useEffect(() => {
    let alive = true
    if (!q || pid) return
    ;(async () => {
      try {
        const res = await liveSearch(q)
        if (!alive) return
        const list = Array.isArray(res) ? res : (res as any)?.data
        const items = Array.isArray(list) ? list : []
        if (items.length > 0) {
          const first = items[0]
          // Prefer product_id
          const firstId = String((first as any)?.product_id || (first as any)?.id || '')
          if (firstId) {
            const brandSlug = brand ? toSlug(brand) : toSlug(brandOf(first)) || 'gapa'
            const partSlug = part ? toSlug(part) : toSlug(categoryOf(first)) || 'parts'
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev)
              next.set('pid', firstId)
              next.delete('q')
              return next
            }, { replace: true })
            navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(firstId)}`, { replace: true })
          }
        }
      } catch {
        // ignore search errors
      }
    })()
    return () => { alive = false }
  }, [q, pid, brand, part, setSearchParams, navigate])

  // Filter strictly by section/category when only part provided
  const scoped = useMemo(() => {
    const list = products
    return list.filter((p) => {
      const b = toSlug(brandOf(p))
      const c = toSlug(categoryOf(p))
      if (brand && part) {
        return b === toSlug(brand) && c === toSlug(part)
      }
      if (!brand && part) {
        return c === toSlug(part) // strict section scope
      }
      return true
    })
  }, [products, brand, part])

  // Facet values computed from scoped list
  const facetValues = useMemo(() => {
    const vals = {
      diameter: new Set<string>(),
      type: new Set<string>(),
      material: new Set<string>(),
      surface: new Set<string>(),
      height: new Set<string>(),
      boltCircle: new Set<string>(),
    }
    for (const p of scoped) {
      for (const a of attrsFrom(p)) {
        const L = a.label.toLowerCase()
        const V = a.value
        if (L.includes('diameter')) vals.diameter.add(V)
        else if (L.includes('brake disc type') || L.includes('type')) vals.type.add(V)
        else if (L.includes('material')) vals.material.add(V)
        else if (L.includes('surface')) vals.surface.add(V)
        else if (L.startsWith('height')) vals.height.add(V)
        else if (L.includes('bolt hole circle')) vals.boltCircle.add(V)
      }
    }
    const sortVals = (s: Set<string>) => Array.from(s).sort((a,b)=>a.localeCompare(b, undefined, { numeric: true }))
    return {
      diameter: sortVals(vals.diameter),
      type: sortVals(vals.type),
      material: sortVals(vals.material),
      surface: sortVals(vals.surface),
      height: sortVals(vals.height),
      boltCircle: sortVals(vals.boltCircle),
    }
  }, [scoped])

  // Facet selections
  const [fDiameter, setFDiameter] = useState<string[]>([])
  const [fType, setFType] = useState<string[]>([])
  const [fMaterial, setFMaterial] = useState<string[]>([])
  const [fSurface, setFSurface] = useState<string[]>([])
  const [fHeight, setFHeight] = useState<string[]>([])
  const [fBoltCircle, setFBoltCircle] = useState<string[]>([])

  // Apply facets + vehicle compatibility
  const filtered = useMemo(() => {
    const list = scoped
    const hasAny = fDiameter.length || fType.length || fMaterial.length || fSurface.length || fHeight.length || fBoltCircle.length
    const byFacets = hasAny ? list.filter((p) => {
      const A = attrsFrom(p)
      const byLabel = (labelIncludes: string) => A.filter(a => a.label.toLowerCase().includes(labelIncludes))
      const hasVal = (arr: Attr[], sel: string[]) => sel.length === 0 || arr.some(a => sel.includes(a.value))
      const okDiameter = hasVal(byLabel('diameter'), fDiameter)
      const okType = hasVal(byLabel('brake disc type').concat(byLabel('type')), fType)
      const okMaterial = hasVal(byLabel('material'), fMaterial)
      const okSurface = hasVal(byLabel('surface'), fSurface)
      const okHeight = hasVal(byLabel('height'), fHeight)
      const okBolt = hasVal(byLabel('bolt hole circle'), fBoltCircle)
      return okDiameter && okType && okMaterial && okSurface && okHeight && okBolt
    }) : list
    // Apply vehicle compatibility
    return byFacets.filter(productMatchesVehicle)
  }, [scoped, fDiameter, fType, fMaterial, fSurface, fHeight, fBoltCircle, vehFilter])

  const zeroResults = !loading && filtered.length === 0

  // Fetch details + related when pid is present (selected product)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!pid) { setSelected(null); setSelectedRaw(null); setRelated([]); return }
        const detail = await getProductById(pid)
        if (!alive) return
        setSelectedRaw(detail)
        setSelected(mapApiToUi(detail))
        const rel = await getRelatedProducts(pid)
        if (!alive) return
        setRelated(Array.isArray(rel) ? rel : [])
      } catch {
        if (!alive) return
        setRelated([])
      }
    })()
    return () => { alive = false }
  }, [pid])

  // Frontend-related suggestions when search fails or related API fails
  const frontendRelated = useMemo(() => {
    const selectedId = String((selectedRaw && ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw)?.product_id) || (selectedRaw && ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw)?.id) || '')
    const basePool = scoped.length ? scoped : products

    // If there is a query, try token-based scoring against titles
    const tokens = (q || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
    if (tokens.length) {
      const scored = basePool
        .filter((p) => String((p as any)?.id ?? (p as any)?.product_id ?? '') !== selectedId)
        .map((p, i) => {
          const title = String((p as any)?.name || (p as any)?.title || (p as any)?.product_name || '').toLowerCase()
          const score = tokens.reduce((acc, t) => acc + (title.includes(t) ? 1 : 0), 0)
          return { p, score, i }
        })
      scored.sort((a, b) => (b.score - a.score) || (a.i - b.i))
      const anyHit = scored.some(s => s.score > 0)
      const picked = (anyHit ? scored.filter(s => s.score > 0) : scored).slice(0, 8).map(s => s.p)
      return picked
    }

    // Else, derive by similarity (same category/brand) if we have a selected product or URL part/brand
    const wantBrand = brand ? toSlug(brand) : (selectedRaw ? toSlug(brandOf(selectedRaw)) : '')
    const wantPart = part ? toSlug(part) : (selectedRaw ? toSlug(categoryOf(selectedRaw)) : '')
    const similar = basePool.filter((p) => {
      const b = toSlug(brandOf(p))
      const c = toSlug(categoryOf(p))
      const sameCat = wantPart ? c === wantPart : true
      const sameBrand = wantBrand ? b === wantBrand : true
      const notSelf = String((p as any)?.product_id ?? (p as any)?.id ?? '') !== selectedId
      return notSelf && (sameCat || sameBrand)
    })
    return similar.slice(0, 8)
  }, [products, q, scoped, selectedRaw, brand, part])

  const finalRelated = (related && related.length) ? related : frontendRelated
  const compatibleRelated = useMemo(() => finalRelated.filter(productMatchesVehicle), [finalRelated, vehFilter])

  // When a user clicks a result, request details, then navigate and update pid
  const onViewProduct = async (id: string, p: any) => {
    try { await getProductById(id) } catch { /* ignore view errors */ }
    const brandSlug = toSlug(brandOf(p) || brand || '') || (brand ? toSlug(brand) : 'gapa')
    const partSlug = toSlug(categoryOf(p) || part || '') || (part ? toSlug(part) : 'parts')
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('q')
      next.set('pid', id)
      return next
    }, { replace: true })
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(id)}`)
  }

  // Map to UI and optionally highlight selection
  const results = useMemo(() => filtered.map((p, i) => ({
    // Use product_id first
    id: String(p?.product_id ?? p?.id ?? i),
    // Prefer part_name
    title: String(p?.part_name || p?.name || p?.title || p?.product_name || 'Car Part'),
    image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg,
    rating: Number(p?.rating || 4),
    price: Number(p?.price || p?.selling_price || p?.amount || 0),
    inStock: Boolean(p?.in_stock ?? true),
    raw: p,
  })), [filtered])

  // Breadcrumb part label: if URL part looks like an ID, resolve name from categories using selected product's category id
  const breadcrumbPartLabel = useMemo(() => {
    const looksNumeric = part ? /^\d+$/.test(part) : false
    if (!looksNumeric && part) return titleCase(part)
    const raw = selectedRaw && (selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw
    const catId = raw && raw.category ? String(raw.category) : (part || '')
    const match = categories.find((c) => String(c.id) === String(catId))
    if (match) return String((match as any).name || (match as any).title || part || '')
    return part ? titleCase(part) : 'Car Parts'
  }, [part, selectedRaw, categories])

  // Category image derived from selected product/category list
  const categoryImage = useMemo(() => {
    // Prefer selected product's category
    const raw = selectedRaw && (selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw
    const catFromSelected = raw ? (typeof raw.category === 'object' ? raw.category : categories.find((c)=> String(c.id) === String(raw?.category))) : undefined
    const imgFromSelected = catFromSelected ? (categoryImageFrom(catFromSelected) || normalizeApiImage(pickImage(catFromSelected) || '')) : undefined
    if (imgFromSelected) return imgFromSelected
    // Else, try to match by URL part slug
    if (part) {
      const match = categories.find((c) => toSlug(String((c as any)?.name || (c as any)?.title || '')) === toSlug(part))
      const img = match ? (categoryImageFrom(match) || normalizeApiImage(pickImage(match) || '')) : undefined
      if (img) return img
    }
    return undefined
  }, [selectedRaw, categories, part])

  // Selected product compatibility
  const selectedCompatible = useMemo(() => {
    return selectedRaw ? productMatchesVehicle(selectedRaw) : true
  }, [selectedRaw, vehFilter])

  const ProductPanel = ({ ui, isSelected }: { ui: ReturnType<typeof mapApiToUi>; isSelected?: boolean }) => {
    // Derive pairs flag and selected raw source for the main (selected) product
    const rawSrc = (isSelected && selectedRaw) ? ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw) : undefined
    const rawPairsVal = rawSrc ? (rawSrc?.pairs ?? rawSrc?.sold_in_pairs ?? rawSrc?.pair ?? rawSrc?.is_pair) : undefined
    const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
    const pairsYes = Boolean(isSelected && (rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'))

    const [qty, setQty] = useState(() => (pairsYes ? 2 : 1))
    const [activeIdx, setActiveIdx] = useState(0)
    const { user } = useAuth()
    const [adding, setAdding] = useState(false)
    const [showPopup, setShowPopup] = useState(false)

    // Parse compatible vehicles and OEM codes from the raw selected product
    const compatList = useMemo(() => {
      if (!isSelected || !rawSrc) return [] as string[]
      const src: any = rawSrc
      const comp = src?.compatibility ?? src?.compatibilities ?? src?.vehicle_compatibility ?? src?.vehicleCompatibility ?? src?.fitment ?? src?.fitments
      const out: string[] = []
      const pushItem = (item: any) => {
        if (!item) return
        if (typeof item === 'string') {
          const parts = item.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean)
          if (parts.length > 1) { out.push(...parts); return }
          out.push(item.trim())
          return
        }
        if (Array.isArray(item)) { item.forEach(pushItem); return }
        if (typeof item === 'object') {
          const brand = String((item as any)?.brand ?? (item as any)?.make ?? (item as any)?.brandName ?? '').trim()
          const model = String((item as any)?.model ?? (item as any)?.modelName ?? (item as any)?.type ?? '').trim()
          const engine = String((item as any)?.engine ?? (item as any)?.engineName ?? (item as any)?.variant ?? '').trim()
          const year = String((item as any)?.year ?? (item as any)?.years ?? '').trim()
          const composed = [brand, model, engine, year].filter(Boolean).join(' ')
          if (composed) out.push(composed)
          else out.push(JSON.stringify(item))
          return
        }
        out.push(String(item))
      }
      pushItem(comp)
      return Array.from(new Set(out))
    }, [isSelected, rawSrc])

    const oemList = useMemo(() => {
      if (!isSelected || !rawSrc) return [] as string[]
      const src: any = rawSrc
      const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList
      const out: string[] = []
      const push = (v: any) => {
        if (!v) return
        if (typeof v === 'string') { v.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return }
        if (Array.isArray(v)) { v.forEach(push); return }
        if (typeof v === 'object') { Object.values(v).map((x) => String(x).trim()).filter(Boolean).forEach((x) => out.push(x)); return }
        out.push(String(v))
      }
      push(o)
      return Array.from(new Set(out))
    }, [isSelected, rawSrc])

    const inc = () => setQty((v) => (pairsYes ? 2 : Math.min(v + 1, 99)))
    const dec = () => setQty((v) => (pairsYes ? 2 : Math.max(v - 1, 1)))
    const mainImage = ui.gallery[activeIdx] || ui.image

    const onAddToCart = async () => {
      if (adding) return
      setAdding(true)
      try {
        const effQty = isSelected ? (pairsYes ? 2 : 1) : qty
        if (user && user.id) {
          await addToCartApi({ user_id: user.id, product_id: ui.id, quantity: effQty })
        } else {
          addGuestCartItem(ui.id, effQty)
        }
        setShowPopup(true)
        // Open global cart popup
        navigate({ hash: '#cart' })
        setTimeout(() => setShowPopup(false), 1200)
      } catch (e) {
        setShowPopup(true)
        navigate({ hash: '#cart' })
        setTimeout(() => setShowPopup(false), 1200)
      } finally {
        setAdding(false)
      }
    }

    return (
      <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
        {/* Warning when product doesn't match selected vehicle */}
        {hasVehicleFilter && !selectedCompatible && (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
            This product may not fit your selected vehicle. See compatible alternatives below or reset your vehicle.
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-[360px_1fr_280px]">
          <aside className="rounded-lg bg-white">
            <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6">
              <img src={mainImage} alt={ui.name} className="h-[320px] w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {ui.gallery.map((g, i) => (
                <button key={i} onClick={() => setActiveIdx(i)} className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10 ${i===activeIdx ? 'outline-2 outline-accent' : ''}`} aria-label={`Preview ${i+1}`}>
                  <img src={g} alt={`Preview ${i+1}`} className="h-14 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <img src={ui.brandLogo} alt={ui.brand} className="h-6 w-auto" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
              <div className="ml-auto text-right text-[12px] text-gray-500">
                <div>Article No: {ui.articleNo}</div>
              </div>
            </div>
            <h2 className="text-[18px] font-semibold text-gray-900">{ui.name}</h2>
            <div className="grid grid-cols-1 gap-1">
              {ui.attributes.map((a) => (
                <div key={a.label + a.value} className="grid grid-cols-[180px_1fr] text-[13px]">
                  <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                  <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700">{a.value}</div>
                </div>
              ))}
              <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
            </div>
            {ui.description && <div className="pt-2 text-[13px] text-gray-700">{ui.description}</div>}

            {/* View Compatible Vehicles */}
            {isSelected && compatList.length > 0 && (
              <details className="mt-2 rounded-md border border-black/10  p-3">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-gray-900">View Compatible Vehicles</summary>
                <ul className="mt-2 list-disc pl-5 text-[12px] text-gray-800">
                  {compatList.map((c, i) => (<li key={i}>{c}</li>))}
                </ul>
              </details>
            )}

            {/* View OEM codes */}
            {isSelected && oemList.length > 0 && (
              <details className="mt-2 rounded-md border border-black/10 p-3">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-gray-900">View OEM</summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {oemList.map((code, i) => (
                    <span key={i} className="inline-flex items-center rounded bg-white px-2 py-1 text-[12px] ring-1 ring-black/10">{code}</span>
                  ))}
                </div>
              </details>
            )}
          </div>

          <aside className="rounded-lg bg-white">
            <div className="text-right">
              <div className="text-[22px] font-bold text-gray-900">₦{ui.price.toLocaleString('en-NG')}</div>
              <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button aria-label="Decrease" onClick={dec} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">‹</button>
              <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
              <button aria-label="Increase" onClick={inc} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">›</button>
            </div>
            {isSelected && pairsYes && (
              <div className="mt-1 text-center text-[11px] text-gray-600">Ships in pairs. Add to cart will add 2 units.</div>
            )}
            <button onClick={onAddToCart} disabled={adding} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658] disabled:opacity-60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              {adding ? 'Adding…' : 'Add to cart'}
            </button>
            <div className="mt-2 text-center text-[12px] text-purple-700">{ui.inStock ? 'In Stock' : 'Out of stock'}</div>
          </aside>
        </div>

        {/* Fixed popup confirmation */}
        {showPopup && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transform rounded-lg bg-gray-900 px-4 py-3 text-white shadow-lg ring-1 ring-black/20">
            <div className="flex items-center gap-2 text-[14px]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span>Added to cart</span>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[13px] text-gray-600">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
            <li><Link to="/parts" className="hover:underline">Car Parts</Link></li>
            {brand && (<><li aria-hidden>›</li><li><Link to={`/parts/${brand}`} className="hover:underline">{titleCase(brand)}</Link></li></>)}
            {part && (<><li aria-hidden>›</li><li className="font-semibold text-brand">{breadcrumbPartLabel}</li></>)}
          </ol>
        </nav>

        {/* Selected vehicle banner */}
        {hasVehicleFilter && (
          <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
            Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
            <button
              className="ml-2 inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium ring-1 ring-black/10"
              onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }}
            >Reset</button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
          {/* Sidebar: vehicle filter + attribute facets */}
          <aside className="sticky top-34 self-start space-y-4">
            {/* Shared Vehicle Filter; updates in place via onChange (no navigation) */}
            <VehicleFilter onChange={setVehFilter} />

            {/* Attribute filters */}
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="text-[12px] font-bold tracking-wide text-white"><span className="inline-block rounded bg-brand px-2 py-1">FILTERS</span></div>
              <div className="mt-3 space-y-4 text-[13px] text-gray-800">
                {([
                  ['DIAMETER (MM)', facetValues.diameter, fDiameter, setFDiameter],
                  ['BRAKE DISC TYPE', facetValues.type, fType, setFType],
                  ['MATERIAL', facetValues.material, fMaterial, setFMaterial],
                  ['SURFACE', facetValues.surface, fSurface, setFSurface],
                  ['HEIGHT (MM)', facetValues.height, fHeight, setFHeight],
                  ['BOLT HOLE CIRCLE (MM)', facetValues.boltCircle, fBoltCircle, setFBoltCircle],
                ] as const).map(([label, options, sel, setSel]) => (
                  <div key={label}>
                    <div className="text-[12px] font-semibold text-gray-900">{label}</div>
                    <div className="mt-2 space-y-2">
                      {options.length === 0 ? (
                        <div className="text-[12px] text-gray-500">No options</div>
                      ) : options.map((opt) => {
                        const id = `${label}-${opt}`
                        const checked = sel.includes(opt)
                        return (
                          <label key={id} className="flex cursor-pointer items-center gap-2">
                            <input type="checkbox" className="h-4 w-4 rounded border-gray-300" checked={checked} onChange={(e)=>{
                              const next = new Set(sel)
                              if (e.currentTarget.checked) next.add(opt)
                              else next.delete(opt)
                              setSel(Array.from(next))
                            }} />
                            <span className="text-[12px] text-gray-700">{opt}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <button onClick={()=>{ setFDiameter([]); setFType([]); setFMaterial([]); setFSurface([]); setFHeight([]); setFBoltCircle([]) }} className="mt-2 h-9 w-full rounded-md bg-gray-100 text-[12px] font-medium ring-1 ring-black/10">Clear all</button>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {categoryImage && (<img src={categoryImage} alt="Category" className="h-6 w-6 rounded bg-[#F6F5FA] object-contain ring-1 ring-black/10" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />)}
                <h1 className="text-[18px] font-semibold text-gray-900">{part ? titleCase(part) : 'All Parts'} {brand ? `· ${titleCase(brand)}` : ''}</h1>
              </div>
              <div className="text-[12px] text-gray-600">{loading ? 'Loading…' : `${results.length} item${results.length===1?'':'s'}`}</div>
            </div>

            {/* Inline search error banner */}
            {(q && zeroResults) && (
              <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                We couldn't find results for “{q}”. Showing related products instead.
              </div>
            )}

            {/* Zero compatible results banner (when filtering list) */}
            {(!pid && hasVehicleFilter && zeroResults) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
                No compatible products found for your selected vehicle in this section.
                <button
                  className="ml-2 inline-flex items-center rounded bg-white px-2 py-0.5 text-[11px] font-medium ring-1 ring-amber-300"
                  onClick={() => { setPersistedVehicleFilter({}); setVehFilter({}); }}
                >Reset vehicle</button>
              </div>
            )}

            {/* Selected product details panel */}
            {pid && selected && (
              <ProductPanel ui={selected} isSelected />
            )}

            {/* If no selection yet, show list of names the way CarParts links to details */}
            {!pid && !loading && (
              results.length === 0 ? (
                <div className="rounded-lg border border-black/10 bg-white p-4 text-sm text-gray-700">No products found in this section.</div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-md bg-[#FBF5E9] p-3 text-[13px] text-gray-800 ring-1 ring-black/10">
                    Select a product below to view details and related products.
                  </div>
                  {results.map((r) => (
                    <div key={r.id} className="rounded-md bg-white p-3 ring-1 ring-black/10">
                      <button onClick={() => onViewProduct(r.id, r.raw)} className="block text-left text-[14px] font-semibold text-brand hover:underline">{r.title}</button>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Related products rendered with same panel UI (filtered by compatibility) */}
            {(compatibleRelated.length > 0) && (
              <section className="mt-6 space-y-4">
                <h3 className="text-[16px] font-semibold text-gray-900">Related Products</h3>
                {compatibleRelated.slice(0, 6).map((p, i) => {
                  // Use product_id for navigation keys
                  const id = String((p as any)?.product_id ?? (p as any)?.id ?? i)
                  const ui = mapApiToUi(p)
                  return (
                    <div key={id}>
                      <ProductPanel ui={ui} />
                    </div>
                  )
                })}
              </section>
            )}

            {/* If no related compatible products */}
            {(hasVehicleFilter && compatibleRelated.length === 0 && (related.length || frontendRelated.length)) && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-800">
                No related products are compatible with your selected vehicle. Try resetting the vehicle filter.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Top brands to filter within this section */}
      {(() => {
        const onBrandSelect = (brandName: string) => {
          const brandSlug = toSlug(brandName) || 'gapa'
          const targetPart = part ? toSlug(part) : (selectedRaw ? toSlug(categoryOf(selectedRaw)) : 'parts')
          // Clear selection and query, then navigate to brand-scoped list view
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete('pid')
            next.delete('q')
            return next
          }, { replace: true })
          navigate(`/parts/${brandSlug}/${targetPart}`)
        }
        return <TopBrands title="Top brands" onSelect={onBrandSelect} />
      })()}
    </div>
  )
}
