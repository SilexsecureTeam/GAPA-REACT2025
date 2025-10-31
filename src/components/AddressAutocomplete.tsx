import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'

type SelectedAddress = {
  address1: string
  city?: string
  region?: string
  postcode?: string
  raw?: any
}

type Props = {
  value: string
  onChange: (v: string) => void
  onAddressSelect?: (s: SelectedAddress) => void
  placeholder?: string
  country?: string
}

function loadGooglePlaces(apiKey: string) {
  // Use the official @googlemaps/js-api-loader to load the Maps JS + Places library.
  return new Promise<void>(async (resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'))
    try {
      // If already loaded
      if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) return resolve()
      const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] })
      await loader.load()
      return resolve()
    } catch (e: any) {
      return reject(e)
    }
  })
}

const RECENT_KEY = 'gapa:recent_addresses'

export default function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder, country = 'ng' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showList, setShowList] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const envGoogleKey = (import.meta as any)?.env?.VITE_GOOGLE_PLACES_KEY || "AIzaSyCYwwIv59RK-WS1dR_TjM0LVfNXLAYlar0"
  const envLocationKey = (import.meta as any)?.env?.VITE_LOCATIONIQ_KEY || "pk.b75f7617325885c2e84df79b6f633e87"
  // If a user accidentally placed a LocationIQ public key into the GOOGLE env var (starts with pk.)
  // prefer treating it as a LocationIQ key and avoid loading Google Places with an invalid key.
  const locationIqKey = envLocationKey || (envGoogleKey && String(envGoogleKey).startsWith('pk.') ? String(envGoogleKey) : undefined)
  const googleApiKey = envGoogleKey && String(envGoogleKey).startsWith('pk.') ? undefined : envGoogleKey
  const dbg = (...args: any[]) => { try { console.debug('[AddressAutocomplete]', ...args) } catch { /* noop */ } }
  const [provider, setProvider] = useState<'google' | 'nominatim' | 'locationiq' | 'local' | 'none'>('none')
  try { console.debug('[AddressAutocomplete] provider keys present?', { google: Boolean(googleApiKey), locationiq: Boolean(locationIqKey) }) } catch { }

  useEffect(() => {
    // load recent suggestions from localStorage
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setSuggestions(JSON.parse(raw))
    } catch { }
  }, [])

  const nominatimSearch = async (q: string, optionalKey?: string) => {
    try { console.debug('[AddressAutocomplete] nominatimSearch query', q) } catch { }
    try {
      // normalize country for nominatim (ISO alpha-2)
      let nomCountry = 'ng'
      try {
        const raw = String(country || 'ng').trim().toLowerCase()
        if (raw === 'nigeria' || raw === 'ng' || raw === 'ngn') nomCountry = 'ng'
        else if (raw.length === 2) nomCountry = raw
      } catch { }
      const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '1', countrycodes: nomCountry })
      // Include a generic 'key' query param if provided (some hosted nominatim-compatible services accept API keys)
      if (optionalKey) params.set('key', optionalKey)
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'gapa-app/1.0' } })
      if (!res.ok) throw new Error(`Nominatim ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data.map((d: any) => ({ description: d.display_name, place_id: `nom_${d.place_id}`, raw: d })) : []
    } catch (e: any) {
      dbg('nominatim error', e?.message || String(e))
      return []
    }
  }
  useEffect(() => {
    if (!googleApiKey) return
    let mounted = true
    loadGooglePlaces(googleApiKey).then(() => {
      if (!mounted) return
      // Prepare AutocompleteService for predictions
      try {
        (window as any).__gapaPlacesService = (window as any).__gapaPlacesService || new (window as any).google.maps.places.AutocompleteService()
        // Mask API key for logs
        try {
          const masked = googleApiKey && String(googleApiKey).length > 8 ? `${String(googleApiKey).slice(0, 4)}...${String(googleApiKey).slice(-4)}` : String(googleApiKey)
          console.info('[AddressAutocomplete] Google Places loaded via Loader — apiKey:', masked)
        } catch { console.info('[AddressAutocomplete] Google Places loaded via Loader') }
        dbg('Google Places loaded via Loader')
      } catch (e: any) {
        dbg('google init error', e?.message || e)
        console.error('[AddressAutocomplete] google init error', e)
        dbg('google init error', e?.message || String(e))
      }
    }).catch((e: any) => {
      dbg('loadGooglePlaces failed', e?.message || e)
      console.error('[AddressAutocomplete] loadGooglePlaces failed', e)
      const msg = String(e?.message || e || '')
      // Detect known legacy API error text and give clearer guidance
      if (msg.toLowerCase().includes('legacy') || msg.includes('LegacyApiNotActivated')) {
        console.warn('[AddressAutocomplete] Detected legacy API error. The Google Cloud project for this key likely needs the Places API (new) and Maps JavaScript API enabled and billing turned on.')
      }
      dbg('loadGooglePlaces failed', e?.message || String(e))
    })
    return () => { mounted = false }
  }, [googleApiKey])

  // Query autocomplete for predictions (debounced)
  // Preference order: Google (if googleApiKey+service), LocationIQ (if locationIqKey), Nominatim fallback
  const locationIqSearch = async (q: string, key: string | undefined) => {
    try { dbg('locationIqSearch query', q) } catch { }
    if (!key) return []
    try {
      const params = new URLSearchParams({ key, q, format: 'json', limit: '6' })
      // Add countrycodes param if available
      try {
        const raw = String(country || 'ng').trim().toLowerCase()
        if (raw === 'nigeria' || raw === 'ng' || raw === 'ngn') params.set('countrycodes', 'ng')
        else if (raw.length === 2) params.set('countrycodes', raw)
      } catch { }
      const url = `https://us1.locationiq.com/v1/autocomplete.php?${params.toString()}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      if (!res.ok) throw new Error(`LocationIQ ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) return []
      // Map to similar shape as nominatim results
      return data.map((d: any, i: number) => ({ description: d.display_name || d.label || d.name, place_id: `li_${d.place_id || d.osm_id || i}`, raw: d }))
    } catch (e: any) {
      dbg('locationiq error', e?.message || String(e))
      return []
    }
  }

  useEffect(() => {
    if (!value || value.trim().length < 3) { setPredictions([]); setProvider('none'); dbg('query too short'); return }
    let active = true
    // Omit strict types to increase recall (some local addresses are returned as geocode)
    const req: any = { input: value }
    // Normalize country to an ISO 3166-1 alpha-2 code expected by Google (e.g., 'NG')
    let countryCode = 'NG'
    try {
      const raw = String(country || 'ng').trim().toLowerCase()
      if (raw === 'nigeria' || raw === 'ng' || raw === 'ngn') countryCode = 'NG'
      else if (raw.length === 2) countryCode = raw.toUpperCase()
    } catch { countryCode = 'NG' }
    if (countryCode) req.componentRestrictions = { country: countryCode }
    const svc = (window as any).__gapaPlacesService
    if (googleApiKey && svc) {
      dbg('query google predictions', value, { countryCode })
      console.debug('[AddressAutocomplete] svc present for predictions?', !!svc)
      console.debug('[AddressAutocomplete] prediction request', { input: value, countryCode })
      try {
        svc.getPlacePredictions(req, async (preds: any[]) => {
          if (!active) return
          dbg('google returned', preds && preds.length)
          console.debug('[AddressAutocomplete] google returned predictions count', preds && preds.length)
          if (!preds || preds.length === 0) {
            // Fallback: try LocationIQ then Nominatim
            console.info('[AddressAutocomplete] no google preds, falling back to LocationIQ/Nominatim')
            if (locationIqKey) {
              setProvider('locationiq')
              const li = await locationIqSearch(value, locationIqKey)
              if (!active) return
              dbg('locationiq returned', li && li.length)
              if (li && li.length) { setPredictions(li); return }
            }
            setProvider('nominatim')
            const nom = await nominatimSearch(value, locationIqKey)
            if (!active) return
            dbg('nominatim returned', nom && nom.length)
            if (nom && nom.length) { setPredictions(nom); return }
            setPredictions([])
            return
          }
          setProvider('google')
          setPredictions(preds)
        })
      } catch (e: any) {
        dbg('google getPlacePredictions error', e?.message || String(e))
        dbg('google error', e)
        console.error('[AddressAutocomplete] google getPlacePredictions threw', e)
        // Google failed, try LocationIQ then Nominatim
        if (locationIqKey) {
          setProvider('locationiq')
          locationIqSearch(value, locationIqKey).then((li) => {
            if (!active) return; dbg('locationiq returned after google error', li && li.length); if (li && li.length) { setPredictions(li); return };
            nominatimSearch(value, locationIqKey).then((nom) => { if (!active) return; dbg('nominatim returned after google error', nom && nom.length); setPredictions(nom) })
          })
        } else {
          setProvider('nominatim')
          nominatimSearch(value, locationIqKey).then((nom) => { if (!active) return; dbg('nominatim returned after google error', nom && nom.length); setPredictions(nom) })
        }
      }
    } else {
      // No Google API key or service — prefer LocationIQ if configured, otherwise Nominatim
      if (locationIqKey) {
        dbg('using LocationIQ for autocomplete (no Google API key) for', value)
        setProvider('locationiq')
        locationIqSearch(value, locationIqKey).then((li) => { if (!active) return; dbg('locationiq returned', li && li.length); setPredictions(li) })
      } else {
        dbg('using nominatim fallback (no Google API key or LocationIQ key) for', value)
        setProvider('nominatim')
        nominatimSearch(value, locationIqKey).then((nom) => { if (!active) return; dbg('nominatim returned', nom && nom.length); setPredictions(nom) })
      }
    }
    return () => { active = false }
  }, [value, googleApiKey, locationIqKey, country])

  const persist = (s: string) => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const arr = raw ? JSON.parse(raw) as string[] : []
      const next = [s, ...arr.filter(x => x !== s)].slice(0, 6)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      setSuggestions(next)
    } catch { }
  }

  const parseAddressComponents = (components: any[]): SelectedAddress => {
    const out: SelectedAddress = { address1: '', raw: components }
    const map = (types: string[]) => components.find((c: any) => types.some(t => c.types.includes(t)))
    const street = map(['route']) || map(['street_address']) || map(['street_number'])
    const sublocality = map(['sublocality', 'sublocality_level_1'])
    const locality = map(['locality', 'postal_town'])
    const admin = map(['administrative_area_level_1', 'administrative_area_level_2'])
    const postal = map(['postal_code'])
    const streetNumber = map(['street_number'])
    const parts: string[] = []
    if (streetNumber && streetNumber.long_name) parts.push(streetNumber.long_name)
    if (street && street.long_name) parts.push(street.long_name)
    if (sublocality && sublocality.long_name) parts.push(sublocality.long_name)
    out.address1 = parts.join(' ').trim() || components.map(c => c.long_name).slice(0, 4).join(', ')
    out.city = locality?.long_name || undefined
    out.region = admin?.long_name || undefined
    out.postcode = postal?.long_name || undefined
    return out
  }

  const handlePredictionSelect = async (prediction: any) => {
    if (!prediction) return
    const id = prediction.place_id
    // Handle Nominatim fallback entries (we tag them with place_id starting with 'nom_')
    if (String(id || '').startsWith('nom_')) {
      try {
        const raw = prediction.raw
        const formatted = prediction.description || raw?.display_name || ''
        onChange(formatted)
        persist(formatted)
        setShowList(false)
        onAddressSelect?.({ address1: formatted, raw })
        return
      } catch (e: any) {
        dbg('nominatim fallback error', String(e))
        return
      }
    }

    // Handle LocationIQ fallback entries (we tag them with place_id starting with 'li_')
    if (String(id || '').startsWith('li_')) {
      try {
        const raw = prediction.raw
        const formatted = prediction.description || raw?.display_name || raw?.label || ''
        onChange(formatted)
        persist(formatted)
        setShowList(false)
        onAddressSelect?.({ address1: formatted, raw })
        return
      } catch (e: any) {
        dbg('locationiq fallback error', String(e))
        return
      }
    }

    try {
      const svc = new (window as any).google.maps.places.PlacesService(document.createElement('div'))
      svc.getDetails({ placeId: id, fields: ['address_components', 'formatted_address', 'geometry', 'name'] }, (place: any, status: any) => {
        console.debug('[AddressAutocomplete] getDetails status', status)
        if (status !== (window as any).google.maps.places.PlacesServiceStatus.OK) {
          dbg('getDetails returned status', status)
          console.warn('[AddressAutocomplete] getDetails did not return OK:', status)
          dbg('places.getDetails status', String(status))
          // try a lightweight fallback: use prediction.description
          const formattedFallback = prediction.description || ''
          onChange(formattedFallback)
          persist(formattedFallback)
          setShowList(false)
          onAddressSelect?.({ address1: formattedFallback, raw: prediction })
          return
        }
        const formatted = place?.formatted_address || prediction.description || ''
        console.debug('[AddressAutocomplete] getDetails returned place', { formatted })
        onChange(formatted)
        persist(formatted)
        setShowList(false)
        // parse components
        const parsed: SelectedAddress = place?.address_components ? parseAddressComponents(place.address_components) : { address1: formatted, raw: place }
        parsed.raw = place
        onAddressSelect?.(parsed)
      })
    } catch (e: any) {
      dbg('places.getDetails error', e?.message || e)
      console.error('[AddressAutocomplete] places.getDetails error', e)
      dbg('places.getDetails error', e?.message || String(e))
      // fallback to nominatim using the visible description
      const formattedFallback = prediction.description || ''
      onChange(formattedFallback)
      persist(formattedFallback)
      setShowList(false)
      onAddressSelect?.({ address1: formattedFallback, raw: prediction })
    }
  }

  const onBlur = () => setTimeout(() => setShowList(false), 150)

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!predictions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(predictions.length - 1, i + 1)); setShowList(true); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(-1, i - 1)); }
    else if (e.key === 'Enter') {
      if (activeIndex >= 0 && predictions[activeIndex]) { e.preventDefault(); handlePredictionSelect(predictions[activeIndex]) }
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowList(Boolean(e.target.value)) }}
        onFocus={() => setShowList(Boolean(value || suggestions.length || predictions.length))}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand"
      />

      {showList && (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md bg-white shadow-lg ring-1 ring-black/10">
          {predictions && predictions.length > 0 ? predictions.map((p, idx) => (
            <li key={p.place_id}>
              <button
                onMouseDown={(ev) => { ev.preventDefault(); handlePredictionSelect(p) }}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${activeIndex === idx ? 'bg-gray-50' : ''}`}
              >
                {/* For Google predictions use structured_formatting; for nominatim fallbacks use description as the main line */}
                <div className="font-medium text-[13px] text-gray-900">{p.structured_formatting?.main_text || p.description || p.display_name}</div>
                <div className="text-[12px] text-gray-600">{p.structured_formatting?.secondary_text || (p.structured_formatting ? p.description : '')}</div>
              </button>
            </li>
          )) : (
            suggestions.map((s) => (
              <li key={s}>
                <button onMouseDown={(ev) => { ev.preventDefault(); onChange(s); persist(s); setShowList(false) }} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s}</button>
              </li>
            ))
          )}
          {provider === 'google' && (
            <li className="px-3 py-2 text-right text-[11px] text-gray-500">Powered by Google</li>
          )}
          {provider === 'locationiq' && (
            <li className="px-3 py-2 text-right text-[11px] text-gray-500">Powered by LocationIQ</li>
          )}
        </ul>
      )}
    </div>
  )
}
