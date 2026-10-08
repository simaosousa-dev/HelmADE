#!/usr/bin/env bash
set -euo pipefail

echo "=== Executing Atomic Commit for Task 3.1 (Conventional Commits 1.0.0) ==="

git add \
  src-tauri/src/agents/ \
  src-tauri/src/commands/agents.rs \
  src-tauri/src/commands/mod.rs \
  src-tauri/src/lib.rs \
  src/types/agent.ts \
  src/services/agentRegistry.ts \
  scripts/verify-task-3.1.sh \
  scripts/commit-task-3.1.sh \
  docs/superpowers/plans/2026-10-08-task-3.1-agent-persona-scanner.md \
  docs/project-brain.md

git commit -m "feat(agents): build local md persona scanner and yaml metadata parser"

COMMIT_HASH=$(git rev-parse --short HEAD)
echo "=== Task 3.1 committed successfully: $COMMIT_HASH ==="
git log -1 --oneline

echo "=== Closing GitHub Issue #44 ==="
if command -v gh >/dev/null 2>&1; then
  gh issue close 44 --repo SS20112006/HelmADE --comment "✅ **Concluído**: Parser e scanner de personas .md implementados com testes unitários em Rust e serviço TypeScript integrado (commit ${COMMIT_HASH})." || echo "Warning: gh issue close failed or not authenticated."
else
  echo "Warning: gh CLI not installed or not in PATH."
fi

git status
