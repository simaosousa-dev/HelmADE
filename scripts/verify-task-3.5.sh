#!/usr/bin/env bash
# HelmADE Task 3.5 — Caixa de Prompt Primário do Orquestrador & Modo Broadcast Verification
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== [1/2] Frontend: Typecheck (Strict TS) ==="
npm run typecheck

echo ""
echo "=== [2/2] Frontend: Production Build (Vite) ==="
npm run build

echo ""
echo "✅ TASK 3.5 VERIFIED SUCCESSFULLY"
