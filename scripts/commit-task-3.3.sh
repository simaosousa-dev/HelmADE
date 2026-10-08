#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 3.3 (Conventional Commits 1.0.0) ==="

git add \
  src-tauri/src/agents/protocol.rs \
  src-tauri/src/agents/router.rs \
  src-tauri/src/agents/mod.rs \
  src-tauri/src/commands/message.rs \
  src-tauri/src/commands/mod.rs \
  src-tauri/src/lib.rs \
  src/services/a2aProtocol.ts \
  scripts/verify-task-3.3.sh \
  scripts/commit-task-3.3.sh \
  docs/project-brain.md

git commit -m "feat(a2a): implement inter-agent message router and terminal visual mirroring"

COMMIT_HASH=$(git rev-parse --short HEAD)
echo "=== Task 3.3 committed successfully: $COMMIT_HASH ==="
git log -1 --oneline

echo "=== Closing GitHub Issue #46 ==="
if command -v gh >/dev/null 2>&1; then
  gh issue close 46 --repo SS20112006/HelmADE --comment "✅ **Concluído**: Protocolo de Troca de Mensagens Inter-Agentes A2A & Espelhamento (Módulo 5) implementado com sucesso (commit ${COMMIT_HASH}). Router IPC com bounded ring buffers, espelhamento visual bidirecional com marcadores ANSI nos terminais e store TypeScript reativo validados por QA com testes unitários em Rust e build verde." || echo "Warning: gh issue close failed or not authenticated."
else
  echo "Warning: gh CLI not installed or not in PATH."
fi

git status
