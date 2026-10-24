'use client'
import { useState, useEffect, useRef } from 'react'
import AccountLayout from '@osr/core/components/AccountLayout'
import { useAuth } from '@osr/core/lib/auth'
import { accountRequest } from '@/lib/account-request'

export default function ProfilePage() {
  const { user } = useAuth()
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const loadedUser = useRef(null)
  const savingRef = useRef(false)
  const successTimer = useRef(null)
  useEffect(() => () => clearTimeout(successTimer.current), [])

  useEffect(() => {
    if (!user) return
    if (loadedUser.current === user.id) return
    const controller = new AbortController()
    setLoading(true); setError(''); setLoaded(false)
    accountRequest('/api/user/profile', user, { signal: controller.signal })
      .then(data => {
        if (!data.profile) throw new Error('Unable to load profile. Please try again.')
        if (controller.signal.aborted) return
        setForm({ first_name: data.profile.first_name || '', last_name: data.profile.last_name || '', phone: data.profile.phone || '' })
        loadedUser.current = user.id
        setLoaded(true)
      })
      .catch(err => { if (!controller.signal.aborted) setError(err.message || 'Unable to load profile. Please try again.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [user, retry])

  const save = async () => {
    if (!user || !loaded || savingRef.current) return
    savingRef.current = true
    setSaving(true); setError(''); setSuccess(false)
    try {
      await accountRequest('/api/user/profile', user, { method: 'PATCH', body: form })
      setSuccess(true)
      clearTimeout(successTimer.current)
      successTimer.current = setTimeout(() => setSuccess(false), 3000)
    } catch (err) { setError(err.message || 'Failed to save. Please try again.') }
    finally { savingRef.current = false; setSaving(false) }
  }

  const inp = (field, label, type = 'text') => (
    <div>
      <label htmlFor={`profile-${field}`} style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--deep)', display: 'block', marginBottom: 8 }}>{label}</label>
      <input
        id={`profile-${field}`} name={field} type={type} value={form[field]} disabled={!loaded}
        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
        style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--sand)', background: '#fff', fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-body)', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
        onFocus={e => e.target.style.borderColor = 'var(--gold)'}
        onBlur={e => e.target.style.borderColor = 'var(--sand)'}
      />
    </div>
  )

  return (
    <AccountLayout>
      <p style={{ fontSize: 10, letterSpacing: '.32em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>Account</p>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 300, color: 'var(--ink)', marginBottom: 28 }}>Edit Profile</h1>

      <div style={{ background: '#fff', border: '1px solid var(--sand)', padding: '28px 24px', maxWidth: 520 }}>
        {/* Google 账户显示 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 0 20px', borderBottom: '1px solid var(--mist)', marginBottom: 24 }}>
          {user?.avatar
            ? <img src={user.avatar} alt="" width={40} height={40} loading="lazy" decoding="async" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{(user?.name || user?.email || '?')[0].toUpperCase()}</div>
          }
          <div>
            <p style={{ fontSize: 12, color: 'var(--ink)', marginBottom: 2 }}>{user?.email}</p>
            <p style={{ fontSize: 10, color: 'var(--taupe)', letterSpacing: '.06em' }}>Signed in to your account</p>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{ width: 20, height: 20, border: '2px solid var(--sand)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {inp('first_name', 'First Name')}
            {inp('last_name', 'Last Name')}
            {inp('phone', 'Phone Number', 'tel')}

            {error && <p role="alert" style={{ fontSize: 12, color: '#B91C1C' }}>{error}</p>}
            {!loaded && <button onClick={() => setRetry(value => value + 1)} className="btn-text">Retry loading profile</button>}
            {success && <p role="status" style={{ fontSize: 12, color: '#15803D' }}>✓ Profile saved successfully.</p>}

            <button onClick={save} disabled={saving || !loaded} style={{
              padding: '12px 28px', background: saving ? 'var(--warm)' : 'var(--gold)',
              border: 'none', color: '#fff', fontSize: 10, letterSpacing: '.22em',
              textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer',
              fontFamily: 'var(--font-body)', transition: 'background 0.2s', alignSelf: 'flex-start',
            }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg) } }` }} />
    </AccountLayout>
  )
}
