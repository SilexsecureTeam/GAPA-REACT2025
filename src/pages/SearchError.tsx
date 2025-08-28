import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function SearchError() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state?: { reason?: string; query?: string; brand?: string; part?: string } }
  const reason = state?.reason || 'no_results'
  const brand = state?.brand
  const part = state?.part

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-[13px] text-gray-600">
          <ol className="flex flex-wrap items-center gap-2 sm:gap-3">
            <li><Link to="/parts" className="hover:underline">Parts Overview</Link></li>
            <li aria-hidden>›</li>
            <li className="font-semibold text-brand">No Results</li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-8 rounded-2xl bg-white p-8 text-center ring-1 ring-black/10">
          <div className="mx-auto grid h-24 w-24 place-content-center rounded-full bg-[#F6F5FA] ring-1 ring-black/10">
            <img src="/gapa-logo.png" alt="Gapa" className="h-10 w-auto" onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display='none'}} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">We couldn't find matching parts</h1>
            <p className="mt-2 text-[14px] text-gray-600">
              {reason === 'error' ? 'There was a problem fetching results. Please try again.' : 'Try adjusting your filters or search term.'}
            </p>
            {(brand || part) && (
              <p className="mt-1 text-[13px] text-gray-500">Selection: {brand ? brand.toUpperCase() : ''} {part ? `· ${part.replace(/-/g,' ')}` : ''}</p>
            )}
          </div>

          <div className="mx-auto flex flex-wrap items-center justify-center gap-3">
            <button onClick={() => navigate(-1)} className="inline-flex h-10 items-center justify-center rounded-md bg-brand px-5 text-[14px] font-semibold text-white ring-1 ring-black/10">Go Back</button>
            <Link to="/parts" className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-5 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Browse All Parts</Link>
          </div>

          <div className="mx-auto max-w-2xl text-left">
            <h2 className="text-[13px] font-bold uppercase tracking-wide text-gray-900">Tips</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-gray-700">
              <li>Check spelling or use fewer keywords.</li>
              <li>Clear some filters to widen the search.</li>
              <li>Try a different vehicle or category.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
