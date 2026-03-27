'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'

const AuthContext = createContext(null)

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: {
          getItem: (key) => {
            try { return localStorage.getItem(key) } catch { return null }
          },
          setItem: (key, value) => {
            try { localStorage.setItem(key, value) } catch {}
          },
          removeItem: (key) => {
            try { localStorage.removeItem(key) } catch {}
          },
        },
      },
    }
  )
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => typeof window !== 'undefined' ? getSupabaseClient() : null)

  async function checkSession() {
    if (!supabase) { setLoading(false); return }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || '',
          avatar: session.user.user_metadata?.avatar_url || '',
          accessToken: session.access_token,
        })
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!supabase) return
    checkSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.full_name || '',
          avatar: session.user.user_metadata?.avatar_url || '',
          accessToken: session.access_token,
        })
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  async function signInWithGoogle(redirectTo = '/account') {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
      },
    })
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
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
  if (!ctx) return { user: null, loading: false, signInWithGoogle: () => {}, signOut: () => {}, refreshUser: () => {} }
  return ctx
}
