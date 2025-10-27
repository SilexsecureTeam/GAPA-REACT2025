import React, { useState, useEffect, useRef } from 'react'
import ProductCard, { type Product } from '../components/ProductCard'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import carShop from '../assets/car-shop.png'
import FallbackLoader from '../components/FallbackLoader'
import { getAllBrands, getAllCategories, getFeaturedProducts, getManufacturers, getPartners, getTopProducts, type ApiBrand, type ApiCategory, type ApiManufacturer, type ApiPartner, type ApiProduct } from '../services/api'
import { pickImage, normalizeApiImage, productImageFrom, categoryImageFrom, partnerImageFrom } from '../services/images'
import { useNavigate } from 'react-router-dom'
import TopBrands from '../components/TopBrands'
import logoImg from '../assets/gapa-logo.png'
import VehicleFilter from '../components/VehicleFilter'
import { getPersistedVehicleFilter, type VehicleFilterState as VehState } from '../services/vehicle'
import { toast } from 'react-hot-toast'
import slider1 from '../assets/slider1.png'
import slider2 from '../assets/slider2.png'
import slider3 from '../assets/slider3.png'

// Helpers to unwrap API shapes and map images safely
function unwrap<T = any>(res: any): T[] {
  // Direct array
  if (Array.isArray(res)) return res as T[]
  // top-level common keys
  if (res && Array.isArray(res.result)) return res.result as T[]
  if (res && Array.isArray(res.data)) return res.data as T[]
  // data is object containing an array under some key
  if (res && res.data && typeof res.data === 'object') {
    const d = res.data as any
    if (Array.isArray(d.result)) return d.result as T[]
    for (const k of Object.keys(d)) {
      const v = d[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  // top-level object contains an array under some key (e.g., "top-products")
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}
function imgOf(obj: any): string | undefined { return pickImage(obj) }

// Name helpers for vehicle drill-down
function brandNameOf(b: any): string {
  return String(b?.name || b?.title || b?.brand_name || b?.brand || '').trim() || 'Brand'
}

// Special offers demo type reused by API mapping
type Offer = Product & { price: number; reviews: number }

function formatNaira(n: number) { return `\u20a6${n.toLocaleString('en-NG')}` }

function OfferCard({ offer, rawProduct }: { offer: Offer; rawProduct?: any }) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(offer.id)
  const navigate = useNavigate()
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  
  // Extract brand and category for proper URL routing
  const brandName = String(rawProduct?.brand?.name || rawProduct?.brand || rawProduct?.manufacturer || rawProduct?.maker || '').trim()
  const catRaw = rawProduct?.category
  const catName = typeof catRaw === 'string' ? catRaw : String(catRaw?.name || catRaw?.title || rawProduct?.category_name || '').trim()
  
  const brandSlug = brandName ? toSlug(brandName) : 'gapa'
  const partSlug = catName ? toSlug(catName) : 'parts'
  
  const handleClick = () => {
    const url = `/parts/${brandSlug}/${partSlug}?pid=${encodeURIComponent(offer.id)}`
    navigate(url, { state: { productData: rawProduct } })
  }
  
  return (
    <div className="relative rounded-xl bg-white ring-1 ring-black/10 cursor-pointer" onClick={handleClick}>
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton 
          active={isFav} 
          onToggle={(active) => { 
            wishlist.toggle(offer.id); 
            if (active) toast.success('Added to wishlist') 
          }} 
          ariaLabel="Add to wishlist" 
        />
      </div>
      <div className="p-4">
        <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg ">
          <img src={normalizeApiImage(offer.image) || logoImg} alt={offer.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
        </div>
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1 text-[12px] text-gray-600">
            <Rating value={offer.rating} size={12} />
            <span className="text-gray-500">({offer.reviews.toLocaleString()})</span>
          </div>
          <span className="block text-[13px] font-semibold text-gray-900 hover:underline">{offer.title}</span>
          <div className="text-[13px] font-extrabold text-gray-900">{formatNaira(offer.price)}</div>
          <div className="text-[10px] leading-3 text-gray-500">NG/ECOM tax</div>
          <div className="text-[10px] leading-3 text-gray-500">Incl. 30% VAT</div>
        </div>
      </div>
    </div>
  )
}

const TAB_LABELS: [string, string, string] = ['Top Car Parts', 'Top Manufacturers', 'Top Sellers']

export default function Home() {
  const navigate = useNavigate()
  // API state
  const [loading, setLoading] = useState(true)
  const [featured, setFeatured] = useState<ApiProduct[]>([])
  const [topProducts, setTopProducts] = useState<ApiProduct[]>([])
  const [brands, setBrands] = useState<ApiBrand[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [manufacturers, setManufacturers] = useState<ApiManufacturer[]>([])
  const [partners, setPartners] = useState<ApiPartner[]>([])
  // Tabs state
  const [tab, setTab] = useState<0 | 1 | 2>(0)
  // Shared vehicle filter banner state (hydrated from localStorage)
  const [vehFilter, setVehFilter] = useState<VehState>(() => getPersistedVehicleFilter())
  const hasVehicleFilter = Boolean(vehFilter.brandName || vehFilter.modelName || vehFilter.engineName)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [f, t, b, c, m, p] = await Promise.allSettled([
          getFeaturedProducts(),
          getTopProducts(),
          getAllBrands(),
          getAllCategories(),
          getManufacturers(),
          getPartners(),
        ])
        if (!alive) return
        setFeatured(unwrap<ApiProduct>(f.status === 'fulfilled' ? f.value : []))
        setTopProducts(unwrap<ApiProduct>(t.status === 'fulfilled' ? t.value : []))
        setBrands(unwrap<ApiBrand>(b.status === 'fulfilled' ? b.value : []))
        setCategories(unwrap<ApiCategory>(c.status === 'fulfilled' ? c.value : []))
        setManufacturers(unwrap<ApiManufacturer>(m.status === 'fulfilled' ? m.value : []))
        setPartners(unwrap<ApiPartner>(p.status === 'fulfilled' ? p.value : []))
      } catch (e: any) {
        // ignore for now; loaders will show
      } finally {
        setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  // Helper to slugify
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Derived UI models
  const featuredAsProducts: Product[] = featured.slice(0, 10).map((it, i) => {
    const brandNameLocal = String((it as any)?.brand?.name || (it as any)?.brand || (it as any)?.manufacturer || (it as any)?.maker || '')
    const catName = typeof (it as any)?.category === 'string' ? (it as any)?.category : ((it as any)?.category?.name || (it as any)?.category?.title || (it as any)?.category_name || '')
    return {
      id: String((it as any)?.product_id ?? (it as any)?.id ?? i),
      title: (it as any)?.name || (it as any)?.title || (it as any)?.product_name || 'Car Part',
      image: productImageFrom(it) || normalizeApiImage(pickImage(it) || '') || logoImg,
      rating: Number((it as any)?.rating || 4),
      brandSlug: brandNameLocal ? toSlug(brandNameLocal) : undefined,
      partSlug: catName ? toSlug(catName) : undefined,
      rawProduct: it, // Keep raw product data for navigation
    }
  })

  const offers: Array<Offer & { rawProduct: any }> = featured.slice(0, 8).map((it, i) => ({
    id: String((it as any)?.product_id ?? (it as any)?.id ?? i),
    title: (it as any)?.name || (it as any)?.title || (it as any)?.product_name || 'Car Part',
    image: productImageFrom(it) || normalizeApiImage(pickImage(it) || '') || logoImg,
    rating: Number((it as any)?.rating || 4.2),
    price: Number((it as any)?.price || (it as any)?.selling_price || (it as any)?.amount || 40000),
    reviews: Number((it as any)?.reviews_count || (it as any)?.reviews || 0),
    brandSlug: undefined,
    partSlug: undefined,
    rawProduct: it, // Keep raw product data for navigation
  }))

  // Tabs a11y helpers
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const current = tab
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const next = (current + 1) % TAB_LABELS.length as 0 | 1 | 2
      setTab(next)
      tabRefs.current[next]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prev = (current - 1 + TAB_LABELS.length) % TAB_LABELS.length as 0 | 1 | 2
      setTab(prev)
      tabRefs.current[prev]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      setTab(0)
      tabRefs.current[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      setTab(2)
      tabRefs.current[2]?.focus()
    }
  }

  // Simplified renderer for tab panel content to avoid nested JSX/paren issues
  const renderTabContent = () => {
    if (tab === 0) {
      return (
        <>
          {topProducts.slice(0, 4).map((p, idx) => {
            const name = (p as any)?.name || (p as any)?.title || (p as any)?.product_name || 'Part'
            const icon = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg
            const raw = p as any
            const handleClick = () => {
              const brandId = String(raw?.brand_id ?? raw?.brand?.id ?? raw?.brand?.brand_id ?? '')
              const catId = String(raw?.category_id ?? raw?.category?.id ?? raw?.category_id ?? '')
              const params = new URLSearchParams()
              if (catId) params.set('catId', String(catId))
              if (brandId) params.set('brandId', String(brandId))
              // fallback to a free-text query so CarParts can match by name if IDs are missing
              if (!brandId && !catId && name) params.set('q', name)
              navigate(`/parts?${params.toString()}`)
            }
            return (
              <button key={`top-${idx}`} onClick={handleClick} className="text-left rounded-xl bg-white p-4" type="button">
                <div className="flex justify-center gap-4">
                  <div className="flex h-auto sm:w-40 ring-1 ring-black/10 p-4 items-center justify-center rounded-lg">
                    <img src={icon} alt={name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                  </div>
                  <div>
                    <h5 className="text-[14px] font-semibold text-gray-900">{name}</h5>
                    <ul className="mt-2 space-y-1.5 text-[13px] text-[#333333]">
                      <li><span className="text-brand !underline">View parts</span></li>
                    </ul>
                  </div>
                </div>
              </button>
            )
          })}
        </>
      )
    }
    if (tab === 1) {
      return loading ? (
        <FallbackLoader label="Loading manufacturers…" />
      ) : (
        <>
          {manufacturers.slice(0, 6).map((m, idx) => {
            const name = (m as any)?.name || (m as any)?.title || 'Manufacturer'
            const id = String((m as any)?.id ?? (m as any)?.manufacturer_id ?? '')
            const handleClick = () => {
              const params = new URLSearchParams()
              if (name) params.set('q', name)
              if (id) params.set('manufacturerId', id)
              navigate(`/parts?${params.toString()}`)
            }
            return (
              <button key={`manu-${idx}`} onClick={handleClick} className="rounded-xl bg-white p-4 ring-1 ring-black/10 text-left" type="button">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Trusted OEM quality</div>
              </button>
            )
          })}
        </>
      )
    }
    if (tab === 2) {
      return loading ? (
        <FallbackLoader label="Loading brands…" />
      ) : (
        <>
          {brands.slice(0, 6).map((b, idx) => {
            const name = brandNameOf(b)
            const id = String((b as any)?.id ?? (b as any)?.brand_id ?? '')
            const handleClick = () => {
              const params = new URLSearchParams()
              if (id) params.set('brandId', id)
              if (name) params.set('title', name)
              navigate(`/parts?${params.toString()}`)
            }
            return (
              <button key={`brand-${String((b as any)?.id ?? idx)}-${idx}`} onClick={handleClick} className="rounded-xl bg-white p-4 ring-1 ring-black/10 text-left" type="button">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Popular seller</div>
              </button>
            )
          })}
        </>
      )
    }
    return null
  }

  // When user clicks a category in "Shop by Section", navigate to CarParts to drill down
  const onPickCategory = (cat: any) => {
    const id = (cat as any)?.id ?? (cat as any)?.category_id
    const name = String((cat as any)?.title || (cat as any)?.name || 'Category')
    if (!id) return
    const params = new URLSearchParams({ catId: String(id), title: name })
    navigate(`/parts?${params.toString()}`)
  }

  // Slider state and logic
  const [currentSlide, setCurrentSlide] = React.useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = React.useState(true)
  
  const slides: Array<
    | { type: 'text'; content: { title: string; subtitle: string; description: string } }
    | { type: 'image'; src: string; alt: string }
  > = [
    {
      type: 'text',
      content: {
        title: 'LOOKING FOR THE BEST CAR PARTS FOR YOUR CAR?',
        subtitle: "WE'VE GOT YOU COVERED!",
        description: 'Over 20,000 genuine parts with free delivery above ₦50,000'
      }
    },
    { type: 'image', src: slider1, alt: 'Car Parts Showcase 1' },
    { type: 'image', src: slider2, alt: 'Car Parts Showcase 2' },
    { type: 'image', src: slider3, alt: 'Car Parts Showcase 3' }
  ]

  // Auto-play slider
  React.useEffect(() => {
    if (!isAutoPlaying) return
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 6000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, slides.length])

  const goToPrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const goToNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Slider */}
      <section 
        className="relative overflow-hidden min-h-[500px] md:min-h-[600px] pt-2"
        onMouseEnter={() => setIsAutoPlaying(false)}
        onMouseLeave={() => setIsAutoPlaying(true)}
      >
        {/* Full Background Slider */}
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === currentSlide
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-95 pointer-events-none'
            }`}
          >
            {slide.type === 'text' ? (
              <div className="absolute inset-0 bg-gradient-brand"></div>
            ) : slide.type === 'image' ? (
              <div className="absolute inset-0 bg-gray-100">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
          </div>
        ))}

        {/* Content Overlay */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 min-h-[500px] md:min-h-[600px] flex items-center">
          <div className="grid grid-cols-1 items-center gap-6 w-full md:grid-cols-2">
            {/* Left: Text Content (only visible on text slide) */}
            <div className={`transition-opacity duration-1000 ${
              slides[currentSlide].type === 'text' ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              {slides[currentSlide].type === 'text' && (
                <div className="text-white">
                  <h1 className="text-2xl font-extrabold leading-tight sm:text-4xl md:text-[42px]">
                    {slides[currentSlide].content.title}
                    <br /> <span className='font-semibold'>{slides[currentSlide].content.subtitle}</span>
                  </h1>
                  <p className="mt-3 font-semibold text-[16px] max-w-md text-white/90">
                    {slides[currentSlide].content.description}
                  </p>
                  <a href="#" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[#F7CD3A] px-6 text-sm font-semibold text-[#201A2B] shadow hover:brightness-105 transition-all">
                    START SHOPPING
                  </a>
                </div>
              )}
            </div>

            {/* Right: Vehicle Filter - Always visible */}
            <div className="md:justify-self-end">
              <VehicleFilter className="md:min-w-[400px] shadow-lg" onSearch={(url) => navigate(url)} onChange={setVehFilter} />
              {hasVehicleFilter && (
                <div className="mt-3 rounded-md bg-[#F7CD3A]/15 px-3 py-2 text-[12px] text-gray-800 ring-1 ring-[#F7CD3A]/30">
                  Selected vehicle: <strong>{[vehFilter.brandName, vehFilter.modelName, vehFilter.engineName].filter(Boolean).join(' › ')}</strong>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
          aria-label="Previous slide"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={goToNextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
          aria-label="Next slide"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? 'w-8 bg-[#F7CD3A]'
                  : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Browse grid */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Browse Car Parts</h2>
          <a href="/parts" className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900">
            View all
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Cards grid */}
        {loading ? (
          <FallbackLoader label="Loading products…" />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {featuredAsProducts.length === 0 ? (
              <div className="col-span-full text-center text-sm text-gray-600">No products found.</div>
            ) : (
              featuredAsProducts.map((p) => (
                <ProductCard key={p.id} product={p} hideAddToCartButton />
              ))
            )}
          </div>
        )}
      </section>

      {/* Shop by Section (Categories) */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-2 sm:px-6">
        <h3 className="text-[20px] font-semibold text-gray-900">Shop by Section</h3>
        {loading ? (
          <FallbackLoader label="Loading categories…" />
        ) : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-10 md:grid-cols-4">
              {categories.slice(0, 8).map((c) => {
                const name = (c as any)?.name || (c as any)?.title || 'Category'
                const img = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || logoImg
                return (
                  <button
                    type="button"
                    key={String((c as any)?.id || name)}
                    onClick={() => onPickCategory(c)}
                    className="group rounded-xl p-3 transition text-left"
                  >
                    <div className="flex h-42 w-full ring-1 ring-black/10 py-2 items-center justify-center overflow-hidden rounded-lg">
                      <img src={img} alt={name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                    </div>
                    <p className="mt-3 text-center text-[12px] font-semibold uppercase tracking-wide text-gray-800">{name}</p>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

      {/* Value props */}
      <section className="mx-auto max-w-6xl px-4 py-10 text-center sm:px-6">
        <h3 className="text-[22px] font-semibold text-gray-900">Making Car Part Shopping Easy</h3>
        <p className="mt-1 text-sm text-gray-600">Find the right parts, save on shipping, and get back on the road in no time.</p>
        <div className="mx-auto mt-6 grid max-w-5xl grid-cols-2 gap-5 md:grid-cols-4">
          { [
            { title: 'Best Prices', desc: 'Get top-quality parts at unbeatable rates.', icon: (
              <path d="M20 6l-11 11-5-5" />
            ) },
            { title: 'Save on Shipping', desc: 'Cut delivery costs with our affordable shipping options.', icon: (
              <path d="M3 12h15l3 6H6z" />
            ) },
            { title: 'Wide Choice', desc: 'Choose from thousands of car parts for any make or model.', icon: (
              <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
            ) },
            { title: 'Fast Delivery', desc: 'Get your order quickly and keep your vehicle running smoothly.', icon: (
              <>
                <path d="M3 13h11l3 5H6z" />
                <path d="M13 6l-1 7" />
              </>
            ) },
          ].map((f) => (
            <div key={f.title} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-brand">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {f.icon}
                </svg>
              </div>
              <h4 className="mt-3 text-sm font-semibold text-gray-900">{f.title}</h4>
              <p className="mt-1 text-[12px] leading-5 text-gray-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tabs: Top Car Parts / Manufacturers / Sellers */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div
          className="flex items-center justify-center gap-6"
          role="tablist"
          aria-label="Homepage top lists"
          onKeyDown={handleTabKeyDown}
        >
          {TAB_LABELS.map((t, i) => (
            <button
              key={t}
              ref={(el) => { tabRefs.current[i] = el }}
              onClick={() => setTab(i as 0 | 1 | 2)}
              role="tab"
              id={`home-tab-${i}`}
              aria-controls={`home-tabpanel-${i}`}
              aria-selected={tab === i}
              tabIndex={tab === i ? 0 : -1}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${tab === i ? 'bg-white ring-2 ring-accent text-[#F7CD3A]' : 'bg-[#F6F5FA] text-gray-700 ring-1 ring-black/5 hover:bg-white'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab panel */}
        <div
          id={`home-tabpanel-${tab}`}
          role="tabpanel"
          aria-labelledby={`home-tab-${tab}`}
          className="mt-6 grid grid-cols-1 gap-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
        >
          {renderTabContent()}
        </div>

        <button className='bg-[#F7CD3A] px-10 rounded-md flex mt-5 w-fit mx-auto justify-center py-2'>View Catalogue</button>
      </section>

      {/* Top brands (from API) */}
      <TopBrands />

      {/* Special Offers on Car Parts (no buttons) */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Special Offers on Car Parts</h3>
        </div>
        {/* Carousel */}
        {loading ? (
          <FallbackLoader label="Loading offers…" />
        ) : (
          <div className="mt-4 py-4 pl-4 overflow-x-auto scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none]" aria-label="Special offers carousel">
            <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
            <div className="no-scrollbar grid auto-cols-[minmax(16rem,20rem)] grid-flow-col gap-6 sm:auto-cols-[minmax(18rem,22rem)] md:auto-cols-[minmax(20rem,24rem)]">
              {offers.length === 0 ? (
                <div className="text-sm text-gray-600">No offers available.</div>
              ) : offers.map((o) => (
                <div key={o.id} className="shrink-0"><OfferCard offer={o} rawProduct={o.rawProduct} /></div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Gapa Car Parts Shop */}
      <section className="mx-auto mt-10 max-w-7xl grid grid-cols-1 gap-6 px-4 pb-12 sm:px-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-6">
          <h3 className="text-[24px] font-semibold text-gray-900 mb-5">Gapa Car Parts Shop</h3>
          <div className="mt-4 space-y-5">
            { [
              { title: 'Fast Delivery', desc: 'Items in stock are shipped within 4–5 days of payment, so you can get back on the road without delays.' },
              { title: 'High-Quality Branded Auto Parts', desc: 'Our wide selection of genuine and branded auto parts keeps your car running smoothly and safely. Count on Gapa Naija as your reliable car parts supplier' },
              { title: 'Original Equipment Quality', desc: 'We stock only authentic parts from certified manufacturers. Our expert team is always ready to help you find the perfect fit for your vehicle.' },
            ].map((f, i, arr) => (
              <div key={f.title}>
                <div className="flex items-start gap-3">
                  <span className="mt-1 inline-flex h-8 !w-10 items-center justify-center rounded-full bg-accent/25 text-brand ring-1 ring-black/5">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6l-11 11-5-5"/></svg>
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-gray-900">{f.title}</p>
                    <p className="mt-1 text-[14px] leading-6 text-gray-600">{f.desc}</p>
                  </div>
                </div>
                {i < arr.length - 1 && <div className="my-4 h-px bg-black/10" />}
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden max-h-[450px] rounded-2xl ring-1 ring-black/10">
          <img src={carShop} alt="Courier delivering parts" className="h-full w-full object-cover" />
        </div>
      </section>

      {/* Partners */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 no-scrollbar">
        <h3 className="text-[16px] font-semibold text-gray-900">Our Partners</h3>
        {loading ? (
          <FallbackLoader label="Loading partners…" />
        ) : (
          <div className="mt-3 flex items-center gap-6 no-scrollbar overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
            {partners.slice(0, 12).map((p, i) => {
              const name = String((p as any)?.name || (p as any)?.title || 'Partner')
              const logo = partnerImageFrom(p) || imgOf(p)
              return (
                <div key={`partner-logo-${String((p as any)?.id ?? i)}-${i}`} className="shrink-0">
                  {logo ? <img src={normalizeApiImage(logo) || logoImg} alt={name} className="h-20 w-auto object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} /> : <span className="text-[13px] font-medium">{name}</span>}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
