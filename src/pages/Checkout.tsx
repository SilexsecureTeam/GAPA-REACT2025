import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../services/auth'
import { getCartForUser, removeCartItem, updateCartQuantity, getProductById, getAllStatesApi, getStatesByLocation, updateDeliveryAddress, /* getUserCartTotal, */ getPriceByState, getDeliveryRate, paymentSuccessfull, getGigQuote } from '../services/api'
import { getGuestCart, setGuestCart, type GuestCart } from '../services/cart'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import toast from 'react-hot-toast'
// import deliveryGig from '../assets/deliveryGig.png'
// Add optional secrets fallback (dev convenience only)
import { PAYSTACK_PUBLIC_KEY as SECRET_PAYSTACK_KEY } from '../secrets'

function sanitizeKey(val: any): string | undefined {
  const s = typeof val === 'string' ? val.trim() : ''
  if (!s) return undefined
  // Ignore Vite placeholders if not replaced
  if (s.startsWith('%VITE_') && s.endsWith('%')) return undefined
  return s
}

type UICartItem = {
  productId: string
  name: string
  price: number
  quantity: number
  image: string
}

type Address = {
  fullName: string
  email: string
  phone: string
  address1: string
  address2: string
  city: string
  region: string
  regionId?: string | number
  country: string
  postcode: string
  deliveryLocationId?: string | number
  deliveryLocationName?: string
}

type PaymentMethod = 'paystack' | 'flutter'

type DeliveryMethod = 'gapa' | 'gig'

