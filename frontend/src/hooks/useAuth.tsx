import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError, getMe, logout as logoutRequest } from '../api/client'
import type { User } from '../types'

type AuthContextValue = {
  user: User | null
  loading: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getMe()
      .then((next) => {
        if (!cancelled) setUser(next)
      })
      .catch((error) => {
        if (!cancelled && (!(error instanceof ApiError) || error.status !== 401)) {
          setUser(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      logout: async () => {
        await logoutRequest()
        setUser(null)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
