import { createContext, useContext, useEffect, useMemo, useState, createElement, type ReactNode } from 'react'
import { setAuthToken, getAuthToken } from './apiClient'
import { VEHICLE_FILTER_KEY } from './vehicle'
import type { LoginResponse } from './api'

export type AuthUser = LoginResponse['user']

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  setSession: (user: AuthUser, token: string) => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // hydrate from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('authUser')
      const t = getAuthToken()
      if (stored && t) {
        setUser(JSON.parse(stored))
        setToken(t)
      }
    } catch {
      // ignore
    }
  }, [])

  // Sync auth state across tabs/windows
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      try {
        if (e.key === 'authUser') {
          if (e.newValue) setUser(JSON.parse(e.newValue))
          else setUser(null)
        }
        if (e.key === 'authToken' || e.key === 'token') {
          if (e.newValue) setToken(e.newValue)
          else setToken(null)
        }
      } catch {
        setUser(null); setToken(null)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setSession = (u: AuthUser, t: string) => {
    setUser(u)
    setToken(t)
    setAuthToken(t)
    localStorage.setItem('authUser', JSON.stringify(u))
  }

  const logout = async () => {
    // Clear in-memory state immediately
    setUser(null)
    setToken(null)

    // Preserve whitelist keys (wishlist and vehicle filter)
    const keysToKeep = new Set<string>(['wishlist', VEHICLE_FILTER_KEY])
    const preserved: Record<string, string | null> = {}
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (!k) continue
        if (keysToKeep.has(k)) preserved[k] = localStorage.getItem(k)
      }
      // Clear everything then restore preserved keys
      localStorage.clear()
      for (const [k, v] of Object.entries(preserved)) {
        if (v == null) continue
        try { localStorage.setItem(k, v) } catch {}
      }
    } catch {
      // Fallback: try removing common auth keys
      try { localStorage.removeItem('authUser') } catch {}
      try { localStorage.removeItem('authToken') } catch {}
      try { localStorage.removeItem('token') } catch {}
    }

    // Clear token from api client
    setAuthToken(null)
    return Promise.resolve()
  }

  const value = useMemo(() => ({ user, token, setSession, logout }), [user, token])

  return createElement(AuthContext.Provider, { value }, children as any)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
