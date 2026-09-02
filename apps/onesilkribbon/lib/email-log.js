import { supabaseAdmin } from '@osr/core/lib/supabase'

// 记录每一封发出去的邮件（成功和失败都记），供后台「邮件记录」页查询。
//
// 原则：记日志本身绝不能影响发信。任何异常都吞掉——邮件已经发出去了，
// 日志没记上是小问题，因为记日志失败反而让调用方报错才是大问题。
export async function logEmail({ kind, to, subject, orderNumber, status, error, providerId }) {
  try {
    await supabaseAdmin.from('email_log').insert({
      kind,
      to_email:     Array.isArray(to) ? to.join(', ') : String(to || ''),
      subject:      subject || null,
      order_number: orderNumber || null,
      status,
      error:        error ? String(error).slice(0, 500) : null,
      provider_id:  providerId || null,
    })
  } catch (e) {
    console.error('[logEmail] 写入失败（不影响发信）:', e.message)
  }
}
