export default function FallbackLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-[220px] place-content-center py-12">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-brand/15" aria-hidden />
          <div className="absolute inset-2 animate-pulse rounded-full bg-accent/20" aria-hidden />
          <div className="grid h-20 w-20 place-content-center rounded-full bg-white ring-1 ring-black/10 shadow-sm">
            <img src="/gapa-logo.png" alt="Gapa" className="h-10 w-auto" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
      </div>
    </div>
  )
}
