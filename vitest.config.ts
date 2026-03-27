import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      DATABASE_PATH: ':memory:',
      GROQ_API_KEY: 'test-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/__tests__/**',
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/app/demo/**',           // Client components — tested via E2E
        'src/app/admin/**',          // Client components — tested via E2E
        'src/components/**',         // React UI components — tested via E2E
        'src/lib/error-capture/**',  // Client-side error boundary — tested via E2E
        'src/types/index.ts',        // Pure type definitions — no runtime code
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
