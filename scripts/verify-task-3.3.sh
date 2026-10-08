#!/usr/bin/env bash
# HelmADE Task 3.3 — Protocolo de Troca de Mensagens Inter-Agentes A2A & Espelhamento Verification
set -euo pipefail

cd "$(dirname "$0")/.."

# Auto-carregar toolchain Rust caso esteja no caminho padrão ~/.cargo/bin
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
elif [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

echo "=== [1/4] Frontend: Typecheck (Strict TS) ==="
npm run typecheck

echo ""
echo "=== [2/4] Frontend: Production Build (Vite) ==="
npm run build

echo ""
echo "=== [3/4] Backend: Rust Cargo Check ==="
python3 scripts/generate-dev-icons.py
cd src-tauri
cargo check --verbose

echo ""
echo "=== [4/4] Backend: Rust Unit Tests (A2A Protocol & Message Router) ==="
cargo test agents -- --nocapture
cd ..

echo ""
echo "✅ TASK 3.3 VERIFIED SUCCESSFULLY"
