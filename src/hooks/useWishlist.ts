import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'wishlist'

export default function useWishlist() {
  const [ids, setIds] = useState<string[]>([])

  // Parse helper
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

  // Load from localStorage
  useEffect(() => {
    setIds(parse(localStorage.getItem(KEY)))
  }, [])

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {}
  }, [ids])

  // Cross-tab and cross-hook sync
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

  const value = useMemo(() => ({ ids, has, toggle }), [ids, has, toggle])
  return value
}
