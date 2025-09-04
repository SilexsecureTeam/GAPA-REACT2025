import { Link, useLocation, useNavigate } from 'react-router-dom'
import logoImg from '../assets/gapa-logo.png'

export default function SearchError() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = (location?.state as { reason?: string; query?: string; brand?: string; part?: string; suggest?: { id: string; title: string; image: string; rating?: number; brandSlug?: string; partSlug?: string } }) || undefined
  const reason = navState?.reason || 'no_results'
  const brand = navState?.brand
  const part = navState?.part

  // Prefer navigation suggestion; else fallback to cached one
  let suggest = navState?.suggest as (typeof navState extends { suggest: infer S } ? S : any) | undefined
  if (!suggest) {
    try {
      const raw = localStorage.getItem('gapa:last-suggest')
      if (raw) suggest = JSON.parse(raw)
    } catch {}
  } else {
    // Save for later visits
    try { localStorage.setItem('gapa:last-suggest', JSON.stringify(suggest)) } catch {}
  }

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const knownBrands = ['audi','bmw','toyota','honda','mercedes','mercedes-benz','hyundai','ford','kia','lexus','volkswagen','vw','peugeot','land rover']
  const titleSlug = suggest ? toSlug(suggest.title) : ''
  const derivedBrand = suggest?.brandSlug || (brand ? toSlug(brand) : (knownBrands.find(b => titleSlug.startsWith(b.replace(/\s+/g, '-')))?.replace(/\s+/g, '-') || 'bmw'))
  const derivedPart = suggest?.partSlug || (part ? toSlug(part) : 'brake-discs')
  const suggestHref = suggest ? `/parts/${derivedBrand}/${derivedPart}?pid=${encodeURIComponent(suggest.id)}` : undefined

  return (
    <div className="bg-white !pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[13px] text-gray-600">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
            <li><Link to="/parts" className="hover:underline">Car Parts</Link></li>
            <li aria-hidden>›</li>
            <li className="font-semibold text-brand">No Results</li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-6 rounded-xl bg-white p-6 ring-1 ring-black/10">
          <div className="flex items-center justify-between">
            <div className="text-[16px] font-semibold text-gray-900">{reason === 'error' ? 'We had trouble finding parts.' : 'We couldn\'t find matching parts.'}</div>
            <div className="text-[12px] text-gray-600">{brand ? brand.toUpperCase() : ''} {part ? `· ${part.toString().replace(/-/g, ' ')}` : ''}</div>
          </div>

          {/* Suggested product (styled similar to result row) */}
          {suggest && (
            <div className="rounded-xl bg-white ring-1 ring-black/10">
              <div className="grid grid-cols-[1fr_auto] items-stretch">
                <div className="p-4 pr-0">
                  <div className="mt-2 grid grid-cols-[110px_1fr] gap-3 pr-4 md:grid-cols-[140px_1fr]">
                    <a href={suggestHref} className="flex items-center justify-center rounded-lg bg-[#F6F5FA]">
                      <img src={suggest.image || logoImg} alt={suggest.title} className="h-28 w-auto object-contain md:h-32" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                    </a>
                    <div>
                      <a href={suggestHref} className="font-semibold text-left text-gray-900 underline-offset-2 hover:underline">{suggest.title}</a>
                      {typeof (suggest as any).rating === 'number' && (
                        <div className="mt-1 text-[12px] text-gray-600">Rating: {(suggest as any).rating.toFixed(1)}</div>
                      )}
                    </div>
                  </div>
                </div>
                <aside className="flex w-56 items-center justify-center border-l border-black/10 p-4">
                  {suggestHref && (
                    <a href={suggestHref} className="inline-flex h-9 w-full items-center justify-center rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">View</a>
                  )}
                </aside>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate(-1)} className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-5 text-[14px] font-semibold text-white ring-1 ring-black/10">Go Back</button>
            <Link to="/parts" className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Browse All Parts</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
