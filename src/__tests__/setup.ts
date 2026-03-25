// Test setup — runs before all test files
// Sets env vars so startup-check.ts does not exit(1) in test mode
// NODE_ENV and DATABASE_PATH are set via vitest.config.ts env block

process.env.GROQ_API_KEY = 'test-key'
