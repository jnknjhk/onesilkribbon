import { redirect } from 'next/navigation'
import OrderConfirmedClient from './OrderConfirmedClient'

export default function OrderConfirmedPage({searchParams}) {
  // Exchange old links before rendering HTML or loading analytics with secrets.
  const proof = searchParams?.proof
  const sessionId = searchParams?.session_id
  if (proof || sessionId) {
    const params = new URLSearchParams()
    if (typeof searchParams?.order === 'string') params.set('order',searchParams.order)
    if (typeof proof === 'string') params.set('proof',proof)
    else if (typeof sessionId === 'string') params.set('session_id',sessionId)
    redirect('/api/payment-confirmation?' + params.toString())
  }
  return <OrderConfirmedClient />
}
