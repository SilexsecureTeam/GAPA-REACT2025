import Rating from './Rating'
import WishlistButton from './WishlistButton'
import useWishlist from '../hooks/useWishlist'
import { Link } from 'react-router-dom'
import { normalizeApiImage } from '../services/images'
import  logoImg from '../assets/gapa-logo.png'
import { toast } from 'react-hot-toast'

export type Product = {
  id: string
  title: string
  image: string
  rating: number
  // Optional slugs from API mapping for accurate routing
  brandSlug?: string
  partSlug?: string
}

export type ProductCardProps = {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(product.id)
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  // Prefer provided slugs; fallback to heuristics
  const knownBrands = ['audi','bmw','toyota','honda','mercedes','mercedes-benz','hyundai','ford','kia','lexus','volkswagen','vw','peugeot','land rover']
  const titleSlug = toSlug(product.title)
  const derivedBrand = product.brandSlug || knownBrands.find(b => titleSlug.startsWith(b.replace(/\s+/g, '-')))?.replace(/\s+/g, '-') || 'bmw'
  const partSlug = product.partSlug || 'brake-discs'
  const base = `/parts/${derivedBrand}/${partSlug}`
  const to = `${base}?pid=${encodeURIComponent(product.id)}`

  const imgSrc = normalizeApiImage(product.image) || logoImg

  return (
    <div className="group relative rounded-md bg-[#F6F5FA] p-4 ring-1 ring-black/5 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={to} className="block truncate text-[14px] font-semibold text-gray-900 hover:underline">{product.title}</Link>
          <Rating value={product.rating} className="mt-1" />
        </div>
        <WishlistButton active={isFav} onToggle={(active) => { wishlist.toggle(product.id); if (active) toast.success('Added to wishlist') }} />
      </div>
      <div className="mb-4">
        <Link to={to} className="inline-flex items-center gap-1 text-[14px] text-gray-700 hover:text-gray-900">
          Shop Now
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <Link to={to} className="mt-4 block aspect-[4/3] w-full overflow-hidden rounded-lg">
        <img
          src={imgSrc}
          alt={product.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = logoImg }}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      
    </div>
  )
}
