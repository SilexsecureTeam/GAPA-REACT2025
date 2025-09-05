import { useEffect, useState } from 'react'
import FallbackLoader from './FallbackLoader'
import { getAllBrands, type ApiBrand } from '../services/api'
import { brandImageFrom, normalizeApiImage, pickImage } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

function brandNameOf(b: any): string {
  return String(b?.name || b?.title || b?.brand_name || b?.brand || '').trim() || 'Brand'
}

export default function TopBrands({ title = 'Top brands', limit = 12, viewAll = true }: { title?: string; limit?: number; viewAll?: boolean }) {
  const [loading, setLoading] = useState(true)
  const [brands, setBrands] = useState<ApiBrand[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await getAllBrands()
        if (!alive) return
        setBrands(Array.isArray(res) ? (res as ApiBrand[]) : [])
      } catch (_) {
        if (alive) setBrands([])
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-2 sm:px-6">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-gray-900 sm:text-[16px]">{title}</h3>
        {viewAll && (
          <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">View all
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        )}
      </div>
      {loading ? (
        <FallbackLoader label="Loading brands…" />
      ) : (
        <div className="mt-3 flex items-center justify-between gap-6 overflow-x-auto rounded-xl bg-white px-4 py-3 ring-1 ring-black/10 no-scrollbar">
          {brands.slice(0, limit).map((b, i) => {
            const name = brandNameOf(b)
            // Prefer explicit brand path, fallback to any image-like field
            const explicit = brandImageFrom(b)
            const fallback = normalizeApiImage(pickImage(b) || '')
            const src = explicit || fallback || logoImg
            return (
              <div key={`top-brand-${String((b as any)?.id ?? i)}-${i}`} className="shrink-0">
                <img
                  src={src}
                  alt={name}
                  className="h-10 sm:h-12 w-auto object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}}
                />
              </div>
            )
          })}
        </div>
      )}
      {/* Local helper to hide scrollbar if the global utility isn't present */}
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
    </section>
  )
}
