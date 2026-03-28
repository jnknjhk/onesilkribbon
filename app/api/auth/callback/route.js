import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/account'
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // 把 code 转发给前端页面，让 Supabase JS SDK 完成 PKCE exchange
  if (code) {
    return NextResponse.redirect(`${origin}/auth/confirm?code=${code}&next=${encodeURIComponent(next)}`)
  }

  return NextResponse.redirect(`${origin}/login?error=no_code`)
}
