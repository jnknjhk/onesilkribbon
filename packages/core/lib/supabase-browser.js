import { createBrowserClient } from '@supabase/ssr'

// 仅用于浏览器。服务端请使用 ./supabase（带 server-only 保护）。
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}
