import { redirect } from 'next/navigation'

export default function PaymentRecoveryRedirect() {
  redirect('/admin/settings?tab=payment-recovery')
}
