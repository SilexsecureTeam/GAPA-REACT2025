import { useState } from 'react'
import WishlistButton from './WishlistButton'
import { toast } from 'react-hot-toast'
import useWishlist from '../hooks/useWishlist'
import logoImg from '../assets/gapa-logo.png'

export type ProductActionData = {
  id: string
  title: string
  image: string
  rating: number
  reviews: number
  brand: string
  price: number
  priceLabel?: string
}

export type ProductActionCardProps = {
  product: ProductActionData
  enableView?: boolean
  onView?: () => void
  onAddToCart?: () => void | Promise<void>
}

const formatNaira = (value: number) => {
  if (!Number.isFinite(value)) return '₦0'
  return `₦${Math.max(0, value).toLocaleString('en-NG')}`
}

export default function ProductActionCard({ product, enableView = true, onView, onAddToCart }: ProductActionCardProps) {
  const wishlist = useWishlist()
  const [adding, setAdding] = useState(false)
  const isFav = wishlist.has(product.id)
  const showView = enableView && typeof onView === 'function'

  const handleWishlistToggle = (nextActive: boolean) => {
    wishlist.toggle(product.id)
    if (nextActive) toast.success('Added to wishlist')
    else toast('Removed from wishlist', { icon: '💔' })
  }

  const handleAddToCart = async () => {
    if (!onAddToCart || adding) return
    setAdding(true)
    try {
      await onAddToCart()
    } finally {
      setAdding(false)
    }
  }

  const ratingLabel = Number.isFinite(product.rating)
    ? (product.rating as number).toFixed(1)
    : '4.0'

  const reviewsLabel = Number.isFinite(product.reviews)
    ? `(${Math.max(0, product.reviews).toLocaleString()})`
    : '(0)'

  const handlePrimaryClick = () => {
    if (showView && onView) onView()
  }

  const imageNode = (
    <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
      <img
        src={product.image || logoImg}
        alt={product.title}
        onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
        className="h-[80%] w-auto object-contain"
      />
    </div>
  )

  return (
    <div className="relative rounded-xl bg-white ring-1 ring-black/10">
      <div className="absolute right-3 top-3 z-10">
        <WishlistButton size={18} active={isFav} onToggle={handleWishlistToggle} />
      </div>
      <div className="p-4">
        {showView ? (
          <button onClick={handlePrimaryClick} className="block w-full text-left">
            {imageNode}
          </button>
        ) : (
          <div className="block w-full cursor-default select-none">
            {imageNode}
          </div>
        )}

        <div className="mt-3 space-y-1">
          <div className="text-[12px] text-gray-600">
            {ratingLabel} • {reviewsLabel}
          </div>
          {showView ? (
            <button onClick={handlePrimaryClick} className="block w-full text-left text-[14px] font-semibold text-gray-900 hover:underline line-clamp-2">
              {product.title}
            </button>
          ) : (
            <div className="text-left text-[14px] font-semibold text-gray-900 line-clamp-2">
              {product.title}
            </div>
          )}
          <div className="text-[12px] text-gray-600">{product.brand}</div>
          <div className="text-[16px] font-extrabold text-brand">{product.priceLabel || formatNaira(product.price)}</div>
          <div className="text-left text-[11px] leading-3 text-gray-600">Incl. VAT</div>
        </div>

        <div className="mt-3 flex items-center justify-end gap-2">
          {showView && (
            <button
              type="button"
              onClick={handlePrimaryClick}
              className="inline-flex h-9 items-center justify-center rounded-md border border-black/10 px-3 text-[12px] font-semibold text-gray-800 hover:bg-black/5"
            >
              View
            </button>
          )}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!onAddToCart || adding}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
