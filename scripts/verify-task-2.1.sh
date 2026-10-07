#!/usr/bin/env bash
# HelmADE Task 2.1 — High-Throughput PTY Multiplexer & Circular Ring Buffer Verification
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

echo ""
echo "=== [4/4] Backend: Rust Unit & Concurrency Tests (RingBuffer & PTY Multiplexer) ==="
cargo test terminal:: -- --nocapture
cd ..

echo ""
echo "✅ TASK 2.1 VERIFIED SUCCESSFULLY"
echo "Commit sugerido:"
echo "  git add src-tauri/ src/ scripts/ docs/ .superpowers/"
echo "  git commit -m \"feat(pty): build high-throughput pty multiplexer and ring buffer in rust\""
