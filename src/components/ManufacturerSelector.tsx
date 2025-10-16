import { type ApiManufacturer } from '../services/api'
import { manufacturerImageFrom, normalizeApiImage, pickImage } from '../services/images'

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ')

export type ManufacturerSelectorProps = {
  manufacturers: ApiManufacturer[]
  selectedId?: string | null
  onSelect?: (manufacturer: ApiManufacturer | null) => void
  loading?: boolean
  className?: string
  title?: string
  showClear?: boolean
}

const toId = (m: ApiManufacturer, fallback: number) => {
  // Prioritize saler_id as requested
  return String((m as any)?.saler_id ?? m?.id ?? (m as any)?.maker_id_ ?? (m as any)?.maker_id ?? (m as any)?.manufacturer_id ?? fallback)
}

const manufacturerName = (m: ApiManufacturer) => {
  return String(m?.name || m?.title || m?.maker_name || m?.manufacturer_name || 'Manufacturer')
}

const manufacturerImage = (m: ApiManufacturer) => {
  return manufacturerImageFrom(m) || normalizeApiImage(pickImage(m) || '')
}

export default function ManufacturerSelector({
  manufacturers,
  selectedId,
  onSelect,
  loading,
  className,
  title = 'Manufacturers',
  showClear = true,
}: ManufacturerSelectorProps) {
  const handleSelect = (m: ApiManufacturer | null) => {
    if (onSelect) onSelect(m)
  }

  const hasSelection = Boolean(selectedId)

  return (
    <section className={cn('w-full max-w-full overflow-hidden rounded-2xl bg-gradient-to-r from-[#F6F5FA] via-white to-[#F6F5FA] p-4 ring-1 ring-black/5 shadow-sm', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-gray-900 sm:text-[15px]">{title}</h2>
        {showClear && hasSelection && (
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-[11px] font-medium text-gray-700 hover:border-brand hover:text-brand"
          >
            Clear
          </button>
        )}
      </div>
      <div className="mt-3 overflow-x-auto no-scrollbar no-scrollbar::-webkit-scrollbar">
        <ul className="flex min-h-[72px] items-stretch gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <li key={`manufacturer-skel-${i}`} className="h-16 w-16 animate-pulse rounded-2xl bg-gray-100" />
            ))
          ) : manufacturers.length === 0 ? (
            <li className="text-[12px] text-gray-600">No manufacturers available.</li>
          ) : (
            manufacturers.map((m, index) => {
              const id = toId(m, index)
              if (!id) return null
              const active = selectedId === id
              const img = manufacturerImage(m)
              const name = manufacturerName(m)
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(active ? null : m)}
                    className={cn(
                      'group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:h-[76px] sm:w-[76px]',
                      active ? 'border-brand bg-white shadow-lg ring-1 ring-brand/30' : 'border-transparent bg-white ring-1 ring-black/10 hover:ring-brand/40'
                    )}
                    aria-pressed={active}
                    title={name}
                  >
                    {img ? (
                      <img src={img} alt={name} className="h-10 w-10 object-contain" loading="lazy" />
                    ) : (
                      <span className="text-[10px] font-medium text-gray-600">{name}</span>
                    )}
                    <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {name}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </section>
  )
}
