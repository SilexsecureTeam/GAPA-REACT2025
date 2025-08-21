import { useState, useEffect } from 'react'

export type WishlistButtonProps = {
  ariaLabel?: string
  size?: number
  active?: boolean
  onToggle?: (active: boolean) => void
}

export default function WishlistButton({ ariaLabel = 'Add to wishlist', size = 20, active: activeProp, onToggle }: WishlistButtonProps) {
  const [active, setActive] = useState(!!activeProp)
  useEffect(() => { setActive(!!activeProp) }, [activeProp])

  const toggle = () => {
    const next = !active
    setActive(next)
    onToggle?.(next)
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      title={active ? 'Remove from wishlist' : 'Add to wishlist'}
      onClick={toggle}
      className={`inline-flex items-center justify-center rounded-full bg-white text-[#350e49] hover:text-[#5A1E78] ring-1 ring-black/10 transition ${active ? 'text-[#5A1E78]' : ''}`}
      style={{ width: size + 8, height: size + 8 }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-8.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </button>
  )
}
