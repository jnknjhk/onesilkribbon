// 删除客户（抹掉个人信息）后，他已付款的订单还留着（财务记录要保留），但联系方式
// 都换成下面这些占位值。前台后台都靠 ERASED_EMAIL 认出"这单的客户已经删除了"。
// .invalid 是保留域名，任何邮件都不可能真的发到这个地址。
export const ERASED_EMAIL = 'deleted-customer@invalid'
export const ERASED_NAME = '已删除的客户'

export const isErased = order => order?.customer_email === ERASED_EMAIL
