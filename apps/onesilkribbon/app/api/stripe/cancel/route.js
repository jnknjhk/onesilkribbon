import { NextResponse } from 'next/server'
import { verifyCancelProof } from '@/lib/payment-proof'
import { reconcileStripeReservation } from '@/lib/stripe-reservations'

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://onesilkribbon.com').replace(/\/$/, '')

function redirect(code) {
  const response = NextResponse.redirect(`${SITE}/checkout?payment_error=${code}`)
  response.headers.set('Referrer-Policy', 'no-referrer')
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// Stripe 的 cancel_url。只有带了签名凭证的取消才允许处理，防止仅凭订单号取消别人的预占。
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const order = searchParams.get('order')
  const proof = searchParams.get('proof')
  if (!order || order.length > 100 || !verifyCancelProof(proof, order)) {
    return redirect('cancel_failed')
  }

  try {
    // 先让 Stripe 确认会话未付款并关闭，再释放本地库存预占。
    const result = await reconcileStripeReservation(order, { cancel: true })
    if (result.status === 'paid') return redirect('already_paid')
    if (result.status !== 'cancelled') return redirect('cancel_failed')
    return redirect('cancelled')
  } catch {
    return redirect('cancel_failed')
  }
}
