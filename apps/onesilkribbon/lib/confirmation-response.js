import { NextResponse } from 'next/server'
import { createPaymentProof, confirmationCookieName, paymentProofDetails } from '@/lib/payment-proof'

export function confirmationResponse(req, orderNumber, reference, existingProof) {
  const url = new URL('/order-confirmed', req.url)
  url.searchParams.set('order',orderNumber)
  const response = NextResponse.redirect(url,303)
  const details = existingProof ? paymentProofDetails(existingProof,orderNumber) : null
  if (existingProof && !details) throw new Error('Invalid confirmation proof')
  response.cookies.set(confirmationCookieName(orderNumber),existingProof || createPaymentProof(orderNumber,reference),{
    httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/api/order-status',
    maxAge:details ? Math.max(0,Math.floor((details.expires-Date.now())/1000)) : 86400,
  })
  response.headers.set('Cache-Control','private, no-store')
  response.headers.set('Referrer-Policy','no-referrer')
  return response
}
