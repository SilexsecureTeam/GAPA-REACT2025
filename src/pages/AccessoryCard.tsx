import { useState } from "react";
import useWishlist from "../hooks/useWishlist";
import WishlistButton from "../components/WishlistButton";
import { Link } from "react-router-dom";
import Rating from "../components/Rating";
type Accessory = {
  id: string;
  title: string;
  image: string;
  rating: number;
  reviews: number;
  price: number;
  badge?: string;
};

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function AccessoryCard({ a }: { a: Accessory }) {
  const wishlist = useWishlist();
  const isFav = wishlist.has(a.id);
  const [qty, setQty] = useState(2);
  const inc = () => setQty((v) => Math.min(99, v + 1));
  const dec = () => setQty((v) => Math.max(1, v - 1));
  return (
    <div className="relative overflow-hidden rounded-xl bg-white ring-1 ring-black/10">
      {/* Header: brand + badges */}
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#E31C25] text-white">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="7" width="18" height="10" rx="2" />
              <path d="M7 7V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <span className="text-[13px] font-extrabold tracking-wide text-gray-900">
            TOYOTA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-accent/60 bg-white px-2 py-[2px] text-[10px] font-bold uppercase tracking-wide text-accent">
            FREE DELIVERY
          </span>
          <div className="-mr-1">
            <WishlistButton
              active={isFav}
              onToggle={() => wishlist.toggle(a.id)}
              ariaLabel="Add to wishlist"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-3">
        {/* Meta */}
        <div className="space-y-0.5 text-[11px] leading-tight text-gray-600">
          <div>Article No: 600123</div>
          <div className="uppercase">TOYOTA Parking Sensors Kit</div>
        </div>

        {/* Image */}
        <Link to={`/product/${a.id}`} className="mt-2 block">
          <div className="flex h-40 items-center justify-center overflow-hidden rounded-lg bg-white">
            <img
              src={a.image}
              alt={a.title}
              className="h-[80%] w-auto object-contain"
            />
          </div>
        </Link>

        {/* Rating + title + price */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center gap-1 text-[12px] text-gray-600">
            <Rating value={a.rating} size={12} />
            <span className="text-gray-500">
              ({a.reviews.toLocaleString()})
            </span>
          </div>
          <Link
            to={`/product/${a.id}`}
            className="block text-[14px] font-semibold text-gray-900 hover:underline"
          >
            {a.title}
          </Link>
          <div className="text-[16px] font-extrabold text-brand">
            {formatNaira(a.price)}
          </div>
          <button
            type="button"
            className="text-left text-[11px] leading-3 text-gray-600 underline"
          >
            Incl. 20% VAT
          </button>
        </div>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex overflow-hidden rounded-md ring-1 ring-black/10">
            <button
              aria-label="Prev"
              onClick={dec}
              className="h-8 w-8 text-gray-700 hover:bg-gray-50"
            >
              ‹
            </button>
            <div className="grid h-8 w-8 place-content-center text-[12px] font-semibold text-gray-800">
              {qty}
            </div>
            <button
              aria-label="Next"
              onClick={inc}
              className="h-8 w-8 text-gray-700 hover:bg-gray-50"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            aria-label="Add to cart"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-[#F7CD3A] ring-1 ring-black/10 hover:brightness-105"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 12.39a2 2 0 0 0 2 1.61h7.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
export default AccessoryCard;
