import TopBrands from '../components/TopBrands'
// import logoImg from '../assets/gapa-logo.png'
import topTool from '../assets/topTool.png'
import t1 from '../assets/t1.png'
import t2 from '../assets/t2.png'
import t3 from '../assets/t3.png'
import t4 from '../assets/t4.png'
import t5 from '../assets/t5.png'
import t6 from '../assets/t6.png'
import t7 from '../assets/t7.png'
import t8 from '../assets/t8.png'
import toolCat1 from '../assets/toolCat1.png'
import toolCat2 from '../assets/toolCat2.png'
import toolCat3 from '../assets/toolCat3.png'
import toolCat4 from '../assets/toolCat4.png'
import toolCat5 from '../assets/toolCat5.png'
import toolCat6 from '../assets/toolCat6.png'
import toolCat7 from '../assets/toolCat7.png'
import toolCat8 from '../assets/toolCat8.png'
import toolCat9 from '../assets/toolCat9.png'
import toolCat10 from '../assets/toolCat10.png'
import toolCat11 from '../assets/toolCat11.png'
import toolCat12 from '../assets/toolCat12.png'
// Placeholder images (replace with real images when available)
const IMG = {
  spanners: t1,
  pullers: t2,
  building: t3,
  pliers: t4,
  measuring: t5,
  striking: t6,
  air: t7,
  sealant: t8,
}

const toolCategories: Array<{ key: string; title: string; img: string }[]> = [
  [
    { key: 'spanners', title: 'SPANNERS & WRENCHES', img: IMG.spanners },
    { key: 'pullers', title: 'PULLERS AND SPECIAL CAR TOOLS', img: IMG.pullers },
    { key: 'building', title: 'BUILDING TOOLS', img: IMG.building },
    { key: 'pliers', title: 'PLIERS', img: IMG.pliers },
  ],
  [
    { key: 'measuring', title: 'MEASURING TOOLS', img: IMG.measuring },
    { key: 'striking', title: 'STRIKING TOOLS', img: IMG.striking },
    { key: 'air', title: 'AIR TOOLS', img: IMG.air },
    { key: 'sealant', title: 'SEALANT & ADHESIVE DISPENSING TOOLS', img: IMG.sealant },
  ]
]

const topToolCats = [
  { name: 'Torque Spanner', img: toolCat1 }, { name: 'Multi-bit Screwdrivers', img: toolCat2 }, { name: 'Socket Wrenches', img: toolCat3 }, { name: 'Combination Ratchet Spanners', img: toolCat4 },
  { name: 'Open end Wrenches', img: toolCat5 }, { name: 'Pliers', img: toolCat6 }, { name: 'Nut Splitters', img: toolCat7 }, { name: 'Nut Splitters', img: toolCat8 }, { name: 'Sheet metal shears', img: toolCat9 }, { name: 'Files', img: toolCat10 }, { name: 'Wire brushes', img: toolCat11 }, { name: 'Vices', img: toolCat12 }
]

// Offer card placeholder matching the design style
function formatNaira(n: number) { return `\u20a6${n.toLocaleString('en-NG')}` }

type Offer = { id: string; title: string; image: string; price: number; rating: number; reviews: number; brand?: string }
const OFFERS: Offer[] = Array.from({ length: 8 }).map((_, i) => ({
  id: `tool-${i+1}`,
  title: 'Bosch Spark Plug',
  image: topTool,
  price: 40000,
  rating: 4.5,
  reviews: 4,
  brand: 'BOSCH',
}))

