import { createContext, useContext, useEffect, useMemo, useState, createElement, type ReactNode } from 'react'
import { setAuthToken, getAuthToken } from './apiClient'
import type { LoginResponse } from './api'

export type AuthUser = LoginResponse['user']

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  setSession: (user: AuthUser, token: string) => void
  logout: () => void
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

  const setSession = (u: AuthUser, t: string) => {
    setUser(u)
    setToken(t)
    setAuthToken(t)
    localStorage.setItem('authUser', JSON.stringify(u))
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    setAuthToken(null)
    localStorage.removeItem('authUser')
  }

  const value = useMemo(() => ({ user, token, setSession, logout }), [user, token])

  return createElement(AuthContext.Provider, { value }, children as any)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
