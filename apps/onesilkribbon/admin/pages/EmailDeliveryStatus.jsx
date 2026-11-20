'use client'

import { useState } from 'react'
import { api } from '../lib/api'
import { Badge, Button, styles as s } from '../ui'

const delivery = {
  delivered: ['已投递', 'success'],
  bounced: ['已退信', 'danger'],
  delivery_delayed: ['投递延迟', 'warning'],
  failed: ['投递失败', 'danger'],
  suppressed: ['已拦截发送', 'danger'],
  complained: ['收到垃圾邮件投诉', 'danger'],
  opened: ['已打开', 'success'],
  clicked: ['已点击', 'success'],
  scheduled: ['待发送', 'info'],
  canceled: ['已取消发送', 'neutral'],
}

export default function EmailDeliveryStatus({ mail }) {
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [label, tone] = Object.hasOwn(delivery, event) ? delivery[event] : ['发信服务已接收', 'neutral']

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const result = await api('/api/admin/emails?deliveryId=' + encodeURIComponent(mail.id), { cache: 'no-store' })
      setEvent(result.event)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Badge tone={tone}>{label}</Badge>
      {mail.provider_id && (
        <Button size="sm" variant="ghost" loading={loading} onClick={refresh}>
          {event ? '刷新投递状态' : '查询投递状态'}
        </Button>
      )}
      {error && <div role="alert" className={s.cellSub}>{error}</div>}
    </div>
  )
}
