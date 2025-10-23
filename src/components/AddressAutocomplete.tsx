import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  placeholder?: string
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

export default function AddressAutocomplete({ value, onChange, placeholder }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showList, setShowList] = useState(false)
  const apiKey = (import.meta as any)?.env?.VITE_GOOGLE_PLACES_KEY || ''

  useEffect(() => {
    // load recent suggestions from localStorage
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setSuggestions(JSON.parse(raw))
    } catch {}
  }, [])

  useEffect(() => {
    if (!apiKey) return
    let mounted = true
    loadGooglePlaces(apiKey).then(() => {
      if (!mounted) return
      const el = inputRef.current
      if (!el) return
      try {
        const ac = new (window as any).google.maps.places.Autocomplete(el, { types: ['address'] })
        ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          const formatted = place.formatted_address || place.name || ''
          if (formatted) onChange(formatted)
        })
      } catch (e) {
        // ignore
      }
    }).catch(() => { /* silent */ })
    return () => { mounted = false }
  }, [apiKey, onChange])

  const persist = (s: string) => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      const arr = raw ? JSON.parse(raw) as string[] : []
      const next = [s, ...arr.filter(x => x !== s)].slice(0, 6)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      setSuggestions(next)
    } catch {}
  }

  const onSelect = (s: string) => {
    onChange(s)
    persist(s)
    setShowList(false)
  }

  const onBlur = () => setTimeout(() => setShowList(false), 150)

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => { onChange(e.target.value); setShowList(Boolean(e.target.value)) }}
        onFocus={() => setShowList(Boolean(value || suggestions.length))}
        onBlur={onBlur}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-brand"
      />
      {showList && suggestions && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white shadow-lg ring-1 ring-black/10">
          {suggestions.map((s) => (
            <li key={s}>
              <button onClick={() => onSelect(s)} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{s}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
