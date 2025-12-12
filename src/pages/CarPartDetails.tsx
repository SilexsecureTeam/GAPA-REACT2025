import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { getAllProducts, liveSearch, getRelatedProducts, type ApiProduct, getProductById, getAllCategories, type ApiCategory, addToCartApi, type ApiManufacturer, getProductReviews, type ApiReview,
  checkSuitability, getSuitabilityModel, getSubSuitabilityModel, getProductOEM, getProductProperties } from '../services/api'
import { normalizeApiImage, pickImage, productImageFrom, categoryImageFrom, manufacturerImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, vehicleMatches as sharedVehicleMatches, type VehicleFilterState as VehState } from '../services/vehicle'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import { toast } from 'react-hot-toast'
import useManufacturers from '../hooks/useManufacturers'
import { makerIdOf, isViewEnabledCategory, categoryOf, brandOf } from '../utils/productMapping'
import ProductActionCard from '../components/ProductActionCard'

// --- Helpers ---
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

type Attr = { label: string; value: string }

type UiProduct = {
  id: string
  brand: string
  brandLogo: string
  name: string
  articleNo: string
  price: number
  image: string
  gallery: string[]
  rating: number
  reviews: number
  inStock: boolean
  attributes: Attr[]
  description?: string
  makerId?: string
  makerName?: string
  makerImage?: string
  category?: string
  soldInPairs?: boolean
}