function useCartData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<UICartItem[]>([])

  const load = async () => {
    try {
      setLoading(true)
      if (user && user.id) {
        const res = await getCartForUser(user.id)
        const arr = Array.isArray(res) ? res : []
        const mapped: UICartItem[] = arr.map((item: any) => {
          const prod = (item && (item.product || item.part || item.item)) || item
          const productId = String(item?.product_id ?? prod?.id ?? item?.id ?? '')
          const name = String(prod?.name || prod?.title || prod?.product_name || 'Part')
          const price = Number(prod?.price ?? prod?.selling_price ?? prod?.amount ?? item?.price ?? 0)
          const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1
          const image = productImageFrom(prod) || normalizeApiImage(pickImage(prod) || '') || logoImg
          return { productId, name, price, quantity, image }
        }).filter(Boolean)
        setItems(mapped)
      } else {
        const cart: GuestCart = getGuestCart()
        if (!cart.items.length) { setItems([]); return }
        const details = await Promise.all(cart.items.map(async (ci) => {
          try { const prod = await getProductById(ci.product_id); return { ci, prod } } catch { return { ci, prod: null } }
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

  useEffect(() => { load() }, [user?.id])

  return { user, loading, items, reload: load, setItems }
}

export default function Checkout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { loading, items, reload } = useCartData()
  const [busyId, setBusyId] = useState<string | null>(null)
  const unauthenticated = !user
  const steps = unauthenticated ? ['Cart', 'Login', 'Address', 'Payment', 'Review'] : ['Cart', 'Address', 'Payment', 'Review']
  const [step, setStep] = useState<number>(0)
  const progress = (step / (steps.length - 1)) * 100

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items])
  // VAT: 7.5% of subtotal
  const vat = useMemo(() => Math.max(0, Math.round(subtotal * 0.075)), [subtotal])

  // --- Delivery pricing & method state ---------------------------------------
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(() => (localStorage.getItem('checkoutDeliveryMethod') as DeliveryMethod) || 'gapa')

  // Gapa pricing (previous deliveryPrice state renamed)
  const [gapaDeliveryPrice, setGapaDeliveryPrice] = useState<number>(0)
  const [deliveryLoading, setDeliveryLoading] = useState<boolean>(false)
  const [defaultDeliveryRate, setDefaultDeliveryRate] = useState<number | null>(null)

  // GIG quote state
  const [gigQuoteAmount, setGigQuoteAmount] = useState<number>(0)
  const [gigLoading, setGigLoading] = useState<boolean>(false)
  const [gigError, setGigError] = useState<string | null>(null)
  const [gigLastRegion, setGigLastRegion] = useState<string | number | undefined>(undefined)

  // Effective delivery price used in calculations
  const effectiveDeliveryPrice = useMemo(() => deliveryMethod === 'gapa' ? gapaDeliveryPrice : gigQuoteAmount, [deliveryMethod, gapaDeliveryPrice, gigQuoteAmount])
  const total = useMemo(() => subtotal + vat + (effectiveDeliveryPrice || 0), [subtotal, vat, effectiveDeliveryPrice])

  // --- Address & Payment state (unchanged except references to delivery price) ---
  const [address, setAddress] = useState<Address>(() => {
    const saved = localStorage.getItem('checkoutAddress')
    const base: Address = {
      fullName: '', email: '', phone: '', address1: '', address2: '', city: '', region: '', regionId: undefined, country: 'Nigeria', postcode: ''
    }
    try {
      if (saved) return { ...base, ...(JSON.parse(saved) as Partial<Address>) }
    } catch {}
    return base
  })
  const [payment, setPayment] = useState<PaymentMethod>(() => {
    const saved = (localStorage.getItem('checkoutPayment') as any) || ''
    return saved === 'flutter' ? 'flutter' : 'paystack'
  })

  // Login tab state
  const [loginTab, setLoginTab] = useState<'login' | 'signup'>('login')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginForm, setLoginForm] = useState({ emailOrPhone: '', password: '' })

  // States list
  const [states, setStates] = useState<{ id?: string | number; name?: string; state?: string; title?: string }[]>([])
  const [statesLoading, setStatesLoading] = useState(false)
  const [locations, setLocations] = useState<{ id: string | number; location: string; price: number }[]>([])

  // Persist delivery method
  useEffect(()=>{ localStorage.setItem('checkoutDeliveryMethod', deliveryMethod) }, [deliveryMethod])

  // Existing effect: load states, default rate, prefill address
  useEffect(() => {
    const u = (user as any) || null
    setAddress((prev) => {
      const next = { ...prev }
      if (u) {
        next.fullName = next.fullName || String(u?.name || '')
        next.email = next.email || String(u?.email || '')
        next.phone = next.phone || String(u?.phone || '')
        next.address1 = next.address1 || String(u?.shipping_address || u?.address || '')
        // city now derived from delivery location; keep if previously stored
        next.city = next.city || ''
        // region/regionId hydrate by matching title later
        next.region = next.region || String(u?.shipping_region || u?.region || '')
        next.country = 'Nigeria'
        next.postcode = next.postcode || String(u?.shipping_postbox || u?.postbox || '')
      }
      return next
    })
    const loadStates = async () => {
      setStatesLoading(true)
      try {
        // Prefer get-states?location=gapa; fallback to getAllStates
        let list = await getStatesByLocation('gapa')
        if (!list?.length) list = await getAllStatesApi()
        setStates(list)
      } catch { setStates([]) } finally { setStatesLoading(false) }
    }
    loadStates()
    ;(async () => { try { const rateNum = await getDeliveryRate(); if (!isNaN(rateNum) && rateNum > 0) setDefaultDeliveryRate(rateNum) } catch {} })()
  }, [user?.id])

  // Hydrate regionId from stored region name
  useEffect(() => {
    if (!address.regionId && address.region && states.length) {
      const match = states.find((s) => (s.title || s.name || s.state || '') === address.region)
      if (match?.id != null) setAddress((a) => ({ ...a, regionId: match.id }))
    }
  }, [states])

  // Fetch Gapa delivery locations/prices when region changes (only if using Gapa OR always to keep ready)
  useEffect(() => {
    const fetchLocations = async () => {
      setLocations([])
      setAddress(a => ({ ...a, deliveryLocationId: undefined, deliveryLocationName: undefined }))
      if (!address.regionId) { setGapaDeliveryPrice(0); return }
      setDeliveryLoading(true)
      try {
        const res = await getPriceByState(address.regionId)
        // Expect shape: { price: [ { id, location, price } ] }
        let arr: any[] = []
        if (Array.isArray((res as any)?.price)) arr = (res as any).price
        else if (Array.isArray((res as any)?.results?.price)) arr = (res as any).results.price
        else if (Array.isArray((res as any)?.data?.price)) arr = (res as any).data.price
        const mapped = arr.map((it) => ({
          id: it.id ?? it.location_id ?? it._id ?? String(it.location || 'loc'),
          location: String(it.location || it.title || it.name || 'Location'),
          price: Number(it.price ?? it.amount ?? 0) || 0,
        })) as { id: string | number; location: string; price: number }[]
        setLocations(mapped)
        // If no specific locations/prices returned, fallback to default delivery rate
        if (!mapped.length) {
          setGapaDeliveryPrice(Math.max(0, Math.round(defaultDeliveryRate || 0)))
        } else {
          // Auto-select if there is exactly one location
          if (mapped.length === 1) {
            const only = mapped[0]
            setAddress(a => ({ ...a, deliveryLocationId: only.id, deliveryLocationName: only.location }))
            setGapaDeliveryPrice(Math.max(0, Math.round(only.price || 0)))
          } else {
            setGapaDeliveryPrice(0) // wait for user to pick location
          }
        }
      } catch {
        setLocations([])
        setGapaDeliveryPrice(Math.max(0, Math.round(defaultDeliveryRate || 0)))
      } finally { setDeliveryLoading(false) }
    }
    fetchLocations()
  }, [address.regionId])

  // Fetch GIG quote when region/state changes & method is gig
  useEffect(() => {
    const fetchGig = async () => {
      if (deliveryMethod !== 'gig') return
      if (!address.regionId) { setGigQuoteAmount(0); setGigError(null); return }
      if (gigLastRegion === address.regionId && gigQuoteAmount > 0 && !gigError) return // already have quote
      setGigLoading(true); setGigError(null)
      try {
        // Derive weight: basic heuristic (1kg per item)
        const totalQty = items.reduce((s,i)=>s+i.quantity,0)
        const weight = Math.max(1, totalQty)
        const stateLabel = states.find(s=>String(s.id)===String(address.regionId))
        const destination_state = String(stateLabel?.title || stateLabel?.name || stateLabel?.state || address.region || address.regionId)
        const quote = await getGigQuote({ destination_state, weight_kg: weight })
        if (quote.amount <= 0) throw new Error('No rate returned')
        setGigQuoteAmount(Math.round(quote.amount))
        setGigLastRegion(address.regionId)
      } catch (e:any) {
        setGigQuoteAmount(0)
        setGigError(e?.message || 'Failed to fetch GIG rate')
      } finally { setGigLoading(false) }
    }
    void fetchGig()
  }, [deliveryMethod, address.regionId, items])

  useEffect(() => { localStorage.setItem('checkoutAddress', JSON.stringify(address)) }, [address])
  useEffect(() => { localStorage.setItem('checkoutPayment', payment) }, [payment])

  // Validation adjustments: require method-specific fields/quotes
  const addressValid = useMemo(() => {
    const req = ['fullName','email','phone','address1','region'] as (keyof Address)[]
    const baseValid = req.every((k) => String((address as any)[k] || '').trim().length > 1)
    if (!baseValid) return false
    if (deliveryMethod === 'gapa') {
      const locValid = locations.length === 0 || Boolean(address.deliveryLocationId)
      return locValid && (gapaDeliveryPrice > 0 || locations.length === 0 || defaultDeliveryRate != null)
    } else { // gig
      return gigQuoteAmount > 0 && !gigLoading && !gigError
    }
  }, [address, locations.length, address.deliveryLocationId, gapaDeliveryPrice, deliveryMethod, gigQuoteAmount, gigLoading, gigError, defaultDeliveryRate])

  const onInc = async (productId: string) => {
    const current = items.find(i => i.productId === productId)
    if (!current) return
    const nextQty = Math.min(99, current.quantity + 1)
    setBusyId(productId)
    try {
      if (user && (user as any).id) {
        await updateCartQuantity({ user_id: (user as any).id, product_id: productId, quantity: nextQty })
      } else {
        const cart = getGuestCart()
        const idx = cart.items.findIndex(it => it.product_id === productId)
        if (idx >= 0) { cart.items[idx].quantity = nextQty; setGuestCart(cart) }
      }
      await reload()
    } finally { setBusyId(null) }
  }

  const onDec = async (productId: string) => {
    const current = items.find(i => i.productId === productId)
    if (!current) return
    const nextQty = Math.max(1, current.quantity - 1)
    setBusyId(productId)
    try {
      if (user && (user as any).id) {
        await updateCartQuantity({ user_id: (user as any).id, product_id: productId, quantity: nextQty })
      } else {
        const cart = getGuestCart()
        const idx = cart.items.findIndex(it => it.product_id === productId)
        if (idx >= 0) { cart.items[idx].quantity = nextQty; setGuestCart(cart) }
      }
      await reload()
    } finally { setBusyId(null) }
  }

  const onRemove = async (productId: string) => {
    setBusyId(productId)
    try {
      if (user && (user as any).id) {
        await removeCartItem((user as any).id, productId)
      } else {
        const cart = getGuestCart()
        const next: GuestCart = { items: cart.items.filter(it => it.product_id !== productId) }
        setGuestCart(next)
      }
      await reload()
    } finally { setBusyId(null) }
  }

  const handleContinueFromAddress = async () => {
    // Persist address to backend if logged in
    if (user && (user as any).id) {
      const methodTag = deliveryMethod === 'gig' ? 'GIG Logistics' : 'Gapa Delivery'
      const payloadAddress = [address.address1, address.address2, address.region, address.postcode, address.deliveryLocationName, methodTag].filter(Boolean).join(', ')
      try { await updateDeliveryAddress({ user_id: (user as any).id, address: payloadAddress }) } catch {}
    }
    // Ensure deliveryPrice is set; if still 0 and we have a default rate, use it
    if (deliveryMethod === 'gapa' && !gapaDeliveryPrice && defaultDeliveryRate) setGapaDeliveryPrice(defaultDeliveryRate)
    setStep((s) => s + 1)
  }

  // Paystack Integration
  const PAYSTACK_KEY = (
    sanitizeKey((import.meta as any)?.env?.VITE_PAYSTACK_PUBLIC_KEY)
    || sanitizeKey((import.meta as any)?.env?.PAYSTACK_PUBLIC_KEY)
    || sanitizeKey(typeof window !== 'undefined' ? (window as any).VITE_PAYSTACK_PUBLIC_KEY : undefined)
    || sanitizeKey(typeof window !== 'undefined' ? (window as any).PAYSTACK_PUBLIC_KEY : undefined)
    || sanitizeKey(typeof document !== 'undefined' ? (document.querySelector('meta[name="paystack-public-key"]') as HTMLMetaElement | null)?.content : undefined)
    || sanitizeKey(SECRET_PAYSTACK_KEY)
  ) as string | undefined
  async function ensurePaystackScript() {
    if ((window as any).PaystackPop) return
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://js.paystack.co/v1/inline.js'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Paystack'))
      document.body.appendChild(s)
    })
  }
  function buildAddressString() {
    const methodTag = deliveryMethod === 'gig' ? 'GIG Logistics' : 'Gapa Delivery'
    return [address.fullName, address.address1, address.address2, address.deliveryLocationName, address.region, address.postcode, methodTag].filter(Boolean).join(', ')
  }

  async function startPaystackCheckout() {
    if (!PAYSTACK_KEY) { toast.error('Payment is not configured'); return }
    try {
      await ensurePaystackScript()
      const amountKobo = Math.max(0, Math.round((subtotal + vat + (effectiveDeliveryPrice || 0)) * 100))
      const email = address.email || (user as any)?.email || 'user@example.com'
      const ref = `GAPA_${Date.now()}`
      // Use a plain function for Paystack callback; delegate to async logic inside
      function paystackCallback(response: any) {
        ;(async () => {
          try {
            await paymentSuccessfull({
              shipping_cost: effectiveDeliveryPrice || 0,
              address: buildAddressString(),
              userId: (user as any)?.id ?? '',
              txn_id: response?.reference || ref,
              pickup_location_id: address.deliveryLocationId ? String(address.deliveryLocationId) : '',
            })
            try { setGuestCart({ items: [] }) } catch {}
            toast.success('Payment successful')
            const amountNgn = (amountKobo / 100) || 0
            navigate(`/order-success?ref=${encodeURIComponent(response?.reference || ref)}&amount=${encodeURIComponent(String(amountNgn))}`)
          } catch (e: any) {
            toast.error(e?.message || 'Failed to confirm payment')
          }
        })().catch(()=>{})
      }
      const handler = (window as any).PaystackPop.setup({
        key: PAYSTACK_KEY,
        email,
        amount: amountKobo,
        currency: 'NGN',
        ref,
        callback: paystackCallback,
        onClose: function(){
          toast('Payment cancelled')
        }
      })
      handler.openIframe()
    } catch (e: any) {
      toast.error(e?.message || 'Unable to start payment')
    }
  }

  // Flutterwave Integration
  const FLUTTER_KEY = (
    sanitizeKey((import.meta as any)?.env?.VITE_FLUTTER_PUBLIC_KEY)
    || sanitizeKey(typeof window !== 'undefined' ? (window as any).VITE_FLUTTER_PUBLIC_KEY : undefined)
    || sanitizeKey(typeof window !== 'undefined' ? (window as any).FLUTTER_PUBLIC_TEST_SK : undefined)
    || sanitizeKey(typeof document !== 'undefined' ? (document.querySelector('meta[name="flutter-public-key"]') as HTMLMetaElement | null)?.content : undefined)
  ) as string | undefined

  async function ensureFlutterScript() {
    if ((window as any).FlutterwaveCheckout) return
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://checkout.flutterwave.com/v3.js'
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Flutterwave'))
      document.body.appendChild(s)
    })
  }

  async function startFlutterCheckout() {
    if (!FLUTTER_KEY) { toast.error('Payment is not configured'); return }
    try {
      await ensureFlutterScript()
      const amountNgn = Math.max(0, Math.round(subtotal + vat + (effectiveDeliveryPrice || 0)))
      const email = address.email || (user as any)?.email || 'user@example.com'
      const ref = `GAPA_FLW_${Date.now()}`
      ;(window as any).FlutterwaveCheckout({
        public_key: FLUTTER_KEY,
        tx_ref: ref,
        amount: amountNgn,
        currency: 'NGN',
        payment_options: 'card,banktransfer,ussd',
        customer: {
          email,
          phone_number: address.phone || '',
          name: address.fullName || ''
        },
        callback: async (response: any) => {
          try {
            await paymentSuccessfull({
              shipping_cost: effectiveDeliveryPrice || 0,
              address: buildAddressString(),
              userId: (user as any)?.id ?? '',
              txn_id: response?.transaction_id || response?.tx_ref || ref,
              pickup_location_id: address.deliveryLocationId ? String(address.deliveryLocationId) : '',
            })
            try { setGuestCart({ items: [] }) } catch {}
            toast.success('Payment successful')
            navigate(`/order-success?ref=${encodeURIComponent(response?.tx_ref || ref)}&amount=${encodeURIComponent(String(amountNgn))}`)
          } catch (e: any) {
            toast.error(e?.message || 'Failed to confirm payment')
          }
        },
        onclose: () => {
          toast('Payment cancelled')
        }
      })
    } catch (e: any) {
      toast.error(e?.message || 'Unable to start payment')
    }
  }

  const goNext = () => {
    // If unauthenticated and moving from Cart -> Login
    if (step === 0) {
      setStep(1)
      return
    }
    // If on login step for unauthenticated
    if (unauthenticated && step === 1) {
      // require user to either login or continue as guest
      setStep(2)
      return
    }
    // Address step index differs by auth
    const addressStepIndex = unauthenticated ? 2 : 1
    const paymentStepIndex = addressStepIndex + 1
    if (step === addressStepIndex) {
      if (addressValid) {
        void handleContinueFromAddress()
      }
      return
    }
    if (step === paymentStepIndex) {
      // Only advance to Review; do not start payment here
      setStep(step + 1)
      return
    }
  }
  const goBack = () => setStep((s) => Math.max(0, s - 1))

  return (
    <div className="bg-white pt-10">
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[20px] font-semibold text-gray-900">Checkout</h1>
          {/* Stepper + Progress */}
          <div className="mt-4">
            <div className="flex items-center justify-between">
              {steps.map((label, i) => {
                const active = i === step
                const completed = i < step
                return (
                  <button key={label} onClick={()=>{ if (i <= step) setStep(i) }} className="flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[12px] ring-1 ring-black/10 ${completed? 'bg-brand text-gray-900' : active? 'bg-white text-gray-900' : 'bg-gray-100 text-gray-600'}`}>
                        {completed ? '✓' : i+1}
                      </div>
                      <div className={`text-[12px] ${active? 'font-semibold text-brand' : 'text-gray-700'}`}>{label}</div>
                    </div>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 h-2 w-full rounded bg-gray-100">
              <div className="h-2 rounded bg-brand" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* Step content */}
        {step === 0 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              {loading ? (
                <div className="py-12 text-center text-sm text-gray-600">Loading cart…</div>
              ) : items.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-600">Your cart is empty.</div>
              ) : (
                <ul className="space-y-3">
                  {items.map((it) => (
                    <li key={it.productId} className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-lg bg-[#F6F5FA] p-2 ring-1 ring-black/10">
                      <div className="flex h-18 w-18 items-center justify-center overflow-hidden rounded bg-white ring-1 ring-black/10">
                        <img src={it.image} alt="" className="h-full w-full object-contain" onError={(e)=>{(e.currentTarget as HTMLImageElement).src=logoImg}} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[14px] font-medium text-gray-900">{it.name}</div>
                        <div className="mt-1 flex items-center gap-2 text-[12px] text-gray-600">
                          <span className="font-semibold text-gray-900">₦{(it.price * it.quantity).toLocaleString('en-NG')}</span>
                          <span>({it.quantity} × ₦{it.price.toLocaleString('en-NG')})</span>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <button disabled={busyId===it.productId} onClick={()=>onDec(it.productId)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white ring-1 ring-black/10 text-gray-700">−</button>
                          <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{it.quantity}</span>
                          <button disabled={busyId===it.productId} onClick={()=>onInc(it.productId)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white ring-1 ring-black/10 text-gray-700">＋</button>
                          <button disabled={busyId===it.productId} onClick={()=>onRemove(it.productId)} className="ml-3 text-[12px] text-red-600 hover:underline">Remove</button>
                        </div>
                      </div>
                      <div className="text-right text-[14px] font-semibold text-gray-900">₦{(it.price * it.quantity).toLocaleString('en-NG')}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Summary */}
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Order Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery</span><span className="font-semibold">Calculated at next step</span></div>
              </div>
              <button onClick={goNext} disabled={items.length===0} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-[#F7CD3A] text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 disabled:opacity-60">Continue</button>
              <button onClick={()=>navigate('/parts')} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-gray-100 text:[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back to shopping</button>
            </aside>
          </div>
        )}

        {/* Login step for unauthenticated users */}
        {unauthenticated && step === 1 && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <div className="mb-3 flex gap-2">
                <button onClick={()=>setLoginTab('login')} className={`h-9 rounded-md px-4 text-sm font-semibold ring-1 ring-black/10 ${loginTab==='login'?'bg-brand text-white':'bg-gray-100 text-gray-900'}`}>Login</button>
                <button onClick={()=>setLoginTab('signup')} className={`h-9 rounded-md px-4 text-sm font-semibold ring-1 ring-black/10 ${loginTab==='signup'?'bg-brand text-white':'bg-gray-100 text-gray-900'}`}>Sign Up</button>
                <div className="ml-auto text-sm text-gray-600">Or continue as guest →</div>
              </div>

              {loginTab==='login' ? (
                <LoginInline
                  loading={loginLoading}
                  error={loginError}
                  value={loginForm}
                  onChange={setLoginForm}
                  onLoading={setLoginLoading}
                  onError={setLoginError}
                  onSuccess={()=>setStep(2)}
                />
              ) : (
                <SignupInline onSuccess={()=>setStep(2)} />
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={goBack} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back</button>
                <button onClick={()=>setStep(2)} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Continue as guest</button>
              </div>
            </div>

            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex items-center justify-between"><span className="text-gray-600">Items</span><span className="font-semibold">{items.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
              </div>
            </aside>
          </div>
        )}

        {/* Address step */}
        {((unauthenticated && step === 2) || (!unauthenticated && step === 1)) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Shipping Address</h3>
              {/* Delivery Method Selector */}
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${deliveryMethod==='gapa' ? 'border-brand ring-1 ring-brand/50 bg-[#FFF9E6]' : 'border-black/10 bg-gray-50'}`}>
                  <input type="radio" name="deliveryMethod" checked={deliveryMethod==='gapa'} onChange={()=>setDeliveryMethod('gapa')} />
                  <div>
                    <div className="font-semibold text-gray-900">Gapa Delivery</div>
                    <div className="text-[11px] text-gray-600">State/location based rate</div>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${deliveryMethod==='gig' ? 'border-brand ring-1 ring-brand/50 bg-[#FFF9E6]' : 'border-black/10 bg-gray-50'}`}>
                  <input type="radio" name="deliveryMethod" checked={deliveryMethod==='gig'} onChange={()=>setDeliveryMethod('gig')} />
                  <div className="flex items-center gap-2">
                    {/* <img src={deliveryGig} className="h-6 w-auto" alt="GIG Logistics"/> */}
                    <div>
                      <div className="font-semibold text-gray-900">GIG Logistics</div>
                      <div className="text-[11px] text-gray-600">Dynamic nationwide rate</div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Address fields (unchanged) */}
                <label className="text-[13px] text-gray-700">Full name
                  <input value={address.fullName} onChange={(e)=>setAddress(a=>({ ...a, fullName: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="e.g., John Doe" />
                </label>
                <label className="text-[13px] text-gray-700">Email
                  <input type="email" value={address.email} onChange={(e)=>setAddress(a=>({ ...a, email: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="you@example.com" />
                </label>
                <label className="text-[13px] text-gray-700">Phone
                  <input value={address.phone} onChange={(e)=>setAddress(a=>({ ...a, phone: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="08012345678" />
                </label>
                <span />
                <label className="text-[13px] text-gray-700 md:col-span-2">Address line 1
                  <input value={address.address1} onChange={(e)=>setAddress(a=>({ ...a, address1: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="Street, area" />
                </label>
                <label className="text-[13px] text-gray-700 md:col-span-2">Address line 2 (optional)
                  <input value={address.address2} onChange={(e)=>setAddress(a=>({ ...a, address2: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="Apartment, suite, etc." />
                </label>
                <label className="text-[13px] text-gray-700">State
                  <select value={String(address.regionId || '')} onChange={(e)=>{
                    const id = e.target.value
                    const st = states.find((s) => String(s.id ?? '') === id)
                    const label = (st?.title || st?.name || st?.state || '') as string
                    setAddress(a=>({ ...a, regionId: id, region: label }))
                    // reset GIG quote on state change
                    setGigQuoteAmount(0); setGigError(null); setGigLastRegion(undefined)
                  }} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-brand">
                    <option value="">{statesLoading ? 'Loading states…' : 'Select state'}</option>
                    {states.map((s) => {
                      const label = (s.title || s.name || s.state || '') as string
                      const id = String(s.id ?? label)
                      return <option key={id} value={id}>{label}</option>
                    })}
                  </select>
                </label>
                {/* Gapa delivery location selection (only show if method gapa) */}
                {deliveryMethod === 'gapa' && (
                  <label className="text-[13px] text-gray-700">Delivery location
                    <select disabled={!address.regionId || deliveryLoading || locations.length===0} value={String(address.deliveryLocationId || '')} onChange={(e)=>{
                      const val = e.target.value
                      const loc = locations.find(l => String(l.id) === val)
                      setAddress(a=>({ ...a, deliveryLocationId: val || undefined, deliveryLocationName: loc?.location }))
                      if (loc) setGapaDeliveryPrice(Math.max(0, Math.round(loc.price || 0)))
                      else if (locations.length===0 && defaultDeliveryRate) setGapaDeliveryPrice(defaultDeliveryRate)
                      else setGapaDeliveryPrice(0)
                    }} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-brand">
                      <option value="">{deliveryLoading ? 'Loading locations…' : (locations.length? 'Select location' : 'No specific locations; default rate applies')}</option>
                      {locations.map((l) => { const id = String(l.id); return <option key={id} value={id}>{l.location}</option> })}
                    </select>
                  </label>
                )}
                {/* Postcode */}
                <label className="text-[13px] text-gray-700">Postcode
                  <input value={address.postcode} onChange={(e)=>setAddress(a=>({ ...a, postcode: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" />
                </label>
              </div>

              {/* GIG status panel when selected */}
              {deliveryMethod==='gig' && (
                <div className="mt-4 rounded-md border border-dashed p-3">
                  <div className="flex items-center gap-3">
                    {/* <img src={deliveryGig} alt="GIG Logistics" className="h-8 w-auto" /> */}
                    <div className="text-sm font-semibold text-gray-900">GIG Logistics Quote</div>
                  </div>
                  <div className="mt-2 text-[12px] text-gray-600">Rates fetched live. Ensure your state is correct.</div>
                  <div className="mt-2 text-[13px] font-medium">
                    {gigLoading && <span className="text-gray-600">Fetching quote…</span>}
                    {!gigLoading && gigError && <span className="text-red-600">{gigError} <button onClick={()=>{ setGigLastRegion(undefined); setGigQuoteAmount(0); setGigError(null); }} className="underline">Retry</button></span>}
                    {!gigLoading && !gigError && gigQuoteAmount>0 && <span className="text-gray-900">₦{gigQuoteAmount.toLocaleString('en-NG')}</span>}
                    {!gigLoading && !gigError && !gigQuoteAmount && address.regionId && <span className="text-gray-500">No quote yet</span>}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={goBack} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back</button>
                <button onClick={goNext} disabled={!addressValid} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 disabled:opacity-60">Continue</button>
              </div>
            </div>
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex items-center justify-between"><span className="text-gray-600">Items</span><span className="font-semibold">{items.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice>0? `₦${effectiveDeliveryPrice.toLocaleString('en-NG')}` : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">₦{total.toLocaleString('en-NG')}</span></div>
              </div>
            </aside>
          </div>
        )}

        {/* Payment step (replace deliveryPrice refs) */}
        {((unauthenticated && step === 3) || (!unauthenticated && step === 2)) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Payment</h3>
              {/* Payment method: only Paystack or Flutterwave */}
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${payment==='paystack' ? 'border-brand ring-1 ring-brand/50' : 'border-black/10'}`}>
                  <input type="radio" name="pay" checked={payment==='paystack'} onChange={()=>setPayment('paystack')} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Pay with Paystack</div>
                    <div className="text-[12px] text-gray-600">Fast and secure via Paystack</div>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${payment==='flutter' ? 'border-brand ring-1 ring-brand/50' : 'border-black/10'}`}>
                  <input type="radio" name="pay" checked={payment==='flutter'} onChange={()=>setPayment('flutter')} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Pay with Flutterwave</div>
                    <div className="text-[12px] text-gray-600">Secure via Flutterwave</div>
                  </div>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between text-[14px]">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold">₦{total.toLocaleString('en-NG')}</span>
              </div>
              <div className="mt-2 space-y-1 text-[12px] text-gray-600">
                <div className="flex items-center justify-between"><span>Subtotal</span><span>₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span>VAT (7.5%)</span><span>₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span>Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span>{effectiveDeliveryPrice>0? `₦${effectiveDeliveryPrice.toLocaleString('en-NG')}` : '-'}</span></div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={goBack} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back</button>
                <button onClick={goNext} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Continue</button>
              </div>
            </div>
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex items-center justify-between"><span className="text-gray-600">Items</span><span className="font-semibold">{items.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice>0? `₦${effectiveDeliveryPrice.toLocaleString('en-NG')}` : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">₦{total.toLocaleString('en-NG')}</span></div>
              </div>
            </aside>
          </div>
        )}

        {/* Review step (replace deliveryPrice refs) */}
        {((unauthenticated && step === 4) || (!unauthenticated && step === 3)) && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Review & Confirm</h3>
              <div className="mt-3 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Items</div>
                  <ul className="mt-2 space-y-2">
                    {items.map((it)=> (
                      <li key={it.productId} className="flex items-center justify-between text-[14px]"><span className="truncate">{it.name} × {it.quantity}</span><span className="font-semibold">₦{(it.price*it.quantity).toLocaleString('en-NG')}</span></li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Shipping Address</div>
                  <div className="mt-1 text-[14px] text-gray-700">
                    {[address.fullName, address.address1, address.address2, address.deliveryLocationName, address.region, address.postcode, deliveryMethod === 'gig' ? 'GIG Logistics' : 'Gapa Delivery'].filter(Boolean).join(', ')}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900">Payment</div>
                  <div className="mt-1 text-[14px] text-gray-700">{payment==='paystack' ? 'Pay with Paystack' : 'Pay with Flutterwave'}</div>
                </div>
                <div className="flex items-center justify-between text-[14px]"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between text-[14px]"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between text-[14px]"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice>0? `₦${effectiveDeliveryPrice.toLocaleString('en-NG')}` : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-3 text-[14px]">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold">₦{total.toLocaleString('en-NG')}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={goBack} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back</button>
                {payment==='paystack' ? (
                  <button onClick={()=>void startPaystackCheckout()} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Pay with Paystack</button>
                ) : (
                  <button onClick={()=>void startFlutterCheckout()} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Pay with Flutterwave</button>
                )}
              </div>
            </div>
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex items-center justify-between"><span className="text-gray-600">Items</span><span className="font-semibold">{items.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">₦{subtotal.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">₦{vat.toLocaleString('en-NG')}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice>0? `₦${effectiveDeliveryPrice.toLocaleString('en-NG')}` : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">₦{total.toLocaleString('en-NG')}</span></div>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}

// Inline login form
import { login, register } from '../services/api'
import { useAuth as useAuthCtx } from '../services/auth'

function LoginInline(props: { loading: boolean; error: string | null; value: { emailOrPhone: string; password: string }; onChange: (v: { emailOrPhone: string; password: string }) => void; onLoading: (v: boolean) => void; onError: (v: string | null) => void; onSuccess: () => void }) {
  const { setSession } = useAuthCtx()
  const { loading, error, value, onChange, onLoading, onError, onSuccess } = props

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    onError(null)
    onLoading(true)
    try {
      const res = await login({ email: value.emailOrPhone, password: value.password })
      setSession(res.user, res.barear_token)
      toast.success('Signed in successfully')
      onSuccess()
    } catch (err: any) {
      const msg = err?.data?.message || err.message || 'Login failed'
      onError(msg)
      toast.error(msg)
    } finally {
      onLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="text-[13px] font-medium text-gray-900">Email or Phone</label>
        <input value={value.emailOrPhone} onChange={(e)=>onChange({ ...value, emailOrPhone: e.target.value })} placeholder="you@example.com or 0801…" className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
      </div>
      <div>
        <label className="text-[13px] font-medium text-gray-900">Password</label>
        <input type="password" value={value.password} onChange={(e)=>onChange({ ...value, password: e.target.value })} placeholder="Enter password" className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">{error}</div>}
      <button disabled={loading} className="w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">{loading? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}

function SignupInline({ onSuccess }: { onSuccess: () => void }) {
  const { setSession } = useAuthCtx()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError('Passwords do not match')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, password_confirmation: form.confirm })
      setSession(res.user, res.barear_token)
      toast.success('Account created')
      onSuccess()
    } catch (err: any) {
      const msg = err?.data?.message || err.message || 'Registration failed'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-[13px] font-medium text-gray-900">Full name
          <input value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
        </label>
        <label className="text-[13px] font-medium text-gray-900">Phone
          <input value={form.phone} onChange={(e)=>setForm({...form, phone: e.target.value})} className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
        </label>
      </div>
      <label className="text-[13px] font-medium text-gray-900">Email
        <input value={form.email} onChange={(e)=>setForm({...form, email: e.target.value})} className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
      </label>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-[13px] font-medium text-gray-900">Password
          <input type="password" value={form.password} onChange={(e)=>setForm({...form, password: e.target.value})} className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
        </label>
        <label className="text-[13px] font-medium text-gray-900">Confirm password
          <input type="password" value={form.confirm} onChange={(e)=>setForm({...form, confirm: e.target.value})} className="mt-1 h-10 w-full rounded-md bg-[#F6F5FA] px-3 text-sm outline-none ring-1 ring-black/10" />
        </label>
      </div>
      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">{error}</div>}
      <button disabled={loading} className="w-full rounded-md bg-brand py-2 text-[12px] font-semibold text-white disabled:opacity-60">{loading? 'Creating account…' : 'Create account'}</button>
    </form>
  )
}