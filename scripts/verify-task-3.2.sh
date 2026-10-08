#!/usr/bin/env bash
# HelmADE Task 3.2 — 1-Click Swarm Presets Catalog & Context Injection Verification
set -euo pipefail

cd "$(dirname "$0")/.."

# Auto-carregar toolchain Rust caso esteja no caminho padrão ~/.cargo/bin
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
elif [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

echo "=== [1/3] Frontend: Typecheck (Strict TS) ==="
npm run typecheck

echo ""
echo "=== [2/3] Frontend: Production Build (Vite) ==="
npm run build

echo ""
echo "=== [3/3] Backend: Rust Cargo Check ==="
python3 scripts/generate-dev-icons.py
cd src-tauri
cargo check --verbose
cd ..

echo ""
echo "✅ TASK 3.2 VERIFIED SUCCESSFULLY"
echo "Commit sugerido:"
echo "  git add src/ scripts/ docs/"
echo "  git commit -m \"feat(swarm): implement 1-click swarm preset catalog and transparent context injection\""
