'use client'
import { useState, useEffect } from 'react'
import AccountLayout from '@/components/AccountLayout'
import { useAuth } from '@/lib/auth'

const COUNTRIES = [
  { code: 'GB', name: 'United Kingdom' }, { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' }, { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' }, { code: 'SE', name: 'Sweden' },
  { code: 'BE', name: 'Belgium' }, { code: 'IE', name: 'Ireland' },
  { code: 'CH', name: 'Switzerland' }, { code: 'CN', name: 'China' },
  { code: 'HK', name: 'Hong Kong' }, { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' }, { code: 'AE', name: 'UAE' },
]

const EMPTY_FORM = { label: 'Home', first_name: '', last_name: '', line1: '', line2: '', city: '', postcode: '', country: 'GB', phone: '', is_default: false }

function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--deep)', display: 'block', marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '11px 14px', border: '1px solid var(--sand)',
  background: '#fff', fontSize: 13, color: 'var(--ink)',
  fontFamily: 'var(--font-body)', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

function AddressForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(initial || EMPTY_FORM)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = (k, label, opts = {}) => (
    <Field label={label}>
      <input {...opts} value={form[k]} onChange={e => set(k, e.target.value)}
        style={inputStyle}
        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
        onBlur={e => e.target.style.borderColor = 'var(--sand)'}
      />
    </Field>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Field label="Label">
        <select value={form.label} onChange={e => set('label', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {['Home', 'Work', 'Other'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {inp('first_name', 'First Name')}
        {inp('last_name', 'Last Name')}
      </div>
      {inp('line1', 'Address Line 1')}
      {inp('line2', 'Address Line 2 (optional)')}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {inp('city', 'City')}
        {inp('postcode', 'Postcode')}
      </div>
      <Field label="Country">
        <select value={form.country} onChange={e => set('country', e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
          {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </Field>
      {inp('phone', 'Phone (optional)', { type: 'tel' })}
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, color: 'var(--deep)' }}>
        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} />
        Set as default address
      </label>
      <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
        <button onClick={() => onSave(form)} disabled={saving} style={{
          padding: '11px 24px', background: saving ? 'var(--warm)' : 'var(--gold)',
          border: 'none', color: '#fff', fontSize: 10, letterSpacing: '.2em',
          textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-body)',
        }}>
          {saving ? 'Saving…' : 'Save Address'}
        </button>
        <button onClick={onCancel} style={{
          padding: '11px 20px', background: 'none', border: '1px solid var(--sand)',
          fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
          cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--taupe)',
        }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function AddressesPage() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState(null) // null | 'add' | { edit: address }
  const [deleteId, setDeleteId] = useState(null)

  const headers = { Authorization: `Bearer ${user?.accessToken}`, 'Content-Type': 'application/json' }

  useEffect(() => { load() }, [user])

  const load = async () => {
    if (!user?.accessToken) return
    const res = await fetch('/api/user/addresses', { headers })
    const data = await res.json()
    setAddresses(data.addresses || [])
    setLoading(false)
  }

  const saveAddress = async (form) => {
    setSaving(true)
    if (mode === 'add') {
      await fetch('/api/user/addresses', { method: 'POST', headers, body: JSON.stringify(form) })
    } else {
      await fetch('/api/user/addresses', { method: 'PATCH', headers, body: JSON.stringify({ id: mode.edit.id, ...form }) })
    }
    await load(); setMode(null); setSaving(false)
  }

  const remove = async (id) => {
    setDeleteId(id)
    await fetch('/api/user/addresses', { method: 'DELETE', headers, body: JSON.stringify({ id }) })
    setAddresses(prev => prev.filter(a => a.id !== id))
    setDeleteId(null)
  }

  return (
    <AccountLayout>
      <p style={{ fontSize: 10, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Account</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)' }}>Addresses</h1>
        {!mode && (
          <button onClick={() => setMode('add')} style={{
            padding: '9px 20px', background: 'var(--gold)', border: 'none',
            color: '#fff', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
            cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            + Add New
          </button>
        )}
      </div>

      {/* 新增表单 */}
      {mode === 'add' && (
        <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '24px', marginBottom: 20 }}>
          <p style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 20 }}>New Address</p>
          <AddressForm onSave={saveAddress} onCancel={() => setMode(null)} saving={saving} />
        </div>
      )}

      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <div style={{ width: 20, height: 20, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
        </div>
      ) : addresses.length === 0 && mode !== 'add' ? (
        <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '48px 24px', textAlign: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--warm)" strokeWidth="1" style={{ margin: '0 auto 14px' }}>
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <p style={{ fontSize: 13, color: 'var(--taupe)', marginBottom: 18 }}>No saved addresses yet.</p>
          <button onClick={() => setMode('add')} style={{ padding: '10px 24px', background: 'var(--gold)', border: 'none', color: '#fff', fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
            Add an Address
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {addresses.map(addr => (
            <div key={addr.id} style={{ background: '#fff', border: `1px solid ${addr.is_default ? 'var(--gold)' : 'var(--sand)'}` }}>
              {/* 编辑模式 */}
              {mode?.edit?.id === addr.id ? (
                <div style={{ padding: '24px' }}>
                  <p style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--taupe)', marginBottom: 20 }}>Edit Address</p>
                  <AddressForm initial={addr} onSave={saveAddress} onCancel={() => setMode(null)} saving={saving} />
                </div>
              ) : (
                <div style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <p style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--taupe)' }}>{addr.label}</p>
                      {addr.is_default && (
                        <span style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid var(--gold)', padding: '2px 7px', borderRadius: 2 }}>Default</span>
                      )}
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.8 }}>
                      {addr.first_name} {addr.last_name}<br />
                      {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                      {addr.city}{addr.postcode ? `, ${addr.postcode}` : ''}<br />
                      {COUNTRIES.find(c => c.code === addr.country)?.name || addr.country}
                    </p>
                    {addr.phone && <p style={{ fontSize: 11, color: 'var(--taupe)', marginTop: 6 }}>{addr.phone}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => setMode({ edit: addr })} style={{ background: 'none', border: '1px solid var(--sand)', padding: '6px 14px', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-body)', color: 'var(--deep)', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--warm)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--sand)'}>
                      Edit
                    </button>
                    <button onClick={() => remove(addr.id)} disabled={deleteId === addr.id} style={{ background: 'none', border: '1px solid var(--sand)', padding: '6px 14px', fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'var(--font-body)', color: '#B91C1C', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#FCA5A5'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--sand)'}>
                      {deleteId === addr.id ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </AccountLayout>
  )
}
