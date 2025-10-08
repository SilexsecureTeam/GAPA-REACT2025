import Rating from './Rating'
import WishlistButton from './WishlistButton'
import useWishlist from '../hooks/useWishlist'
import { useNavigate } from 'react-router-dom'
import { normalizeApiImage, productImageFrom } from '../services/images'
import  logoImg from '../assets/gapa-logo.png'
import { toast } from 'react-hot-toast'
import { useState } from 'react'
import { useAuth } from '../services/auth'
import { addGuestCartItem } from '../services/cart'
import { addToCartApi } from '../services/api'

export type Product = {
  id: string
  title: string
  image: string
  rating: number
  // Optional slugs from API mapping for accurate routing
  brandSlug?: string
  partSlug?: string
  // Optional raw product data for navigation state
  rawProduct?: any
}

export type ProductCardProps = {
  product: Product
  hideWishlistButton?: boolean
  hideAddToCartButton?: boolean
}

export default function ProductCard({ product, hideWishlistButton, hideAddToCartButton }: ProductCardProps) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(product.id)
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const navigate = useNavigate()
  const { user } = useAuth()
  const [adding, setAdding] = useState(false)

  // Prefer provided slugs; fallback to heuristics
  const knownBrands = ['audi','bmw','toyota','honda','mercedes','mercedes-benz','hyundai','ford','kia','lexus','volkswagen','vw','peugeot','land rover']
  const titleSlug = toSlug(product.title)
  const derivedBrand = product.brandSlug || knownBrands.find(b => titleSlug.startsWith(b.replace(/\s+/g, '-')))?.replace(/\s+/g, '-') || 'gapa'
  const partSlug = product.partSlug || 'parts'
  const base = `/parts/${derivedBrand}/${partSlug}`
  const to = `${base}?pid=${encodeURIComponent(product.id)}`
  
  // Create navigation handler with raw product data
  const handleNavigate = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (product.rawProduct) {
      navigate(to, { state: { productData: product.rawProduct } })
    } else {
      navigate(to)
    }
  }

  // Use productImageFrom path logic if original image looks relative/placeholder
  const directImg = product.image
  const imgSrc = productImageFrom({ image: directImg }) || normalizeApiImage(directImg) || logoImg

  const handleToggle = (nextActive: boolean) => {
    wishlist.toggle(product.id)
    if (nextActive) toast.success('Added to wishlist')
    else toast('Removed from wishlist', { icon: '💔' })
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (adding) return
    setAdding(true)
    try {
      if (user && user.id) {
        await addToCartApi({ user_id: user.id, product_id: product.id, quantity: 1 })
      } else {
        addGuestCartItem(product.id, 1)
      }
      toast.success('Added to cart')
      navigate({ hash: '#cart' })
    } catch {
      toast.error('Could not add to cart')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="group relative rounded-md bg-[#F6F5FA] p-4 ring-1 ring-black/5 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button 
            type="button" 
            onClick={handleNavigate} 
            className="block truncate text-[14px] font-semibold text-gray-900 hover:underline text-left w-full"
          >
            {product.title}
          </button>
          <Rating value={product.rating} className="mt-1" />
        </div>
        {!hideWishlistButton && (
          <WishlistButton active={isFav} onToggle={handleToggle} />
        )}
      </div>
      <div className="mb-4 flex items-center justify-between">
        <button 
          type="button"
          onClick={handleNavigate}
          className="inline-flex items-center gap-1 text-[14px] text-gray-700 hover:text-gray-900"
        >
          Shop Now
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </button>
        {!hideAddToCartButton && (
          <button
            type="button"
            aria-label="Add to cart"
            onClick={handleAddToCart}
            disabled={adding}
            className="inline-flex h-8 items-center justify-center rounded-md bg-[#F7CD3A] px-3 text-[12px] font-semibold text-[#201A2B] ring-1 ring-black/10 hover:brightness-105 disabled:opacity-60"
          >
            {adding ? 'Adding…' : 'Add to cart'}
          </button>
        )}
      </div>

      <button 
        type="button"
        onClick={handleNavigate}
        className="mt-4 block aspect-[4/3] w-full overflow-hidden rounded-lg"
      >
        <img
          src={imgSrc}
          alt={product.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </button>
    </div>
  )
}
