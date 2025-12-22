import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrency } from '../context/CurrencyContext'
import { useAuth } from '../services/auth'
import { getCartForUser, removeCartItem, addToCartApi, getProductById, getAllStatesApi, getStatesByLocation, updateDeliveryAddress, /* getUserCartTotal, */ getPriceByState, paymentSuccessfull, getGigQuote } from '../services/api'
import { getGuestCart, setGuestCart, type GuestCart } from '../services/cart'
import { normalizeApiImage, pickImage, productImageFrom } from '../services/images'
import logoImg from '../assets/gapa-logo.png'
import toast from 'react-hot-toast'
import AddressAutocomplete from '../components/AddressAutocomplete'
// import deliveryGig from '../assets/deliveryGig.png'
// Add optional secrets fallback (dev convenience only)
import { PAYSTACK_PUBLIC_KEY as SECRET_PAYSTACK_KEY } from '../secrets'

// One-time GIG env diagnostic logging (added per debugging requirement)
if (typeof window !== 'undefined' && !(window as any).__GIG_ENV_LOGGED__) {
  (window as any).__GIG_ENV_LOGGED__ = true
  try {
    const envAny: any = (import.meta as any)?.env || {}
    const gigSnapshot = Object.fromEntries(Object.entries(envAny).filter(([k]) => k.includes('GIG')))
    console.group('[GIG ENV CHECK]')
    console.info('Raw GIG-related keys:', Object.keys(gigSnapshot))
    console.info('Resolved values (masking password):', {
      VITE_GIG_BASE_URL: envAny.VITE_GIG_BASE_URL,
      VITE_GIG_USERNAME: envAny.VITE_GIG_USERNAME,
      VITE_GIG_PASSWORD_PRESENT: !!envAny.VITE_GIG_PASSWORD,
    })
    console.info('Full import.meta.env size:', Object.keys(envAny).length)
    console.groupEnd()
  } catch (e) {
    console.warn('[GIG ENV CHECK] failed to log env vars', e)
  }
}
 
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

// FIX: Proper Address type syntax (previous version missed '=' and braces)
type Address = {
  fullName: string;
  email: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  regionId?: string | number;
  country: string;
  postcode: string;
  deliveryLocationId?: string | number;
  deliveryLocationName?: string;
}

type PaymentMethod = 'paystack' | 'flutter'

type DeliveryMethod = 'gapa' | 'gig'

function useCartData() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<UICartItem[]>([])
  const [rawItems, setRawItems] = useState<any[]>([]) // store full API cart rows for logistics enrichment

  const load = async () => {
    try {
      setLoading(true)
      if (user && user.id) {
        const res = await getCartForUser(user.id)
        const arr = Array.isArray(res) ? res : []
        setRawItems(arr)
        const mapped: UICartItem[] = arr.map((item: any) => {
          const prod = (item && (item.product || item.part || item.item)) || item
          const productId = String(item?.product_id ?? prod?.id ?? item?.id ?? '')
          const name = String(prod?.name || prod?.title || prod?.product_name || 'Part')
            .trim()
          const price = Number(prod?.price ?? prod?.selling_price ?? prod?.amount ?? item?.price ?? 0)
          const quantity = Number(item?.quantity ?? item?.qty ?? 1) || 1
          const image = productImageFrom(prod) || normalizeApiImage(pickImage(prod) || '') || logoImg
          return { productId, name, price, quantity, image }
        }).filter(Boolean)
        setItems(mapped)
      } else {
        const cart: GuestCart = getGuestCart()
        if (!cart.items.length) { setItems([]); setRawItems([]); return }
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
        setRawItems(details.map(d => ({ ...(d.prod || {}), quantity: d.ci.quantity })))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user?.id])

  return { user, loading, items, rawItems, reload: load, setItems }
}

