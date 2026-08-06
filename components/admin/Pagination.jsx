'use client'

export function Pagination({ page, totalPages, totalCount, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 16 }}>
      <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="admin-tap-target"
        style={{ padding: '6px 14px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: 6, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
        上一页
      </button>
      <span style={{ fontSize: 12, color: '#A8A4A0' }}>第 {page} / {totalPages} 页 · 共 {totalCount} 条</span>
      <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="admin-tap-target"
        style={{ padding: '6px 14px', background: '#fff', border: '1px solid #E8E4DF', borderRadius: 6, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
        下一页
      </button>
    </div>
  )
}
