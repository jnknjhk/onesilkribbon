import OrderDetail from '@/admin/pages/orders/OrderDetail'

export default async function OrderPage({ params }) {
  const { number } = await params
  return <OrderDetail number={number} />
}
