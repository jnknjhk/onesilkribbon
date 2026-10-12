'use client'
// 发货信息：选快递公司 + 填单号，追踪链接自动生成（也可以改）。单个发货和批量发货共用。
import { useEffect } from 'react'
import { CARRIERS, OTHER_CARRIER, findCarrier, trackingUrlFor } from '../../lib/carriers'
import { Field, Input, Select, styles as s } from '../../ui'

// value: { carrierChoice, customCarrier, trackingNumber, trackingUrl, urlTouched }
export function initialShipValue(order) {
  const known = findCarrier(order?.tracking_carrier)
  return {
    carrierChoice: order?.tracking_carrier ? (known ? known.label : OTHER_CARRIER) : CARRIERS[0].label,
    customCarrier: order?.tracking_carrier && !known ? order.tracking_carrier : '',
    trackingNumber: order?.tracking_number || '',
    trackingUrl: order?.tracking_url || '',
    urlTouched: !!order?.tracking_url,
  }
}

export function carrierName(v) {
  return v.carrierChoice === OTHER_CARRIER ? v.customCarrier.trim() : v.carrierChoice
}

export function shipValueValid(v) {
  return !!v.trackingNumber.trim() && !!carrierName(v)
}

export function CarrierSelect({ value, onChange }) {
  return (
    <div className={s.grid2}>
      <Field label="快递公司" required>
        <Select value={value.carrierChoice} onChange={e => onChange({ ...value, carrierChoice: e.target.value, urlTouched: false })}>
          {CARRIERS.map(c => <option key={c.label} value={c.label}>{c.label}</option>)}
          <option value={OTHER_CARRIER}>其他（手动填写）</option>
        </Select>
      </Field>
      {value.carrierChoice === OTHER_CARRIER && (
        <Field label="快递公司名称" required>
          <Input value={value.customCarrier} onChange={e => onChange({ ...value, customCarrier: e.target.value })} placeholder="例如：Yodel" />
        </Field>
      )}
    </div>
  )
}

export default function ShipFields({ value, onChange }) {
  // 没手动改过追踪链接时，跟着快递公司和单号自动生成
  useEffect(() => {
    if (value.urlTouched) return
    const auto = trackingUrlFor(carrierName(value), value.trackingNumber)
    if (auto !== value.trackingUrl) onChange({ ...value, trackingUrl: auto })
  }, [value.carrierChoice, value.customCarrier, value.trackingNumber]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={s.stack}>
      <CarrierSelect value={value} onChange={onChange} />
      <Field label="快递单号" required>
        <Input value={value.trackingNumber} onChange={e => onChange({ ...value, trackingNumber: e.target.value })} placeholder="例如：AB123456789GB" autoFocus />
      </Field>
      <Field label="追踪链接" hint={value.carrierChoice === OTHER_CARRIER ? '其他快递公司需要自己粘贴追踪链接（可不填）' : '根据快递公司和单号自动生成，可修改'}>
        <Input value={value.trackingUrl} onChange={e => onChange({ ...value, trackingUrl: e.target.value, urlTouched: true })} placeholder="https://…" />
      </Field>
    </div>
  )
}
