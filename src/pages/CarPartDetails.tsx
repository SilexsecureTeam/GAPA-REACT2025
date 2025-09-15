import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getAllProducts, liveSearch, getRelatedProducts, type ApiProduct, getProductById, getAllCategories, type ApiCategory, addToCartApi } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'

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

  // Apply vehicle compatibility only (facets disabled in this view)
  const filtered = useMemo(() => scoped.filter(productMatchesVehicle), [scoped, vehFilter])

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

  const ProductPanel = ({ ui, isSelected, raw }: { ui: ReturnType<typeof mapApiToUi>; isSelected?: boolean; raw?: any }) => {
    // Derive pairs flag and selected raw source for the main (selected) product
    const rawSrc = raw ? (raw?.part ? raw.part : raw) : ((isSelected && selectedRaw) ? ((selectedRaw as any).part ? (selectedRaw as any).part : selectedRaw) : undefined)
    const rawPairsVal = rawSrc ? (rawSrc?.pairs ?? rawSrc?.sold_in_pairs ?? rawSrc?.pair ?? rawSrc?.is_pair) : undefined
    const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
    const pairsYes = Boolean(isSelected && (rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'))

    const [qty, setQty] = useState(() => (pairsYes ? 2 : 1))
    const [activeIdx, setActiveIdx] = useState(0)
    const { user } = useAuth()
    const [adding, setAdding] = useState(false)
    const [showPopup, setShowPopup] = useState(false)

    // Parse compatible vehicles and OEM codes from the raw product
    const compatList = useMemo(() => {
      if (!rawSrc) return [] as string[]
      const src: any = rawSrc
      const comp = src?.compatibility ?? src?.compatibilities ?? src?.vehicle_compatibility ?? src?.vehicleCompatibility ?? src?.fitment ?? src?.fitments
      const out: string[] = []
      const pushItem = (item: any) => {
        if (!item) return
        if (typeof item === 'string') { item.split(/\n+/).map((s)=>s.trim()).filter(Boolean).forEach((s)=>out.push(s)); return }
        if (Array.isArray(item)) { item.forEach(pushItem); return }
        if (typeof item === 'object') { Object.values(item).forEach(pushItem as any); return }
        out.push(String(item))
      }
      pushItem(comp)
      return Array.from(new Set(out))
    }, [rawSrc])

    // Build hierarchical tree (maker > model > details) from compat list
    type CompatTree = Record<string, Record<string, string[]>>
    const compatTree = useMemo<CompatTree>(() => {
      const tree: CompatTree = {}
      let currentMaker = 'Other'
      const up = (s: string) => s.trim().toUpperCase()
      const stripBullets = (s: string) => s.replace(/^[\s\t•·\-\u2022]+/, '').trim()
      const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

      for (let raw of compatList) {
        if (!raw) continue
        let s = stripBullets(raw).replace(/\s+/g, ' ')
        if (!s) continue
        const isMakerHeader = /^[A-Z][A-Z\s\-&/]+$/.test(s) && !/[()]/.test(s) && !/\d{2}\.\d{4}/.test(s) && s.length <= 40
        if (isMakerHeader) { currentMaker = s; if (!tree[currentMaker]) tree[currentMaker] = {}; continue }
        // If line repeats maker at start, strip it; else try to guess maker from first 1-2 tokens
        const tokens = s.split(/\s+/)
        if (currentMaker && new RegExp('^' + esc(currentMaker) + '\\b', 'i').test(up(s))) {
          s = s.replace(new RegExp('^' + esc(currentMaker) + '\\s+', 'i'), '')
        } else {
          const guess = tokens[0]
          currentMaker = guess
          if (!tree[currentMaker]) tree[currentMaker] = {}
          s = s.replace(new RegExp('^' + esc(guess) + '\\s+', 'i'), '')
        }
        // Derive model (before first '(' or 'YEAR OF CONSTRUCTION' or comma)
        let model = s
        let rest = ''
        const upper = s.toUpperCase()
        const yearIdx = upper.indexOf('YEAR OF CONSTRUCTION')
        const parenIdx = s.indexOf('(')
        const commaIdx = s.indexOf(',')
        const stopIdx = yearIdx >= 0 ? yearIdx : (parenIdx >= 0 ? parenIdx : (commaIdx >= 0 ? commaIdx : -1))
        if (stopIdx > 0) {
          model = s.slice(0, stopIdx).trim()
          rest = s.slice(stopIdx).trim()
        }
        if (!model) model = s
        if (!tree[currentMaker][model]) tree[currentMaker][model] = []
        if (rest) tree[currentMaker][model].push(rest)
      }
      return tree
    }, [compatList])

    const oemList = useMemo(() => {
      if (!rawSrc) return [] as string[]
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
    }, [rawSrc])

    const [copiedOEM, setCopiedOEM] = useState<number | null>(null)

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
          <aside className="rounded-lg bg-[#F6F5FA] p-6">
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

        {/* Full-width sections: Description, Compatible Vehicles, OEM Numbers */}
        <div className="mt-5 space-y-4">
          {ui.description && (
            <section className="rounded-lg bg-[#F6F5FA] p-4 ring-1 ring-black/10">
              <h3 className="text-[14px] font-semibold text-gray-900">Description</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{ui.description}</p>
            </section>
          )}

          {Object.keys(compatTree).length > 0 && (
            <section className="rounded-lg bg-white p-4 ring-1 ring-black/10">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Compatible Vehicles</h3>
                <span className="text-[12px] text-gray-600">{compatList.length} entries</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.keys(compatTree).sort().map((maker) => {
                  const models = compatTree[maker] || {}
                  return (
                    <details key={maker} className="rounded-md border border-black/10 bg-[#F6F5FA] p-3" open>
                      <summary className="cursor-pointer list-none text-[13px] font-semibold text-gray-900">{maker} <span className="ml-1 text-[11px] font-normal text-gray-600">({Object.keys(models).length} models)</span></summary>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {Object.keys(models).sort().map((model) => {
                          const detailsList = models[model]
                          return (
                            <div key={maker + '::' + model} className="rounded-md bg-white p-2 ring-1 ring-black/5">
                              <div className="text-[12px] font-medium text-gray-900">{model}</div>
                              {detailsList && detailsList.length > 0 ? (
                                <ul className="mt-1 list-disc pl-5 text-[12px] text-gray-800">
                                  {detailsList.map((d, i) => (<li key={i}>{d}</li>))}
                                </ul>
                              ) : (
                                <div className="mt-1 text-[12px] text-gray-600">No additional details</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>
          )}

          {oemList.length > 0 && (
            <section className="rounded-lg bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[14px] font-semibold text-gray-900">OEM Numbers</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {oemList.map((code, i) => (
                  <span key={i} className="inline-flex items-center gap-2 rounded bg-[#F6F5FA] px-2 py-1 text-[12px] ring-1 ring-black/10">
                    <span>{code}</span>
                    <button
                      type="button"
                      className="inline-flex items-center rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-black/10 hover:bg-gray-50"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(code)
                          setCopiedOEM(i)
                          setTimeout(() => setCopiedOEM((prev) => (prev === i ? null : prev)), 1200)
                        } catch {}
                      }}
                      aria-label={`Copy ${code}`}
                    >{copiedOEM === i ? 'Copied' : 'Copy'}</button>
                  </span>
                ))}
              </div>
            </section>
          )}
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

  // Page layout
  return (
    <div className="mx-auto max-w-6xl px-3 py-4">
      {/* Breadcrumbs */}
      <nav className="mb-4 text-[12px] text-gray-600">
        <Link to="/" className="hover:text-gray-900">Home</Link>
        <span className="mx-1">/</span>
        <Link to="/parts" className="hover:text-gray-900">Car Parts</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{breadcrumbPartLabel}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside>
          <VehicleFilter onChange={(s)=> setVehFilter(s)} />
          {categoryImage && (
            <div className="mt-4 rounded-lg bg-[#F6F5FA] p-3 ring-1 ring-black/10">
              <img src={categoryImage} alt="Category" className="mx-auto h-28 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
            </div>
          )}
        </aside>

        <main className="space-y-6">
          {selected && selectedRaw ? (
            <ProductPanel ui={selected} isSelected raw={selectedRaw} />
          ) : (
            <section className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Results</h3>
                <span className="text-[12px] text-gray-600">{results.length} items</span>
              </div>
              {zeroResults ? (
                <div className="text-[13px] text-gray-700">No products match your selection.</div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3">
                  {results.map((r) => (
                    <button key={r.id} onClick={() => onViewProduct(r.id, r.raw)} className="text-left">
                      <div className="rounded-lg bg-white p-2 ring-1 ring-black/10 hover:shadow">
                        <div className="flex items-center justify-center rounded bg-[#F6F5FA] p-3">
                          <img src={r.image} alt={r.title} className="h-28 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                        </div>
                        <div className="mt-2 text-[12px] font-medium text-gray-900 line-clamp-2">{r.title}</div>
                        <div className="mt-1 text-[12px] text-gray-600">₦{r.price.toLocaleString('en-NG')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Compatible alternatives first if available */}
          {selected && compatibleRelated.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Compatible Alternatives</h3>
                <span className="text-[12px] text-gray-600">{compatibleRelated.length}</span>
              </div>
              {compatibleRelated.map((p: any) => {
                const id = String((p?.product_id ?? p?.id) ?? '')
                const ui = mapApiToUi(p)
                return (
                  <div key={id}>
                    <ProductPanel ui={ui} raw={p} />
                  </div>
                )
              })}
            </section>
          )}

          {/* More related */}
          {selected && finalRelated.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-gray-900">Related Products</h3>
                <span className="text-[12px] text-gray-600">{finalRelated.length}</span>
              </div>
              {finalRelated.map((p: any) => {
                const id = String((p?.product_id ?? p?.id) ?? '')
                const ui = mapApiToUi(p)
                return (
                  <div key={id}>
                    <ProductPanel ui={ui} raw={p} />
                  </div>
                )
              })}
            </section>
          )}
        </main>
      </div>
    </div>
  )
}
