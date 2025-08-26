import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'
import ridexLogo from '../assets/ridex.jpg'
import padImg from '../assets/br-disk.png'

// Lightweight demo catalogue to resolve a product by slug
const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const DEMO_PRODUCTS = [
  {
    id: '402B0289',
    brand: 'RIDEX',
    name: 'RIDEX 402B0289 Brake pad set',
    articleNo: '123456',
    price: 40000,
    rating: 4.8,
    ratingCount: 3,
    inStock: true,
    images: [padImg, padImg, padImg],
    shortNote: 'Rear Axle not prepared for wear warning indicator, excl. wear warning contact',
    specs: [
      { label: 'Quantity Unit:', value: 'Axle set' },
      { label: 'Fitting Position:', value: 'Rear Axle' },
      { label: 'Wear Warning Contact:', value: 'Not prepared for wear warning indicator, excl. wear warning contact' },
      { label: 'Supplementary Article/\nSupplementary info', value: 'With accessories' },
      { label: 'Thickness(mm) :', value: '17.5' },
      { label: 'Height (mm):', value: '59' },
      { label: 'Width (mm) :', value: '116.5' },
    ],
    vehicles: ['AUDI'],
    suitabilityRows: [
      { label: 'Car Models', value: 'Golf 5; Audi A4 B8 Avant; Audi A6 C7 Avant; Audi A4 B7 Avant; Audi Q5 8R; Audi A4 B8; Audi A5 8ta; Audi A5 8t3; Audi A6 C7 4g; Audi A7 4g; Audi A4 B8 Allroad; Audi A5 B8 Cabrio' },
      { label: 'Engine:', value: '1.6; 2.0 TDI quattro; 2.0 TFSI quattro; 2.0 TFSI; 3.0 TDI quattro; 2.0 TFSI flexible fuel quattro; 2.0 TFSI flexible fuel; 3.2 FSI; 2.7 TDI; S4 quattro; 1.8 TFSI quattro; 1.8 TFSI; 3.2 FSI quattro; 3.0 TDI; 3.0 TFSI quattro; 2.8 FSI; 2.0 TFSI Flexfuel quattro; SQ5 TDI quattro; SQ5 TFSI quattro; SQ5 TFSI Hybrid quattro; S5 quattro; 2.8 FSI quattro' },
      { label: 'Engine:', value: '1.6; 2.0 TDI quattro; 2.0 TFSI; 3.0 TDI quattro; 2.0 TFSI flexible fuel quattro; 2.0 TFSI flexible fuel; 3.2 FSI; 2.7 TDI; S4 quattro; 1.8 TFSI quattro; 1.8 TFSI; 3.2 FSI quattro; 3.0 TDI; 3.0 TFSI quattro; 2.8 FSI; 2.0 TFSI Flexfuel quattro; SQ5 TDI quattro; SQ5 TFSI quattro; SQ5 TFSI Hybrid quattro; S5 quattro; 2.8 FSI quattro' },
      { label: 'Engine power (horsepower):', value: '102–354 hp' },
      { label: 'Power (kilowatts):', value: '75–260 kw' },
      { label: 'Year of manufacture:', value: '2004 – 2018 Jahre' },
      { label: 'Manufacturer article number:', value: '402B0289' },
      { label: 'OE part number(s):', value: '8K0698451, 8K0698451A, 8K0698451B, 8K0698451C, 8K0698451D' },
    ],
  },
]

function useCarPartProduct(slug?: string) {
  return useMemo(() => {
    if (!slug) return null
    // Find by slug of name, id, or brand+name
    return (
      DEMO_PRODUCTS.find(p => toSlug(p.name) === slug || toSlug(p.id) === slug || toSlug(`${p.brand}-${p.name}`) === slug) || DEMO_PRODUCTS[0]
    )
  }, [slug])
}

function Badge({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 text-brand" aria-hidden>{icon}</div>
      <div>
        <div className="text-[12px] font-bold uppercase tracking-wide text-gray-900">{title}</div>
        <div className="text-[11px] leading-4 text-gray-600">{desc}</div>
      </div>
    </div>
  )
}

