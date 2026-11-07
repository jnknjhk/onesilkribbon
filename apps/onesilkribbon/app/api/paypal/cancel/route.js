import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@osr/core/lib/supabase'
import { verifyCancelProof } from '@/lib/payment-proof'
import { getPayPalOrder, recoverPayPal } from '@/lib/paypal-payment'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://onesilkribbon.com').replace(/\/$/, '')

function redirect(code) {
  const response = NextResponse.redirect(`${SITE}/checkout?payment_error=${code}`)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// PayPal 的 cancel_url。先查 PayPal，确认没有已完成的收款，再释放本地预占。
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const order = searchParams.get('order')
  const proof = searchParams.get('proof')
  if (!order || order.length > 100 || !verifyCancelProof(proof, order)) {
    return redirect('cancel_failed')
  }

  try {
    const { data: session, error } = await supabaseAdmin.from('paypal_sessions')
      .select('paypal_order_id').eq('order_number', order).maybeSingle()
    if (error) throw error

    if (session?.paypal_order_id) {
      let provider = null
      try {
        provider = await getPayPalOrder(session.paypal_order_id)
      } catch (err) {
        // PayPal 已找不到这个订单（过期/清理），它不可能再被捕获；可以安全释放本地预占。
        if (!/not found/i.test(err?.message || '')) throw err
      }
      const captured = provider?.status === 'COMPLETED' ||
        provider?.purchase_units?.some(unit => unit?.payments?.captures?.length > 0)
      if (captured) {
        // 客户其实已经付了款：先把本地订单补记完成，再告诉他不要重复支付。
        try { await recoverPayPal(order, session.paypal_order_id, { capture: false }) } catch {}
        return redirect('already_paid')
      }
    }

    const { error: releaseError } = await supabaseAdmin.rpc('release_checkout_reservation', {
      p_order_number: order,
      p_reason: 'PayPal 付款已取消',
    })
    if (releaseError) {
      if (/payment evidence/i.test(releaseError.message || '')) return redirect('already_paid')
      throw releaseError
    }
    return redirect('cancelled')
  } catch {
    return redirect('cancel_failed')
  }
}
