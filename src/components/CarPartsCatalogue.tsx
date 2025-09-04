import { useEffect, useRef, useState } from 'react'
import FallbackLoader from './FallbackLoader'
import { getAllBrands, getAllCategories, getManufacturers, type ApiBrand, type ApiCategory, type ApiManufacturer } from '../services/api'
import { categoryImageFrom, normalizeApiImage, pickImage } from '../services/images'

function unwrap<T = any>(res: any): T[] {
  if (Array.isArray(res)) return res as T[]
  if (res && Array.isArray(res.data)) return res.data as T[]
  if (res && typeof res === 'object') {
    for (const k of Object.keys(res)) {
      const v = (res as any)[k]
      if (Array.isArray(v)) return v as T[]
    }
  }
  return []
}

const TAB_LABELS: [string, string, string] = ['Top Car Parts', 'Top Manufacturers', 'Top Sellers']

export default function CarPartsCatalogue({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<ApiBrand[]>([])
  const [categories, setCategories] = useState<ApiCategory[]>([])
  const [manufacturers, setManufacturers] = useState<ApiManufacturer[]>([])
  const [tab, setTab] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [b, c, m] = await Promise.allSettled([
          getAllBrands(),
          getAllCategories(),
          getManufacturers(),
        ])
        if (!alive) return
        setBrands(unwrap<ApiBrand>(b.status === 'fulfilled' ? b.value : []))
        setCategories(unwrap<ApiCategory>(c.status === 'fulfilled' ? c.value : []))
        setManufacturers(unwrap<ApiManufacturer>(m.status === 'fulfilled' ? m.value : []))
      } catch (_) {
        // ignore
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

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

  const renderTabContent = () => {
    if (tab === 0) {
      return (
        <>
          {categories.slice(0, 4).map((c, idx) => {
            const name = (c as any)?.name || (c as any)?.title || 'Category'
            const icon = categoryImageFrom(c) || normalizeApiImage(pickImage(c) || '') || '/gapa-logo.png'
            const links = [name, 'Popular', 'New', 'Top Rated', 'Budget']
            return (
              <div key={`cat-${idx}`} className="rounded-xl bg-white p-4 ">
                <div className="flex justify-center gap-4">
                  <div className="flex h-auto sm:w-40 ring-1 ring-black/10 p-4 items-center justify-center rounded-lg">
                    <img src={icon} alt={name} className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src='/gapa-logo.png'}} />
                  </div>
                  <div>
                    <h5 className="text-[14px] font-semibold text-gray-900">{name}</h5>
                    <ul className="mt-2 space-y-1.5 text-[13px] text-[#333333]">
                      {links.map((l) => (
                        <li key={l}><a href="#" className="text-brand !underline !hover:underline">{l}</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
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
            return (
              <div key={`manu-${idx}`} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Trusted OEM quality</div>
              </div>
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
            const name = String((b as any)?.name || (b as any)?.title || 'Brand')
            return (
              <div key={`brand-${String((b as any)?.id ?? idx)}-${idx}`} className="rounded-xl bg-white p-4 ring-1 ring-black/10">
                <div className="text-[14px] font-semibold text-gray-900">{name}</div>
                <div className="mt-2 text-[12px] text-gray-600">Popular seller</div>
              </div>
            )
          })}
        </>
      )
    }
    return null
  }

  return (
    <section className={`mx-auto max-w-7xl px-4 py-12 sm:px-6 ${className}`}>
      <div
        className="flex items-center justify-center gap-6"
        role="tablist"
        aria-label="Car parts catalogue"
        onKeyDown={handleTabKeyDown}
      >
        {TAB_LABELS.map((t, i) => (
          <button
            key={t}
            ref={(el) => { tabRefs.current[i] = el }}
            onClick={() => setTab(i as 0 | 1 | 2)}
            role="tab"
            id={`catalogue-tab-${i}`}
            aria-controls={`catalogue-tabpanel-${i}`}
            aria-selected={tab === i}
            tabIndex={tab === i ? 0 : -1}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition ${tab === i ? 'bg-white ring-2 ring-accent text-[#F7CD3A]' : 'bg-[#F6F5FA] text-gray-700 ring-1 ring-black/5 hover:bg-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div
        id={`catalogue-tabpanel-${tab}`}
        role="tabpanel"
        aria-labelledby={`catalogue-tab-${tab}`}
        className="mt-6 grid grid-cols-1 gap-4 gap-y-10 md:grid-cols-2 lg:grid-cols-3"
      >
        {renderTabContent()}
      </div>

      <button className='bg-[#F7CD3A] px-10 rounded-md flex mt-5 w-fit mx-auto justify-center py-2'>View Catalogue</button>
    </section>
  )
}