function InterestedCard() {
  return (
    <div className="rounded-xl bg-white ring-1 ring-black/10">
      <div className="flex items-center justify-between px-3 py-2">
        <img src={ridexLogo} alt="RIDEX" className="h-5" />
        <span className="text-[12px] text-gray-500">Article No: 123456</span>
      </div>
      <div className="px-3 pb-3">
        <div className="flex h-36 items-center justify-center rounded-lg bg-[#F6F5FA]">
          <img src={padImg} alt="Brake Disc" className="h-24 object-contain" />
        </div>
        <div className="mt-2 text-[13px] font-semibold text-gray-900">RIDEX BRAKE disc, Rear Axle 300x20mm, 5/6 x 120, Vented, Cast Iron</div>
        <div className="mt-1 flex items-center gap-1 text-[12px] text-orange-500">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.431L24 9.748l-6 5.846L19.335 24 12 19.897 4.665 24 6 15.594 0 9.748l8.332-1.73z"/></svg>
          <span className="text-gray-800">(4)</span>
        </div>
        <div className="mt-1 text-[14px] font-extrabold text-gray-900">₦40,000</div>
        <div className="text-[10px] text-gray-600">Incl. 20% VAT</div>
        <button className="mt-2 inline-flex h-8 w-full items-center justify-center rounded-md bg-[#F7CD3A] text-[13px] font-semibold text-gray-900 ring-1 ring-black/10">Add to cart</button>
      </div>
    </div>
  )
}

