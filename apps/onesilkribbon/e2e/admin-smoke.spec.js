// 管理端 smoke 测试。
// 公开用例不需要账号；登录后的用例只做只读浏览，不保存、不删除任何数据。
// 需要登录的用例通过环境变量提供测试管理员：
//   E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
// 如果提供 E2E_BASE_URL，会直接测试该地址，不再启动本地 dev server。
const { test, expect } = require('@playwright/test')

const email = process.env.E2E_ADMIN_EMAIL
const password = process.env.E2E_ADMIN_PASSWORD

async function expectNoErrorBoundary(page) {
  await expect(page.getByText('An unexpected error occurred')).toHaveCount(0)
  await expect(page.getByText('SOMETHING WENT WRONG')).toHaveCount(0)
}

test.describe('public admin gate', () => {
  test('unauthenticated admin redirects to login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin-login/)
  })

  test('login form exposes labels and validates empty submit', async ({ page }) => {
    await page.goto('/admin-login')
    await expect(page.getByLabel('邮箱')).toBeVisible()
    await expect(page.getByLabel('密码')).toBeVisible()
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page.locator('#admin-login-error')).toContainText('请填写邮箱和密码')
  })
})

test.describe('authenticated admin smoke', () => {
  test.skip(!email || !password, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD to run authenticated smoke tests')

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin-login')
    await page.getByLabel('邮箱').fill(email)
    await page.getByLabel('密码').fill(password)
    await page.getByRole('button', { name: '登录' }).click()
    await expect(page).toHaveURL(/\/admin(\?.*)?$/)
    await expect(page.getByRole('link', { name: /工作台/ })).toBeVisible()
  })

  test('workbench and main lists load without an error boundary', async ({ page }) => {
    await expect(page.getByText('最近订单')).toBeVisible()
    await expectNoErrorBoundary(page)

    for (const [path, heading] of [
      ['/admin/orders', '订单'],
      ['/admin/products', '商品'],
      ['/admin/customers', '客户'],
      ['/admin/content', '内容'],
      ['/admin/marketing', '营销'],
      ['/admin/settings', '设置'],
    ]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expectNoErrorBoundary(page)
    }
  })

  test('coupon modal traps focus and closes with Escape', async ({ page }) => {
    await page.goto('/admin/marketing')
    await page.getByRole('tab', { name: '优惠码' }).click()
    const trigger = page.getByRole('button', { name: '新建优惠码' })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: '新建优惠码' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByLabel('优惠码')).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})
