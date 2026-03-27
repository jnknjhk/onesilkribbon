'use client'
import { useState, useEffect, createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  async function checkSession() {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = await res.json()
      setUser(data.user || null)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle(redirectTo = '/account') {
    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
    })
    window.location.href = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?${params}`
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    window.location.href = '/'
  }

  useEffect(() => {
    setMounted(true)
    checkSession()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading: !mounted || loading, signInWithGoogle, signOut, refreshUser: checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) return { user: null, loading: false, signInWithGoogle: () => {}, signOut: () => {}, refreshUser: () => {} }
  return ctx
}
