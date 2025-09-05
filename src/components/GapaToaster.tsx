import { Toaster, ToastBar, toast } from 'react-hot-toast'
import { useEffect } from 'react'

/**
 * GapaToaster
 * Advanced styling for react-hot-toast with brand theming, animated progress, and custom icons.
 */
export default function GapaToaster() {
  // Inject keyframes + utility styles once
  useEffect(() => {
    if (document.getElementById('gapa-toast-styles')) return
    const style = document.createElement('style')
    style.id = 'gapa-toast-styles'
    style.textContent = `@keyframes gapaToastIn{0%{transform:translateY(-6px) scale(.96);opacity:0}60%{transform:translateY(2px) scale(1.01);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}@keyframes gapaToastOut{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-4px) scale(.95);opacity:0}}@keyframes gapaProgress{from{transform:scaleX(1)}to{transform:scaleX(0)}}.gapa-toast-anim{animation:gapaToastIn .55s cubic-bezier(.4,.16,.2,1)}.gapa-toast-exit{animation:gapaToastOut .35s cubic-bezier(.4,.16,.2,1) forwards}.gapa-toast-progress{transform-origin:left center;animation:gapaProgress var(--toast-duration,4000ms) linear forwards}`
    document.head.appendChild(style)
  }, [])

  const iconFor = (t: any) => {
    if (t.type === 'loading') {
      return (
        <span className="relative inline-flex h-5 w-5 items-center justify-center">
          <span className="absolute inline-block h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </span>
      )
    }
    if (t.type === 'success') {
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] to-[var(--accent)] text-white shadow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
      )
    }
    if (t.type === 'error') {
      return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-rose-400 text-white shadow">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
        </span>
      )
    }
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-gray-600">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /></svg>
      </span>
    )
  }

  const gradientFor = (t: any) => {
    switch (t.type) {
      case 'success': return 'linear-gradient(to bottom,var(--brand),var(--accent))'
      case 'error': return 'linear-gradient(to bottom,#dc2626,#f87171)'
      case 'loading': return 'linear-gradient(to bottom,var(--accent),var(--brand))'
      default: return 'linear-gradient(to bottom,var(--brand),var(--accent))'
    }
  }

  const bottomStripeClass = (t: any) => {
    switch (t.type) {
      case 'success': return 'from-[var(--brand)] via-[var(--accent)] to-[var(--brand)]'
      case 'error': return 'from-red-500/90 via-red-400 to-red-500/90'
      case 'loading': return 'from-[var(--accent)] via-[var(--brand)] to-[var(--accent)]'
      default: return 'from-[var(--brand)] via-[var(--accent)] to-[var(--brand)]'
    }
  }

  return (
    <Toaster
      position="top-right"
      gutter={12}
      toastOptions={{
        duration: 4000,
        className: 'group !p-0 !bg-transparent shadow-none',
        style: { background: 'transparent', padding: 0, boxShadow: 'none' },
        success: { iconTheme: { primary: 'var(--brand)', secondary: '#fff' } },
        error: { iconTheme: { primary: '#DC2626', secondary: '#fff' } },
      }}
    >
      {(t) => (
        <ToastBar toast={t} style={{ padding: 0 }}>
          {({ message }) => (
            <div
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`gapa-toast-anim relative flex w-[340px] items-start gap-3 overflow-hidden rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-black/10 backdrop-blur-sm transition-all duration-300 will-change-transform group-hover:shadow-lg ${t.visible ? '' : 'gapa-toast-exit'}`}
              style={{ WebkitMaskImage: 'radial-gradient(circle at 10% 10%, black 0 60%, transparent 130%)' }}
            >
              {/* Decorative gradient edge */}
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
              <span aria-hidden className="absolute left-0 top-0 h-full w-1" style={{ backgroundImage: gradientFor(t) }} />

              {/* Progress bar (scaled) */}
              <span
                aria-hidden
                className="gapa-toast-progress absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-100 bg-gradient-to-r from-[#ffffff66] via-[#ffffffaa] to-[#ffffff11]"
                style={{ '--toast-duration': `${t.duration || 4000}ms` } as any}
              />

              {/* Content */}
              <div className="relative flex items-start gap-3 pl-1">
                <div className="mt-0.5 shrink-0 select-none">{iconFor(t)}</div>
                <div className="flex-1 pt-0.5 text-[13px] leading-snug text-gray-900 font-medium">
                  {message}
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  aria-label="Close notification"
                  className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent)]"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Bottom status stripe */}
              <span aria-hidden className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r ${bottomStripeClass(t)}`} />
            </div>
          )}
        </ToastBar>
      )}
    </Toaster>
  )
}
