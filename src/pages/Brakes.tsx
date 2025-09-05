import TopBrands from '../components/TopBrands'
// import VehicleSelector from '../components/VehicleSelector'
import brDisk from '../assets/br-disk.png'
import brakeImg from '../assets/brake.png'
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

function StepDot({ n }: { n: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#4B1B76] text-[12px] font-semibold text-white">{n}</span>
  )
}

function HeroVehicleCard() {
  return (
    <div className="overflow-hidden rounded-lg bg-white shadow-md ring-1 ring-black/10">
      <div className="flex items-center justify-between bg-[#4B1B76] px-4 py-3 text-white">
        <div className="inline-flex items-center gap-2">
          <span className="text-[15px] font-semibold">Select Vehicle</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
        </div>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-white/60">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="-rotate-45"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.13-3.36L23 10" /><path d="M20.49 15a9 9 0 01-14.13 3.36L1 14" /></svg>
        </span>
      </div>
      <div className="p-4">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-3 bottom-24 w-[2px] bg-[#E5D7F2]" aria-hidden />
          <div className="space-y-3">
            {[{label:'BMW', filled:true},{label:'1 Convertible E88(03)/..', filled:true},{label:'Select Engine', filled:false}].map((row, i)=> (
              <div key={i} className="grid grid-cols-[28px_1fr_42px] items-center gap-3">
                <div className="flex justify-center"><StepDot n={i+1} /></div>
                <div className="relative">
                  <input defaultValue={row.filled?row.label:''} placeholder={row.label} readOnly className={`h-11 w-full rounded-md px-3 text-[14px] ring-1 ${row.filled?'bg-[#F2F1F6] ring-gray-200':'bg-[#F2F1F6] ring-gray-200'} text-gray-800`} />
                </div>
                <button className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-[#4B1B76] text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
        <button className="mt-4 inline-flex h-11 w-full items-center justify-center gap-3 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          Search
        </button>
        <div className="my-4 h-px bg-gray-200" />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-700">Enter your registration below</p>
          <div className="mt-3 flex gap-3">
            <input placeholder="Your Reg" className="h-10 w-full rounded-md bg-[#F2F1F6] px-3 text-[14px] text-gray-800 ring-1 ring-gray-200" />
            <button className="h-10 rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-[#201A2B] ring-1 ring-black/5">Search</button>
          </div>
          <a href="#" className="mt-3 inline-block text-[13px] font-medium text-brand underline">Can't  Find Your Car In The Catalogue?</a>
        </div>
      </div>
    </div>
  )
}

export default function Brakes() {
  return (
    <div className="bg-white pt-0">
      {/* Page title */}
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <h1 className="text-[22px] font-bold text-gray-900 sm:text-3xl">Car brakes parts</h1>
      </section>

      {/* Red notice bar */}
      <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6">
        <div className="rounded-md bg-[#EF4936] px-4 py-2 text-[12px] font-semibold text-white">
          <span className="inline-flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            Select Your Car Model To Find Brake Parts That Fit — Our Search Only Shows Results For Your Vehicle.
          </span>
        </div>
      </div>

      {/* Hero with selector and image */}
      <section className="">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-6 px-4 py-6 sm:px-6 md:grid-cols-2">
          <div className="md:max-w-[430px]">
            <HeroVehicleCard />
          </div>
          <div className="flex items-center justify-center md:justify-start">
            <img src={brakeImg} alt="Brake parts" className="w-[85%] max-w-[520px] md:w-full object-contain" />
          </div>
        </div>
      </section>

      {/* Top brake categories (pill icons) */}
      <section id="categories" className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6">
        <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">Choose the right brake parts section for your car.</h3>
        <ul className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-gray-800 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4">
          {TOP_CATEGORIES.map((topCat, index) => (
            <li key={index} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 ring-1 ring-black/10">
              <img src={topCat.img} alt={topCat.name} className="inline-block h-10 w-10 rounded-full border p-1 object-contain" aria-hidden />
              <a href="#" className="hover:underline">{topCat.name}</a>
            </li>
          ))}
        </ul>
        <div className="my-6 h-px bg-black/10" />
      </section>

      {/* Top brands from API (allowed external component) */}
      <TopBrands title="Top brake brands" />

      {/* Best sellers grid */}
      <section id="bestsellers" className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-gray-900 sm:text-[20px]">Top-Rated Brake System Best Sellers:</h3>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SPECIAL_OFFERS.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      </section>

      {/* Info section */}
      {/* <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <h3 className="text-[18px] font-semibold text-gray-900">Everything You Need to Know About Brake Parts</h3>
        <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Common Brake Components</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Brake pads &amp; discs — core elements for effective braking.</li>
              <li>Calipers &amp; hoses — ensure stable hydraulic pressure.</li>
              <li>Handbrake cables — maintain parking stability.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">When to Replace</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Grinding or squealing noises during braking.</li>
              <li>Vibrations in the steering wheel when braking.</li>
              <li>Increased stopping distance.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Maintenance Tips</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Regularly check brake fluid levels.</li>
              <li>Inspect pads and discs every 10,000 km.</li>
              <li>Replace components in axle pairs for balanced performance.</li>
            </ul>
          </div>
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Safety First</h4>
            <ul className="mt-2 text-[13px] text-gray-700 list-disc pl-5 space-y-1">
              <li>Use quality parts to ensure reliable braking.</li>
              <li>Follow manufacturer torque specs when installing.</li>
              <li>Bed in new pads and discs properly.</li>
            </ul>
          </div>
        </div>
      </section> */}
    </div>
  )
}
