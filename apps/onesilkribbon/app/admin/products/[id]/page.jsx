import ProductEditorPage from '@/admin/pages/products/ProductEditorPage'

// /admin/products/new 新建，/admin/products/<id> 编辑
export default async function ProductPage({ params, searchParams }) {
  const { id } = await params
  const query = await searchParams
  const template = typeof query?.template === 'string' ? query.template : ''
  return <ProductEditorPage id={id} template={template} />
}
