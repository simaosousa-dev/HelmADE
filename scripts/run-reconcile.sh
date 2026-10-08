#!/usr/bin/env bash
# ==============================================================================
# run-reconcile.sh
# Executa a reconciliação do backlog de Strike Teams do HelmADE via Python 3
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== A executar Reconciliação do Backlog com Strike Teams (Python 3) ==="
python3 scripts/reconcile-strike-teams-backlog.py
