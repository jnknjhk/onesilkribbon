import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })

  // 清除所有 Supabase auth cookie
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  }

  response.cookies.set('sb-access-token', '', cookieOptions)
  response.cookies.set('sb-refresh-token', '', cookieOptions)

  return response
}
