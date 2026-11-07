// 后台写操作回归，默认跳过。只有在显式的 staging 环境才运行：
//
//   E2E_WRITE=1 \
//   E2E_BASE_URL=https://<staging-url> \
//   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
//   npm run test:e2e
//
// 安全限制：拒绝 production（onesilkribbon.com）和 localhost。
// 本地 dev server 连的是生产 Supabase，不能拿来做写测试。
const { test, expect } = require('@playwright/test')

const base = process.env.E2E_BASE_URL || ''
const enabled = process.env.E2E_WRITE === '1' &&
  !!base &&
  !/onesilkribbon\.com/i.test(base) &&
  !/localhost|127\.0\.0\.1/i.test(base)
const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

test.describe('admin write flow (staging only)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 })
  test.skip(!enabled, 'Set E2E_WRITE=1 and E2E_BASE_URL to a staging URL (not production or localhost)')
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD')

  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(60_000)
    await page.goto('/admin-login')
    await page.getByLabel('邮箱').fill(email)
    await page.getByLabel('密码').fill(password)
    await page.getByRole('button', { name: '登录' }).click()
    await page.getByLabel('密码').fill('').catch(() => {})
    await expect(page).toHaveURL(/\/admin(\?.*)?$/, { timeout: 20_000 })
  })

  test('create, list, update stock and delete a product through the real API', async ({ page }) => {
    const suffix = Date.now().toString(36)
    const name = `E2E Product ${suffix}`
    const slug = `e2e-product-${suffix}`
    let productId = null

    try {
      const created = await page.request.post('/api/admin/products', {
        data: {
          action: 'create',
          product: {
            name, slug, collection: 'fine-silk-ribbons', description: 'E2E test product',
            care_instructions: '', is_active: true, is_featured: false,
            images: [], attribute_config: [], specifications: [], sort_order: 0,
          },
          skus: [{
            sku_code: `E2E-${suffix}`, colour: 'Ivory', colour_hex: '#ffffff',
            width_mm: 7, length_m: 10, price_gbp: 10, stock_qty: 3, is_active: true,
            attributes: {}, images: [],
          }],
        },
      })
      expect(created.ok()).toBeTruthy()
      const createdBody = await created.json()
      productId = createdBody.id
      expect(productId).toBeTruthy()

      await page.goto(`/admin/products?q=${encodeURIComponent(slug)}`)
      await expect(page.getByText(name)).toBeVisible()

      const detail = await page.request.get(`/api/admin/products?id=${productId}`)
      expect(detail.ok()).toBeTruthy()
      const detailBody = await detail.json()
      expect(detailBody.product.slug).toBe(slug)
      expect(detailBody.skus.length).toBe(1)

      const updated = await page.request.post('/api/admin/products', {
        data: {
          action: 'update',
          product: detailBody.product,
          skus: [{ ...detailBody.skus[0], stock_qty: 5, loaded_stock_qty: detailBody.skus[0].stock_qty }],
          deletedSkuIds: [],
        },
      })
      expect(updated.ok()).toBeTruthy()

      const after = await page.request.get(`/api/admin/products?id=${productId}`)
      const afterBody = await after.json()
      expect(Number(afterBody.skus[0].stock_qty)).toBe(5)
    } finally {
      if (productId) {
        await page.request.post('/api/admin/products', {
          data: { action: 'delete', product: { id: productId } },
        })
      }
    }
  })
})
