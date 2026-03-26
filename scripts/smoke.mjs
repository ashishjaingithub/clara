/**
 * Clara production smoke test.
 * Runs against the live production server (npm start).
 * NEVER runs against npm run dev.
 *
 * Usage:
 *   npm run smoke                          # test against http://127.0.0.1:3002
 *   SMOKE_BASE_URL=http://x.x.x.x:3002 npm run smoke
 *
 * Exit 0 = all checks passed.
 * Exit 1 = one or more checks failed. Do not deploy.
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3002';
const TIMEOUT_MS = 10_000;

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${label}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

async function get(path, expectedStatus = 200) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: ac.signal });
    if (res.status !== expectedStatus) {
      throw new Error(`Expected HTTP ${expectedStatus}, got ${res.status}`);
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

console.log(`\nClara smoke test — ${BASE}\n`);

// 1. Server is up and serving a production build (not dev)
await check('Server responds to / with production HTML', async () => {
  const res = await get('/');
  const html = await res.text();
  if (html.includes('hmr-client') || html.includes('next-devtools') || html.includes('__webpack_hmr')) {
    throw new Error('Dev server detected (HMR scripts in response). Run `npm run build` first.');
  }
  if (!html.includes('Clara')) {
    throw new Error('Page does not contain expected "Clara" content.');
  }
});

// 2. HMR endpoint is absent (production builds do not serve it)
await check('HMR endpoint absent (confirms production build)', async () => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/_next/webpack-hmr`, { signal: ac.signal });
    clearTimeout(timer);
    if (res.status === 200) {
      throw new Error('HMR endpoint responded with 200 — dev server is running, not a production build.');
    }
    // Any non-200 (404, 400) is the expected production behaviour.
  } finally {
    clearTimeout(timer);
  }
});

// 3. POST /api/demo — missing auth returns 401 (auth layer is active)
await check('POST /api/demo without auth returns 401', async () => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hubspot_company_id: 'smoke-test-probe' }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 (auth required), got ${res.status}. Auth layer may be disabled.`);
    }
  } finally {
    clearTimeout(timer);
  }
});

// 4. POST /api/demo — bad body with valid auth returns 400 (validation is active)
//    Uses SMOKE_OPERATOR_API_KEY env var when provided; skips shape-check otherwise.
await check('POST /api/demo with bad body returns 400 (validation active)', async () => {
  const apiKey = process.env.SMOKE_OPERATOR_API_KEY;
  if (!apiKey) {
    // Can't exercise this path without credentials — skip gracefully.
    console.log('      (skipped — SMOKE_OPERATOR_API_KEY not set)');
    return;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/demo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({}), // missing hubspot_company_id
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (res.status !== 400) {
      throw new Error(`Expected HTTP 400 for missing hubspot_company_id, got ${res.status}.`);
    }
  } finally {
    clearTimeout(timer);
  }
});

// 5. GET /api/demo with invalid uuid format returns 400
await check('GET /api/demo?uuid=invalid returns 400', async () => {
  await get('/api/demo?uuid=not-a-uuid', 400);
});

// 6. GET /api/demo with valid-format but nonexistent uuid returns 404
await check('GET /api/demo?uuid=<nonexistent> returns 404', async () => {
  await get('/api/demo?uuid=00000000-0000-0000-0000-000000000000', 404);
});

// 7. GET /api/chat — missing sessionId returns 400
await check('GET /api/chat without sessionId returns 400', async () => {
  await get('/api/chat', 400);
});

// 8. GET /api/chat — invalid sessionId format returns 400
await check('GET /api/chat?sessionId=invalid returns 400', async () => {
  await get('/api/chat?sessionId=not-a-uuid', 400);
});

// 9. 404 is handled gracefully (Next.js 404 page, not a crash)
await check('GET /nonexistent-path returns 404', async () => {
  await get('/nonexistent-path-smoke-test', 404);
});

// Summary
console.log(`\n${'─'.repeat(48)}`);
console.log(`Smoke test: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\nDo not deploy. Fix the failures above first.\n');
  process.exit(1);
} else {
  console.log('\nAll checks passed. Safe to deploy.\n');
}
