import { useCallback, useEffect, useMemo, useState } from 'react'

const KEY = 'wishlist'

export default function useWishlist() {
  const [ids, setIds] = useState<string[]>([])

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) setIds(JSON.parse(raw))
    } catch {}
  }, [])

  // Persist
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {}
  }, [ids])

  const has = useCallback((id: string) => ids.includes(id), [ids])
  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const value = useMemo(() => ({ ids, has, toggle }), [ids, has, toggle])
  return value
}