function OfferCard({ offer }: { offer: Offer }) {
  return (
    <div className="relative rounded-xl bg-white ring-1 ring-black/10">
      <div className="p-4">
        <div className="h-6 text-[14px] font-extrabold text-brand">{offer.brand || 'BOSCH'}</div>
        <a href="#" className="text-[12px] text-brand underline">Article No: 123456</a>
        <div className="mt-2 flex h-36 items-center justify-center overflow-hidden rounded-lg">
          <img src={offer.image} alt={offer.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
        </div>
        <div className="mt-3 space-y-1">
          <a href="#" className="block text-[13px] font-semibold text-gray-900 hover:underline">{offer.title} ,</a>
          <div className="text-[12px] text-gray-600">Weight: 0.503kg</div>
          <div className="mt-2 flex items-center gap-1 text-[12px] text-gray-600">
            <span className="text-brand">{'★★★★★'.slice(0, Math.round(offer.rating))}</span>
            <span className="text-gray-500">({offer.reviews})</span>
          </div>
          <div className="text-[16px] font-extrabold text-gray-900">{formatNaira(offer.price)}</div>
          <div className="text-[10px] leading-3 text-gray-500">Price per item</div>
          <div className="text-[10px] leading-3 text-gray-500">Incl. 20% VAT</div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex gap-2">
            <button aria-label="Prev" className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10">‹</button>
            <button aria-label="Next" className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10">›</button>
          </div>
          <button type="button" aria-label="Add to cart" className="inline-flex h-8 items-center justify-center rounded-md bg-[#F7CD3A] px-3 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105">
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
}

export default function Tools() {
  return (
    <div className="bg-white pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">Tools &amp; equipment</h1>
        <p className="mt-1 text-[14px] leading-6 text-gray-600 max-w-2xl">Find the right tools and workshop equipment to keep your car in perfect shape — from DIY fixes to professional repairs.</p>

        {/* Grid of tool categories */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {toolCategories.flat().map((c) => (
            <div key={c.key} className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-white">
                <img src={c.img} alt={c.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
              </div>
              <p className="mt-3 text-center text-[12px] font-semibold uppercase tracking-wide text-gray-800">{c.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top Tool Categories (pill icons) */}
      <section className="mx-auto max-w-7xl px-4 pb-2 pt-2 sm:px-6">
        <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Top Tool Categories</h3>
        <ul className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-gray-800 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {topToolCats.map((topCat, index) => (
            <li key={index} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2">
              <img src={topCat.img} alt={topCat.name} className="inline-block h-8 w-8 rounded-full border-1 p-1" aria-hidden />
              <a href="#" className="hover:underline">{topCat.name}</a>
            </li>
          ))}
        </ul>
        <div className="my-6 h-px bg-black/10" />
      </section>

      {/* Top-Quality Car Tools offers */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h3 className="text-center text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-Quality Car Tools at Affordable Prices</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERS.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      </section>

      {/* Top brands from API (shared component) */}
      <TopBrands />

      {/* Info section */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h3 className="text-[18px] font-semibold text-gray-900">Everything You Need to Know About Car Tools &amp; Equipment</h3>
        <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Essential Hand Tools</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Spanners &amp; Wrenches – For tightening and loosening nuts and bolts.</li>
              <li>Socket Sets – Versatile tools for multiple car parts, including wheels and engine components.</li>
              <li>Screwdrivers – Basic for any repair, from dashboards to battery terminals.</li>
              <li>Pliers &amp; Cutters – Handy for electrical work, hoses, and wire handling.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Garage &amp; Workshop Equipment</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Jacks &amp; Stands – Essential for lifting your vehicle safely during tyre changes or underbody work.</li>
              <li>Torque Wrenches – Ensure nuts and bolts are tightened to manufacturer specifications.</li>
              <li>Air Compressors – Useful for tyres, cleaning, and powering pneumatic tools.</li>
              <li>Battery Chargers &amp; Starters – Keep your car powered and avoid emergencies.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Diagnostic &amp; Electrical Tools</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>OBD2 Scanners – Quickly identify engine errors and electrical issues.</li>
              <li>Multimeters – Check voltage, battery health, and wiring problems.</li>
              <li>Test Lamps – Simple but effective for circuit troubleshooting.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Why the Right Tools Matter</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Save time and money on repairs.</li>
              <li>Ensure safer maintenance.</li>
              <li>Extend the life of your car parts.</li>
              <li>Gain confidence whether at home or in the workshop.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
