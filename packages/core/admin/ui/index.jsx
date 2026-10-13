'use client'
// 后台通用组件。所有后台页面都从这里取按钮、标签、表单、表格、弹窗和提示，
// 不再各页自己写一套——之前光按钮就有金/黑/深蓝/绿/红/描边六种样子。
import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import s from './admin.module.css'
import { Icon } from './icons'
import { imageUrl, imageSrcSet } from '../lib/image'

export { Icon }
export const styles = s
export const cx = (...a) => a.filter(Boolean).join(' ')

// ── 按钮 ─────────────────────────────────────────────────────────────────────
// variant: primary（每个界面最多一个主操作）| secondary | danger | dangerGhost | ghost
export function Button({ variant = 'secondary', size, icon, loading, block, iconOnly, children, className, type = 'button', disabled, ...rest }) {
  return (
    <button
      type={type}
      className={cx(s.btn, s['btn_' + variant], size === 'sm' && s.btnSm, block && s.btnBlock, iconOnly && s.iconBtn, className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={s.spinner} /> : icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children != null && children !== false && <span>{children}</span>}
    </button>
  )
}

export function ButtonLink({ href, variant = 'secondary', size, icon, children, className, ...rest }) {
  return (
    <Link href={href} className={cx(s.btn, s['btn_' + variant], size === 'sm' && s.btnSm, className)} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 15 : 16} />}
      {children != null && <span>{children}</span>}
    </Link>
  )
}

// ── 标签 ─────────────────────────────────────────────────────────────────────
// tone: neutral | success | warning | danger | info | brand
export function Badge({ tone = 'neutral', children, icon }) {
  return (
    <span className={cx(s.badge, s['tone_' + tone])}>
      {icon && <Icon name={icon} size={12} strokeWidth={2.2} />}
      {children}
    </span>
  )
}

// ── 页面头 ───────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, back, actions }) {
  return (
    <div className={s.pageHeader}>
      <div style={{ minWidth: 0 }}>
        {back && (
          typeof back === 'string'
            ? <Link href={back} className={s.pageBack}><Icon name="arrowLeft" size={15} />返回</Link>
            : <button type="button" onClick={back.onClick} className={s.pageBack}><Icon name="arrowLeft" size={15} />{back.label || '返回'}</button>
        )}
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle && <div className={s.pageSub}>{subtitle}</div>}
      </div>
      {actions && <div className={s.pageActions}>{actions}</div>}
    </div>
  )
}

// ── 卡片 ─────────────────────────────────────────────────────────────────────
export function Card({ title, subtitle, actions, children, padded = true, className, style }) {
  return (
    <section className={cx(s.card, className)} style={style}>
      {(title || actions) && (
        <div className={s.cardHead}>
          <div style={{ minWidth: 0 }}>
            {title && <h2 className={s.cardTitle}>{title}</h2>}
            {subtitle && <div className={s.cardSub}>{subtitle}</div>}
          </div>
          {actions && <div className={s.pageActions}>{actions}</div>}
        </div>
      )}
      {padded ? <div className={s.cardBody}>{children}</div> : children}
    </section>
  )
}

// 默认收起的次要内容（编辑页里的"规格参数""排序"等）
export function Collapsible({ title, defaultOpen = false, children }) {
  return (
    <details className={s.details} open={defaultOpen}>
      <summary>{title}<Icon name="chevronDown" size={16} /></summary>
      <div className={s.detailsBody}>{children}</div>
    </details>
  )
}

// ── 页签 ─────────────────────────────────────────────────────────────────────
// tabs: [{ key, label, count?, href? }]。有 href 时渲染成链接（能在新标签页打开、能收藏）
export function Tabs({ tabs, value, onChange }) {
  return (
    <div className={s.tabs} role="tablist">
      {tabs.map(t => {
        const active = t.key === value
        const inner = (
          <>
            {t.label}
            {t.count != null && <span className={cx(s.tabCount, s.num)}>{t.count}</span>}
          </>
        )
        return t.href
          ? <Link key={t.key} href={t.href} role="tab" aria-selected={active} className={cx(s.tab, active && s.tabActive)}>{inner}</Link>
          : <button key={t.key} type="button" role="tab" aria-selected={active} className={cx(s.tab, active && s.tabActive)} onClick={() => onChange?.(t.key)}>{inner}</button>
      })}
    </div>
  )
}