export default function Checkout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { formatPrice } = useCurrency()
  const { loading, items, rawItems, reload } = useCartData()
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

  // GIG quote state
  const [gigQuoteAmount, setGigQuoteAmount] = useState<number>(0)
  const [gigLoading, setGigLoading] = useState<boolean>(false)
  const [gigError, setGigError] = useState<string | null>(null)
  // Remove GIG stations state (endpoints 404); use static fallback IDs
  // const [gigStations, setGigStations] = useState<{ id:number; name:string; city:string; state:string; raw:any }[]>([])
  // const [gigStationId, setGigStationId] = useState<number | null>(null)
  const DEFAULT_GIG_RECEIVER_STATION_ID = 2 // fallback based on working payload example
  // Removed unused DEFAULT_GIG_SENDER_STATION_ID constant (was causing TS 6133 warning)
  // const [gigLastRegion, setGigLastRegion] = useState<string | number | undefined>(undefined)
  // NEW: receiver geolocation (attempt to capture once)
  const [receiverGeo, setReceiverGeo] = useState<{ lat?: number; lng?: number; error?: string }>({})
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setReceiverGeo(g => (g.lat || g.lng ? g : { lat: pos.coords.latitude, lng: pos.coords.longitude }))
      },
      (err) => { setReceiverGeo(g => (g.error ? g : { ...g, error: err.message })) },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    )
  }, [])

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

  // NEW: Allowed states for Gapa delivery only
  const GAPA_ALLOWED_STATE_TITLES = useMemo(()=>['LAGOS STATE','ABUJA FEDERAL CAPITAL TERRITORY'], [])
  const normalizeStateLabel = (s?: string) => (s||'').trim().toUpperCase()
  const isAllowedForGapa = (st: any) => {
    const label = normalizeStateLabel(st?.title || st?.name || st?.state || '')
    if (!label) return false
    if (GAPA_ALLOWED_STATE_TITLES.includes(label)) return true
    // Accept common abbreviations for Abuja (FCT) just in case
    if (label === 'FCT' && GAPA_ALLOWED_STATE_TITLES.includes('ABUJA FEDERAL CAPITAL TERRITORY')) return true
    if (label === 'ABUJA' && GAPA_ALLOWED_STATE_TITLES.includes('ABUJA FEDERAL CAPITAL TERRITORY')) return true
    return false
  }

  // When switching to Gapa, if current state not allowed, clear it.
  useEffect(() => {
    if (deliveryMethod !== 'gapa') return
    if (!address.regionId) return
    const current = states.find(s => String(s.id) === String(address.regionId))
    if (!current || !isAllowedForGapa(current)) {
      setAddress(a => ({ ...a, regionId: undefined, region: '', deliveryLocationId: undefined, deliveryLocationName: undefined }))
      setGapaDeliveryPrice(0)
    }
  }, [deliveryMethod, address.regionId, states])

  // Persist delivery method
  useEffect(()=>{ localStorage.setItem('checkoutDeliveryMethod', deliveryMethod) }, [deliveryMethod])

  // Existing effect: load states, default rate, prefill address
  useEffect(() => {
    const u = (user as any) || null
    setAddress((prev: Address) => { // annotated prev
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
  }, [user?.id])

  // Hydrate regionId from stored region name
  useEffect(() => {
    if (!address.regionId && address.region && states.length) {
      const match = states.find((s) => (s.title || s.name || s.state || '') === address.region)
      if (match?.id != null) setAddress((a: Address) => ({ ...a, regionId: match.id }))
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
        if (!mapped.length) {
          // no fallback price – explicit error state
          setGapaDeliveryPrice(0)
        } else if (mapped.length === 1) {
          const only = mapped[0]
          setAddress(a => ({ ...a, deliveryLocationId: only.id, deliveryLocationName: only.location }))
          setGapaDeliveryPrice(Math.max(0, Math.round(only.price || 0)))
        } else {
          setGapaDeliveryPrice(0) // wait for user selection
        }
      } catch {
        // on error no fallback – keep at 0
        setLocations([])
        setGapaDeliveryPrice(0)
      } finally { setDeliveryLoading(false) }
    }
    fetchLocations()
  }, [address.regionId])

  // Reset / prepare GIG quote when user switches delivery method
  useEffect(() => {
    if (deliveryMethod === 'gig') {
      setGigQuoteAmount(0)
      setGigError(null)
      if (address.regionId) void requestGigQuote()
    }
  }, [deliveryMethod])

  const buildGigQuoteParams = () => {
    // Prefer enriched rawItems when available
    const source = rawItems.length ? rawItems : items
    const cartItemsForQuote = source.map((it: any) => ({
      name: it.name,
      description: (it.description || it.details || it.name || '').slice(0,200),
      weight_in_kg: Number(it.weight_in_kg || it.weight || 1) || 1,
      quantity: Number(it.quantity || 1) || 1,
      article_number: it.article_number || it.article || it.code || '',
      code: it.code || it.product_code || '',
      value: Number((it.price || it.unit_price || 0)) * (Number(it.quantity || 1) || 1)
    }))
    const totalQty = cartItemsForQuote.reduce((s,i)=> s + (Number(i.quantity)||1), 0)
    const weight = cartItemsForQuote.reduce((s,i)=> s + (Number(i.weight_in_kg)||1)*(Number(i.quantity)||1), 0) || totalQty
    const stateObj = states.find(s=>String(s.id)===String(address.regionId))
    const destination_state = String(stateObj?.title || stateObj?.name || stateObj?.state || address.region || address.regionId || '')
    const destination_city = String(address.city || address.deliveryLocationName || '').trim() || destination_state
    const receiver_address = [address.address1, address.address2, address.deliveryLocationName, destination_city, destination_state, address.postcode].filter(Boolean).join(', ')
    const receiver_name = address.fullName || 'Customer'
    const receiver_phone = address.phone || ''
    const items_count = Math.max(1, totalQty)
    const declared_value = cartItemsForQuote.reduce((sum,i)=> sum + (i.value||0), 0)
    // Use static receiver station id (API station lookup removed)
    const receiver_station_id = DEFAULT_GIG_RECEIVER_STATION_ID
    const destination_service_centre_id = receiver_station_id
    const user_id = (user as any)?.id ? String((user as any).id) : undefined
    return { destination_state, destination_city, receiver_address, receiver_name, receiver_phone, weight_kg: weight, items_count, items: cartItemsForQuote, receiver_latitude: receiverGeo.lat, receiver_longitude: receiverGeo.lng, declared_value, receiver_station_id, destination_service_centre_id, user_id }
  }

  const requestGigQuote = async () => {
    if (deliveryMethod !== 'gig') return
    if (!address.regionId) { setGigQuoteAmount(0); setGigError('Select a state first'); return }
    setGigLoading(true); setGigError(null); setGigQuoteAmount(0)
    try {
      const params = buildGigQuoteParams()
      console.log('GIG quote params', params)
      const quote = await getGigQuote(params)
      if (!quote || typeof quote.amount !== 'number' || quote.amount <= 0) throw new Error('Can\'t ship to this location')
      setGigQuoteAmount(Math.round(quote.amount))
    } catch (e: any) {
      console.error('GIG quote error', e)
      const msg = e?.message || 'Can\'t ship to this location'
      toast.error(msg) // NEW: show error via toast instead of inline text
      setGigError(msg)
      setGigQuoteAmount(0)
    } finally { setGigLoading(false) }
  }

  // Auto refetch quote when relevant address/cart inputs change while on GIG
  useEffect(() => {
    if (deliveryMethod !== 'gig') return
    if (!address.regionId) { setGigQuoteAmount(0); setGigError(null); return }
    const t = setTimeout(() => { void requestGigQuote() }, 400)
    return () => clearTimeout(t)
  }, [deliveryMethod, address.regionId, address.city, address.deliveryLocationName, address.address1, address.address2, address.postcode, items, receiverGeo.lat, receiverGeo.lng, states /* removed gigStationId */])

  useEffect(() => { localStorage.setItem('checkoutAddress', JSON.stringify(address)) }, [address])
  useEffect(() => { localStorage.setItem('checkoutPayment', payment) }, [payment])

  // Validation adjustments: require method-specific fields/quotes
  const addressValid = useMemo(() => {
    const req = ['fullName','email','phone','address1','region'] as (keyof Address)[]
    const baseValid = req.every((k) => String((address as any)[k] || '').trim().length > 1)
    if (!baseValid) return false
    if (deliveryMethod === 'gapa') {
      const locValid = locations.length === 0 || Boolean(address.deliveryLocationId)
      return locValid && gapaDeliveryPrice > 0 // must have explicit price
    } else {
      return gigQuoteAmount > 0 && !gigLoading && !gigError  
    }
  }, [address, locations.length, address.deliveryLocationId, gapaDeliveryPrice, deliveryMethod, gigQuoteAmount, gigLoading, gigError])

  const onInc = async (productId: string) => {
    const current = items.find(i => i.productId === productId)
    if (!current) return
    const nextQty = Math.min(99, current.quantity + 1)
    if (nextQty === current.quantity) return // Already at max
    
    setBusyId(productId)
    try {
      if (user && (user as any).id) {
        // NEW LOGIC: Remove product from cart, then add it back with new quantity
        try {
          // Step 1: Remove the product from cart
          await removeCartItem((user as any).id, productId)
          
          // Step 2: Add it back with the new quantity
          await addToCartApi({ 
            user_id: (user as any).id, 
            product_id: productId, 
            quantity: nextQty 
          })
        } catch (e) {
          console.error('Failed to increase quantity:', e)
          toast.error('Unable to increase quantity')
          return
        }
      } else {
        // Guest cart
        const cart = getGuestCart()
        const idx = cart.items.findIndex(it => it.product_id === productId)
        if (idx >= 0) { 
          cart.items[idx].quantity = nextQty
          setGuestCart(cart) 
        }
      }
      await reload()
    } finally { 
      setBusyId(null) 
    }
  }

  const onDec = async (productId: string) => {
    const current = items.find(i => i.productId === productId)
    if (!current) return
    const nextQty = Math.max(1, current.quantity - 1)
    if (nextQty === current.quantity) return // Already at min
    
    setBusyId(productId)
    try {
      if (user && (user as any).id) {
        // NEW LOGIC: Remove item completely, then re-add with remaining quantity
        try {
          // Step 1: Remove the item
          await removeCartItem((user as any).id, productId)
          
          // Step 2: Re-add with the remaining quantity (if > 0)
          if (nextQty > 0) {
            await addToCartApi({ 
              user_id: (user as any).id, 
              product_id: productId, 
              quantity: nextQty 
            })
          }
        } catch (e) {
          console.error('Failed to decrease quantity:', e)
          toast.error('Unable to decrease quantity')
          return
        }
      } else {
        // Guest cart
        const cart = getGuestCart()
        const idx = cart.items.findIndex(it => it.product_id === productId)
        if (idx >= 0) { 
          cart.items[idx].quantity = nextQty
          setGuestCart(cart) 
        }
      }
      await reload()
    } finally { 
      setBusyId(null) 
    }
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
    // if (deliveryMethod === 'gapa' && !gapaDeliveryPrice && defaultDeliveryRate) setGapaDeliveryPrice(defaultDeliveryRate)
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
              user_id: (user as any)?.id ?? '',
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
              user_id: (user as any)?.id ?? '',
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
                <div className="py-12 text-center text-sm text-gray-600">Your cart is empty</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {items.map(it => (
                    <li key={it.productId} className="flex gap-3 py-3">
                      <img src={it.image} alt={it.name} className="h-16 w-16 rounded-md object-cover ring-1 ring-black/10" />
                      <div className="flex flex-1 flex-col">
                        <div className="flex justify-between gap-3">
                          <div className="pr-2">
                            <div className="line-clamp-2 text-[14px] font-medium text-gray-900">{it.name}</div>
                            <div className="mt-1 text-[12px] text-gray-600">{formatPrice(it.price)} <span className="text-gray-500">({it.quantity} × {formatPrice(it.price)})</span></div>
                          </div>
                          <div className="text-right text-[14px] font-semibold text-gray-900">{formatPrice(it.price * it.quantity)}</div>
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2">
                          <button disabled={busyId===it.productId} onClick={()=>onDec(it.productId)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white ring-1 ring-black/10 text-gray-700">−</button>
                          <span className="inline-flex h-7 min-w-8 items-center justify-center rounded-md border border-black/10 px-2 text-[12px]">{it.quantity}</span>
                          <button disabled={busyId===it.productId} onClick={()=>onInc(it.productId)} className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white ring-1 ring-black/10 text-gray-700">＋</button>
                          <button disabled={busyId===it.productId} onClick={()=>onRemove(it.productId)} className="ml-3 text-[12px] text-red-600 hover:underline">Remove</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Summary */}
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Order Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                {/* 5. Update Totals */}
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">{formatPrice(vat)}</span></div>
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
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">{formatPrice(vat)}</span></div>
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
                  <input type="radio" name="deliveryMethod" checked={deliveryMethod==='gig'} onChange={()=>{ setDeliveryMethod('gig'); setGigQuoteAmount(0); setGigError(null); if(address.regionId) void requestGigQuote() }} />
                  <div className="flex items-center gap-2">
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
                  <input value={address.fullName} onChange={(e)=>setAddress((a: Address)=>({ ...a, fullName: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="e.g., John Doe" />
                </label>
                <label className="text-[13px] text-gray-700">Email
                  <input type="email" value={address.email} onChange={(e)=>setAddress((a: Address)=>({ ...a, email: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="you@example.com" />
                </label>
                <label className="text-[13px] text-gray-700">Phone
                  <input value={address.phone} onChange={(e)=>setAddress((a: Address)=>({ ...a, phone: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="08012345678" />
                </label>
                <span />
                <label className="text-[13px] text-gray-700 md:col-span-2">Address line 1
                  <AddressAutocomplete
                    value={address.address1}
                    onChange={(v)=>setAddress((a: Address)=>({ ...a, address1: v }))}
                    onAddressSelect={(s)=>{
                      setAddress((a: Address)=>({ ...a, address1: s.address1 || a.address1, city: s.city || a.city, region: s.region || a.region, postcode: s.postcode || a.postcode }))
                    }}
                    placeholder="Street, area"
                    country={address.country?.toLowerCase?.() || 'ng'}
                  />
                </label>
                <label className="text-[13px] text-gray-700 md:col-span-2">Address line 2 (optional)
                  <input value={address.address2} onChange={(e)=>setAddress((a: Address)=>({ ...a, address2: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" placeholder="Apartment, suite, etc." />
                </label>
                <label className={`text-[13px] font-medium transition-all ${!address.regionId && deliveryMethod ? 'text-brand' : 'text-gray-700'}`}>
                  <span className="flex items-center gap-2">
                    State
                    {!address.regionId && deliveryMethod && (
                      <span className="inline-flex h-5 items-center rounded-full bg-brand/10 px-2 text-[10px] font-semibold text-brand animate-pulse">
                        Select here →
                      </span>
                    )}
                  </span>
                  <select value={String(address.regionId || '')} onChange={(e)=>{
                    const id = e.target.value
                    const st = states.find((s) => String(s.id ?? '') === id)
                    const label = (st?.title || st?.name || st?.state || '') as string
                    setAddress((a: Address)=>({ ...a, regionId: id, region: label, deliveryLocationId: undefined, deliveryLocationName: undefined }))
                    // reset quotes / prices on state change
                    setGigQuoteAmount(0); setGigError(null); setGapaDeliveryPrice(0)
                  }} className={`mt-1 h-10 w-full rounded-md border bg-white px-3 text-[14px] outline-none transition-all ${
                    !address.regionId && deliveryMethod 
                      ? 'border-brand ring-2 ring-brand/30 shadow-md animate-pulse' 
                      : 'border-black/10 focus:ring-2 focus:ring-brand'
                  }`}>
                    <option value="">{statesLoading ? 'Loading states…' : 'Select state'}</option>
                    {(deliveryMethod==='gapa' ? states.filter(isAllowedForGapa) : states).map((s) => {
                      const label = (s.title || s.name || s.state || '') as string
                      const id = String(s.id ?? label)
                      return <option key={id} value={id}>{label}</option>
                    })}
                  </select>
                </label>
                {/* Gapa delivery location selector (shown when multiple locations) */}
                {deliveryMethod==='gapa' && address.regionId && locations.length>0 && (
                  <label className="text-[13px] text-gray-700">Delivery location
                    <select value={String(address.deliveryLocationId || '')} onChange={(e)=>{
                      const val = e.target.value
                      const loc = locations.find(l => String(l.id) === val)
                      setAddress((a: Address)=>({ ...a, deliveryLocationId: val || undefined, deliveryLocationName: loc?.location }))
                      if (loc) setGapaDeliveryPrice(Math.max(0, Math.round(loc.price || 0)))
                      else setGapaDeliveryPrice(0)
                    }} className="mt-1 h-10 w-full rounded-md border border-black/10 bg-white px-3 text-[14px] outline-none focus:ring-2 focus:ring-brand">
                      <option value="">Select location</option>
                      {locations.map(l => <option key={l.id} value={l.id}>{l.location}</option>)} {/* Removed price display */}
                    </select>
                  </label>
                )}
                {/* Postcode */}
                <label className="text-[13px] text-gray-700">Zipcode
                  <input value={address.postcode} onChange={(e)=>setAddress((a: Address)=>({ ...a, postcode: e.target.value }))} className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand" />
                </label>
              </div>

              {/* GIG status panel when selected */}
              {deliveryMethod==='gig' && (
                <div className="mt-4 rounded-md border border-dashed p-3">
                  <div className="flex items-center gap-3">
                    {/* <img src={deliveryGig} alt="GIG Logistics" className="h-8 w-auto" /> */}
                    <div className="text-sm font-semibold text-gray-900">GIG Logistics Quote</div>
                  </div>
                  <div className="mt-2 text-[12px] text-gray-600">Live rate from GIG.</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[13px] font-medium">
                    {gigLoading && <span className="text-gray-600">Fetching quote…</span>}
                    {/* Inline error removed; handled via toast */}
                    {!gigLoading && !gigError && gigQuoteAmount>0 && <span className="text-gray-900">{formatPrice(gigQuoteAmount)}</span>}
                    {!gigLoading && !gigError && !gigQuoteAmount && address.regionId && <span className="text-gray-500">No quote yet</span>}
                    <button type="button" disabled={gigLoading || !address.regionId} onClick={()=>void requestGigQuote()} className="inline-flex h-8 items-center justify-center rounded-md border border-brand px-3 text-[12px] font-semibold text-brand disabled:opacity-50">{gigLoading? 'Loading…' : gigQuoteAmount>0 ? 'Refresh quote' : 'Get quote'}</button>
                    {!gigLoading && gigError && <button type="button" onClick={()=>void requestGigQuote()} className="text-[12px] text-brand underline">Retry</button>}
                  </div>
                </div>
              )}

              {/* Gapa error message when no price */}
              {deliveryMethod==='gapa' && address.regionId && !deliveryLoading && locations.length===0 && (
                <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">Can't ship to this location</div>
              )}
              {deliveryMethod==='gapa' && address.regionId && locations.length>0 && !gapaDeliveryPrice && (
                <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200">Select a delivery location to get price</div>
              )}

              <div className="mt-4 flex gap-2">
                <button onClick={goBack} className="inline-flex h-10 items-center justify-center rounded-md bg-gray-100 px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10">Back</button>
                <button onClick={goNext} disabled={!addressValid} className="inline-flex h-10 items-center justify-center rounded-md bg-[#F7CD3A] px-4 text-[14px] font-semibold text-gray-900 ring-1 ring-black/10 disabled:opacity-60">Continue</button>
              </div>
            </div>
            <aside className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <h3 className="text-[16px] font-semibold text-gray-900">Summary</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                {/* 7. Update Summary Sidebar (Address Step) */}
                <div className="flex items-center justify-between"><span className="text-gray-600">Items</span><span className="font-semibold">{items.length}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">{formatPrice(vat)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">{formatPrice(total)}</span></div>
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
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${payment==='paystack' ? 'border-brand ring-1 ring-brand/50 bg-[#FFF9E6]' : 'border-black/10 bg-gray-50'}`}>
                  <input type="radio" name="pay" checked={payment==='paystack'} onChange={()=>setPayment('paystack')} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Pay with Paystack</div>
                    <div className="text-[12px] text-gray-600">Secure via Paystack</div>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 ${payment==='flutter' ? 'border-brand ring-1 ring-brand/50 bg-[#FFF9E6]' : 'border-black/10 bg-gray-50'}`}>
                  <input type="radio" name="pay" checked={payment==='flutter'} onChange={()=>setPayment('flutter')} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Pay with Flutterwave</div>
                    <div className="text-[12px] text-gray-600">Secure via Flutterwave</div>
                  </div>
                </label>
              </div>
              <div className="mt-4 flex items-center justify-between text-[14px]">
                <span className="text-gray-600">Total</span>
                <span className="font-semibold">{formatPrice(total)}</span>
              </div>
              <div className="mt-2 space-y-1 text-[12px] text-gray-600">
                {/* 9. Update Payment Small Details */}
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span>VAT (7.5%)</span><span>{formatPrice(vat)}</span></div>
                <div className="flex items-center justify-between"><span>Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span>{effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : '-'}</span></div>
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
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">{formatPrice(vat)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">{formatPrice(total)}</span></div>
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
                      <li key={it.productId} className="flex items-center justify-between text-[14px]"><span className="truncate">{it.name} × {it.quantity}</span><span className="font-semibold">{formatPrice(it.price * it.quantity)}</span></li>
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
                <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span>VAT (7.5%)</span><span>{formatPrice(vat)}</span></div>
                <div className="flex items-center justify-between"><span>Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span>{effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : '-'}</span></div><div className="flex items-center justify-between border-t border-black/10 pt-3 text-[14px]">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold">{formatPrice(total)}</span>
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
                <div className="flex items-center justify-between"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">VAT (7.5%)</span><span className="font-semibold">{formatPrice(vat)}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Delivery ({deliveryMethod==='gig' ? 'GIG' : 'Gapa'})</span><span className="font-semibold">{effectiveDeliveryPrice > 0 ? formatPrice(effectiveDeliveryPrice) : '-'}</span></div>
                <div className="flex items-center justify-between border-t border-black/10 pt-2"><span className="text-gray-600">Total</span><span className="font-semibold">{formatPrice(total)}</span></div>
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
  // reference loading & error to avoid unused warnings if tree-shaken paths remove JSX
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  ;(loading || error); // harmless reference

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
