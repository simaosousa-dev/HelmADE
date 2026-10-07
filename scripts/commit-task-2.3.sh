#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 2.3 (Conventional Commits 1.0.0) ==="

git add \
  src/stores/useGridLayoutStore.ts \
  src/components/grid \
  scripts/verify-task-2.3.sh \
  docs/superpowers/plans/2026-10-07-task-2.3-tiled-grid.md \
  docs/project-brain.md \
  scripts/sync-completed-issues.sh \
  scripts/reconcile-all-issues.sh

git commit -m "feat(grid): implement tiled grid layouts and one-touch maximize zoom"

echo "=== Task 2.3 commit completed successfully! ==="
git status
