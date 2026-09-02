'use client'
import { useState } from 'react'
import { C, inp } from './ui'

// SKU 批量调整弹窗。自己管筛选/字段/模式/数值这些临时状态，
// 算完之后通过 onApply 把新的 skus 数组交回给编辑页——
// 弹窗不直接改父组件的状态，只负责"算出结果"。
export default function BatchSkuModal({ open, onClose, skus, attrNames, onApply, onNotify }) {
  const [filter, setFilter] = useState({})   // attrName -> value（'' = 不限）
  const [field, setField]   = useState('price_gbp')
  const [mode, setMode]     = useState('set') // 'set' | 'add' | 'multiply'
  const [value, setValue]   = useState('')

  if (!open) return null

  const targets = skus.filter(sku =>
    Object.entries(filter).every(([attr, val]) => !val || (sku.attributes?.[attr] || '') === val)
  )

  function close() {
    setValue(''); setFilter({})
    onClose()
  }

  function applyValue() {
    if (!value && value !== '0') return
    const val = parseFloat(value)
    if (isNaN(val)) return

    const targetIndices = new Set(targets.map(t => skus.indexOf(t)))
    onApply(skus.map((sku, i) => {
      if (!targetIndices.has(i)) return sku
      let newVal
      const current = parseFloat(sku[field] || 0)
      if (mode === 'set')           newVal = val
      else if (mode === 'add')      newVal = Math.max(0, current + val)
      else if (mode === 'multiply') newVal = Math.max(0, parseFloat((current * val).toFixed(2)))
      if (field === 'stock_qty') newVal = Math.max(0, Math.round(newVal))
      if (field === 'price_gbp') newVal = parseFloat(newVal.toFixed(2))
      return { ...sku, [field]: String(newVal) }
    }))
    onNotify(`已批量更新 ${targets.length} 个 SKU`)
    close()
  }

  function applyToggle(active) {
    const targetIndices = new Set(targets.map(t => skus.indexOf(t)))
    onApply(skus.map((sku, i) => targetIndices.has(i) ? { ...sku, is_active: active } : sku))
    onNotify(`已批量${active ? '启用' : '停用'} ${targets.length} 个 SKU`)
    close()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:32, width:480, maxWidth:'90vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:16, color:C.ink, fontWeight:400 }}>批量调整 SKU</h3>
          <button onClick={close} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:C.muted }}>×</button>
        </div>

        {/* 按属性筛选范围 */}
        <div style={{ marginBottom:20 }}>
          <p style={{ fontSize:11, color:C.muted, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>筛选范围（不选 = 全部 SKU）</p>
          {attrNames.map(attrName => {
            const opts = [...new Set(skus.map(s => s.attributes?.[attrName] || '').filter(Boolean))]
            return (
              <div key={attrName} style={{ marginBottom:10 }}>
                <label style={{ fontSize:12, color:C.sub, display:'block', marginBottom:4 }}>{attrName}</label>
                <select value={filter[attrName] || ''} onChange={e => setFilter(p => ({ ...p, [attrName]: e.target.value }))}
                  style={{ ...inp, padding:'7px 10px', fontSize:12 }}>
                  <option value="">全部</option>
                  {opts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )
          })}
          <p style={{ fontSize:11, color:C.gold, marginTop:6 }}>已匹配 {targets.length} 个 SKU</p>
        </div>

        {/* 字段 + 模式 + 数值 */}
        <div style={{ marginBottom:20 }}>
          <p style={{ fontSize:11, color:C.muted, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>调整内容</p>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {[['price_gbp','价格(£)'],['stock_qty','库存数量']].map(([val,label]) => (
              <button key={val} onClick={() => setField(val)} style={{
                flex:1, padding:'8px', borderRadius:6, border:`1px solid ${field===val ? C.gold : C.border}`,
                background: field===val ? C.gold+'22' : '#fff', color: field===val ? C.gold : C.sub,
                fontSize:12, cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            {[['set','设为'],['add','增加/减少'],['multiply','乘以']].map(([val,label]) => (
              <button key={val} onClick={() => setMode(val)} style={{
                flex:1, padding:'7px', borderRadius:6, border:`1px solid ${mode===val ? C.gold : C.border}`,
                background: mode===val ? C.gold+'22' : '#fff', color: mode===val ? C.gold : C.sub,
                fontSize:11, cursor:'pointer'
              }}>{label}</button>
            ))}
          </div>
          <input type="number" step={field==='price_gbp' ? '0.01' : '1'}
            value={value} onChange={e => setValue(e.target.value)}
            placeholder={mode==='set' ? '输入新值' : mode==='add' ? '正数增加，负数减少' : '倍数（如 1.1 = 涨价10%）'}
            style={{ ...inp }} />
        </div>

        {/* 批量启用/停用 */}
        <div style={{ marginBottom:20, paddingTop:16, borderTop:`1px solid ${C.border}` }}>
          <p style={{ fontSize:11, color:C.muted, letterSpacing:'.1em', textTransform:'uppercase', marginBottom:10 }}>批量启用/停用</p>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => applyToggle(true)} style={{ flex:1, padding:'9px', background:C.green+'22', border:`1px solid ${C.green}`, borderRadius:6, color:C.green, fontSize:12, cursor:'pointer' }}>
              启用所选 SKU
            </button>
            <button onClick={() => applyToggle(false)} style={{ flex:1, padding:'9px', background:C.red+'22', border:`1px solid ${C.red}`, borderRadius:6, color:C.red, fontSize:12, cursor:'pointer' }}>
              停用所选 SKU
            </button>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={close}
            style={{ flex:1, padding:'10px', background:'#fff', border:`1px solid ${C.border}`, borderRadius:8, fontSize:12, cursor:'pointer' }}>取消</button>
          <button onClick={applyValue} disabled={!value}
            style={{ flex:2, padding:'10px', background: value ? C.gold : C.border, border:'none', borderRadius:8, color:'#fff', fontSize:12, cursor: value ? 'pointer' : 'not-allowed' }}>
            应用到 {targets.length} 个 SKU
          </button>
        </div>
      </div>
    </div>
  )
}