function attrsFrom(p: any): Attr[] {
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

function mapApiToUi(p: any, manufacturers: any[] = []): UiProduct {
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const id = String(src?.product_id ?? src?.id ?? '')
  const brandName = String(src?.brand?.name || src?.brand || src?.manufacturer || src?.maker || 'GAPA')
  const brandLogo = normalizeApiImage(pickImage(src?.brand)) || normalizeApiImage(src?.brand_logo) || normalizeApiImage(pickImage(src)) || logoImg
  const name = String(src?.part_name || src?.name || src?.title || src?.product_name || 'Car Part')
  const articleNo = String(src?.article_no || src?.article_number || src?.article || src?.sku || src?.code || 'N/A')
  const price = Number(src?.price || src?.selling_price || src?.amount || 0)
  
  const image = productImageFrom(src) || normalizeApiImage(pickImage(src) || '') || logoImg
  const galleryFields = [src?.img_url, src?.img_url_1, src?.img_url_2].filter(Boolean) as string[]
  const galleryFromFields = galleryFields.map((s) => productImageFrom({ img_url: s }) || normalizeApiImage(s) || '').filter(Boolean)
  const rawImages: any[] = Array.isArray(src?.images) ? src.images : Array.isArray(src?.gallery) ? src.gallery : []
  const builtGallery = rawImages.map((x) => {
    if (typeof x === 'string') return productImageFrom({ img_url: x }) || normalizeApiImage(x) || ''
    return productImageFrom(x) || normalizeApiImage(pickImage(x) || '') || ''
  })
  const gallery = Array.from(new Set([...galleryFromFields, ...builtGallery, image].filter(Boolean)))
  
  const rating = Number(src?.rating || src?.stars || 4)
  const reviews = Number(src?.reviews_count || src?.reviews || 0)
  const inStock = Boolean((src as any)?.in_stock ?? (src as any)?.live_status ?? true)
  const attributes = attrsFrom(src)
  const description = String(src?.description || src?.details || '')
  
  const makerId = String(src?.saler_id ?? src?.maker_id_ ?? src?.maker_id ?? src?.manufacturer_id ?? '').trim()
  let makerName = String(src?.maker?.name || src?.manufacturer?.name || src?.manufacturer || src?.maker || '').trim()
  let makerImage = manufacturerImageFrom(src?.maker || src?.manufacturer || src) || ''

  if (makerId && manufacturers.length) {
    const manufacturer = manufacturers.find((m: any) => {
      const mId = String(m.id ?? m?.maker_id_ ?? m?.maker_id ?? m?.manufacturer_id ?? '')
      const mSalerId = String((m as any)?.saler_id ?? '')
      return (mSalerId && mSalerId === makerId) || (mId === makerId)
    })
    if (manufacturer) {
      makerImage = manufacturerImageFrom(manufacturer) || makerImage
      makerName = String(manufacturer.name || manufacturer.title || (manufacturer as any)?.maker_name || makerName || '').trim()
    }
  }

  const cat = categoryOf(src)
  const rawPairsVal = src?.pairs ?? src?.sold_in_pairs ?? src?.pair ?? src?.is_pair
  const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
  const soldInPairs = rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'

  return { id, brand: brandName, brandLogo: brandLogo || logoImg, name, articleNo, price, image, gallery: gallery.length ? gallery : [image], rating, reviews, inStock, attributes, description, makerId, makerName, makerImage, category: cat, soldInPairs }
}

function ImageWithFallback({ src, alt, className, showFallback = false }: { src: string | undefined; alt: string; className?: string; showFallback?: boolean }) {
  const safeSrc = src || (showFallback ? logoImg : '')
  const [current, setCurrent] = useState(safeSrc)
  const [hasError, setHasError] = useState(false)
  useEffect(() => { setCurrent(safeSrc); setHasError(false) }, [safeSrc])
  
  if (!current || hasError && !showFallback) {
    return <div className={className} />
  }
  
  return <img src={current} alt={alt} className={className} onError={() => { if (showFallback && current !== logoImg) setCurrent(logoImg); else setHasError(true) }} loading="lazy" />
}

const RELATED_LIMIT = 24
const INITIAL_VISIBLE_RELATED = 10

const __productUiCache = new Map<string, UiProduct>()
function mapApiToUiCached(p: any, manufacturers: any[] = []) {
  const src = (p && typeof p === 'object' && 'part' in p) ? (p as any).part : p
  const id = String(src?.product_id ?? src?.id ?? '')
  if (id && __productUiCache.has(id)) return __productUiCache.get(id)!
  const ui = mapApiToUi(p, manufacturers)
  if (id) __productUiCache.set(id, ui)
  return ui
}

// --- Component 1: Compatibility Details Tree ---
function CompatDetails({ compatTree }: { compatTree: Record<string, Record<string, string[]>> }) {
  const makers = useMemo(() => Object.keys(compatTree).sort(), [compatTree])
  const [expandedMaker, setExpandedMaker] = useState<string | null>(null)

  useEffect(() => {
    setExpandedMaker(makers.length > 0 ? makers[0] : null)
  }, [makers])

  return (
    <div className="space-y-2">
      {makers.map((maker) => {
        const isOpen = expandedMaker === maker
        return (
          <details key={`maker-${maker}`} className="rounded-md bg-gray-50" open={isOpen}>
            <summary
              className="cursor-pointer px-3 py-2 font-semibold text-sm text-gray-800"
              onClick={(e) => { e.preventDefault(); setExpandedMaker(prev => prev === maker ? null : maker) }}
            >
              {maker}
            </summary>
            <div className="px-3 pb-3 pt-0">
              {Object.keys(compatTree[maker] || {}).length === 0 ? (
                <div className="text-sm text-gray-700">No specific models listed.</div>
              ) : (
                Object.entries(compatTree[maker]).map(([model, details]) => (
                  <details key={`model-${maker}-${model}`} className="mt-2 rounded-md bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-black/5">
                    <summary className="cursor-pointer font-medium">{model}</summary>
                    <div className="mt-2 pl-2 text-gray-600">
                      {details && details.length > 0 ? (
                        <ul className="list-disc pl-5">
                          {details.map((d, i) => <li key={`detail-${maker}-${model}-${i}`}>{d}</li>)}
                        </ul>
                      ) : (
                        <div className="text-sm text-gray-600">No additional details</div>
                      )}
                    </div>
                  </details>
                ))
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}

// --- Component 2: Product Panel (Standalone) ---
const ProductPanel = ({ ui, isSelected, raw, onSelect, oem = [] }: { ui: ReturnType<typeof mapApiToUi>; isSelected?: boolean; raw?: any; onSelect?: (id: string, raw: any) => void, oem?: any[] }) => {
  const navigate = useNavigate()
  const { formatPrice } = useCurrency()
  const { has: wishlistHas, toggle: wishlistToggle } = useWishlist()
  const { user } = useAuth()
  
  // Logic
  const rawSrc = raw ? (raw?.part ? raw.part : raw) : undefined
  const rawPairsVal = rawSrc ? (rawSrc?.pairs ?? rawSrc?.sold_in_pairs ?? rawSrc?.pair ?? rawSrc?.is_pair) : undefined
  const pairsStr = String(rawPairsVal ?? '').trim().toLowerCase()
  const pairsYes = Boolean(isSelected && (rawPairsVal === true || pairsStr === 'yes' || pairsStr === 'true' || pairsStr === '1'))

  const [qty, setQty] = useState(() => (pairsYes ? 2 : 1))
  const [activeIdx, setActiveIdx] = useState(0)
  const [adding, setAdding] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [categories, setCategories] = useState<ApiCategory[]>([])

  const wished = wishlistHas(ui.id)

  const compatList = useMemo(() => {
    if (!rawSrc || !isSelected) return [] as string[]
    const src: any = rawSrc
    const comp = src?.compatibility ?? src?.compatibilities ?? src?.vehicle_compatibility ?? src?.vehicleCompatibility ?? src?.fitment ?? src?.fitments
    const out: string[] = []
    const pushItem = (item: any) => {
      if (!item) return
      if (typeof item === 'string') { item.split(/\n+/).map((s) => s.trim()).filter(Boolean).forEach((s) => out.push(s)); return }
      if (Array.isArray(item)) { item.forEach(pushItem); return }
      if (typeof item === 'object') { Object.values(item).forEach(pushItem as any); return }
      out.push(String(item))
    }
    pushItem(comp)
    return Array.from(new Set(out))
  }, [rawSrc, isSelected])

  const compatTree = useMemo(() => {
      if (!isSelected || compatList.length === 0) return {}
      const tree: Record<string, Record<string, string[]>> = {}
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
        const tokens = s.split(/\s+/)
        if (currentMaker && new RegExp('^' + esc(currentMaker) + '\\b', 'i').test(up(s))) {
          s = s.replace(new RegExp('^' + esc(currentMaker) + '\\s+', 'i'), '')
        } else {
          const guess = tokens[0]; (currentMaker = guess)
          if (!tree[currentMaker]) tree[currentMaker] = {}
          s = s.replace(new RegExp('^' + esc(guess) + '\\s+', 'i'), '')
        }
        let model = s
        let rest = ''
        const upper = s.toUpperCase()
        const yearIdx = upper.indexOf('YEAR OF CONSTRUCTION')
        const parenIdx = s.indexOf('(')
        const commaIdx = s.indexOf(',')
        const stopIdx = yearIdx >= 0 ? yearIdx : (parenIdx >= 0 ? parenIdx : (commaIdx >= 0 ? commaIdx : -1))
        if (stopIdx > 0) { model = s.slice(0, stopIdx).trim(); rest = s.slice(stopIdx).trim() }
        if (!model) model = s
        if (!tree[currentMaker][model]) tree[currentMaker][model] = []
        if (rest) tree[currentMaker][model].push(rest)
      }
      return tree
  }, [compatList, isSelected])

  const oemList = useMemo(() => {
    if (!rawSrc || !isSelected) return [] as string[]
    const src: any = rawSrc
    const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList ?? src?.OEM ?? src?.OEM_NO
    const out: string[] = []
    const push = (v: any) => {
      if (!v) return
      if (typeof v === 'string') { v.split(/[\n,;\s]+/).map((s) => s.trim()).filter(s => s.length > 0).forEach((s) => out.push(s)); return }
      if (Array.isArray(v)) { v.forEach(push); return }
      if (typeof v === 'object') { Object.values(v).map((x) => String(x).trim()).filter(Boolean).forEach((x) => out.push(x)); return }
      out.push(String(v))
    }
    push(o)
    if (oem && oem.length > 0) {
      oem.forEach((item: any) => {
          const code = item?.oem || item?.OEM || item?.code || item?.oem_number
          if (code) push(code)
      })
    }
    return Array.from(new Set(out)).filter(s => s && s !== 'null' && s !== 'undefined')
  }, [rawSrc, isSelected, oem])

  const [copiedOEM, setCopiedOEM] = useState<number | null>(null)
  const [suitabilityLoading, setSuitabilityLoading] = useState(false)
  const [suitabilityData, setSuitabilityData] = useState<any[]>([])
  const [suitabilityExplicitEmpty, setSuitabilityExplicitEmpty] = useState(false)

  // Load suitability
  useEffect(() => {
    let alive = true
    if (!isSelected || !ui?.id) return
    setSuitabilityLoading(true)
    setSuitabilityData([])
    setSuitabilityExplicitEmpty(false)
    ;(async () => {
      try {
        const models = await checkSuitability(ui.id)
        if (!alive) return
        if (models && (models as any).__emptySuitability) {
          setSuitabilityData([])
          setSuitabilityExplicitEmpty(true)
          return
        }
        const modelArr: any[] = Array.isArray(models) ? models : []
        if (modelArr.length === 0) {
           setSuitabilityData([])
           return
        }
        const prepared = await Promise.all(modelArr.map(async (m: any) => {
          const modelId = m?.id ?? m?.model_id
          const sub = await getSuitabilityModel(modelId)
          const subModels = Array.isArray(sub) ? sub.map((s: any) => ({ ...s, subSubHtml: undefined, loading: false, error: null })) : []
          return { modelId, modelName: m?.model || m?.name || '', raw: m, subModels }
        }))
        if (alive) setSuitabilityData(prepared)
      } catch (e: any) {
        if (alive) setSuitabilityData([])
      } finally {
        if (alive) setSuitabilityLoading(false)
      }
    })()
    
    // Also load categories for the View Details button logic
    getAllCategories().then(c => {
      if(alive && Array.isArray(c)) setCategories(c)
    }).catch(()=>{})
    
    return () => { alive = false }
  }, [isSelected, ui?.id])

  const loadSubSub = async (modelIndex: number, subIndex: number) => {
    setSuitabilityData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev || []))
      const target = copy[modelIndex]?.subModels?.[subIndex]
      if (!target) return prev
      if (target.subSubHtml || target.loading) return prev
      target.loading = true
      return copy
    })
    try {
      const prev = suitabilityData[modelIndex]
      const sub = prev?.subModels?.[subIndex]
      const subModelId = sub?.id ?? sub?.sub_model_id
      const res = await getSubSuitabilityModel(subModelId)
      const html = Array.isArray(res) && res.length ? (res[0]?.sub_sub_model || '') : ''
      setSuitabilityData((prev) => {
        const copy = JSON.parse(JSON.stringify(prev || []))
        if (!copy[modelIndex] || !copy[modelIndex].subModels) return prev
        copy[modelIndex].subModels[subIndex].subSubHtml = html
        copy[modelIndex].subModels[subIndex].loading = false
        copy[modelIndex].subModels[subIndex].error = null
        return copy
      })
    } catch (e: any) {
      setSuitabilityData((prev) => {
        const copy = JSON.parse(JSON.stringify(prev || []))
        if (!copy[modelIndex] || !copy[modelIndex].subModels) return prev
        copy[modelIndex].subModels[subIndex].loading = false
        copy[modelIndex].subModels[subIndex].error = 'Failed to load details'
        return copy
      })
    }
  }

  const inc = () => setQty((v) => (pairsYes ? Math.min(v + 2, 99) : Math.min(v + 1, 99)))
  const dec = () => setQty((v) => (pairsYes ? Math.max(v - 2, 1) : Math.max(v - 1, 1)))
  const mainImage = ui.gallery[activeIdx] || ui.image

  const onAddToCart = async () => {
    if (adding) return
    setAdding(true)
    try {
      const effQty = isSelected ? qty : qty
      if (user && user.id) { await addToCartApi({ user_id: user.id, product_id: ui.id, quantity: effQty }) }
      else { addGuestCartItem(ui.id, effQty) }
      setShowPopup(true)
      navigate({ hash: '#cart' })
      setTimeout(() => setShowPopup(false), 1200)
    } catch (e) {
      setShowPopup(true); navigate({ hash: '#cart' }); setTimeout(() => setShowPopup(false), 1200)
    } finally { setAdding(false) }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white p-4 ring-1 ring-black/10">
      <div className="grid gap-6 lg:grid-cols-7">
        <aside className="rounded-lg p-6 row-span-2 lg:col-span-3">
          <div className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6 ${onSelect && !isSelected ? 'cursor-pointer hover:opacity-90' : ''}`}
            onClick={() => { if (onSelect && !isSelected) onSelect(ui.id, raw) }}>
            <ImageWithFallback src={mainImage} alt={ui.name} className="h-[320px] w-auto object-contain" showFallback={true} />
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {ui.gallery.map((g, i) => (
              <button key={`g-${ui.id}-${i}`} onClick={() => setActiveIdx(i)} className={`flex items-center justify-center rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10 ${i === activeIdx ? 'outline-2 outline-accent' : ''}`} aria-label={`Preview ${i + 1}`}>
                <ImageWithFallback src={g} alt={`Preview ${i + 1}`} className="h-14 w-auto object-contain" showFallback={true} />
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-3 col-span-2">
          <div className="flex items-start gap-2">
            <p className='font-semibold'>Article No: {ui.articleNo}</p>
            <div className="ml-auto flex items-center gap-2">
              <WishlistButton ariaLabel={wished ? 'Remove from wishlist' : 'Add to wishlist'} size={22} active={wished} onToggle={(active) => { wishlistToggle(ui.id); if (active) toast.success('Added to wishlist') }} />
            </div>
          </div>
          {ui.makerId && ui.makerId !== 'null' && (ui.makerImage || ui.makerName) && (
            <div className="flex items-center gap-3 bg-white p-1">
              {ui.makerImage && <ImageWithFallback src={ui.makerImage} alt={ui.makerName || 'Manufacturer'} className="h-16 w-16 object-contain" />}
              {ui.makerName && <div className="text-[14px] text-gray-600"><span className="font-medium">Manufacturer:</span> {ui.makerName}</div>}
            </div>
          )}
          <h2 className="text-[18px] font-semibold text-gray-900">
            {onSelect && !isSelected ? (
              <button type="button" onClick={() => onSelect(ui.id, raw)} className="text-left hover:underline focus:outline-none">{ui.name}</button>
            ) : ui.name}
          </h2>
          <div className="grid grid-cols-1 gap-1">
            {ui.attributes.slice(0, 8).map((a) => (
              <div key={a.label + a.value} className="grid grid-cols-1 text-[13px] sm:grid-cols-[100px_1fr] !md:pr-5">
                <div className="rounded-t-md bg-[#FBF5E9] pl-3 py-1.5 font-medium text-gray-800 sm:rounded-l-md sm:rounded-tr-none">{a.label}</div>
                <div className="rounded-b-md bg-[#FBF5E9] px-0 py-1.5 text-gray-700 break-words sm:rounded-r-md sm:rounded-bl-none">{a.value}</div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg bg-white col-span-2 px-1">
          <div className="text-right">
            <div className="text-[22px] font-bold text-gray-900">{formatPrice(ui.price)}</div>
            <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button aria-label="Decrease" onClick={dec} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">‹</button>
            <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
            <button aria-label="Increase" onClick={inc} disabled={Boolean(isSelected && pairsYes)} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700 disabled:opacity-50">›</button>
          </div>
          {isSelected && pairsYes && <div className="mt-1 text-center text-[11px] text-gray-600">Ships in pairs. Add to cart will add 2 units.</div>}
          <button onClick={onAddToCart} disabled={adding} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658] disabled:opacity-60">
            {adding ? 'Adding…' : 'Add to cart'}
          </button>
          {isSelected && (() => {
            const rawCat = rawSrc ? categoryOf(rawSrc) : ''
            let categoryName = rawCat
            if (/^\d+$/.test(rawCat)) {
               const match = categories.find(c => String(c.id) === rawCat)
               categoryName = match ? String(match.title || match.name) : ''
            }
            const shouldShowFullDetails = isViewEnabledCategory(categoryName)
            
            return shouldShowFullDetails ? (
              <Link to={`/product/${ui.id}?from=${encodeURIComponent(window.location.pathname + window.location.search)}`} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white text-[13px] font-medium text-gray-900 ring-1 ring-black/10 hover:bg-gray-50">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                View Full Details
              </Link>
            ) : null
          })()}
          {!isSelected && onSelect && (
            <button type="button" onClick={() => onSelect(ui.id, raw)} className="mt-2 w-full rounded-md bg-white text-[12px] font-medium text-accent underline-offset-2 hover:underline">View details</button>
          )}
          <div className="mt-2 text-center text-[12px] text-purple-700">{ui.inStock ? 'In Stock' : 'Out of stock'}</div>
        </aside>

        <div className="mt-5 space-y-4 lg:col-span-4">
          {ui.description && (
            <section className="rounded-lg bg-[#F6F5FA] p-4 ring-1 ring-black/10">
              <h3 className="text-[14px] font-semibold text-gray-900">Description</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{ui.description}</p>
            </section>
          )}
          
          {suitabilityLoading ? (
            <div className="rounded-lg bg-white p-4 text-center text-gray-500">Loading vehicle compatibility...</div>
          ) : suitabilityExplicitEmpty ? (
            <div className="rounded-lg bg-white ring-1 ring-black/10">
              <div className="px-4 py-3 text-[13px] font-semibold text-gray-900">Suitable vehicles</div>
              <div className="p-3 text-sm text-gray-700">Compatible with all vehicles</div>
            </div>
          ) : suitabilityData && suitabilityData.length > 0 ? (
            <div className="rounded-lg bg-white ring-1 ring-black/10">
              <div className="px-4 py-3 text-[13px] font-semibold text-gray-900">Suitable vehicles</div>
              <div className="max-h-60 overflow-auto p-3 pt-0 space-y-2 no-scrollbar">
                {suitabilityData.map((modelItem: any, mi: number) => (
                  <details key={`suit-model-${mi}`} className="rounded-md bg-gray-50" >
                    <summary className="cursor-pointer px-3 py-2 font-medium text-sm text-gray-800">{modelItem.modelName || modelItem.raw?.model || `Model ${modelItem.modelId}`}</summary>
                    <div className="mt-2 space-y-2 pl-3">
                      {Array.isArray(modelItem.subModels) && modelItem.subModels.length > 0 ? (
                        modelItem.subModels.map((sub: any, si: number) => (
                          <details key={`suit-sub-${mi}-${si}`} className="rounded-md bg-white px-3 py-2 text-sm text-gray-700 ring-1 ring-black/5" onToggle={(e) => {
                            try {
                              const opened = (e.target as HTMLDetailsElement).open
                              if (opened && !sub.subSubHtml && !sub.loading) {
                                loadSubSub(mi, si)
                              }
                            } catch (err) { }
                          }}>
                            <summary className="cursor-pointer font-medium">{sub?.sub_model || sub?.name || `Variant ${sub?.id || si}`}</summary>
                            <div className="mt-2 pl-2 text-gray-600">
                              {sub.loading ? (
                                <div className="text-sm text-gray-500">Loading details...</div>
                              ) : sub.error ? (
                                <div className="text-sm text-red-500">{sub.error}</div>
                              ) : sub.subSubHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: sub.subSubHtml }} />
                              ) : (
                                <div className="text-sm text-gray-500">No further details available.</div>
                              )}
                            </div>
                          </details>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">No sub-models available for this model.</div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : oemList.length > 0 ? (
            <details className="rounded-lg bg-white ring-1 ring-black/10">
              <summary className="cursor-pointer list-none px-4 py-3 text-[13px] font-semibold text-gray-900">OEM Part Numbers</summary>
              <div className="p-3 pt-0">
                <div className="mt-1 flex flex-wrap gap-2">
                  {oemList.map((code, i) => (
                    <span key={`oem-${i}`} className="inline-flex items-center gap-2 rounded bg-[#F6F5FA] px-2 py-1 text-[12px] ring-1 ring-black/10">
                      <span>{code}</span>
                      <button
                        type="button"
                        className="inline-flex items-center rounded bg-white px-1.5 py-0.5 text-[11px] ring-1 ring-black/10 hover:bg-gray-50"
                        onClick={async () => {
                          try { await navigator.clipboard.writeText(code); setCopiedOEM(i); setTimeout(() => setCopiedOEM((prev) => (prev === i ? null : prev)), 1200) } catch {}
                        }}
                        aria-label={`Copy ${code}`}
                      >{copiedOEM === i ? 'Copied' : 'Copy'}</button>
                    </span>
                  ))}
                </div>
              </div>
            </details>
          ) : null}
        </div>
      </div>
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

// --- Main Page Component ---
export default function CarPartDetails() {
  const navigate = useNavigate()
  const { formatPrice } = useCurrency()
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const returnUrl = searchParams.get('from') || '/parts'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Product Data
  const [prod, setProd] = useState<UiProduct | null>(null)
  const [productRaw, setProductRaw] = useState<any>(null)
  
  // Secondary Data
  const [oem, setOem] = useState<any[]>([])
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [related, setRelated] = useState<ApiProduct[]>([])
  
  // Filter state
  const [vehFilter, setVehFilter] = useState<VehState>(() => getPersistedVehicleFilter())
  const hasVehicleFilter = useMemo(() => Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName), [vehFilter])
  
  // Suitability (fetched from backend)
  const [suitabilityData, setSuitabilityData] = useState<any[]>([])
  const [suitabilityExplicitEmpty, setSuitabilityExplicitEmpty] = useState(false)

  const { manufacturers } = useManufacturers()
  
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'compatibility' | 'reviews'>('description')
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [copiedOEM, setCopiedOEM] = useState<number | null>(null)

  // Handle vehicle filter change
  const handleVehFilterChange = useCallback((next: VehState) => {
    setVehFilter(prev => {
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev
      return next
    })
  }, [])

  // Check compatibility of the MAIN product against current filter
  const isCompatible = useMemo(() => {
    if (!productRaw || !hasVehicleFilter) return true
    return sharedVehicleMatches(productRaw, vehFilter)
  }, [productRaw, vehFilter, hasVehicleFilter])

  // Fetch all data in parallel for speed
  useEffect(() => {
    let alive = true
    if (!id) return
    setLoading(true)
    setError(null)
    setSuitabilityData([])
    setSuitabilityExplicitEmpty(false)

    ;(async () => {
      try {
        // 1. Fetch Main Product First (Blocker)
        const raw = await getProductById(id)
        if (!alive) return
        setProductRaw(raw)
        const ui = mapApiToUi(raw, manufacturers)
        setProd(ui)

        // 2. Fire other requests in parallel
        const results = await Promise.allSettled([
          getProductOEM(id),
          getProductReviews(id),
          getRelatedProducts(id),
          checkSuitability(id)
        ])
        
        if (!alive) return

        // OEM
        if (results[0].status === 'fulfilled') setOem(Array.isArray(results[0].value) ? results[0].value : [])
        
        // Reviews
        if (results[1].status === 'fulfilled') setReviews(Array.isArray(results[1].value) ? results[1].value : [])
        
        // Related (take first 12)
        if (results[2].status === 'fulfilled') {
            const relArr = Array.isArray(results[2].value) ? results[2].value : []
            setRelated(relArr.slice(0, 12))
        }

        // Suitability
        if (results[3].status === 'fulfilled') {
          const models = results[3].value
          if (models && (models as any).__emptySuitability) {
            setSuitabilityExplicitEmpty(true)
          } else {
            const modelArr: any[] = Array.isArray(models) ? models : []
            // Fetch sub-models for these top-level models in parallel
            const prepared = await Promise.all(modelArr.map(async (m: any) => {
              const modelId = m?.id ?? m?.model_id
              const sub = await getSuitabilityModel(modelId)
              const subModels = Array.isArray(sub) ? sub.map((s: any) => ({ ...s, subSubHtml: undefined, loading: false, error: null })) : []
              return { modelId, modelName: m?.model || m?.name || '', raw: m, subModels }
            }))
            if (alive) setSuitabilityData(prepared)
          }
        }

      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load product')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    
    return () => { alive = false }
  }, [id, manufacturers]) 

  const avgRating = useMemo(() => {
    if (!reviews.length) return prod?.rating || 0
    return reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / reviews.length
  }, [reviews, prod])

  const oemList = useMemo(() => {
    if (!productRaw) return []
    const src = productRaw.part || productRaw
    const o = src?.oem ?? src?.oem_no ?? src?.oem_number ?? src?.oem_numbers ?? src?.oemNumbers ?? src?.oem_list ?? src?.oemList ?? src?.OEM ?? src?.OEM_NO
    const out: string[] = []
    const push = (v: any) => {
      if (!v) return
      if (typeof v === 'string') { v.split(/[\n,;\s]+/).map((s) => s.trim()).filter((s: string) => s.length > 0).forEach((s) => out.push(s)); return }
      if (Array.isArray(v)) { v.forEach(push); return }
      out.push(String(v))
    }
    push(o)
    oem.forEach((item: any) => {
        const code = item?.oem || item?.OEM || item?.code || item?.oem_number
        if (code) push(code)
    })
    return Array.from(new Set(out)).filter(s => s && s !== 'null')
  }, [productRaw, oem])

  const onViewProduct = async (id: string, p: any) => {
    // Only pre-fetch details for view-enabled categories
    const categoryName = categoryOf(p)
    const shouldFetchDetails = isViewEnabledCategory(categoryName)
    
    // We fire the fetch but don't await it to block navigation - optimist approach
    if (shouldFetchDetails) {
       getProductById(id).catch(() => {}) 
    }
    
    const brandSlug = toSlug(brandOf(p) || 'gapa')
    const partSlug = toSlug(categoryOf(p) || 'parts')
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.delete('q'); next.set('pid', id); return next }, { replace: true })
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(id)}`, { state: { productData: p }, replace: true })
  }

  const onAddToCart = async (p: any) => {
      const pid = String((p as any)?.product_id ?? (p as any)?.id ?? '')
      if (!pid) return
      try {
        await addToCartApi({ user_id: 'guest', product_id: pid, quantity: 1 }) // Simplified for example, real auth used in ProductActionCard
        navigate({ hash: '#cart' })
      } catch {
        navigate({ hash: '#cart' })
      }
  }

  if (loading) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 pt-12">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-64 rounded bg-gray-200" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square w-full rounded-xl bg-gray-200" />
            <div className="space-y-4">
              <div className="h-10 w-3/4 rounded bg-gray-200" />
              <div className="h-32 w-full rounded bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !prod) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 pt-12 text-center">
        <h2 className="text-2xl font-bold">Product Not Found</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-brand underline">Go Back</button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-4 overflow-x-hidden">
      <nav className="mb-4 text-[12px] text-gray-600">
        <Link to="/" className="hover:text-gray-900">Home</Link>
        <span className="mx-1">/</span>
        <Link to="/parts" className="hover:text-gray-900">Car Parts</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-900">{prod.name}</span>
      </nav>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 self-start">
            <div className="rounded-xl bg-gradient-to-br from-[#201A2B] via-[#2d2436] to-[#201A2B] p-[2px] shadow-xl">
              <div className="rounded-[10px] bg-white p-2">
                 <VehicleFilter onChange={handleVehFilterChange} />
                 {hasVehicleFilter && (
                   <div className="mt-2 px-2 text-xs font-bold text-green-700">
                     Active: {[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' • ')}
                   </div>
                 )}
              </div>
            </div>
          </div>
        </aside>

        <main className="space-y-6 min-w-0">
          <div className="overflow-hidden rounded-xl bg-white p-4 ring-1 ring-black/10">
            {hasVehicleFilter && !isCompatible && (
              <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                ⚠️ This product does not match your selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' ')}</strong>.
              </div>
            )}
            
            <ProductPanel ui={prod} isSelected raw={productRaw} oem={oem} />

            {/* Tabs */}
            <div className="mt-8 border-t border-gray-100 pt-6">
               <div className="flex gap-6 border-b border-gray-200 pb-1 text-sm font-medium text-gray-600 overflow-x-auto">
                  {['description','specs','compatibility','reviews'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t as any)} className={`pb-2 capitalize ${activeTab === t ? 'border-b-2 border-brand text-gray-900' : 'hover:text-gray-900'}`}>
                      {t === 'compatibility' ? 'Compatibility & OEM' : t}
                    </button>
                  ))}
               </div>
               
               <div className="py-6">
                 {activeTab === 'description' && (
                   <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{prod.description || 'No description available.'}</p>
                 )}
                 
                 {activeTab === 'specs' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                       {prod.attributes.map((a, i) => (
                         <div key={i} className="flex justify-between border-b border-gray-100 py-2 text-sm">
                            <span className="font-medium text-gray-600">{a.label}</span>
                            <span className="text-gray-900">{a.value}</span>
                         </div>
                       ))}
                    </div>
                 )}
                 
                 {activeTab === 'compatibility' && (
                   <div className="space-y-6">
                      {oemList.length > 0 && (
                        <div>
                          <h4 className="font-bold text-gray-900 mb-2">OEM Numbers</h4>
                          <div className="flex flex-wrap gap-2">
                             {oemList.map((code, i) => (
                               <span key={i} className="inline-flex items-center gap-2 rounded bg-gray-100 px-2 py-1 text-xs font-mono text-gray-800 cursor-pointer hover:bg-gray-200" onClick={() => { navigator.clipboard.writeText(code); setCopiedOEM(i); setTimeout(() => setCopiedOEM(null), 1000) }}>
                                 {code} {copiedOEM === i ? '✓' : ''}
                               </span>
                             ))}
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="font-bold text-gray-900 mb-2">Suitable Vehicles</h4>
                        {suitabilityData.length > 0 ? (
                           <div className="border rounded-lg divide-y">
                              {suitabilityData.map((m: any, i) => (
                                 <details key={i} className="group p-2">
                                    <summary className="cursor-pointer font-medium text-sm text-gray-800 list-none flex items-center justify-between">
                                      {m.modelName}
                                      <span className="text-gray-400 text-xs transition-transform group-open:rotate-180">▼</span>
                                    </summary>
                                    <div className="mt-2 pl-4 text-xs space-y-1 text-gray-600">
                                       {m.subModels?.map((s: any, j: number) => (
                                          <div key={j} className="py-1 border-l-2 border-gray-200 pl-2">
                                            {s.sub_model || s.name}
                                          </div>
                                       ))}
                                    </div>
                                 </details>
                              ))}
                           </div>
                        ) : suitabilityExplicitEmpty ? (
                          <div className="text-sm text-green-700">Compatible with all vehicles (Universal).</div>
                        ) : (
                          <div className="text-sm text-gray-500">No specific vehicle data available. Check OEM numbers.</div>
                        )}
                      </div>
                   </div>
                 )}

                 {activeTab === 'reviews' && (
                    <div className="space-y-4">
                       <h4 className="font-bold text-gray-900">Average Rating: {avgRating.toFixed(1)} / 5</h4>
                       {reviews.length === 0 ? <div className="text-sm text-gray-500">No reviews yet.</div> : 
                          (showAllReviews ? reviews : reviews.slice(0, 3)).map((r, i) => (
                             <div key={i} className="border-b pb-4">
                                <div className="flex items-center gap-2">
                                   <div className="font-bold text-sm text-gray-900">{r.name || 'User'}</div>
                                   <div className="flex text-yellow-400 text-xs">{'★'.repeat(Number(r.rating))}</div>
                                </div>
                                <p className="text-sm text-gray-700 mt-1">{r.review}</p>
                             </div>
                          ))
                       }
                       {reviews.length > 3 && (
                         <button onClick={() => setShowAllReviews(!showAllReviews)} className="text-brand text-sm underline">
                           {showAllReviews ? 'Show Less' : `View all ${reviews.length} reviews`}
                         </button>
                       )}
                    </div>
                 )}
               </div>
            </div>
            
            {/* Related Products */}
            {related.length > 0 && (
              <div className="mt-12 border-t border-gray-100 pt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Related Products</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {related.map((p, i) => {
                     const cardProduct = mapProductToActionData(p, i)
                     return (
                       <ProductActionCard 
                         key={cardProduct.id} 
                         product={cardProduct} 
                         enableView={true} 
                         onView={() => onViewProduct(cardProduct.id, p)}
                         onAddToCart={() => onAddToCart(p)} 
                       />
                     )
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
  }
