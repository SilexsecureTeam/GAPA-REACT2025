import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBrands from '../components/TopBrands'
import { useAuth } from '../services/auth'
import {
  getAllCategories,
  getSubCategories,
  getSubSubCategories,
  getProductsBySubSubCategory,
  addToCartApi,
  type ApiProduct,
} from '../services/api'
import {
  categoryImageFrom,
  productImageFrom,
  normalizeApiImage,
  pickImage,
} from '../services/images'
import { addGuestCartItem } from '../services/cart'
import logoImg from '../assets/gapa-logo.png'

// Helpers
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const formatNaira = (n: number) => `\u20a6${Number(n || 0).toLocaleString('en-NG')}`

function brandOf(p: any): string {
  return String(p?.brand?.name || p?.brand || p?.manufacturer || p?.maker || p?.brand_name || 'GAPA').trim()
}

function mapProduct(p: any, i: number) {
  return {
    id: String(p?.product_id ?? p?.id ?? i),
    // Prefer part_name
    title: String(p?.part_name || p?.name || p?.title || 'Car Tool'),
    image: productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg,
    rating: Number(p?.rating || p?.stars || 4),
    reviews: Number(p?.reviews_count || p?.reviews || 0),
    brand: brandOf(p) || undefined,
    price: Number(p?.price || p?.selling_price || p?.amount || 0),
    raw: p,
  }
}

