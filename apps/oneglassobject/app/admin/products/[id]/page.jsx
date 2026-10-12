import ProductEditorPage from '@osr/core/admin/pages/products/ProductEditorPage'

// /admin/products/new 新建，/admin/products/<id> 编辑
export default function ProductPage({ params }) {
  return <ProductEditorPage id={decodeURIComponent(params.id)} />
}
