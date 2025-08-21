import Rating from './Rating'
import WishlistButton from './WishlistButton'
import useWishlist from '../hooks/useWishlist'
import { Link } from 'react-router-dom'

export type Product = {
  id: string
  title: string
  image: string
  rating: number
}

export type ProductCardProps = {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const wishlist = useWishlist()
  const isFav = wishlist.has(product.id)
  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const to = `/parts/${toSlug(product.title)}`

  return (
    <div className="group relative rounded-md bg-[#F6F5FA] p-4 ring-1 ring-black/5 transition hover:bg-white hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={to} className="block truncate text-[14px] font-semibold text-gray-900 hover:underline">{product.title}</Link>
          <Rating value={product.rating} className="mt-1" />
        </div>
        <WishlistButton active={isFav} onToggle={() => wishlist.toggle(product.id)} />
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
          src={product.image}
          alt={product.title}
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = 'https://dummyimage.com/600x450/f6f5fa/aaa.png&text=Part' }}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </Link>

      
    </div>
  )
}
