#!/usr/bin/env bash
# ==============================================================================
# commit-backlog-reconciliation.sh
# Atomic commit for Backlog Reconciliation & Strike Teams Governance
# Strictly complies with Conventional Commits 1.0.0 & Invariant Rules
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== Executing Atomic Commit for Backlog Reconciliation (Conventional Commits 1.0.0) ==="

# Staging designated artefacts atomically
git add \
  AGENTS.md \
  docs/superpowers/plans/2026-10-08-strike-teams-roadmap-backlog.md \
  scripts/reconcile-strike-teams-backlog.py \
  scripts/run-reconcile.sh \
  scripts/sync-completed-issues.sh \
  scripts/commit-backlog-reconciliation.sh

# Conventional Commits 1.0.0 commit
git commit -m "chore(backlog): reconcile roadmap issues with official strike teams and required skills"

echo "=== Backlog Reconciliation Commit Complete ==="
git log -1 --stat
git status -s
