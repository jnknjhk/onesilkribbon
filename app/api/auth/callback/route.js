import { NextResponse } from 'next/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/account'
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // PKCE flow: 有 code，交换 session（由 Supabase 客户端在前端处理）
  // Implicit flow: token 在 hash 中，直接重定向到目标页面让前端处理
  if (code) {
    // 重定向到目标页，Supabase JS SDK 会自动处理 code exchange
    return NextResponse.redirect(`${origin}${next}`)
  }

  // 没有 code 也没有 error，可能是 implicit flow，重定向首页
  return NextResponse.redirect(`${origin}/account`)
}
