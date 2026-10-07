#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commits (Conventional Commits 1.0.0) ==="

# 1. docs(adr)
echo "Commit 1/4: docs(adr)..."
git add \
  docs/adr/2026-10-07-0005-pty-multiplexing-ring-buffer.md \
  docs/superpowers/plans/2026-10-07-task-2.1-pty-multiplexer.md \
  docs/superpowers/plans/2026-10-07-task-2.2-xterm-webgl.md \
  docs/superpowers/plans/2026-10-07-task-2.3-tiled-grid.md \
  docs/project-brain.md
git commit -m "docs(adr): document pty multiplexing and add task implementation plans"

# 2. feat(pty)
echo "Commit 2/4: feat(pty)..."
git add \
  src-tauri/Cargo.toml \
  Cargo.lock \
  src-tauri/src/terminal \
  src-tauri/src/commands/terminal.rs \
  src-tauri/src/commands/mod.rs \
  src-tauri/src/lib.rs \
  scripts/verify-task-2.1.sh
git commit -m "feat(pty): build high-throughput pty multiplexer and ring buffer in rust"

# 3. feat(terminal)
echo "Commit 3/4: feat(terminal)..."
git add \
  package.json \
  src/components/terminal \
  src/services/terminalService.ts \
  src/types/terminal.ts \
  src/types/xterm.d.ts \
  scripts/verify-task-2.2.sh
git commit -m "feat(terminal): integrate xterm webgl wrapper with auto-resizing and truecolor"

# 4. chore(git)
echo "Commit 4/4: chore(git)..."
git add \
  .gitignore \
  AGENTS.md \
  scripts/commit-task-2-atomic.sh
git commit -m "chore(git): update gitignore for tsbuildinfo and stage agents configuration"

echo "=== All 4 atomic commits executed successfully! ==="
git status
