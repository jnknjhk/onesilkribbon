import SettingsPage from '@osr/core/admin/pages/settings/SettingsPage'
import PaymentRecovery from '@/components/admin/PaymentRecovery'

export default function Settings() {
  return <SettingsPage paymentRecovery={<PaymentRecovery embedded />} />
}
