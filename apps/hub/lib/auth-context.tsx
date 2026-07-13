import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SessionUser } from './api'

const TOKEN_KEY = 'cbt_token'
const USER_KEY = 'cbt_user'
const API_KEY = 'cbt_api_key'

type AuthState = {
  token: string | null
  user: SessionUser | null
  apiKey: string | null
  ready: boolean // hydrated from localStorage
  login: (token: string, user: SessionUser) => void
  logout: () => void
  setApiKey: (key: string) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [apiKey, setApiKeyState] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Restore session from localStorage on mount.
  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY)
      const u = localStorage.getItem(USER_KEY)
      const k = localStorage.getItem(API_KEY)
      if (t) setToken(t)
      if (u) setUser(JSON.parse(u) as SessionUser)
      if (k) setApiKeyState(k)
    } catch {
      // ignore corrupt storage
    }
    setReady(true)
  }, [])

  const login = (newToken: string, newUser: SessionUser) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(USER_KEY, JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(API_KEY)
    setToken(null)
    setUser(null)
    setApiKeyState(null)
  }

  const setApiKey = (key: string) => {
    localStorage.setItem(API_KEY, key)
    setApiKeyState(key)
  }

  return (
    <AuthContext.Provider value={{ token, user, apiKey, ready, login, logout, setApiKey }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
