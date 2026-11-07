// 后台敏感操作审计。只在服务端调用；写入失败绝不能影响主操作。
import { createHash } from 'node:crypto'
import { supabaseAdmin } from '@osr/core/lib/supabase'

// 客户邮箱不直接落审计表，存短哈希用于关联同一客户的操作。
export function auditEmail(email) {
  return createHash('sha256')
    .update(String(email || '').trim().toLowerCase())
    .digest('hex')
    .slice(0, 16)
}

export async function recordAdminAction(admin, action, { targetType, targetId, detail } = {}) {
  try {
    await supabaseAdmin.from('admin_audit_log').insert({
      actor_email: admin?.email || 'unknown',
      action,
      target_type: targetType || null,
      target_id: targetId != null ? String(targetId) : null,
      detail: detail && typeof detail === 'object' && !Array.isArray(detail) ? detail : {},
    })
  } catch {
    // 审计表还没建或写入失败时跳过，不影响已经完成的业务操作
  }
}
