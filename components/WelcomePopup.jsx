'use client'
import { useState, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

const STORAGE_KEY = 'osr_popup'

export default function WelcomePopup() {
  const [show, setShow]           = useState(false)
  const [step, setStep]           = useState('form')
  const [email, setEmail]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [couponCode, setCouponCode] = useState('')
  const pathname                  = usePathname()
  const searchParams              = useSearchParams()

  useEffect(() => {
    const verified = searchParams.get('verified')
    const code     = searchParams.get('code')
    if (verified === 'success' && code) {
      setCouponCode(code)
      setStep('success')
      setShow(true)
      window.history.replaceState({}, '', '/')
    } else if (verified === 'already') {
      setStep('already')
      setShow(true)
      window.history.replaceState({}, '', '/')
    } else if (verified === 'expired') {
      setStep('expired')
      setShow(true)
      window.history.replaceState({}, '', '/')
    }
  }, [searchParams])

  useEffect(() => {
    if (pathname !== '/') return
    const verified = searchParams.get('verified')
    if (verified) return
    if (localStorage.getItem(STORAGE_KEY) === 'purchased') return
    const fromInternal = sessionStorage.getItem('osr_internal')
    if (fromInternal) return
    const timer = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(timer)
  }, [pathname])

  useEffect(() => {
    sessionStorage.setItem('osr_internal', '1')
  }, [pathname])

  useEffect(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    if (nav && (nav.type === 'navigate' || nav.type === 'reload')) {
      const ref = document.referrer
      const isExternal = !ref || !ref.includes('onesilkribbon.com')
      if (isExternal) sessionStorage.removeItem('osr_internal')
    }
  }, [])

  // 锁定 body 滚动
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [show])

  const handleClose = () => setShow(false)

  const handleSubmit = async () => {
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'welcome_popup' }),
      })
      const data = await res.json()
      if (data.ok) {
        setStep(data.already ? 'already' : 'sent')
      } else {
        setError(data.error || 'Something went wrong')
      }
    } catch { setError('Something went wrong, please try again') }
    setLoading(false)
  }

  if (!show) return null

  return (
    <>
      <div onClick={handleClose} style={{
        position:'fixed',inset:0,background:'rgba(28,23,20,0.6)',
        zIndex:1000,backdropFilter:'blur(4px)',animation:'fadeIn 0.3s ease',
      }}/>

      <div className="welcome-popup" style={{
        position:'fixed',
        zIndex:1001,
        background:'var(--cream)',
        overflow:'hidden',
        animation:'slideUp 0.4s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>

        {/* Left panel — only on form step and desktop */}
        {step === 'form' && (
          <div className="popup-left" style={{
            background:'var(--ink)',padding:'48px 32px',
            display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',textAlign:'center',
          }}>
            <p style={{fontSize:10,letterSpacing:'0.3em',textTransform:'uppercase',color:'var(--gold)',marginBottom:24}}>One Silk Ribbon</p>
            <p style={{fontFamily:'var(--font-display)',fontSize:42,fontStyle:'italic',color:'var(--cream)',lineHeight:1.1,fontWeight:300,margin:'0 0 24px'}}>10%<br/>off</p>
            <p style={{fontSize:11,color:'#9A8878',lineHeight:1.8,letterSpacing:'0.05em'}}>your first order</p>
            <div style={{width:32,height:1,background:'var(--gold)',margin:'24px auto'}}/>
            <p style={{fontSize:10,color:'#6a5a4a',lineHeight:1.8,letterSpacing:'0.05em'}}>Handcrafted mulberry silk ribbons, made with love</p>
          </div>
        )}

        {/* Right / Main panel */}
        <div style={{padding:'40px 28px',position:'relative',textAlign: step !== 'form' ? 'center' : 'left', display:'flex', flexDirection:'column', justifyContent:'center'}}>
          <button onClick={handleClose} style={{
            position:'absolute',top:12,right:12,
            background:'none',border:'none',color:'var(--taupe)',
            fontSize:20,cursor:'pointer',lineHeight:1,
            padding:8, minWidth:44, minHeight:44,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>✕</button>

          {/* FORM */}
          {step === 'form' && <>
            {/* Mobile-only badge */}
            <div className="popup-mobile-badge">
              <span style={{fontFamily:'var(--font-display)',fontSize:28,fontStyle:'italic',color:'var(--gold)',fontWeight:300}}>10% off</span>
              <span style={{fontSize:11,color:'var(--taupe)',letterSpacing:'0.05em'}}>&nbsp;your first order</span>
            </div>
            <p style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:300,color:'var(--ink)',marginBottom:8}}>Welcome</p>
            <p style={{fontSize:12,color:'var(--taupe)',lineHeight:1.8,marginBottom:28}}>
              Join our community and receive an exclusive discount on your first order.
            </p>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:10,letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--taupe)',display:'block',marginBottom:8}}>Email Address</label>
              <input type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="your@email.com"
                style={{width:'100%',padding:'14px',boxSizing:'border-box',background:'#fff',border:'1px solid var(--warm)',fontFamily:'var(--font-body)',fontSize:16,color:'var(--ink)',outline:'none',borderRadius:0,WebkitAppearance:'none'}}
              />
              {error && <p style={{fontSize:11,color:'#C0392B',marginTop:6}}>{error}</p>}
            </div>
            <button onClick={handleSubmit} disabled={loading} style={{
              width:'100%',padding:'16px',background:'var(--ink)',border:'none',
              color:'var(--cream)',fontFamily:'var(--font-body)',fontSize:11,
              letterSpacing:'0.2em',textTransform:'uppercase',
              cursor:loading?'default':'pointer',marginBottom:16,opacity:loading?0.7:1,
              minHeight:48,
            }}>{loading ? 'Sending…' : 'Get My 10% Off'}</button>
            <button onClick={handleClose} style={{
              background:'none',border:'none',fontSize:10,color:'var(--taupe)',
              letterSpacing:'0.1em',cursor:'pointer',textDecoration:'underline',display:'block',margin:'0 auto',
              padding:8,
            }}>No thanks</button>
            <p style={{fontSize:9,color:'#C0B9B0',marginTop:16,lineHeight:1.6}}>
              By subscribing you agree to receive marketing emails. Unsubscribe anytime.
            </p>
          </>}

          {/* SENT */}
          {step === 'sent' && <>
            <p style={{fontSize:32,marginBottom:16}}>✉️</p>
            <p style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:300,color:'var(--ink)',marginBottom:12}}>Check your inbox</p>
            <p style={{fontSize:13,color:'var(--taupe)',lineHeight:1.8,marginBottom:8}}>
              We've sent a confirmation link to<br/><strong style={{color:'var(--ink)'}}>{email}</strong>
            </p>
            <p style={{fontSize:12,color:'var(--taupe)',lineHeight:1.8,marginBottom:28}}>
              Click the link in the email to receive your exclusive 10% discount code. The link expires in 24 hours.
            </p>
            <button onClick={handleClose} style={{
              background:'var(--ink)',border:'none',color:'var(--cream)',
              padding:'14px 32px',fontFamily:'var(--font-body)',
              fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',
              minHeight:48,
            }}>Got It</button>
          </>}

          {/* SUCCESS */}
          {step === 'success' && <>
            <p style={{fontSize:28,marginBottom:16}}>✦</p>
            <p style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:300,color:'var(--ink)',marginBottom:12}}>Your code is ready</p>
            <p style={{fontSize:13,color:'var(--taupe)',lineHeight:1.8,marginBottom:24}}>
              Use this code at checkout for 10% off your first order:
            </p>
            <div style={{background:'var(--ink)',color:'var(--cream)',padding:'16px 24px',letterSpacing:'0.3em',fontSize:18,fontFamily:'monospace',marginBottom:24,wordBreak:'break-all'}}>
              {couponCode}
            </div>
            <p style={{fontSize:11,color:'var(--taupe)',lineHeight:1.8,marginBottom:28}}>
              We've also sent it to your email for safekeeping.
            </p>
            <button onClick={handleClose} style={{
              background:'var(--ink)',border:'none',color:'var(--cream)',
              padding:'14px 32px',fontFamily:'var(--font-body)',
              fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',
              minHeight:48,
            }}>Start Shopping</button>
          </>}

          {/* ALREADY */}
          {step === 'already' && <>
            <p style={{fontSize:28,marginBottom:16}}>✦</p>
            <p style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:300,color:'var(--ink)',marginBottom:12}}>You're already subscribed</p>
            <p style={{fontSize:13,color:'var(--taupe)',lineHeight:1.8,marginBottom:28}}>
              This email has already received a welcome discount. Please check your inbox for your code.
            </p>
            <button onClick={handleClose} style={{
              background:'var(--ink)',border:'none',color:'var(--cream)',
              padding:'14px 32px',fontFamily:'var(--font-body)',
              fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',
              minHeight:48,
            }}>Continue Shopping</button>
          </>}

          {/* EXPIRED */}
          {step === 'expired' && <>
            <p style={{fontSize:28,marginBottom:16}}>⏰</p>
            <p style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:300,color:'var(--ink)',marginBottom:12}}>Link expired</p>
            <p style={{fontSize:13,color:'var(--taupe)',lineHeight:1.8,marginBottom:28}}>
              Your verification link has expired. Please subscribe again to receive a new link.
            </p>
            <button onClick={() => { setStep('form'); setEmail('') }} style={{
              background:'var(--ink)',border:'none',color:'var(--cream)',
              padding:'14px 32px',fontFamily:'var(--font-body)',
              fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',
              minHeight:48,
            }}>Try Again</button>
          </>}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}

        .welcome-popup {
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: min(560px, 92vw);
          display: grid;
          grid-template-columns: ${step === 'form' ? '1fr 1fr' : '1fr'};
          max-height: 90vh;
          overflow-y: auto;
        }
        .popup-mobile-badge { display: none; }

        @media (max-width: 560px) {
          .welcome-popup {
            grid-template-columns: 1fr !important;
            width: calc(100vw - 32px);
            max-height: 85vh;
          }
          .popup-left { display: none !important; }
          .popup-mobile-badge {
            display: flex !important;
            align-items: baseline;
            gap: 4px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--sand);
          }
        }
      `}</style>
    </>
  )
}
