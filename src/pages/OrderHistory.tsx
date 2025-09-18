import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUserOrders, getUserOrderItems, type ApiOrder, type ApiOrderItem } from '../services/api'
import { useAuth } from '../services/auth'
import FallbackLoader from '../components/FallbackLoader'
import logo from '../assets/gapa-logo.png'

function currency(n: number) {
  if (!isFinite(n)) return '₦0'
  return `₦${Math.max(0, Math.round(n)).toLocaleString('en-NG')}`
}

function OrderCard({ order, onToggle }: { order: ApiOrder; onToggle: (orderId: string) => void }) {
  const id = String(order?.order_id || order?.id || order?.reference || order?.txn_id || '')
  const created = String(order?.created_at || order?.date || order?.order_date || '')
  const status = String(order?.status || order?.order_status || 'Processing')
  const total = Number(order?.total || order?.amount || order?.grand_total || 0)
  const ref = String(order?.reference || order?.txn_id || id || '')
  const shipping = String(order?.shipping_address || order?.address || order?.shipping || '')

  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-10 w-10 place-content-center rounded-full bg-[#F6F5FA] ring-1 ring-black/10">
          <img src={logo} alt="" className="h-6 w-6 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-gray-900">Order #{id}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-600">
            {created && <span>{new Date(created).toLocaleString()}</span>}
            {ref && <span className="truncate">Ref: {ref}</span>}
            {shipping && <span className="truncate">Ship: {shipping}</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-[12px] font-medium text-gray-800 ring-1 ring-black/10">{status}</div>
          <div className="mt-1 text-[14px] font-semibold text-gray-900">{currency(total)}</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={() => onToggle(id)} className="inline-flex h-9 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[13px] font-semibold text-gray-900 ring-1 ring-black/10">View items</button>
        <Link to={`/order-success?ref=${encodeURIComponent(ref)}&amount=${encodeURIComponent(String(total || ''))}`} className="inline-flex h-9 items-center justify-center rounded-md bg-gray-100 px-4 text-[13px] font-semibold text-gray-900 ring-1 ring-black/10">View receipt</Link>
      </div>
    </div>
  )
}

export default function OrderHistory() {
  const { user } = useAuth()
  const userId = user?.id
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<ApiOrder[]>([])
  const [expanded, setExpanded] = useState<Record<string, { loading: boolean; items: ApiOrderItem[] }>>({})

  useEffect(() => {
    if (!userId) { setLoading(false); setOrders([]); return }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await getUserOrders(userId)
        if (!cancelled) setOrders(res)
      } catch {
        if (!cancelled) setOrders([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  const onToggle = async (orderId: string) => {
    setExpanded((prev) => {
      const cur = prev[orderId]
      if (cur && cur.items.length) {
        const next = { ...prev }
        delete next[orderId]
        return next
      }
      return { ...prev, [orderId]: { loading: true, items: [] } }
    })
    try {
      const items = await getUserOrderItems(orderId)
      setExpanded((prev) => ({ ...prev, [orderId]: { loading: false, items } }))
    } catch {
      setExpanded((prev) => ({ ...prev, [orderId]: { loading: false, items: [] } }))
    }
  }

  const empty = !loading && orders.length === 0

  return (
    <div className="bg-white pt-10">
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-[20px] font-semibold text-gray-900">Order History</h1>
        <p className="mt-1 text-[13px] text-gray-600">View your recent purchases and their status.</p>

        {loading && (
          <div className="mt-6"><FallbackLoader label="Loading your orders…" /></div>
        )}

        {empty && (
          <div className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-[#F6F5FA] to-white p-0 ring-1 ring-black/10 shadow-sm">
            <div className="grid gap-0 md:grid-cols-2">
              {/* Illustration / Accent side */}
              <div className="relative hidden md:block">
                <div className="absolute inset-0 flex items-center justify-center p-8">
                  <div className="relative -mt-6 w-full max-w-xs">
                    <div className="absolute -left-6 -top-6 h-20 w-20 rounded-full bg-[#F7CD3A]/30 blur-2xl" />
                    <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-purple-200/40 blur-2xl" />
                    <div className="relative rounded-2xl bg-white/70 p-6 backdrop-blur-sm ring-1 ring-black/10">
                      <div className="mx-auto grid h-20 w-20 place-content-center rounded-full bg-[#F7CD3A]/20 ring-1 ring-[#F7CD3A]/40">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-[#201A2B]">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 6h14m-6-6v6m-4 0h8" />
                        </svg>
                      </div>
                      <p className="mt-4 text-center text-[12px] font-medium text-gray-700 leading-relaxed">
                        Your shopping journey starts here. Discover quality parts, tools & accessories curated for your vehicle.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Text / Actions side */}
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight">No orders found</h2>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-600 max-w-md">You haven't placed any orders yet. Browse our catalogue to find genuine parts perfectly matched to your vehicle.</p>
                <ul className="mt-4 space-y-2 text-[12px] text-gray-700">
                  <li className="flex items-start gap-2"><span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#F7CD3A]" /><span>Track availability & compatibility with your saved vehicle.</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#F7CD3A]" /><span>Fast checkout with secured payment.</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-[#F7CD3A]" /><span>Earn trust ordering from verified brands.</span></li>
                </ul>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link to="/parts" className="inline-flex h-11 items-center justify-center rounded-md bg-[#F7CD3A] px-6 text-[14px] font-semibold text-[#201A2B] shadow-sm ring-1 ring-black/10 hover:brightness-105">Browse parts</Link>
                  <Link to="/" className="inline-flex h-11 items-center justify-center rounded-md bg-white px-5 text-[14px] font-medium text-gray-800 ring-1 ring-black/10 hover:bg-gray-50">Go home</Link>
                </div>
                <div className="mt-6 flex flex-wrap gap-4 text-[11px] text-gray-500">
                  <div className="flex items-center gap-1"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg><span>Real‑time order tracking</span></div>
                  <div className="flex items-center gap-1"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg><span>Quality guaranteed</span></div>
                  <div className="flex items-center gap-1"><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg><span>Wide product range</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !empty && (
          <div className="mt-6 space-y-4">
            {orders.map((o, idx) => {
              const id = String((o as any)?.order_id || (o as any)?.id || idx)
              const state = expanded[id]
              const isExpanded = Boolean(state)
              return (
                <div key={id} className="overflow-hidden rounded-2xl ring-1 ring-black/10">
                  <OrderCard order={o} onToggle={onToggle} />
                  {isExpanded && (
                    <div className="border-t border-black/10 bg-[#F6F5FA] p-4">
                      {state?.loading ? (
                        <div className="text-center text-sm text-gray-600">Loading items…</div>
                      ) : (state?.items.length ?? 0) === 0 ? (
                        <div className="text-center text-sm text-gray-600">No items found for this order.</div>
                      ) : (
                        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {state?.items.map((it: any, i) => {
                            const name = String(it?.product_name || it?.name || it?.title || 'Item')
                            const qty = Number(it?.quantity || it?.qty || 1)
                            const price = Number(it?.price || it?.amount || 0)
                            return (
                              <li key={i} className="flex items-center justify-between rounded-lg bg-white p-3 text-[14px] ring-1 ring-black/10">
                                <span className="truncate">{name} × {qty}</span>
                                <span className="font-semibold">{currency(price * qty)}</span>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
