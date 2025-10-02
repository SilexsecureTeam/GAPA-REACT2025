import { useEffect, useMemo, useState } from 'react'
import { getManufacturers, type ApiManufacturer } from '../services/api'

let cachedManufacturers: ApiManufacturer[] | null = null
let cachedAt = 0
let inflight: Promise<ApiManufacturer[]> | null = null
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export type UseManufacturersState = {
  manufacturers: ApiManufacturer[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export default function useManufacturers(): UseManufacturersState {
  const [manufacturers, setManufacturers] = useState<ApiManufacturer[]>(() => cachedManufacturers ?? [])
  const [loading, setLoading] = useState<boolean>(() => !cachedManufacturers)
  const [error, setError] = useState<string | null>(null)
  const [, forceRerender] = useState(0)

  const shouldUseCache = useMemo(() => {
    if (!cachedManufacturers) return false
    if (Date.now() - cachedAt > CACHE_TTL) return false
    return true
  }, [])

  const fetchManufacturers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await (inflight ||= getManufacturers())
      cachedManufacturers = Array.isArray(data) ? data : []
      cachedAt = Date.now()
      setManufacturers(cachedManufacturers)
    } catch (err) {
      console.error('Failed to load manufacturers', err)
      setError('Unable to load manufacturers right now.')
      setManufacturers([])
    } finally {
      inflight = null
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (shouldUseCache && cachedManufacturers) {
        setManufacturers(cachedManufacturers)
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)
        const data = await (inflight ||= getManufacturers())
        if (cancelled) return
        cachedManufacturers = Array.isArray(data) ? data : []
        cachedAt = Date.now()
        setManufacturers(cachedManufacturers)
      } catch (err) {
        if (cancelled) return
        console.error('Failed to load manufacturers', err)
        setError('Unable to load manufacturers right now.')
        setManufacturers([])
      } finally {
        if (!cancelled) {
          inflight = null
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [shouldUseCache])

  const refresh = () => {
    cachedManufacturers = null
    cachedAt = 0
    inflight = null
    forceRerender((x) => x + 1)
    void fetchManufacturers()
  }

  return { manufacturers, loading, error, refresh }
}