// ── 表单 ─────────────────────────────────────────────────────────────────────
// group=true 时外层用 div 而不是 label：label 包着一组按钮（比如上架/下架）时，
// 点标签文字会触发第一个按钮，悄悄把状态改掉
export function Field({ label, required, hint, error, children, style, group }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className={s.field} style={style}>
      {label && <span className={s.fieldLabel}>{label}{required && <span className={s.fieldReq}>*</span>}</span>}
      {children}
      {error ? <div className={s.fieldError}>{error}</div> : hint && <div className={s.fieldHint}>{hint}</div>}
    </Tag>
  )
}

export const Input = forwardRef(function Input({ size, className, ...rest }, ref) {
  return <input ref={ref} className={cx(s.input, size === 'sm' && s.inputSm, className)} {...rest} />
})

export function Select({ options, size, className, children, ...rest }) {
  return (
    <select className={cx(s.select, size === 'sm' && s.inputSm, className)} {...rest}>
      {options ? options.map(o => <option key={o.value} value={o.value}>{o.label}</option>) : children}
    </select>
  )
}

export function Textarea({ className, ...rest }) {
  return <textarea className={cx(s.textarea, className)} {...rest} />
}

export function SearchInput({ value, onChange, placeholder = '搜索…', style }) {
  return (
    <div className={s.searchWrap} style={style}>
      <Icon name="search" size={16} />
      <input className={s.input} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search" />
    </div>
  )
}

