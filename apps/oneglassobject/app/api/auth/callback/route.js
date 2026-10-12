import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { safeNextPath } from '@osr/core/lib/safe-next'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // next 来自 URL，必须过滤成站内路径——否则 next=.evil.com 拼在 origin 后面
  // 就成了 https://本站.evil.com，登录完直接被送去钓鱼站（见 safe-next.js）
  const next = safeNextPath(searchParams.get('next'))
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  // 先建一个指向目标页的 response
  const response = NextResponse.redirect(`${origin}${next}`)

  // 用 NextResponse 的 cookies 来读写，这样 cookie 才能真正写入浏览器
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Exchange error:', exchangeError)
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // session 已通过 response.cookies 写入浏览器，直接跳转
  return response
}
