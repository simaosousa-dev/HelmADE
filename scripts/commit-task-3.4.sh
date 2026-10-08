#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 3.4 (Conventional Commits 1.0.0) ==="

git add \
  src/App.tsx \
  src/components/grid/TiledTerminalGrid.tsx \
  src/components/swarm/SwarmPresetSelector.tsx \
  src/components/terminal/TerminalHeader.tsx \
  src/components/a2a/ \
  src/hooks/useA2AMessages.ts \
  src/stores/useA2AStore.ts \
  src/types/a2a.ts \
  src/types/message.ts \
  docs/project-brain.md \
  scripts/verify-task-3.4.sh \
  scripts/commit-task-3.4.sh

git commit -m "feat(ui): build team wire realtime agent communication feed sidebar"

COMMIT_HASH=$(git rev-parse --short HEAD)
echo "=== Task 3.4 committed successfully: $COMMIT_HASH ==="
git log -1 --stat

echo "=== Closing GitHub Issue for Task 3.4 ==="
if command -v gh >/dev/null 2>&1; then
  gh issue close 47 --repo SS20112006/HelmADE --comment "✅ **Concluído**: Painel Lateral \"Team Wire\" (Feed de Chat dos IAs) (Módulo 5) implementado com sucesso (commit ${COMMIT_HASH}). Feed em tempo real com auto-scroll inteligente, avatares semânticos por agente, chips de intenção, filtros de canal e conformidade rigorosa Apple HIG." || echo "Warning: gh issue close failed or not authenticated."
else
  echo "Warning: gh CLI not installed or not in PATH."
fi

git status
