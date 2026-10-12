import OrderDetail from '@osr/core/admin/pages/orders/OrderDetail'

export default function OrderPage({ params }) {
  return <OrderDetail number={decodeURIComponent(params.number)} />
}
