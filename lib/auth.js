'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  function buildUser(session) {
    if (!session?.user) return null
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || '',
      avatar: session.user.user_metadata?.avatar_url || '',
      accessToken: session.access_token,
    }
  }

  useEffect(() => {
    const supabase = createSupabaseBrowserClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(buildUser(session))
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(buildUser(session))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle(next = '/account') {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}` },
    })
  }

  async function signInWithEmail(email, password) {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUpWithEmail(email, password, name) {
    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
