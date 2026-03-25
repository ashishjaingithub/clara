#!/usr/bin/env bash
# Clara Health Check
# Verifies: (a) app responds at localhost:3002, (b) typecheck passes, (c) tests pass
# Usage: bash scripts/health-check.sh [--skip-app]
# Exit: 0 if all checks pass, 1 if any check fails

set -euo pipefail

CLARA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASS=0
FAIL=0
RESULTS=()

log_pass() {
  echo "  [PASS] $1"
  PASS=$((PASS + 1))
  RESULTS+=("PASS: $1")
}

log_fail() {
  echo "  [FAIL] $1"
  FAIL=$((FAIL + 1))
  RESULTS+=("FAIL: $1")
}

echo "=== Clara Health Check ==="
echo "Working directory: $CLARA_DIR"
echo ""

# ─── Check 1: App HTTP response ───────────────────────────────────────────────
echo "1. App HTTP response (localhost:3002)..."
if curl -sf --max-time 5 http://localhost:3002 > /dev/null 2>&1; then
  log_pass "App responds at http://localhost:3002"
else
  log_fail "App not responding at http://localhost:3002 (is 'npm run dev' or 'npm run start' running?)"
fi

# ─── Check 2: TypeScript typecheck ───────────────────────────────────────────
echo "2. TypeScript typecheck (tsc --noEmit)..."
if (cd "$CLARA_DIR" && npm run typecheck 2>&1); then
  log_pass "TypeScript typecheck passes"
else
  log_fail "TypeScript typecheck failed — run 'npm run typecheck' for details"
fi

# ─── Check 3: Unit tests ──────────────────────────────────────────────────────
echo "3. Unit tests (vitest run)..."
if (cd "$CLARA_DIR" && npm test 2>&1); then
  log_pass "All unit tests pass"
else
  log_fail "Unit tests failed — run 'npm test' for details"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "=== Summary ==="
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "Passed: $PASS / $((PASS + FAIL))"

if [ "$FAIL" -gt 0 ]; then
  echo "Health check FAILED ($FAIL checks failed)"
  exit 1
else
  echo "Health check PASSED"
  exit 0
fi
