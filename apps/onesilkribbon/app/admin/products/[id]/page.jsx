import ProductEditorPage from '@osr/core/admin/pages/products/ProductEditorPage'

// /admin/products/new 新建，/admin/products/<id> 编辑
export default async function ProductPage({ params }) {
  const { id } = await params
  return <ProductEditorPage id={id} />
}
