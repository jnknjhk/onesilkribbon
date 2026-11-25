import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { normalizeEmail, verifyUnsubscribeToken } from '@/lib/unsubscribe'

// GET 只把人带到确认页，不直接退订：邮件安全扫描器经常预取链接。
export async function GET(req) {
  const url = new URL(req.url)
  const params = new URLSearchParams({
    email: url.searchParams.get('email') || '',
    token: url.searchParams.get('token') || '',
  })
  return NextResponse.redirect(new URL(`/unsubscribe?${params}`, url.origin), 302)
}

// POST 支持两种调用：
//   · 确认页表单（email + token）
//   · RFC 8058 一键退订（List-Unsubscribe-Post），参数在查询串里
export async function POST(req) {
  const url = new URL(req.url)
  const contentType = req.headers.get('content-type') || ''
  let email = url.searchParams.get('email')
  let token = url.searchParams.get('token')
  let fromConfirmForm = false

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => null)
    email = email || body?.email
    token = token || body?.token
  } else if (contentType.includes('form')) {
    const form = await req.formData().catch(() => null)
    const formEmail = form?.get('email')
    const formToken = form?.get('token')
    if (formEmail || formToken) {
      email = email || formEmail
      token = token || formToken
      fromConfirmForm = true
    }
    // 否则是 RFC 8058 一键退订：参数在查询串里，body 只有 List-Unsubscribe=One-Click。
  }

  const normalized = normalizeEmail(email)
  // 只有确认页表单才跳回页面；一键退订必须回 2xx，邮箱服务商不会跟随 3xx。
  const wantsHtml = fromConfirmForm
  const finish = ok => {
    if (wantsHtml) return NextResponse.redirect(new URL(`/unsubscribe?${ok ? 'done=1' : 'error=1'}`, url.origin), 303)
    return NextResponse.json(ok ? { ok: true } : { error: 'Invalid unsubscribe link' }, {
      status: ok ? 200 : 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  if (!normalized || !verifyUnsubscribeToken(normalized, token)) return finish(false)

  try {
    // 即使邮箱从未订阅过也要落一条退订记录：营销邮件可能发给只下过单、
    // 或只在旧 newsletter 表里的人。否则页面显示成功，实际什么都没记。
    const { data: updated, error } = await supabaseAdmin.from('subscribers')
      .update({ status: 'unsubscribed', verified: false, verify_token: null, token_expires_at: null })
      .eq('email', normalized)
      .select('id')
    if (error) throw error
    if (!updated?.length) {
      const { error: insertError } = await supabaseAdmin.from('subscribers')
        .insert({ email: normalized, status: 'unsubscribed', verified: false, source: 'unsubscribe' })
      // 并发请求已经插入时按成功处理。
      if (insertError && insertError.code !== '23505') throw insertError
    }
    const { error: legacyError } = await supabaseAdmin.from('newsletter_subscribers')
      .delete().eq('email', normalized)
    if (legacyError) console.error('Unsubscribe legacy cleanup failed')
    return finish(true)
  } catch {
    return NextResponse.json({ error: 'Unsubscribe could not be completed. Please try again.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
