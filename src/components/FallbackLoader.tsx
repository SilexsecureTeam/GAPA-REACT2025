export default function FallbackLoader({ label = 'Loading…' }: { label?: string }) {
  const logo = '/gapa-logo.png'
  return (
    <div className="grid min-h-[220px] place-content-center py-12">
      <div className="flex flex-col items-center gap-5">
        <div className="relative">
          {/* Outer soft glow */}
          <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-brand/10 via-accent/10 to-brand/10 blur-2xl" aria-hidden />

          {/* Spinning conic ring */}
          <div className="absolute inset-0 grid place-content-center">
            <div className="h-[112px] w-[112px] rounded-full bg-[conic-gradient(var(--tw-gradient-stops))] from-brand via-accent to-brand animate-spin-slow [mask-image:radial-gradient(circle_46px_at_center,transparent_46px,black_47px)]" />
          </div>

          {/* Dotted orbit */}
          <div className="absolute inset-0 grid place-content-center">
            <div className="h-[112px] w-[112px] rounded-full border-2 border-dashed border-brand/30 animate-spin-reverse-slower" />
          </div>

          {/* Center logo with subtle pulse */}
          <div className="relative grid h-24 w-24 place-content-center rounded-full bg-white/90 shadow-md ring-1 ring-black/10">
            <img src={logo} alt="Gapa" className="h-12 w-12 object-contain select-none pointer-events-none animate-pulse" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
      </div>

      {/* Local keyframes (Tailwind arbitrary notations) */}
      <style>
        {`
          @keyframes spin-slow { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
          @keyframes spin-reverse-slower { from { transform: rotate(360deg) } to { transform: rotate(0deg) } }
          .animate-spin-slow { animation: spin-slow 2.4s linear infinite; }
          .animate-spin-reverse-slower { animation: spin-reverse-slower 4s linear infinite; }
        `}
      </style>
    </div>
  )
}
