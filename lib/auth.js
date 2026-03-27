'use client'
import { useState, useEffect, createContext, useContext } from 'react'
import { createClient } from '@supabase/supabase-js'

const AuthContext = createContext(null)

let supabaseInstance = null
function getSupabaseClient() {
  if (supabaseInstance) return supabaseInstance
  supabaseInstance = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { flowType: 'pkce', autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }
  )
  return supabaseInstance
}

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[1]) : null
}

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
    const supabase = getSupabaseClient()

    async function init() {
      // 先尝试从 Supabase SDK 获取 session
      let { data: { session } } = await supabase.auth.getSession()

      // 如果没有，尝试从 cookie 恢复
      if (!session) {
        const accessToken = getCookie('sb-access-token')
        const refreshToken = getCookie('sb-refresh-token')
        if (accessToken && refreshToken) {
          const { data } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          session = data.session
        }
      }

      setUser(buildUser(session))
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(buildUser(session))
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signInWithGoogle(redirectTo = '/account') {
    const supabase = getSupabaseClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${redirectTo}`,
      },
    })
  }

  async function signOut() {
    const supabase = getSupabaseClient()
    await supabase.auth.signOut()
    // 清除 cookie
    document.cookie = 'sb-access-token=; Max-Age=0; path=/'
    document.cookie = 'sb-refresh-token=; Max-Age=0; path=/'
    setUser(null)
    window.location.href = '/'
  }

  async function refreshUser() {
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    setUser(buildUser(session))
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) return { user: null, loading: false, signInWithGoogle: () => {}, signOut: () => {}, refreshUser: () => {} }
  return ctx
}