export default function Tools() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Catalog state
  const [subCats, setSubCats] = useState<any[]>([])
  const [loadingSubCats, setLoadingSubCats] = useState(false)
  const [activeSubCatId, setActiveSubCatId] = useState<string>('')

  const [subSubCats, setSubSubCats] = useState<any[]>([])
  const [loadingSubSubCats, setLoadingSubSubCats] = useState(false)
  const [activeSubSubCatId, setActiveSubSubCatId] = useState<string>('')

  const [products, setProducts] = useState<ApiProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)

  // Load categories then resolve Tools category and its sub-categories
  useEffect(() => {
    (async () => {
      try {
        const cats = await getAllCategories()
        const list = (Array.isArray(cats) ? cats : [])
        const found = list.find((c) => /tools?/.test(String((c as any)?.name || (c as any)?.title || '').toLowerCase()))
          || list.find((c) => /equipment|workshop/.test(String((c as any)?.name || (c as any)?.title || '').toLowerCase()))
          || null
        if (found) {
          setLoadingSubCats(true)
          const subs = await getSubCategories(String((found as any)?.id ?? (found as any)?.category_id ?? ''))
          const mapped = (subs || []).map((sc: any, i: number) => ({
            id: String(sc?.sub_cat_id ?? sc?.id ?? sc?.sub_category_id ?? i),
            name: String(sc?.sub_title || sc?.title || sc?.name || 'Sub Category'),
            image: categoryImageFrom(sc) || normalizeApiImage(pickImage(sc) || '') || logoImg,
            raw: sc,
          }))
          setSubCats(mapped)
          const first = mapped[0]
          if (first) setActiveSubCatId(first.id)
        }
      } finally {
        setLoadingSubCats(false)
      }
    })()
  }, [])

  // Load sub-sub-categories whenever sub-category changes
  useEffect(() => {
    if (!activeSubCatId) return
    (async () => {
      try {
        setLoadingSubSubCats(true)
        const res = await getSubSubCategories(activeSubCatId)
        const mapped = (res || []).map((ssc: any, i: number) => ({
          id: String(ssc?.sub_sub_cat_id ?? ssc?.id ?? ssc?.sub_sub_category_id ?? ssc?.subsubcatID ?? i),
          name: String(ssc?.sub_sub_title || ssc?.title || ssc?.name || 'Type'),
          image: categoryImageFrom(ssc) || normalizeApiImage(pickImage(ssc) || '') || logoImg,
          raw: ssc,
        }))
        setSubSubCats(mapped)
        const first = mapped[0]
        setActiveSubSubCatId(first ? first.id : '')
      } finally {
        setLoadingSubSubCats(false)
      }
    })()
  }, [activeSubCatId])

  // Load products for selected sub-sub-category
  useEffect(() => {
    if (!activeSubSubCatId) { setProducts([]); return }
    (async () => {
      try {
        setLoadingProducts(true)
        const prods = await getProductsBySubSubCategory(activeSubSubCatId)
        setProducts(Array.isArray(prods) ? prods : [])
      } finally {
        setLoadingProducts(false)
      }
    })()
  }, [activeSubSubCatId])

  // Derived labels/images
  const activeSubCat = useMemo(() => subCats.find((s) => s.id === activeSubCatId) || null, [subCats, activeSubCatId])
  const activeSubSubCat = useMemo(() => subSubCats.find((t) => t.id === activeSubSubCatId) || null, [subSubCats, activeSubSubCatId])

  const onSelectSubCat = (id: string) => {
    setActiveSubCatId(id)
    setActiveSubSubCatId('')
    setProducts([])
  }

  const onSelectSubSubCat = (id: string) => {
    setActiveSubSubCatId(id)
  }

  const onViewProduct = (p: any) => {
    const pid = String(p?.product_id ?? p?.id ?? '')
    if (!pid) return
    const brandSlug = toSlug(brandOf(p) || 'gapa')
    const partSlug = toSlug(String(activeSubCat?.name || activeSubSubCat?.name || 'tools'))
    // Navigate to unified details page (CarPartDetails) which expects pid in query
    navigate(`/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(pid)}`)
  }

  const onAddToCart = async (p: any) => {
    const pid = String(p?.product_id ?? p?.id ?? '')
    if (!pid) return
    try {
      if (user && user.id) {
        await addToCartApi({ user_id: user.id, product_id: pid, quantity: 1 })
      } else {
        addGuestCartItem(pid, 1)
      }
      // Open global cart popup
      navigate({ hash: '#cart' })
    } catch {
      navigate({ hash: '#cart' })
    }
  }

  // Render
  return (
    <div className="bg-white pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">Tools &amp; equipment</h1>
        <p className="mt-1 text-[14px] leading-6 text-gray-600 max-w-2xl">Find the right tools and workshop equipment to keep your car in perfect shape — from DIY fixes to professional repairs.</p>

        {/* Grid of tool sub-categories (from API) */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loadingSubCats && (
            <div className="col-span-full text-sm text-gray-500">Loading categories…</div>
          )}
          {!loadingSubCats && subCats.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectSubCat(c.id)}
              className={`rounded-2xl bg-white p-4 text-left ring-1 ring-black/10 transition hover:shadow ${activeSubCatId===c.id ? 'outline-2 outline-[#F7CD3A]' : ''}`}
              aria-pressed={activeSubCatId===c.id}
            >
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[#F6F5FA] ring-1 ring-black/10">
                  <img src={c.image || logoImg} alt={c.name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-gray-900">{c.name}</div>
                  <div className="text-[12px] text-gray-500">Sub-category</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Top Tool Categories (pill icons) - uses sub-sub categories for the active sub-category */}
      <section className="mx-auto max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top tool categories{activeSubCat ? ` — ${activeSubCat.name}` : ''}</h3>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-gray-800 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {loadingSubSubCats && <li className="col-span-full text-sm text-gray-500">Loading…</li>}
          {!loadingSubSubCats && subSubCats.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelectSubSubCat(t.id)}
                className={`flex w-full items-center gap-2 rounded-full bg-white px-3 py-2 ring-1 ring-black/10 transition hover:shadow ${activeSubSubCatId===t.id ? 'outline-2 outline-[#F7CD3A]' : ''}`}
                aria-pressed={activeSubSubCatId===t.id}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#F6F5FA] ring-1 ring-black/10">
                  <img src={t.image || logoImg} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                </span>
                <span className="truncate">{t.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="my-6 h-px bg-black/10" />
      </section>

      {/* Top-Quality Car Tools offers - products under active sub-sub-category */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h3 className="text-center text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-Quality Car Tools at Affordable Prices{activeSubSubCat ? ` — ${activeSubSubCat.name}` : ''}</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loadingProducts && (
            <div className="col-span-full text-center text-sm text-gray-500">Loading products…</div>
          )}
          {!loadingProducts && products.length === 0 && (
            <div className="col-span-full text-center text-sm text-gray-500">No products found.</div>
          )}
          {!loadingProducts && products.map((p, i) => {
            const ui = mapProduct(p, i)
            return (
              <div key={ui.id} className="relative rounded-xl bg-white ring-1 ring-black/10">
                <div className="p-4">
                  <div className="h-6 text-[14px] font-extrabold text-brand">{ui.brand || 'GAPA'}</div>
                  <button type="button" className="text-[12px] text-brand underline">Article No: {String((p as any)?.article_no || (p as any)?.article_number || (p as any)?.code || '—')}</button>
                  <button onClick={() => onViewProduct(p)} className="mt-2 block">
                    <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg">
                      <img src={ui.image || logoImg} alt={ui.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                    </div>
                  </button>
                  <div className="mt-3 space-y-1">
                    <button onClick={() => onViewProduct(p)} className="block text-left text-[13px] font-semibold text-gray-900 hover:underline">{ui.title}</button>
                    <div className="text-[12px] text-gray-600">Weight: {String((p as any)?.weight_in_kg || '—')}kg</div>
                    <div className="mt-2 flex items-center gap-1 text-[12px] text-gray-600">
                      <span className="text-brand">{'★★★★★'.slice(0, Math.round(ui.rating))}</span>
                      <span className="text-gray-500">({ui.reviews})</span>
                    </div>
                    <div className="text-[16px] font-extrabold text-gray-900">{formatNaira(ui.price)}</div>
                    <div className="text-[10px] leading-3 text-gray-500">Price per item</div>
                    <div className="text-[10px] leading-3 text-gray-500">Incl. 20% VAT</div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span />
                    <button type="button" aria-label="Add to cart" onClick={() => onAddToCart(p)} className="inline-flex h-8 items-center justify-center rounded-md bg-[#F7CD3A] px-3 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" />
                      </svg>
                      Add to cart
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Top brands from API (shared component) */}
      <TopBrands />

      {/* Info section (optional content can be added later) */}
      {/* ...existing code... */}
    </div>
  )
}
