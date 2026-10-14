import { errorResponse } from '@osr/core/lib/api-error'
import { redirect } from 'next/navigation'
import { recoverPayPal } from '@/lib/paypal-payment'

export async function GET(req) {
  const params = new URL(req.url).searchParams
  const token = params.get('token')
  const orderNumber = params.get('order')
  if (!token || !orderNumber) return Response.json({ error: 'Missing payment identity' }, { status: 400 })
  try { await recoverPayPal(orderNumber, token) }
  catch (err) {
    return errorResponse(err, { status: 503, tag: 'paypal-capture',
      message: 'Payment verification is pending. Please refresh this page to retry. Do not pay again. Your order details have been retained.' })
  }
  redirect('/order-confirmed?order=' + encodeURIComponent(orderNumber))
}
