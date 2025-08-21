import { useMemo, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import Rating from '../components/Rating'
import WishlistButton from '../components/WishlistButton'
import useWishlist from '../hooks/useWishlist'

// Placeholder product fetcher (ready to be replaced with API)
const useProduct = (id?: string) => {
  return useMemo(() => {
    if (!id) return null
    return {
      id,
      brand: 'Febreze',
      brandLogo: 'https://dummyimage.com/110x44/ffffff/111111.png&text=Febreze',
      name: 'Febreze Lucky Leaf Car sir Freshner 537960',
      articleNo: '123456',
      price: 40000,
      image: 'https://dummyimage.com/300x520/f6f5fa/aaaaaa.png&text=Freshener',
      gallery: [
        'https://dummyimage.com/300x520/f6f5fa/aaaaaa.png&text=Freshener',
        'https://dummyimage.com/300x520/f6f5fa/aaaaaa.png&text=Side',
        'https://dummyimage.com/300x520/f6f5fa/aaaaaa.png&text=Back'
      ],
      rating: 0,
      reviews: 0,
      inStock: true,
      attributes: [
        { label: 'Scent', value: 'Tutti Frutti' },
        { label: 'Material', value: 'Cardboard' },
        { label: 'Product line', value: 'Lucky Leaf' },
        { label: 'Packing Type', value: 'Bag' },
        { label: 'Fastening type', value: 'Suspended' },
        { label: 'Condition', value: 'New' },
      ],
      description: 'Long-lasting car air freshener with a vibrant scent to keep your vehicle smelling fresh. Easy to hang and effective against odors.',
      warnings: ['WARNING', 'Keep out of reach of children', 'Do not ingest', 'Avoid contact with eyes']
    }
  }, [id])
}

export default function ProductDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const product = useProduct(id)
  const wishlist = useWishlist()
  const [qty, setQty] = useState(2)
  const inc = () => setQty((v) => Math.min(v + 1, 99))
  const dec = () => setQty((v) => Math.max(v - 1, 1))

  if (!product) return null

  const isFav = wishlist.has(product.id)

  return (
    <div className="bg-white !pt-14">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-medium text-gray-900 sm:text-[38px]">{product.name}</h1>

        <nav aria-label="Breadcrumb" className="mt-2 text-[15px] text-gray-600">
          <ol className="flex items-center gap-3 font-medium">
            <li><Link to="/parts" className="hover:underline text-gray-700">Parts Catalogue</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li><Link to="/parts/air-fresheners" className="hover:underline text-gray-700">Car Fresheners</Link></li>
            <li aria-hidden className="-mt-1.5 text-[24px]">›</li>
            <li className="font-semibold text-brand">{product.brand}</li>
          </ol>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[400px_1fr_320px]">
          {/* Gallery */}
          <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-6">
              <img src={product.image} alt={product.name} className="h-[360px] w-auto object-contain" />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.gallery.map((g, i) => (
                <button key={i} onClick={() => navigate(0)} className="flex items-center justify-center rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10">
                  <img src={g} alt={`Preview ${i+1}`} className="h-16 w-auto object-contain" />
                </button>
              ))}
            </div>
          </aside>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <img src={product.brandLogo} alt={product.brand} className="h-6 w-auto" />
              <div className="ml-auto text-right text-[12px] text-gray-500">
                <div>Article No: {product.articleNo}</div>
                <button className="text-brand underline">(Rate this product)</button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-600">
              <Rating value={product.rating} />
              <span>({product.reviews})</span>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {product.attributes.map((a) => (
                <div key={a.label} className="grid grid-cols-[180px_1fr] text-[13px]">
                  <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                  <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5 text-gray-700">{a.value}</div>
                </div>
              ))}
              <div className="mt-2 text-[12px] text-orange-700">⚠ WARNING <button className="underline">More</button></div>
            </div>

            <div className="pt-2 text-[13px] text-gray-700">{product.description}</div>
          </div>

          {/* Purchase */}
          <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
            <div className="text-right">
              <div className="text-[22px] font-bold text-gray-900">₦{product.price.toLocaleString('en-NG')}</div>
              <div className="mt-1 text-[10px] text-gray-600">Incl. 20% VAT, excl delivery cost</div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button aria-label="Decrease" onClick={dec} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">‹</button>
              <div className="inline-flex h-7 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{qty}</div>
              <button aria-label="Increase" onClick={inc} className="inline-flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-black/10 text-gray-700">›</button>
            </div>

            <button className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 hover:bg-[#f9d658]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" /></svg>
              Add to cart
            </button>

            <div className="mt-2 text-center">
              <WishlistButton active={isFav} onToggle={() => wishlist.toggle(product.id)} ariaLabel="Add to wishlist" />
            </div>

            <div className="mt-2 text-center text-[12px] text-purple-700">{product.inStock ? 'In Stock' : 'Out of stock'}</div>
          </aside>
        </div>

        {/* Info section bottom */}
        <section aria-labelledby="pd-info" className="mt-10">
          <h2 id="pd-info" className="text-[18px] font-semibold text-gray-900">Product information</h2>
          <div className="mt-3 grid gap-2 text-[13px] text-gray-700 sm:grid-cols-2">
            {product.attributes.map((a) => (
              <div key={a.label+a.value} className="grid grid-cols-[180px_1fr]">
                <div className="rounded-l-md bg-[#FBF5E9] px-3 py-1.5 font-medium text-gray-800">{a.label}</div>
                <div className="rounded-r-md bg-[#FBF5E9] px-3 py-1.5">{a.value}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  )
}
