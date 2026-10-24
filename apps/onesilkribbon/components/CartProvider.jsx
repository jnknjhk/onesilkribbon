'use client'
import { useEffect } from 'react'
import { useCart } from '@/lib/cart'

export function CartProvider({ children }) {
  useEffect(() => { useCart.persist.rehydrate() }, [])
  return <>{children}</>
}
