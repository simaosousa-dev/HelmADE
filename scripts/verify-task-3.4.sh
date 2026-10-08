#!/usr/bin/env bash
# HelmADE Task 3.4 — Team Wire Realtime Agent Feed Sidebar Verification
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== [1/2] Frontend: Typecheck (Strict TS) ==="
npm run typecheck

echo ""
echo "=== [2/2] Frontend: Production Build (Vite) ==="
npm run build

echo ""
echo "✅ TASK 3.4 VERIFIED SUCCESSFULLY"
