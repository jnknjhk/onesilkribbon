'use client'

// 统一的确认/提示弹窗——替代 window.confirm()/alert()，和后台其他自定义弹窗（比如订单页的发货/退款弹窗）视觉风格保持一致
export function ConfirmDialog({ open, title, message, danger, confirmLabel = '确认', cancelLabel = '取消', loading, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 400, color: '#1C1714', marginBottom: 12 }}>{title}</h3>
        {message && <p style={{ fontSize: 13, color: '#6B6460', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>{cancelLabel}</button>
          <button onClick={onConfirm} disabled={loading}
            style={{ flex: 1, padding: '10px', background: danger ? '#ef4444' : '#1C1714', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#fff', opacity: loading ? 0.6 : 1 }}>
            {loading ? '处理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// 替代 window.alert() 的单按钮提示弹窗
export function InfoDialog({ open, title, message, onClose }) {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 380, maxWidth: '90vw' }} onClick={e => e.stopPropagation()}>
        {title && <h3 style={{ fontSize: 16, fontWeight: 400, color: '#1C1714', marginBottom: 12 }}>{title}</h3>}
        <p style={{ fontSize: 13, color: '#6B6460', lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
        <button onClick={onClose} style={{ width: '100%', padding: '10px', background: '#1C1714', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer', color: '#fff' }}>知道了</button>
      </div>
    </div>
  )
}
