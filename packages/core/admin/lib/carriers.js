// 常用快递公司和它们的查件链接格式。发货时选快递公司 + 填单号，追踪链接自动生成，
// 不用再自己去快递官网复制粘贴。数据库里 tracking_carrier 存的仍是公司名（和以前手填的一致）。
export const CARRIERS = [
  { label: 'Royal Mail',  url: n => `https://www.royalmail.com/track-your-item#/tracking-results/${n}` },
  { label: 'Evri',        url: n => `https://www.evri.com/track/parcel/${n}` },
  { label: 'DPD',         url: n => `https://track.dpd.co.uk/parcels/${n}` },
  { label: 'Parcelforce', url: n => `https://www.parcelforce.com/track-trace?trackNumber=${n}` },
  { label: 'DHL',         url: n => `https://www.dhl.com/gb-en/home/tracking/tracking-express.html?submit=1&tracking-id=${n}` },
  { label: 'UPS',         url: n => `https://www.ups.com/track?tracknum=${n}` },
  { label: 'FedEx',       url: n => `https://www.fedex.com/fedextrack/?trknbr=${n}` },
]
export const OTHER_CARRIER = '__other__'

export function findCarrier(label) {
  if (!label) return null
  const l = String(label).trim().toLowerCase()
  return CARRIERS.find(c => c.label.toLowerCase() === l) || null
}

export function trackingUrlFor(carrierLabel, number) {
  const c = findCarrier(carrierLabel)
  const n = String(number || '').trim()
  return c && n ? c.url(encodeURIComponent(n)) : ''
}
