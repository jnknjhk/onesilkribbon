const { defineConfig, devices } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // Windows 本机默认复用已安装的 Chrome，避免受限网络里下载 Playwright 浏览器；
  // Linux/CI 用 Playwright 自带的 Chromium（ci.yml 里 `playwright install chromium`）。
  // 需要时可用 PLAYWRIGHT_CHANNEL=msedge 覆盖。
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      ...(process.env.PLAYWRIGHT_CHANNEL || process.platform === 'win32'
        ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' }
        : {}),
    },
  }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