// 二选一 / 多选一的分段按钮（状态、开关）
export function Segmented({ options, value, onChange }) {
  return (
    <div className={s.segmented} role="radiogroup">
      {options.map(o => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value}
          className={cx(s.segBtn, o.value === value && s.segBtnActive)} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Checkbox({ checked, onChange, children, disabled }) {
  return (
    <label className={s.check} style={disabled ? { opacity: .5, cursor: 'default' } : undefined}>
      <input type="checkbox" checked={!!checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

// ── 提示条 ───────────────────────────────────────────────────────────────────
export function Notice({ tone = 'info', children, style }) {
  const icon = tone === 'danger' || tone === 'warning' ? 'alert' : 'info'
  return (
    <div className={cx(s.notice, s['tone_' + tone])} style={style}>
      <Icon name={icon} size={16} />
      <div>{children}</div>
    </div>
  )
}

// ── 弹窗 ─────────────────────────────────────────────────────────────────────
export function Modal({ open, title, onClose, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className={s.modalBack} onMouseDown={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={s.modal} style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className={s.modalHead}>
          <h3 className={s.modalTitle}>{title}</h3>
          <Button variant="ghost" size="sm" iconOnly icon="x" onClick={onClose} aria-label="关闭" />
        </div>
        <div className={s.modalBody}>{children}</div>
        {footer && <div className={s.modalFoot}>{footer}</div>}
      </div>
    </div>
  )
}

// 二次确认。danger=true 时确认按钮是红色——所有删除/不可恢复的操作都必须经过它
export function ConfirmDialog({ open, title, message, danger, confirmLabel = '确认', cancelLabel = '取消', loading, onConfirm, onCancel, children }) {
  return (
    <Modal open={open} title={title} onClose={loading ? undefined : onCancel} width={420}
      footer={<>
        <Button onClick={onCancel} disabled={loading}>{cancelLabel}</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}>
      {message && <p style={{ margin: 0, color: 'var(--text-2)', lineHeight: 1.7 }}>{message}</p>}
      {children}
    </Modal>
  )
}

// ── 空状态 / 加载 ────────────────────────────────────────────────────────────
export function EmptyState({ icon = 'inbox', title, text, action }) {
  return (
    <div className={s.empty}>
      <Icon name={icon} size={32} strokeWidth={1.4} />
      {title && <div className={s.emptyTitle}>{title}</div>}
      {text && <div className={s.emptyText}>{text}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

export function SkeletonRows({ rows = 5 }) {
  return (
    <div style={{ padding: 18 }}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={s.skeleton} style={{ width: `${90 - (i % 3) * 15}%`, marginBottom: 14 }} />
      ))}
    </div>
  )
}

// ── 表格 ─────────────────────────────────────────────────────────────────────
// columns: [{ key, header, render(row), align, width, primary, hideMobile }]
// primary 列在手机上作为卡片标题单独一行；其它列显示成"标签：值"。
// onRowHover：鼠标移到某一行时调用（比如提前预取详情页，点下去就快）
export function DataTable({ columns, rows, rowKey = 'id', onRowClick, onRowHover, rowClassName, empty, loading }) {
  // 鼠标在某一行停 120ms 才算"想点"，划过一整列表不会触发一串预取
  const hoverTimer = useRef(null)
  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  if (loading) return <SkeletonRows />
  if (!rows || rows.length === 0) return empty || <EmptyState title="没有数据" />
  return (
    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead>
          <tr>{columns.map(c => <th key={c.key} className={c.align === 'right' ? s.alignRight : undefined} style={c.width ? { width: c.width } : undefined}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey] ?? i}
              className={cx(onRowClick && s.rowClick, rowClassName?.(row))}
              onClick={onRowClick ? e => { if (!e.target.closest('button,a,input,select,label,textarea')) onRowClick(row) } : undefined}
              onPointerEnter={onRowHover ? () => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => onRowHover(row), 120) } : undefined}
              onPointerLeave={onRowHover ? () => clearTimeout(hoverTimer.current) : undefined}>
              {columns.map(c => (
                <td key={c.key}
                  data-label={c.primary ? undefined : (typeof c.header === 'string' ? c.header : undefined)}
                  className={cx(c.align === 'right' && s.alignRight, c.primary && s.cellPrimary, c.hideMobile && s.hideMobile)}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function Pager({ page, totalPages, total, onChange, unit = '条' }) {
  if (!totalPages || totalPages <= 1) {
    return total != null ? <div className={s.pager}><span>共 {total} {unit}</span><span /></div> : null
  }
  return (
    <div className={s.pager}>
      <span>共 {total} {unit} · 第 {page} / {totalPages} 页</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <Button size="sm" icon="chevronLeft" disabled={page <= 1} onClick={() => onChange(page - 1)}>上一页</Button>
        <Button size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>下一页<Icon name="chevronRight" size={15} /></Button>
      </div>
    </div>
  )
}

// ── 图片 ─────────────────────────────────────────────────────────────────────
// 后台所有图片都用它：按显示宽度（width，单位 px）取缩略图，默认懒加载。
// 缩略图万一取不到（比如图片优化额度用完），自动退回显示原图
export function Img({ src, width, alt = '', loading = 'lazy', ...rest }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  if (!src) return null
  const useOriginal = failed || !width
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={useOriginal ? src : imageUrl(src, width)}
      srcSet={useOriginal ? undefined : imageSrcSet(src, width)}
      alt={alt} loading={loading} decoding="async"
      onError={() => { if (!useOriginal) setFailed(true) }}
      {...rest}
    />
  )
}

// ── 统计 ─────────────────────────────────────────────────────────────────────
export function Stat({ label, value, sub }) {
  return (
    <div className={cx(s.card, s.stat)}>
      <div className={s.statLabel}>{label}</div>
      <div className={cx(s.statValue, s.num)}>{value}</div>
      {sub && <div className={s.statSub}>{sub}</div>}
    </div>
  )
}

// ── 轻提示（右下角，几秒后自动消失） ──────────────────────────────────────────
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const idRef = useRef(0)
  const push = useCallback((text, kind) => {
    const id = ++idRef.current
    setItems(list => [...list, { id, text, kind }])
    setTimeout(() => setItems(list => list.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3000)
  }, [])
  const api = useRef(null)
  if (!api.current) api.current = {}
  api.current.success = text => push(text, 'success')
  api.current.error = text => push(text, 'error')
  return (
    <ToastCtx.Provider value={api.current}>
      {children}
      <div className={s.toastHost} aria-live="polite">
        {items.map(t => (
          <div key={t.id} className={cx(s.toast, t.kind === 'error' && s.toastError)}>
            <Icon name={t.kind === 'error' ? 'alert' : 'check'} size={16} />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx) || { success: () => {}, error: () => {} }
}

// 编辑页离开前提醒"有没保存的修改"：刷新/关闭标签页由浏览器提示；
// 点后台里的任何链接（侧边栏、返回）先问一句，取消就留在原页
export function useUnsavedWarning(dirty) {
  useEffect(() => {
    if (!dirty) return
    const onUnload = e => { e.preventDefault(); e.returnValue = '' }
    // 捕获阶段挂在 document 上，比 Next 的 <Link> 先拿到点击；取消时连同默认跳转一起拦下
    const onClick = e => {
      const a = e.target.closest?.('a[href]')
      if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
      if (a.getAttribute('href').startsWith('#')) return
      if (!window.confirm('有修改还没保存，确定离开吗？')) { e.preventDefault(); e.stopPropagation() }
    }
    window.addEventListener('beforeunload', onUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [dirty])
}
