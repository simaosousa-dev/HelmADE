#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 2.4 (Conventional Commits 1.0.0) ==="

git add \
  src/types/terminal.ts \
  src/stores/useGridLayoutStore.ts \
  src/components/terminal/TerminalStatusBadge.tsx \
  src/components/terminal/TerminalHeader.tsx \
  src/components/terminal/index.ts \
  src/components/grid/TiledTerminalGrid.tsx \
  scripts/verify-task-2.4.sh \
  scripts/commit-task-2.4.sh \
  docs/superpowers/plans/2026-10-08-task-2.4-semantic-terminal-headers.md \
  docs/project-brain.md

git commit -m "feat(terminal): add semantic terminal panel headers, color badges and reactive status indicators"

echo "=== Task 2.4 commit completed successfully! ==="
git log -1 --oneline
git status
