import TopBrands from '../components/TopBrands'
// import VehicleSelector from '../components/VehicleSelector'
import brDisk from '../assets/br-disk.png'
import special from '../assets/special.png'
import logoImg from '../assets/gapa-logo.png'

const TOP_CATEGORIES = [
  { name: 'Brake pad set', img: brDisk },
  { name: 'Brake discs', img: brDisk },
  { name: 'Brake calipers', img: brDisk },
  { name: 'Brake hoses', img: brDisk },
  { name: 'Brake drums', img: brDisk },
  { name: 'Brake shoes', img: brDisk },
  { name: 'Handbrake cables', img: brDisk },
  { name: 'ABS sensors', img: brDisk },
  { name: 'Brake fluid', img: brDisk },
  { name: 'Vacuum pumps', img: brDisk },
  { name: 'Wheel cylinders', img: brDisk },
  { name: 'Back plates', img: brDisk },
]

const SPECIAL_OFFERS = Array.from({ length: 8 }).map((_, i) => ({
  id: `brk-${i+1}`,
  title: 'BRAKE DISC',
  image: special,
  brand: 'BOSCH',
  article: 'Article No: 123456',
  price: 40000,
  rating: 4.5,
  reviews: 4,
}))

function formatNaira(n: number) { return `\u20a6${n.toLocaleString('en-NG')}` }

function OfferCard({ offer }: { offer: typeof SPECIAL_OFFERS[number] }) {
  return (
    <div className="relative rounded-xl !bg-white ring-1 ring-black/10">
      <div className="p-4">
        <div className="h-6 text-[14px] font-extrabold text-brand">{offer.brand}</div>
        <a href="#" className="text-[12px] text-brand underline">{offer.article}</a>
        <div className="">
          <img src={offer.image} alt={offer.title} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
        </div>
        <div className="mt-3 space-y-1">
          <a href="#" className="block text-[13px] font-semibold text-gray-900 hover:underline">{offer.title}</a>
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

export default function Brakes() {
  return (
    <div className="bg-white pt-10">
      {/* Header */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[28px]">Brake system parts</h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-6 text-gray-600">Find reliable brake pads, discs, calipers, hoses and more. Quality brands, fair prices, fast delivery.</p>

        {/* Subtle notice (instead of red banner) */}
        <div className="mt-4 rounded-md bg-[#F7F5FB] p-3 text-[12px] text-gray-800 ring-1 ring-black/10">
          Tip: Select your vehicle on the parts pages to see brake parts that fit your exact model.
        </div>

        {/* Top brake categories - professional grid */}
        <div className="mt-6">
          <h3 className="text-[16px] font-semibold text-gray-900">Top brake categories</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {TOP_CATEGORIES.map((c) => (
              <div key={c.name} className="rounded-2xl bg-white p-4 ring-1 ring-black/10">
                <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-white">
                  <img src={c.img} alt={c.name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                </div>
                <p className="mt-3 text-center text-[12px] font-semibold uppercase tracking-wide text-gray-800">{c.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Top brands from API */}
      <TopBrands title="Top brake brands" />

      {/* Best sellers */}
      <section id="bestsellers" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-rated brake system best sellers</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SPECIAL_OFFERS.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      </section>

      {/* Info section aligned with Tools/EngineOil */}
      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6">
        <h3 className="text-[18px] font-semibold text-gray-900">Everything You Need to Know About Brake Parts</h3>
        <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Common Brake Components</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">
              <li>Brake pads &amp; discs — core elements for effective braking.</li>
              <li>Calipers &amp; hoses — ensure stable hydraulic pressure.</li>
              <li>Handbrake cables — maintain parking stability.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">When to Replace</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">
              <li>Grinding or squealing noises during braking.</li>
              <li>Vibrations in the steering wheel when braking.</li>
              <li>Increased stopping distance.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Maintenance Tips</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">
              <li>Regularly check brake fluid levels.</li>
              <li>Inspect pads and discs every 10,000 km.</li>
              <li>Replace components in axle pairs for balanced performance.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Safety First</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">
              <li>Use quality parts to ensure reliable braking.</li>
              <li>Follow manufacturer torque specs when installing.</li>
              <li>Bed in new pads and discs properly.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
