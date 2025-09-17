import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'wishlist'

export default function useWishlist() {
  // Local parser kept stable across renders
  const parse = (raw: string | null): string[] => {
    if (!raw) return []
    try {
      const val = JSON.parse(raw)
      if (!Array.isArray(val)) return []
      const arr = val.map((x) => String(x)).filter(Boolean)
      return Array.from(new Set(arr))
    } catch {
      return []
    }
  }

  // Pre-hydrate from localStorage (prevents initial empty flash)
  const initial: string[] = (() => {
    if (typeof window === 'undefined') return []
    try { return parse(localStorage.getItem(KEY)) } catch { return [] }
  })()

  const [ids, setIds] = useState<string[]>(initial)
  const [loaded, setLoaded] = useState<boolean>(false)

  // One-time load (in case initial ran before storage populated – defensive)
  useEffect(() => {
    try { setIds(parse(localStorage.getItem(KEY))) } catch {}
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist whenever ids change (after hydration)
  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(KEY, JSON.stringify(ids)) } catch {}
  }, [ids, loaded])

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        setIds(parse(e.newValue))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const has = useCallback((id: string) => ids.includes(String(id)), [ids])
  const toggle = useCallback((id: string) => {
    const key = String(id)
    setIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : Array.from(new Set([...prev, key]))))
  }, [])

  const value = useMemo(() => ({ ids, has, toggle, loaded }), [ids, has, toggle, loaded])
  return value
}
