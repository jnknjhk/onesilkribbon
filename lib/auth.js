'use client'
import { useState, useEffect, createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading, null = logged out
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkSession()
  }, [])

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
    // 构建 Supabase Google OAuth URL
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

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, refreshUser: checkSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
