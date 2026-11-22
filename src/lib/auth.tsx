import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './db'
import type { Profile } from './types'

interface AuthState {
  profile: (Profile & { email: string }) | null
  loading: boolean
  needsSetup: boolean
  isGerant: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  profile: null, loading: true, needsSetup: false, isGerant: false, refresh: async () => {}, signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthState['profile']>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await api.me()
      setProfile(r.user ?? null)
      setNeedsSetup(Boolean(r.needsSetup))
    } catch {
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const onLogout = () => setProfile(null)
    window.addEventListener('dema:logout', onLogout)
    return () => window.removeEventListener('dema:logout', onLogout)
  }, [refresh])

  const value: AuthState = {
    profile, loading, needsSetup,
    isGerant: profile?.role === 'gerant',
    refresh,
    signOut: async () => { await api.logout(); setProfile(null) },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