export default function CarPartProduct() {
  const { slug } = useParams<{ slug: string }>()
  const product = useCarPartProduct(slug)
  const wishlist = useWishlist()
  const [qty, setQty] = useState(2)
  const [tab, setTab] = useState<'oem' | 'vehicles' | 'faq'>('vehicles')
  const [activeImg, setActiveImg] = useState(0)

  if (!product) return null

  const isFav = wishlist.has(product.id)

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[13px] text-gray-600">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
            <li><Link to="/parts" className="hover:underline">Parts Overview</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/parts/bmw/brake-pads" className="hover:underline">BMW</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/parts/bmw/brake-pads" className="hover:underline">1 Convertible (E88)</Link></li>
            <li aria-hidden>›</li>
            <li><Link to="/parts/bmw/brake-pads" className="hover:underline">125 i</Link></li>
            <li aria-hidden>›</li>
            <li className="font-semibold text-brand">Brake Pad Set</li>
          </ol>
        </nav>

        {/* Fitment warning bar */}
        <div className="mt-3 rounded-md bg-[#F24E5E] px-3 py-2 text-center text-[12px] font-semibold text-white">⚠ The Spare Part Doesn't Fit BMW 1 Convertible (E88) 125 i</div>

        {/* Selector row */}
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          {["BMW", "1 Convertible (E88)", "125 i (160 KW / 218 HP)"].map((label) => (
            <div key={label} className="relative">
              <select className="h-10 w-full appearance-none rounded-md bg-[#F6F5FA] px-3 pr-8 text-sm text-gray-800 outline-none ring-1 ring-black/10">
                <option>{label}</option>
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-2 inline-flex items-center text-gray-600">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-md bg-[#F6F5FA] px-3 ring-1 ring-black/10">
              <span className="inline-flex h-6 w-8 items-center justify-center rounded bg-white text-[12px] font-bold text-brand ring-1 ring-black/10">GB</span>
              <input placeholder="YOUR REG" className="h-10 w-[140px] bg-transparent text-sm outline-none" />
            </div>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white ring-1 ring-black/10">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            </button>
          </div>
        </div>

        {/* Main product block */}
        <div className="mt-6 grid gap-6 lg:grid-cols-[120px_1fr_320px]">
          {/* Thumbs */}
          <div className="space-y-3" role="tablist" aria-label="Product images">
            {product.images.map((img, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={activeImg === i}
                aria-controls={`image-panel-${i}`}
                onClick={() => setActiveImg(i)}
                className={`flex items-center justify-center rounded-lg bg-white p-2 ring-1 ring-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${activeImg===i ? 'ring-2 ring-brand' : ''}`}
              >
                <img src={img} alt={`Thumbnail ${i + 1}`} className="h-16 w-auto object-contain" />
              </button>
            ))}
          </div>

          {/* Image + meta */}
          <div>
            <h1 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">{product.name}</h1>
            <p className="mt-1 text-[12px] text-gray-600">{product.shortNote}</p>
            <div id={`image-panel-${activeImg}`} role="tabpanel" className="mt-3 flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6">
              <img src={product.images[activeImg]} alt={product.name} className="h-[260px] w-auto object-contain sm:h-[300px]" />
            </div>

            {/* Video row */}
            <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-black/10">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-8 w-12 items-center justify-center rounded-md bg-red-600 text-white">▶</div>
                <p className="text-[13px] text-gray-700">Check out this video to learn more about this item: Brake pad set</p>
              </div>
            </div>
          </div>

          {/* Purchase panel */}
          <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="flex items-start justify-between">
              <img src={ridexLogo} alt={product.brand} className="h-6" />
              <div className="text-right text-[12px] text-gray-500">
                <div>Article No: {product.articleNo}</div>
                <Link to="/parts" className="text-brand underline">Parts Overview</Link>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-600">
              <div className="flex items-center gap-1 text-orange-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .587l3.668 7.431L24 9.748l-6 5.846L19.335 24 12 19.897 4.665 24 6 15.594 0 9.748l8.332-1.73z"/></svg>
                <strong className="text-gray-900">{product.rating.toFixed(1)}</strong>
              </div>
              <span>(reviews - {product.ratingCount})</span>
            </div>

            <div className="mt-5 text-right">
              <div className="text-[24px] font-bold text-gray-900">₦{product.price.toLocaleString('en-NG')}</div>
              <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
            </div>

            <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-3">
              <div className="inline-flex overflow-hidden rounded-md ring-1 ring-black/10">
                <button aria-label="Decrease" onClick={() => setQty(Math.max(1, qty-1))} className="h-8 w-8">‹</button>
                <div className="grid h-8 w-10 place-content-center text-[12px] font-semibold">{qty}</div>
                <button aria-label="Increase" onClick={() => setQty(Math.min(99, qty+1))} className="h-8 w-8">›</button>
              </div>
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg> Add to cart</button>
            </div>

            <div className="mt-2 flex items-center gap-2 text-[12px] text-purple-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-purple-600" aria-hidden />
              {product.inStock ? 'In Stock' : 'Out of stock'}
            </div>

            <div className="mt-3 text-center">
              <WishlistButton active={isFav} onToggle={() => wishlist.toggle(product.id)} ariaLabel="Add to wishlist" />
            </div>

            <div className="mt-3 space-y-2 text-[12px] text-gray-700">
              <div className="inline-flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10H7" /><path d="M21 6H3" /><path d="M21 14H3" /><path d="M21 18H7" /></svg>
                <span>SECURE TRANSACTION</span>
              </div>
              <Link to="#" className="block text-brand underline">Safety and product information</Link>
            </div>
          </aside>
        </div>

        {/* Badges */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Badge icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6l-11 11-5-5"/></svg>} title="Return and Exchange" desc="14 days" />
          <Badge icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>} title="Safe Order" desc="100 days" />
          <Badge icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h15l3 6H6z"/></svg>} title="Save on Delivery" desc="14 days" />
          <Badge icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M2 16h14l3-6H6z"/></svg>} title="Fast Delivery" desc="" />
        </div>

        {/* Interested carousel (simple grid) */}
        <div className="mt-6">
          <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">YOU MAY ALSO BE INTERESTED IN:</h3>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <InterestedCard key={i} />
            ))}
          </div>
        </div>

        {/* Reviews list */}
        <section className="mt-8 rounded-xl bg-white p-4 ring-1 ring-black/10">
          <div className="flex items-center justify-between">
            <h4 className="text-[16px] font-semibold text-gray-900">CUSTOMER REVIEWS</h4>
            <Link to="#" className="text-[12px] text-gray-600">View all ⟲</Link>
          </div>
          <div className="mt-3 space-y-4">
            {['Sammy', 'Sammy', 'Sammy'].map((name, i) => (
              <div key={i} className="rounded-lg bg-[#F8F6FB] p-3">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="text-[10px] text-gray-500">20/04/2025</div>
                <p className="mt-2 text-[13px] text-gray-700">Gapa Naija is a breath of fresh air! The interface is smooth and easy to use, and I love how everything feels designed for Nigerians. Payments went through seamlessly, and I've already recommended it to my friends</p>
                <button className="mt-2 text-[12px] font-semibold text-brand underline">Send a Reply</button>
              </div>
            ))}
            <div className="pt-2 text-center"><button className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-6 text-[13px] font-semibold text-gray-900 ring-1 ring-black/10">Write a Review</button></div>
          </div>
        </section>

        {/* Specs + Tabs */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          {/* Specs card */}
          <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="space-y-1">
              {product.specs.map(s => (
                <div key={s.label} className="grid grid-cols-[180px_1fr] text-[13px]">
                  <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{s.label}</div>
                  <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700 whitespace-pre-line">{s.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-black/10 pt-3">
              <h5 className="text-[12px] font-bold uppercase tracking-wide text-gray-700">OVERVIEW OF PRODUCT</h5>
              <div className="mt-2 space-y-1 text-[13px]">
                {[['Brake pad set RIDEX', ''], ['Number of order', product.id], ['Trade of numbers', `Ridex ${product.id}`], ['Our Price:', '₦19000'], ['Condition', 'New']].map(([l, v]) => (
                  <div key={l} className="grid grid-cols-[200px_1fr]">
                    <div className="px-2 py-1.5 text-gray-700">{l}</div>
                    <div className="border-b border-dotted border-black/20 px-2 py-1.5 text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'oem', label: 'OEM Part Number' },
                { key: 'vehicles', label: 'Suitable Vehicles' },
                { key: 'faq', label: 'FAQ: Frequently asked questions' },
              ].map((t) => (
                <button key={t.key} onClick={() => setTab(t.key as any)} className={`rounded-t-md px-3 py-2 text-[13px] font-semibold ${tab===t.key ? 'bg-white text-brand ring-1 ring-black/10' : 'bg-[#F6F5FA] text-gray-700 ring-1 ring-black/10'}`}>{t.label}</button>
              ))}
            </div>
            <div className="rounded-b-md bg-white p-4 ring-1 ring-black/10">
              {tab === 'oem' && (
                <div className="text-[13px] text-gray-700">OE numbers matching this product will appear here.</div>
              )}
              {tab === 'vehicles' && (
                <div className="text-[13px] text-gray-800">
                  <div className="mb-2 flex items-center gap-2"><button className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white">+</button> <span className="font-semibold">{product.vehicles[0]}</span></div>
                  <div className="rounded-md border border-dashed border-black/20 p-3 text-[12px] text-gray-700">Manufacturer/Model/Type/KW/Manuf. year (from – to)</div>
                </div>
              )}
              {tab === 'faq' && (
                <div className="text-[13px] text-gray-700">Have questions? Contact support and we'll help you choose the right part.</div>
              )}
            </div>
          </div>
        </div>

        {/* Suitable rows table */}
        <div className="mt-8 rounded-xl bg-white p-4 ring-1 ring-black/10">
          <h4 className="text-[14px] font-semibold text-gray-900">{product.name} suitable for:</h4>
          <div className="mt-3 divide-y divide-dotted divide-black/20 text-[13px]">
            {product.suitabilityRows.map((r, i) => (
              <div key={i} className="grid grid-cols-[220px_1fr] gap-3 py-3">
                <div className="text-gray-700">{r.label}</div>
                <div className="text-gray-800">{r.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payment methods */}
        <div className="mt-6">
          <h4 className="text-[16px] font-semibold text-gray-900">Payment Methods</h4>
          <div className="mt-3 flex flex-wrap items-center gap-6 rounded-xl bg-white px-4 py-3 ring-1 ring-black/10">
            {['PayPal', 'Mastercard', 'Access', 'PayPal', 'Access'].map((pm) => (
              <div key={pm} className="inline-flex items-center gap-2">
                <span className="inline-block h-6 w-10 rounded bg-[#F6F5FA] ring-1 ring-black/10" aria-hidden />
                <span className="text-[13px] text-gray-800">{pm}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom links + rating distribution */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">BRAKE PADS FOR YOUR CAR</h4>
            <div className="mt-2 flex flex-wrap gap-3 text-[12px] text-brand">
              {['AUDI A4 B8 BRAKE PADS', 'AUDI A4 B8 BRAKE PADS', 'AUDI A4 B8 BRAKE PADS', 'AUDI A4 B8 BRAKE PADS', 'AUDI A4 B8 BRAKE PADS'].map((s) => (
                <Link key={s} to="#" className="underline">{s}</Link>
              ))}
            </div>
            <div className="mt-4"><button className="rounded-md border border-brand px-6 py-2 text-[13px] font-semibold text-brand">View More</button></div>
          </div>

          <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <h4 className="text-[16px] font-semibold text-gray-900">RATING AND REVIEWS</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center text-[#FFB400]">★★★★★</div>
                  <div className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-[#F6F5FA] px-2 text-[12px] font-bold">4.8</div>
                  <div className="text-[12px] text-gray-600">(Based on 1425 reviews)</div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    ['5 Stars', 95],
                    ['4 Stars', 65],
                    ['3 Stars', 40],
                    ['2 Stars', 10],
                    ['1 Star', 3],
                  ].map(([label, val]) => (
                    <div key={label as string} className="grid grid-cols-[80px_1fr_40px] items-center gap-2 text-[12px] text-gray-700">
                      <div>{label as string}</div>
                      <div className="h-2 rounded bg-gray-200">
                        <div className="h-2 rounded bg-[#F7CD3A]" style={{ width: `${val as number}%` }} />
                      </div>
                      <div className="text-right text-[12px] text-gray-500">{(val as number) * 15}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid content-start gap-2 text-[12px] text-gray-700">
                {['The product cost', 'The product quality', 'Packaging quality', 'Manufacturer', 'Warranty'].map((l, i) => (
                  <div key={l} className="grid grid-cols-[160px_1fr_40px] items-center gap-2">
                    <div>{l}</div>
                    <div className="h-2 rounded bg-gray-200"><div className="h-2 rounded bg-[#F7CD3A]" style={{ width: `${[96, 78, 70, 40, 35][i]}%` }} /></div>
                    <div className="text-right text-[12px] text-gray-500">{[1425, 1000, 800, 140, 8][i]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
