#!/usr/bin/env bash
# HelmADE Task 2.3 — Layouts de Grelha Tiled (1x1 a 4x4) e Zoom/Maximizar em 1 Toque Verification
set -euo pipefail

cd "$(dirname "$0")/.."

# Auto-carregar toolchain Rust caso esteja no caminho padrão ~/.cargo/bin
if [ -f "$HOME/.cargo/env" ]; then
  # shellcheck source=/dev/null
  source "$HOME/.cargo/env"
elif [ -d "$HOME/.cargo/bin" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi

echo "=== [1/4] Frontend: Typecheck ==="
npm run typecheck

echo ""
echo "=== [2/4] Frontend: Production Build ==="
npm run build

echo ""
echo "=== [3/4] Backend: Rust Cargo Check ==="
python3 scripts/generate-dev-icons.py
cd src-tauri
cargo check --verbose
cd ..

echo ""
echo "=== [4/4] Validação de Ficheiros de Layout de Grelha Tiled (Módulo 3) ==="
test -f src/stores/useGridLayoutStore.ts
test -f src/components/grid/GridLayoutControls.tsx
test -f src/components/grid/TiledTerminalGrid.tsx
test -f src/components/grid/index.ts
echo "✅ Todos os componentes e contratos da grelha foram localizados."

echo ""
echo "✅ TASK 2.3 VERIFIED SUCCESSFULLY"
echo "Commit sugerido:"
echo "  git add package.json src/ scripts/ docs/ .superpowers/"
echo "  git commit -m \"feat(grid): implement tiled grid layouts and one-touch maximize zoom\""
