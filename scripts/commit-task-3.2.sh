#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 3.2 (Conventional Commits 1.0.0) ==="

git add \
  src/config/swarmPresets.ts \
  src/stores/useSwarmStore.ts \
  src/services/swarmLauncher.ts \
  src/components/swarm/ \
  src/App.tsx \
  scripts/verify-task-3.2.sh \
  scripts/commit-task-3.2.sh \
  docs/superpowers/plans/2026-10-08-task-3.2-swarm-presets.md \
  docs/ROADMAP.md \
  docs/project-brain.md

git commit -m "feat(swarm): implement 1-click swarm preset catalog and transparent context injection"

COMMIT_HASH=$(git rev-parse --short HEAD)
echo "=== Task 3.2 committed successfully: $COMMIT_HASH ==="
git log -1 --oneline

echo "=== Closing GitHub Issue #45 ==="
if command -v gh >/dev/null 2>&1; then
  gh issue close 45 --repo SS20112006/HelmADE --comment "✅ **Concluído**: Modelos de Enxame com 1 Clique (Swarm Presets), store reativo useSwarmStore, swarmLauncher coordenado e seletor modal Apple HIG implementados e integrados no cockpit (commit ${COMMIT_HASH})." || echo "Warning: gh issue close failed or not authenticated."
else
  echo "Warning: gh CLI not installed or not in PATH."
fi

git status
