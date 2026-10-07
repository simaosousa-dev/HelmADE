#!/usr/bin/env bash
# HelmADE Task 2.4 — Cabeçalhos Semânticos, Badges de Cor e Indicadores de Estado (Módulo 3) Verification
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
echo "=== [4/4] Validação de Ficheiros e Contratos Semânticos (Task 2.4) ==="
test -f src/types/terminal.ts
test -f src/stores/useGridLayoutStore.ts
test -f src/components/terminal/TerminalStatusBadge.tsx
test -f src/components/terminal/TerminalHeader.tsx
test -f src/components/terminal/index.ts
test -f src/components/grid/TiledTerminalGrid.tsx

grep -q "TerminalPanelColor" src/types/terminal.ts
grep -q "AgentRoleType" src/types/terminal.ts
grep -q "updatePanelTitle" src/stores/useGridLayoutStore.ts
grep -q "updatePanelColor" src/stores/useGridLayoutStore.ts
grep -q "updatePanelStatus" src/stores/useGridLayoutStore.ts
grep -q "TerminalStatusBadge" src/components/terminal/index.ts
grep -q "TerminalHeader" src/components/terminal/index.ts
grep -q "TerminalHeader" src/components/grid/TiledTerminalGrid.tsx

echo "✅ Todos os componentes semânticos, tipos e contratos da Task 2.4 foram localizados e validados."

echo ""
echo "✅ TASK 2.4 VERIFIED SUCCESSFULLY"
echo "Commit sugerido:"
echo "  git add package.json src/ scripts/ docs/ .superpowers/"
echo "  git commit -m \"feat(terminal): add semantic terminal panel headers, color badges and reactive status indicators\""
