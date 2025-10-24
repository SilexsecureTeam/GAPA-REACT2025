import { useEffect, useRef, useState } from 'react'

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
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('No window'))
    // If already loaded
    if ((window as any).google && (window as any).google.maps && (window as any).google.maps.places) return resolve()
    const id = 'gapa-google-places'
    if (document.getElementById(id)) return resolve()
    const s = document.createElement('script')
    s.id = id
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Google Places'))
    document.head.appendChild(s)
  })
}

const RECENT_KEY = 'gapa:recent_addresses'

export default function AddressAutocomplete({ value, onChange, onAddressSelect, placeholder, country = 'ng' }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showList, setShowList] = useState(false)
  const [predictions, setPredictions] = useState<any[]>([])
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_PLACES_KEY || ''
  // debug logs visible in-UI (helps when browser console isn't available)
  const [logs, setLogs] = useState<string[]>([])
  const dbg = (...args: any[]) => {
    try { console.debug('[AddressAutocomplete]', ...args) } catch { /* noop */ }
    try {
      const text = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      setLogs(l => [text, ...l].slice(0, 12))
    } catch { /* noop */ }
  }
  const [provider, setProvider] = useState<'google'|'nominatim'|'local'|'none'>('none')
  const [lastError, setLastError] = useState<string|undefined>(undefined)
  try { console.debug('[AddressAutocomplete] apiKey present?', Boolean(apiKey)) } catch {}

  useEffect(() => {
    // load recent suggestions from localStorage
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setSuggestions(JSON.parse(raw))
    } catch {}
  }, [])

  const nominatimSearch = async (q: string) => {
    try { console.debug('[AddressAutocomplete] nominatimSearch query', q) } catch {}
    try {
      // normalize country for nominatim (ISO alpha-2)
      let nomCountry = 'ng'
      try {
        const raw = String(country || 'ng').trim().toLowerCase()
        if (raw === 'nigeria' || raw === 'ng' || raw === 'ngn') nomCountry = 'ng'
        else if (raw.length === 2) nomCountry = raw
      } catch {}
      const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', addressdetails: '1', countrycodes: nomCountry })
      const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`
      const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'gapa-app/1.0' } })
      if (!res.ok) throw new Error(`Nominatim ${res.status}`)
      const data = await res.json()
      return Array.isArray(data) ? data.map((d:any) => ({ description: d.display_name, place_id: `nom_${d.place_id}`, raw: d })) : []
    } catch (e: any) {
      setLastError(e?.message || String(e))
      return []
    }
  }
  useEffect(() => {
    if (!apiKey) return
    let mounted = true
    loadGooglePlaces(apiKey).then(() => {
      if (!mounted) return
      // Prepare AutocompleteService for predictions
      try {
        (window as any).__gapaPlacesService = (window as any).__gapaPlacesService || new (window as any).google.maps.places.AutocompleteService()
      } catch (e) {
        // ignore
      }
    }).catch((e) => { dbg('loadGooglePlaces failed', e?.message || e) })
    return () => { mounted = false }
  }, [apiKey])

  // Query Google Autocomplete for predictions (debounced)
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
    if (apiKey && svc) {
      dbg('query google predictions', value, { countryCode })
      try {
        svc.getPlacePredictions(req, async (preds: any[]) => {
          if (!active) return
          dbg('google returned', preds && preds.length)
          if (!preds || preds.length === 0) {
            // Fallback to Nominatim
            setProvider('nominatim')
            const nom = await nominatimSearch(value)
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
        setLastError(e?.message || String(e))
        dbg('google error', e)
        // Google failed, try nominatim
        setProvider('nominatim')
        nominatimSearch(value).then((nom) => { if (!active) return; dbg('nominatim returned after google error', nom && nom.length); setPredictions(nom) })
      }
    } else {
      // No Google API key or svc — use Nominatim directly
      dbg('using nominatim fallback (no Google API key) for', value)
      setProvider('nominatim')
      nominatimSearch(value).then((nom) => { if (!active) return; dbg('nominatim returned', nom && nom.length); setPredictions(nom) })
    }
    return () => { active = false }
  }, [value, apiKey, country])

  const persist = (s: string) => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const arr = raw ? JSON.parse(raw) as string[] : []
      const next = [s, ...arr.filter(x => x !== s)].slice(0, 6)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      setSuggestions(next)
    } catch {}
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
    out.address1 = parts.join(' ').trim() || components.map(c=>c.long_name).slice(0,4).join(', ')
    out.city = locality?.long_name || undefined
    out.region = admin?.long_name || undefined
    out.postcode = postal?.long_name || undefined
    return out
  }

  const handlePredictionSelect = async (prediction: any) => {
    if (!prediction) return
    const id = prediction.place_id
    const svc = new (window as any).google.maps.places.PlacesService(document.createElement('div'))
    svc.getDetails({ placeId: id, fields: ['address_components','formatted_address','geometry','name'] }, (place: any) => {
      const formatted = place?.formatted_address || prediction.description || ''
      onChange(formatted)
      persist(formatted)
      setShowList(false)
      // parse components
      const parsed: SelectedAddress = place?.address_components ? parseAddressComponents(place.address_components) : { address1: formatted, raw: place }
      parsed.raw = place
      onAddressSelect?.(parsed)
    })
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
                onMouseDown={(ev)=>{ ev.preventDefault(); handlePredictionSelect(p) }}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${activeIndex===idx? 'bg-gray-50' : ''}`}
              >
                <div className="font-medium text-[13px] text-gray-900">{p.structured_formatting?.main_text}</div>
                <div className="text-[12px] text-gray-600">{p.structured_formatting?.secondary_text || p.description}</div>
              </button>
            </li>
          )) : (
            suggestions.map((s) => (
              <li key={s}>
                <button onMouseDown={(ev)=>{ ev.preventDefault(); onChange(s); persist(s); setShowList(false) }} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s}</button>
              </li>
            ))
          )}
          <li className="px-3 py-2 text-right text-[11px] text-gray-500">Powered by Google</li>
          {/* Inline debug logs for visibility */}
          {logs.length > 0 && (
            <li className="px-3 py-2 text-left text-[11px] text-gray-500">
              <div className="mb-2 font-semibold text-[12px] text-gray-700">Debug</div>
              <div className="max-h-24 overflow-auto text-[11px] text-gray-600">
                {logs.map((ln, i) => <div key={i} className="truncate">{ln}</div>)}
              </div>
            </li>
          )}
          <li className="px-3 py-2 text-left text-[11px] text-gray-500">
            <div className="flex items-center justify-between text-[11px] text-gray-500">
              <div>Provider: <span className="font-semibold text-gray-700">{provider}</span></div>
              <div>{lastError ? <span className="text-red-500">{lastError}</span> : null}</div>
            </div>
          </li>
        </ul>
      )}
    </div>
  )
}
