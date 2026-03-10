'use client'
import React, { useState, useEffect } from 'react'
import { useCart } from '@/lib/cart'
import { formatGBP, calculateTotals } from '@/lib/pricing'
import Link from 'next/link'

export function CartProvider({ children }) {
  return <>{children}</>
}

export function CartDrawer() {
    const { items, isOpen, closeCart, removeItem, updateQty, getSubtotal } = useCart()
    const [shippingSettings, setShippingSettings] = React.useState(null)

    React.useEffect(() => {
      fetch('/api/settings')
        .then(r => r.json())
        .then(data => setShippingSettings({
          shippingRate:          parseFloat(data.shipping_rate)           || 0,
          freeShippingThreshold: parseFloat(data.free_shipping_threshold) || 45.00,
          freeShippingEnabled:   data.free_shipping_enabled !== 'false',
        }))
        .catch(() => {})
    }, [])

    const totals = calculateTotals(getSubtotal ? getSubtotal() : 0, shippingSettings)


  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div onClick={closeCart} style={{
          position: 'fixed', inset: 0, background: 'rgba(28,23,20,0.4)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(480px, 100vw)',
        background: 'var(--cream)',
        zIndex: 201,
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          padding: '28px 36px', borderBottom: '1px solid var(--sand)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <span className="eyebrow" style={{ marginBottom: 4 }}>Your Basket</span>
            <p style={{ fontSize: 12, color: 'var(--taupe)' }}>
              {items.length === 0 ? 'Empty' : `${items.reduce((s,i)=>s+i.qty,0)} item${items.reduce((s,i)=>s+i.qty,0)!==1?'s':''}`}
            </p>
          </div>
          <button onClick={closeCart} style={{
            background: 'none', border: 'none', color: 'var(--taupe)',
            fontSize: 22, lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 36px' }}>
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 80 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 28,
                fontStyle: 'italic', color: 'var(--taupe)', marginBottom: 24,
              }}>
                Your basket is empty
              </p>
              <button onClick={closeCart} className="btn-text"
                style={{ margin: '0 auto' }}>
                <span className="line" />
                Continue Shopping
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {items.map(item => (
                <CartItem key={item.skuId} item={item}
                  onRemove={() => removeItem(item.skuId)}
                  onQtyChange={(q) => updateQty(item.skuId, q)} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{
            padding: '24px 36px 36px',
            borderTop: '1px solid var(--sand)',
          }}>
            {/* Free shipping progress */}
            {!totals.freeShipping && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 8, letterSpacing: '0.05em' }}>
                  Add {formatGBP(totals.amountToFreeShipping)} more for free shipping
                </p>
                <div style={{ height: 2, background: 'var(--sand)', borderRadius: 1 }}>
                  <div style={{
                    height: '100%', background: 'var(--gold)', borderRadius: 1,
                    width: `${Math.min(100, (parseFloat(totals.subtotalIncVat) / (shippingSettings?.freeShippingThreshold || 45)) * 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              <Row label="Subtotal (exc. VAT)" value={formatGBP(totals.subtotalExVat)} />
              <Row label="VAT (20%)" value={formatGBP(totals.vatAmount)} />
              <Row label="Shipping" value={totals.freeShipping ? 'Free' : formatGBP(totals.shipping)} />
              <div style={{ height: 1, background: 'var(--sand)', margin: '4px 0' }} />
              <Row label="Total" value={formatGBP(totals.total)} bold />
            </div>

            <Link href="/checkout" onClick={closeCart}>
              <button className="btn-primary" style={{ marginBottom: 12 }}>
                Proceed to Checkout
              </button>
            </Link>
            <button onClick={closeCart} className="btn-secondary">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function CartItem({ item, onRemove, onQtyChange }) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      {/* Image / colour swatch */}
      <div style={{
        width: 72, height: 90, flexShrink: 0,
        background: item.colourHex || 'var(--sand)',
        position: 'relative', overflow: 'hidden',
      }}>
        {item.image && (
          <img src={item.image} alt={item.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 16,
          fontWeight: 400, marginBottom: 4, color: 'var(--ink)',
        }}>
          {item.name}
        </p>
        <p style={{ fontSize: 11, color: 'var(--taupe)', marginBottom: 12, letterSpacing: '0.04em' }}>
          {item.skuDesc}
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Qty control */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            border: '1px solid var(--warm)',
          }}>
            <button onClick={() => onQtyChange(item.qty - 1)} style={{
              width: 32, height: 32, background: 'none', border: 'none',
              color: 'var(--deep)', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>−</button>
            <span style={{ width: 32, textAlign: 'center', fontSize: 13 }}>{item.qty}</span>
            <button onClick={() => onQtyChange(item.qty + 1)} style={{
              width: 32, height: 32, background: 'none', border: 'none',
              color: 'var(--deep)', fontSize: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <p style={{
              fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)',
            }}>
              {formatGBP(item.price * item.qty)}
            </p>
            <button onClick={onRemove} style={{
              background: 'none', border: 'none',
              color: 'var(--taupe)', fontSize: 14,
            }}>✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, bold }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      fontSize: bold ? 14 : 12,
      fontWeight: bold ? 400 : 300,
      color: bold ? 'var(--ink)' : 'var(--taupe)',
      letterSpacing: '0.04em',
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: bold ? 'var(--font-display)' : 'inherit', fontSize: bold ? 18 : 12 }}>
        {value}
      </span>
    </div>
  )
}
