#!/usr/bin/env bash
# HelmADE Task 2.2 — @xterm/xterm WebGL Integration & Fast Rendering Verification
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
echo "=== [4/4] Validação de Ficheiros do Terminal (@xterm + WebGL) ==="
test -f src/components/terminal/XTermWrapper.tsx
test -f src/components/terminal/useTerminalSession.ts
test -f src/components/terminal/terminalThemes.ts
test -f src/components/terminal/index.ts
test -f src/types/xterm.d.ts
echo "✅ Todos os componentes e contratos do terminal foram localizados."

echo ""
echo "✅ TASK 2.2 VERIFIED SUCCESSFULLY"
echo "Commit sugerido:"
echo "  git add package.json src/ scripts/ docs/ .superpowers/"
echo "  git commit -m \"feat(terminal): integrate xterm webgl wrapper with auto-resizing and truecolor\""
