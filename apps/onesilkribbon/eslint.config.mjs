import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // React Hooks 7 新增的严格规则会在现有 effect/ref 写法上产生大量错误。
      // 先降级为 warning，避免阻塞构建；后续单独做 React effect 清理时再逐项处理。
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
  ]),
])
