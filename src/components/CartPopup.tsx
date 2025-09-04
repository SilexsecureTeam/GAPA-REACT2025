import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../services/auth'
import { getCartForUser, removeCartItem, getProductById } from '../services/api'
import { getGuestCart, setGuestCart, type GuestCart } from '../services/cart'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'

export type CartPopupProps = {
  open: boolean
  onClose: () => void
  onProceed: () => void
  onViewCart?: () => void
  refreshKey?: number
}

export type UICartItem = {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
}

function mapApiCartItemToUi(item: any): UICartItem | null {
  const prod = (item && (item.product || item.part || item.item)) || item
  const productId = String(item?.product_id ?? prod?.id ?? item?.id ?? '')
  if (!productId) return null
  const name = String(prod?.name || prod?.title || prod?.product_name || 'Part')
  const price = Number(prod?.price ?? prod?.selling_price ?? prod?.amount ?? item?.price ?? 0)
  const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1
  const image = productImageFrom(prod) || normalizeApiImage(pickImage(prod) || '') || logoImg
  return { productId, name, price, quantity, image }
}

export default function CartPopup({ open, onClose, onProceed, onViewCart, refreshKey = 0 }: CartPopupProps) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<UICartItem[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items])

  const load = async () => {
    try {
      setLoading(true)
      if (user && user.id) {
        const res = await getCartForUser(user.id)
        const arr = Array.isArray(res) ? res : []
        const mapped: UICartItem[] = arr.map(mapApiCartItemToUi).filter(Boolean) as UICartItem[]
        setItems(mapped)
      } else {
        // Guest cart: enrich with product details
        const cart: GuestCart = getGuestCart()
        if (!cart.items.length) { setItems([]); return }
        const details = await Promise.all(cart.items.map(async (ci) => {
          try {
            const prod = await getProductById(ci.product_id)
            return { ci, prod }
          } catch {
            return { ci, prod: null }
          }
        }))
        const mapped: UICartItem[] = details.map(({ ci, prod }) => {
          const p = prod && (prod as any).part ? (prod as any).part : prod
          const name = String(p?.name || p?.title || 'Part')
          const price = Number(p?.price || p?.selling_price || p?.amount || 0)
          const image = productImageFrom(p) || normalizeApiImage(pickImage(p) || '') || logoImg
          return { productId: ci.product_id, name, price, quantity: ci.quantity, image }
        })
        setItems(mapped)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshKey, user?.id])

  const onRemove = async (productId: string) => {
    setBusyId(productId)
    try {
      if (user && user.id) {
        await removeCartItem(user.id, productId)
      } else {
        const cart = getGuestCart()
        const next: GuestCart = { items: cart.items.filter(it => it.product_id !== productId) }
        setGuestCart(next)
      }
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  const countLabel = String(items.length).padStart(2, '0')

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end ">
      {/* Backdrop - click to close only when user chooses */}
      <div className="absolute inset-0 bg-black/10" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-[380px] md:max-w-[420px] bg-white shadow-2xl ring-1 ring-black/10 md:rounded-xl mr-3 md:mr-8 lg:mr-12">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-[16px] font-semibold text-gray-900">Shopping Cart ({countLabel})</h3>
          <button onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-600">Loading cart…</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-600">Your cart is empty.</div>
          ) : (
            <ul className="space-y-4">
              {items.map((it) => (
                <li key={it.productId} className="grid grid-cols-[52px_1fr_auto] items-start gap-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-[#F6F5FA] ring-1 ring-black/10">
                    <img src={it.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-gray-900">{it.name}</div>
                    <div className="mt-1 text-[13px] text-gray-600">{it.quantity} x <span className="font-semibold text-gray-900">₦{it.price.toLocaleString('en-NG')}</span></div>
                  </div>
                  <button disabled={busyId===it.productId} onClick={()=>onRemove(it.productId)} className="mt-0.5 text-gray-500 hover:text-red-600" aria-label="Remove">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between text-[14px]">
            <span className="text-gray-600">Sub-Total:</span>
            <span className="font-semibold text-gray-900">₦{subtotal.toLocaleString('en-NG')}</span>
          </div>
          <button onClick={onProceed} disabled={items.length===0} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 disabled:opacity-60">
            PROCEED TO CHECKOUT <span aria-hidden>→</span>
          </button>
          <button onClick={onViewCart ?? onProceed} className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-md border border-purple-600 text-[14px] font-semibold text-purple-700">
            VIEW CART
          </button>
        </div>
      </div>
    </div>
  )
}
