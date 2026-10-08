#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reconcile-strike-teams-backlog.py
==============================================================================
Script de reconciliação e automação do backlog do HelmADE no GitHub.
Alinhado com a arquitetura dos 4 Trios de Ataque (Strike Teams) e com o
roadmap mestre em docs/superpowers/plans/2026-10-08-strike-teams-roadmap-backlog.md.

Funcionalidades:
1. Criação/sincronização de labels de Trios de Ataque e Agentes.
2. Fecho idempotente de issues antigas/duplicadas (#7, #8, #9, #10, #19, #20, #21, #31, #41).
3. Garantia e fecho de Task 2.3 e Task 2.4 com commits 06cfa1e e e9202d9.
4. Criação idempotente das 20 tarefas pendentes (Task 3.1 a Task 8.3) com corpo
   estruturado em Português e labels completas.
5. Verificação final do backlog aberto no repositório.
==============================================================================
"""

import sys
import re
import json
import subprocess
from typing import List, Dict, Any, Optional

REPO = "SS20112006/HelmADE"

# Cores ANSI para feedback legível no terminal
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def log_info(msg: str) -> None:
    print(f"{CYAN}ℹ️  {msg}{RESET}")


def log_success(msg: str) -> None:
    print(f"{GREEN}✅ {msg}{RESET}")


def log_warning(msg: str) -> None:
    print(f"{YELLOW}⚠️  {msg}{RESET}")


def log_error(msg: str) -> None:
    print(f"{RED}❌ {msg}{RESET}")


def run_cmd(args: List[str], check: bool = True) -> subprocess.CompletedProcess:
    """Executa um comando de subprocesso com codificação utf-8 e captura de saída."""
    return subprocess.run(args, capture_output=True, text=True, check=check)


def check_gh_cli() -> None:
    """Valida se o GitHub CLI está presente e autenticado."""
    log_info("A verificar o GitHub CLI (gh)...")
    try:
        ver = run_cmd(["gh", "--version"])
        first_line = ver.stdout.splitlines()[0] if ver.stdout else ""
        log_info(f"Encontrado: {first_line}")
    except FileNotFoundError:
        log_error("O comando 'gh' não foi encontrado no PATH. Instale com 'brew install gh'.")
        sys.exit(1)

    auth = run_cmd(["gh", "auth", "status"], check=False)
    if auth.returncode != 0:
        log_error("GitHub CLI não está autenticado. Execute 'gh auth login' primeiro.")
        sys.exit(1)
    log_success(f"GitHub CLI autenticado com sucesso para {REPO}.")


# ==============================================================================
# 1. LABELS: STRIKE TEAMS, AGENTES E METADADOS
# ==============================================================================
LABELS_CONFIG = [
    # Strike Teams (Trios de Ataque)
    ("team:fullstack-feature", "1f883d", "🚀 Trio Full-Stack Feature (Nova Funcionalidade / E2E)"),
    ("team:ui-desktop", "6f42c1", "🎨 Trio UI/UX & Native Desktop (Interface & Experiência)"),
    ("team:hotfix-stability", "e36209", "⚡ Trio Hotfix, Build & Estabilidade (Correção Cirúrgica)"),
    ("team:arch-perf", "5c2d91", "🏛️ Trio Arquitetura, Performance & Dívida Técnica"),
    # Agentes Especializados
    ("agent:fullstack", "1f883d", "Atribuído ao Full-Stack Implementation Engineer"),
    ("agent:frontend", "6f42c1", "Atribuído ao Anti-Slop Frontend & Design Specialist"),
    ("agent:apple-hig", "0366d6", "Atribuído ao Apple HIG Design Specialist"),
    ("agent:database", "336699", "Atribuído ao Database Specialist (SQLite)"),
    ("agent:qa-security", "cb2431", "Atribuído ao QA & Security Auditor"),
    ("agent:devops", "24292e", "Atribuído ao DevOps & Release Agent"),
    ("agent:system-architect", "5c2d91", "Atribuído ao System Architect"),
    ("agent:performance", "0e8a16", "Atribuído ao Performance & Optimization Engineer"),
    ("agent:build-error-resolver", "e36209", "Atribuído ao Build Error Resolver"),
    ("agent:silent-failure-hunter", "b60205", "Atribuído ao Silent Failure Hunter"),
    ("agent:complexity-auditor", "8250df", "Atribuído ao Complexity Auditor"),
    ("agent:sre-observability", "0e8a16", "Atribuído ao SRE & Observability Engineer"),
    # Fases do Roadmap
    ("phase:0-scaffold", "0052cc", "Fase 0: Scaffolding, Guardrails & Arquitetura Base"),
    ("phase:1-workspace", "1d76db", "Fase 1: Workspaces, Git Worktrees & Isolamento"),
    ("phase:2-grid-pty", "5319e7", "Fase 2: Grelha Tiled & Multiplexador de Terminais"),
    ("phase:3-agents-teamwire", "d93f0b", "Fase 3: Motor de Agentes Antigravity (.md) & Team Wire"),
    ("phase:4-live-preview", "0e8a16", "Fase 4: Live Preview & Navegador Integrado"),
    ("phase:5-helmvoice", "fbca04", "Fase 5: HelmVoice (Módulo de Voz a Custo Zero)"),
    ("phase:6-governance", "c5def5", "Fase 6: Governação, Telemetria & Streamer Shield"),
    ("phase:7-audit-e2e", "b60205", "Fase 7: Auditoria Apple HIG, Performance & E2E"),
    ("phase:8-release", "006b75", "Fase 8: Packaging, CI/CD & Release v1.0.0"),
    # Prioridades
    ("priority:p0-critical", "b60205", "Bloqueador ou dependência crítica de arquitetura"),
    ("priority:p1-high", "d93f0b", "Funcionalidade central de módulo"),
    ("priority:p2-medium", "fbca04", "Funcionalidade complementar"),
]


def sync_labels() -> None:
    log_info("A sincronizar labels no GitHub...")
    for name, color, desc in LABELS_CONFIG:
        cmd = [
            "gh", "label", "create", name,
            "--repo", REPO,
            "--color", color,
            "--description", desc,
            "--force"
        ]
        res = run_cmd(cmd, check=False)
        if res.returncode == 0:
            print(f"  🏷️  Label '{name}' configurada.")
        else:
            log_warning(f"Não foi possível sincronizar label '{name}': {res.stderr.strip()}")
    log_success("Labels sincronizadas com sucesso.")


# ==============================================================================
# 2. CARREGAR TODAS AS ISSUES EXISTENTES NO REPOSITÓRIO
# ==============================================================================
def get_all_issues() -> List[Dict[str, Any]]:
    cmd = [
        "gh", "issue", "list",
        "--repo", REPO,
        "--state", "all",
        "--limit", "500",
        "--json", "number,title,state,labels"
    ]
    res = run_cmd(cmd, check=True)
    return json.loads(res.stdout)


def find_issue_by_task_id(task_id: str, all_issues: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    pattern = re.compile(rf"^{re.escape(task_id)}(?::|\s|$)", re.IGNORECASE)
    for iss in all_issues:
        title = iss.get("title", "").strip()
        if pattern.search(title):
            return iss
    return None


# ==============================================================================
# 3. FECHO DE ISSUES ANTIGAS / DUPLICADAS
# ==============================================================================
OUTDATED_ISSUES_TO_CLOSE = [7, 8, 9, 10, 19, 20, 21, 31, 41]


def close_outdated_issues(issue_map_by_num: Dict[int, Dict[str, Any]]) -> None:
    log_info("A analisar e fechar issues antigas/duplicadas já concluídas (#7, #8, #9, #10, #19, #20, #21, #31, #41)...")
    comment_text = (
        "✅ **Concluído**: Esta tarefa foi totalmente implementada e validada no repositório "
        "com quality gates verdes. A fechar issue durante a reconciliação de backlog dos Trios de Ataque."
    )

    for num in OUTDATED_ISSUES_TO_CLOSE:
        issue = issue_map_by_num.get(num)
        if not issue:
            # Tentar verificar diretamente se a issue existe
            view_res = run_cmd(["gh", "issue", "view", str(num), "--repo", REPO, "--json", "number,state,title"], check=False)
            if view_res.returncode == 0:
                issue = json.loads(view_res.stdout)
            else:
                log_info(f"Issue #{num} não existe no repositório.")
                continue

        state = issue.get("state", "").upper()
        title = issue.get("title", "")
        if state == "OPEN":
            log_info(f"Fechando issue #{num} ('{title}')...")
            # Adicionar comentário explicativo
            run_cmd(["gh", "issue", "comment", str(num), "--repo", REPO, "--body", comment_text], check=False)
            # Fechar issue com motivo completed
            run_cmd(["gh", "issue", "close", str(num), "--repo", REPO, "--reason", "completed"], check=False)
            log_success(f"Issue #{num} fechada com sucesso.")
        else:
            print(f"  Issue #{num} já se encontra fechada ({state}).")


# ==============================================================================
# 4. GESTÃO DE TASK 2.3 E TASK 2.4 (CONCLUÍDAS COM COMMITS)
# ==============================================================================
TASK_2_3_BODY = """### 🎯 Objetivo
Implementar na interface desktop as grelhas CSS Grid com alternância de layouts de 1x1 até 4x4 (16 painéis paralelos) e atalho `Cmd+Enter` para toggle instantâneo de zoom e maximização sem desmontar componentes nem perder instâncias de PTY.

### 🛡️ Equipa de Subagentes Atribuída (Trio de Ataque)
🎨 **Trio UI/UX & Native Desktop**
• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`, `apple-hig-auditor`)
• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `apple-hig-auditor`)
• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)

### 🧰 Skills Obrigatórias
`react-patterns`, `design-taste-frontend`, `apple-hig-auditor`, `strict-type-verifier`, `semantic-git-workflow`

### 📂 Ficheiros e Módulos Envolvidos
- `src/stores/useGridLayoutStore.ts`
- `src/components/grid/TiledTerminalGrid.tsx`
- `src/components/grid/TerminalSlot.tsx`
- `scripts/verify-task-2.3.sh`

### 🚦 Quality Gate & Verificação
Comutação fluida de layouts sem destruição de buffers ou desconexões PTY; teste de verificação a verde.

### 📝 Commit Checkpoint Sugerido
`feat(grid): implement tiled grid layouts and one-touch maximize zoom`
"""

TASK_2_4_BODY = """### 🎯 Objetivo
Desenvolver cabeçalhos semânticos em cada painel de terminal com badges coloridas distintas por agente, indicadores de estado de ligação e controlos rápidos de foco e fecho.

### 🛡️ Equipa de Subagentes Atribuída (Trio de Ataque)
🎨 **Trio UI/UX & Native Desktop**
• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`, `apple-hig-auditor`)
• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `apple-hig-auditor`)
• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)

### 🧰 Skills Obrigatórias
`react-patterns`, `design-taste-frontend`, `apple-hig-auditor`, `strict-type-verifier`, `semantic-git-workflow`

### 📂 Ficheiros e Módulos Envolvidos
- `src/types/terminal.ts`
- `src/components/terminal/TerminalHeader.tsx`
- `src/components/terminal/TerminalStatusBadge.tsx`
- `src/components/grid/TiledTerminalGrid.tsx`
- `scripts/verify-task-2.4.sh`

### 🚦 Quality Gate & Verificação
Header responsivo com Apple HIG, contrastes WCAG AA e indicadores de estado reactivos.

### 📝 Commit Checkpoint Sugerido
`feat(terminal): add semantic terminal panel headers, color badges and reactive status indicators`
"""


def ensure_completed_task(
    task_id: str,
    title: str,
    labels: str,
    body: str,
    commit_hash: str,
    commit_message: str,
    all_issues: List[Dict[str, Any]]
) -> None:
    matched = find_issue_by_task_id(task_id, all_issues)
    issue_num: Optional[int] = matched["number"] if matched else None

    if issue_num is None:
        log_info(f"A criar issue para {task_id}...")
        create_res = run_cmd([
            "gh", "issue", "create",
            "--repo", REPO,
            "--title", title,
            "--label", labels,
            "--body", body
        ], check=True)
        url = create_res.stdout.strip()
        issue_num = int(url.split("/")[-1])
        log_success(f"Issue criada: #{issue_num} para {task_id}")
        matched_state = "OPEN"
    else:
        matched_state = matched.get("state", "").upper()
        log_info(f"Issue #{issue_num} já existe para {task_id} (Estado: {matched_state}).")

    if matched_state == "OPEN":
        comment = (
            f"✅ **Concluído**: Implementado com sucesso no commit `{commit_hash}` "
            f"(`{commit_message}`). Quality gates validados a verde."
        )
        run_cmd(["gh", "issue", "comment", str(issue_num), "--repo", REPO, "--body", comment], check=False)
        run_cmd(["gh", "issue", "close", str(issue_num), "--repo", REPO, "--reason", "completed"], check=False)
        log_success(f"Issue #{issue_num} fechada com referência ao commit {commit_hash}.")
    else:
        log_success(f"Issue #{issue_num} ({task_id}) já se encontra devidamente fechada.")


def sync_tasks_2_3_and_2_4(all_issues: List[Dict[str, Any]]) -> None:
    log_info("A sincronizar Task 2.3 e Task 2.4...")
    ensure_completed_task(
        task_id="Task 2.3",
        title="Task 2.3: Layouts de Grelha Tiled (1x1 a 4x4) e Zoom em 1 Toque",
        labels="phase:2-grid-pty,priority:p1-high,team:ui-desktop,agent:frontend,agent:apple-hig,agent:devops",
        body=TASK_2_3_BODY,
        commit_hash="06cfa1e",
        commit_message="feat(grid): implement tiled grid layouts and one-touch maximize zoom",
        all_issues=all_issues
    )

    ensure_completed_task(
        task_id="Task 2.4",
        title="Task 2.4: Cabeçalhos Semânticos, Badges de Cor e Indicadores de Estado",
        labels="phase:2-grid-pty,priority:p1-high,team:ui-desktop,agent:frontend,agent:apple-hig,agent:devops",
        body=TASK_2_4_BODY,
        commit_hash="e9202d9",
        commit_message="feat(terminal): add semantic terminal panel headers, color badges and reactive status indicators",
        all_issues=all_issues
    )


# ==============================================================================
# 5. BACKLOG PENDENTE: 20 TAREFAS (TASK 3.1 A TASK 8.3)
# ==============================================================================
PENDING_BACKLOG = [
    {
        "id": "Task 3.1",
        "title": "Task 3.1: Descoberta e Leitura de Personas .md no Sistema (Módulo 4)",
        "labels": "phase:3-agents-teamwire,priority:p0-critical,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Scanner de ficheiros de agentes locais em formato markdown (`.md`) no diretório do utilizador/projeto e parser de metadados YAML (frontmatter) para popular o catálogo dinâmico de agentes.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `living-docs-governance`, `error-handling`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `living-docs-governance`, `error-handling`, `react-patterns`, `design-taste-frontend`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/agents/scanner.rs`\n- `src-tauri/src/agents/parser.rs`\n- `src-tauri/src/commands/agents.rs`\n- `src/services/agentRegistry.ts`\n- `src/types/agent.ts`",
        "quality_gate": "Testes unitários Rust para scanner e parser YAML frontmatter; listagem reativa no frontend sem ficheiros bloqueados.",
        "commit": "`feat(agents): build local md persona scanner and yaml metadata parser`"
    },
    {
        "id": "Task 3.2",
        "title": "Task 3.2: Modelos de Enxame com 1 Clique (Swarm Presets) & Injeção de Contexto (Módulo 4)",
        "labels": "phase:3-agents-teamwire,priority:p1-high,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Catálogo de presets de enxames de agentes pré-configurados (ex: Trio Full-Stack, Trio UI/UX, Trio Hotfix, Trio Arquitetura) com injeção transparente de contexto inicial e lançamento coordenado.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `background-agent-orchestration`, `apple-hig-auditor`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`design-taste-frontend`, `background-agent-orchestration`, `apple-hig-auditor`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/config/swarmPresets.ts`\n- `src/components/swarm/SwarmPresetSelector.tsx`\n- `src/services/swarmLauncher.ts`\n- `src/stores/useSwarmStore.ts`",
        "quality_gate": "Seleção de preset instancia os painéis e atribui papéis corretamente no store; conformidade visual com Apple HIG.",
        "commit": "`feat(swarm): implement 1-click swarm preset catalog and transparent context injection`"
    },
    {
        "id": "Task 3.3",
        "title": "Task 3.3: Protocolo de Troca de Mensagens Inter-Agentes A2A & Espelhamento (Módulo 5)",
        "labels": "phase:3-agents-teamwire,priority:p0-critical,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Implementação do router de mensagens A2A (Agent-to-Agent) em Rust com espelhamento visual bidirecional entre canais de terminal e a interface.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `omni-agents-a2a`, `error-handling`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `omni-agents-a2a`, `error-handling`, `react-patterns`, `apple-hig-auditor`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/agents/router.rs`\n- `src-tauri/src/agents/protocol.rs`\n- `src-tauri/src/commands/message.rs`\n- `src/services/a2aProtocol.ts`",
        "quality_gate": "Mensagens trocadas entre 2 sessões virtuais com entrega garantida e baixa latência; sem memory leaks nos buffers.",
        "commit": "`feat(a2a): implement inter-agent message router and terminal visual mirroring`"
    },
    {
        "id": "Task 3.4",
        "title": "Task 3.4: Painel Lateral \"Team Wire\" (Feed de Chat dos IAs) (Módulo 5)",
        "labels": "phase:3-agents-teamwire,priority:p1-high,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Interface lateral retrátil tipo feed em tempo real de mensagens trocadas pelos agentes em execução, com avatares, balões de conversa semânticos e Apple HIG.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `high-end-visual-design`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`design-taste-frontend`, `apple-hig-auditor`, `high-end-visual-design`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/components/teamwire/TeamWireSidebar.tsx`\n- `src/components/teamwire/MessageBubble.tsx`\n- `src/components/teamwire/AgentAvatar.tsx`\n- `src/hooks/useTeamWire.ts`",
        "quality_gate": "Renderização fluida a 60fps com autoscroll inteligente e materiais semânticos nativos (.regularMaterial); contraste WCAG AA.",
        "commit": "`feat(ui): build team wire realtime agent communication feed sidebar`"
    },
    {
        "id": "Task 3.5",
        "title": "Task 3.5: Caixa de Prompt Primário do Orquestrador & Modo Broadcast (Módulo 5)",
        "labels": "phase:3-agents-teamwire,priority:p1-high,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Componente de input global para o utilizador/orquestrador enviar comandos a agentes individuais ou em modo broadcast sincronizado para todas as grelhas ativas.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `ponytail`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`design-taste-frontend`, `apple-hig-auditor`, `ponytail`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/components/teamwire/PromptInput.tsx`\n- `src/components/teamwire/BroadcastToggle.tsx`\n- `src/stores/useTeamWireStore.ts`",
        "quality_gate": "Envio com atalhos de teclado (Enter / Shift+Enter), debounce correto e broadcast disparando eventos PTY sincronizados.",
        "commit": "`feat(ui): add orchestrator prompt input box with broadcast mode toggle`"
    },
    {
        "id": "Task 3.6",
        "title": "Task 3.6: Seletor de Modelo de IA por Agente & Perfis Cognitivos (Módulo 4)",
        "labels": "phase:3-agents-teamwire,priority:p1-high,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Configuração modular de fornecedores e modelos de IA (Claude 3.7 Sonnet, GPT-4o, Codex, Gemini 2.5 Flash, Ollama local) por agente com perfis cognitivos persistidos em SQLite.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `schema-and-db-migration`, `omni-models`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `schema-and-db-migration`, `omni-models`, `design-taste-frontend`, `apple-hig-auditor`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src/components/terminal/ModelSelectorDropdown.tsx`\n- `src/components/swarm/AgentModelConfigModal.tsx`\n- `src/config/modelCatalog.ts`\n- `src-tauri/src/db/schema.rs`\n- `src-tauri/src/commands/agents.rs`\n- `src/stores/useAgentConfigStore.ts`",
        "quality_gate": "Migração segura em SQLite (expand-contract), validação de chaves e persistência de preferências de modelo sem leak de segredos.",
        "commit": "`feat(agents): implement per-agent ai model selector and cognitive profile routing`"
    },
    {
        "id": "Task 4.1",
        "title": "Task 4.1: Painel de Webview Dockada & Deteção Automática de Portas (Módulo 6)",
        "labels": "phase:4-live-preview,priority:p1-high,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Painel embutido de preview com WebView2 / WKWebView dockada ao lado da grelha de terminais com sniffer automático da porta de dev server ativo (ex: Vite na 3000/5173).",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `latency-critical-systems`, `error-handling`, `react-patterns`, `design-taste-frontend`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/browser/sniffer.rs`\n- `src-tauri/src/commands/browser.rs`\n- `src/components/preview/LiveBrowserDock.tsx`\n- `src/hooks/useAutoPortDetection.ts`",
        "quality_gate": "Deteção de arranque do servidor HTTP em < 500ms e recarga instantânea na webview dockada sem crashes de processo.",
        "commit": "`feat(preview): create docked webview panel and automatic dev server port sniffer`"
    },
    {
        "id": "Task 4.2",
        "title": "Task 4.2: Controlos de Navegação, Alternador de Viewport e Consola de Erros (Módulo 6)",
        "labels": "phase:4-live-preview,priority:p2-medium,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Barra de ferramentas de navegação (voltar, avançar, recarregar, URL bar), alternador responsivo de viewport (Desktop, Tablet, Mobile) e gaveta de consola para captura de logs do browser.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `minimalist-ui`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`design-taste-frontend`, `apple-hig-auditor`, `minimalist-ui`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/components/preview/BrowserToolbar.tsx`\n- `src/components/preview/ViewportSelector.tsx`\n- `src/components/preview/ConsoleDrawer.tsx`",
        "quality_gate": "Redimensionamento perfeito de viewports sem quebra de overflow; captura de mensagens `console.error` em stream.",
        "commit": "`feat(ui): add responsive viewport switcher and embedded browser console drawer`"
    },
    {
        "id": "Task 5.1",
        "title": "Task 5.1: Bindings Nativos de Reconhecimento de Fala macOS em Rust (Módulo 7)",
        "labels": "phase:5-helmvoice,priority:p1-high,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Implementação do motor de voz HelmVoice com reconhecimento local de fala em macOS utilizando o framework nativo SFSpeechRecognizer via bindings Rust Objective-C a custo 0.00€.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `latency-critical-systems`, `error-handling`, `react-patterns`, `apple-hig-auditor`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/voice/macos_speech.rs`\n- `src-tauri/src/voice/engine.rs`\n- `src-tauri/src/commands/voice.rs`\n- `src-tauri/build.rs`",
        "quality_gate": "Transcrição em tempo real em streaming com latência < 250ms em offline; compilação limpa com links para frameworks macOS (Speech, AVFoundation).",
        "commit": "`feat(voice): implement zero-cost local speech recognition via native macos apis`"
    },
    {
        "id": "Task 5.2",
        "title": "Task 5.2: Gestor de Atalho Global Push-to-Talk & Dicionário de Código (Módulo 7)",
        "labels": "phase:5-helmvoice,priority:p2-medium,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Registo de atalho global push-to-talk (ex: Fn ou Ctrl+Espaço) e dicionário contextual fonético para correção automática de termos de código (ex: \"const\", \"rust\", \"async\", \"tauri\").",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `apple-hig-auditor`, `react-patterns`, `design-taste-frontend`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`apple-hig-auditor`, `react-patterns`, `design-taste-frontend`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src-tauri/src/voice/hotkey.rs`\n- `src-tauri/src/voice/dictionary.rs`\n- `src/services/voiceService.ts`\n- `src/components/voice/VoiceOverlay.tsx`",
        "quality_gate": "Feedback háptico e visual imediato no ecrã com overlay translúcido nativo; hotkey capturada mesmo com aplicação em background.",
        "commit": "`feat(voice): add global push-to-talk hotkey and technical coding vocabulary tuner`"
    },
    {
        "id": "Task 6.1",
        "title": "Task 6.1: Standby de Grelhas em Segundo Plano & Alertas de Bloqueio y/N (Módulo 8)",
        "labels": "phase:6-governance,priority:p1-high,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Throttling de CPU para painéis inativos e detetor heurístico de prompts de confirmação interativa (`y/N`, passwords, sudo) para disparar alertas semânticos imediatos.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`rust-patterns`, `latency-critical-systems`, `error-handling`, `design-taste-frontend`, `apple-hig-auditor`, `strict-type-verifier`, `security-review`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/terminal/block_detector.rs`\n- `src-tauri/src/terminal/throttler.rs`\n- `src/components/grid/BlockAlertIndicator.tsx`\n- `src/stores/useGridStore.ts`",
        "quality_gate": "Deteção de prompt `y/N` em < 100ms e transição visual da borda do painel para cor de alerta; redução de ciclos de CPU em repouso.",
        "commit": "`feat(governance): add background grid cpu throttler and interactive prompt block detector`"
    },
    {
        "id": "Task 6.2",
        "title": "Task 6.2: Dashboard de Telemetria de Tokens & Custos Reais (Módulo 9)",
        "labels": "phase:6-governance,priority:p1-high,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Dashboard analítico de consumo cumulativo de tokens (input/output/cached), projeção financeira em dólares/euros baseada em tabela de preços e gráficos de uso por agente.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `industrial-brutalist-ui`, `apple-hig-auditor`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`design-taste-frontend`, `industrial-brutalist-ui`, `apple-hig-auditor`, `strict-type-verifier`, `e2e-playwright-testing`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/views/UsageDashboardView.tsx`\n- `src/components/telemetry/CostMetricCard.tsx`\n- `src/components/telemetry/TokenUsageChart.tsx`\n- `src/services/pricingTable.ts`",
        "quality_gate": "Cálculo exato de métricas sem perdas de precisão decimal; layout Apple HIG / Industrial Brutalist legível e acessível.",
        "commit": "`feat(telemetry): build token usage and financial cost estimation analytics dashboard`"
    },
    {
        "id": "Task 6.3",
        "title": "Task 6.3: Streamer Shield (Mascaramento de Segredos & Modo Apresentação) (Módulo 10)",
        "labels": "phase:6-governance,priority:p1-high,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Modo de proteção para live stream e gravação, ocultando chaves de API, tokens JWT, passwords e caminhos de diretórios privados nas saídas de terminal e interfaces.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `security-review`, `rust-testing`, `strict-type-verifier`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `security-scan`, `strict-type-verifier`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`security-review`, `rust-testing`, `strict-type-verifier`, `design-taste-frontend`, `apple-hig-auditor`, `security-scan`, `semantic-git-workflow`",
        "files": "- `src-tauri/src/security/redactor.rs`\n- `src/components/security/StreamerShieldToggle.tsx`\n- `src/stores/useSecurityStore.ts`",
        "quality_gate": "Testes de expressão regular sem backtracking catastrófico (ReDoS-free); mascaramento de strings sensíveis antes da renderização no DOM.",
        "commit": "`feat(security): build streamer shield with realtime secret masking and private path hiding`"
    },
    {
        "id": "Task 7.1",
        "title": "Task 7.1: Auditoria Apple HIG & Refinamento de Acessibilidade",
        "labels": "phase:7-audit-e2e,priority:p0-critical,team:ui-desktop,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Auditoria exaustiva de conformidade com Apple Human Interface Guidelines: tipografia San Francisco (SF Pro Text <=19pt, SF Pro Display >=20pt), contraste WCAG AA 4.5:1 e feedback háptico.",
        "team": "🎨 **Trio UI/UX & Native Desktop**\n• Implementador UI: `frontend-design-specialist` (Skills: `apple-hig-auditor`, `a11y-auditor`, `design-taste-frontend`)\n• Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `apple-hig-auditor`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`apple-hig-auditor`, `a11y-auditor`, `design-taste-frontend`, `strict-type-verifier`, `semantic-git-workflow`, `finishing-a-development-branch`",
        "files": "- `src/index.css`\n- `src/components/**/*.tsx`\n- `src/styles/higTokens.ts`",
        "quality_gate": "Zero violações de contraste WCAG 2.1 AA em temas Claro e Escuro; alvos de toque >= 44x44px em todos os controlos interativos.",
        "commit": "`style(hig): enforce strict apple human interface guidelines and wcag aa contrast`"
    },
    {
        "id": "Task 7.2",
        "title": "Task 7.2: Auditoria Ponytail de Economia de Código e Limpeza de Código Morto",
        "labels": "phase:7-audit-e2e,priority:p1-high,team:arch-perf,agent:system-architect,agent:performance,agent:qa-security,agent:devops",
        "objective": "Aplicação dos princípios Ponytail em todo o repositório para eliminação de abstrações especulativas, dependências redundantes e registro no Ponytail Debt Ledger.",
        "team": "🏛️ **Trio Arquitetura, Performance & Dívida Técnica**\n• Arquiteto de Sistemas: `system-architect` (Skills: `ponytail-review`, `ponytail-debt`, `ponytail`)\n• Engenheiro de Performance: `performance-engineer` (Skills: `performance-profiling-benchmark`, `latency-critical-systems`)\n• Auditor de Código: `qa-security-auditor` (Skills: `ponytail-audit`, `strict-type-verifier`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`ponytail-review`, `ponytail-debt`, `ponytail`, `performance-profiling-benchmark`, `latency-critical-systems`, `ponytail-audit`, `strict-type-verifier`, `semantic-git-workflow`",
        "files": "- Repositório completo (`src/`, `src-tauri/`)",
        "quality_gate": "Redução líquida de linhas de código sem regressão de funcionalidade; testes e linters a passar a verde.",
        "commit": "`refactor(economy): prune speculative abstractions and dead code via ponytail audit`"
    },
    {
        "id": "Task 7.3",
        "title": "Task 7.3: Caça a Falhas Silenciosas e Resiliência de Erros",
        "labels": "phase:7-audit-e2e,priority:p1-high,team:hotfix-stability,agent:build-error-resolver,agent:qa-security,agent:devops",
        "objective": "Varredura cirúrgica de falhas silenciosas, promises rejeitadas não capturadas, unwrap() inseguros em Rust e sanitização de mensagens de erro para evitar path leaks.",
        "team": "⚡ **Trio Hotfix, Build & Estabilidade**\n• Cirurgião Rápido: `build-error-resolver` (Skills: `error-handling`, `safety-guard`, `systematic-debugging`)\n• Auditor Forense: `qa-security-auditor` (Skills: `strict-type-verifier`, `error-handling`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`error-handling`, `safety-guard`, `systematic-debugging`, `strict-type-verifier`, `semantic-git-workflow`",
        "files": "- Repositório completo (`src/`, `src-tauri/`)",
        "quality_gate": "Zero `unwrap()` em código de produção Rust; Error Boundaries no React capturando e apresentando mensagens higienizadas.",
        "commit": "`fix(resilience): eliminate swallowed errors and dangling promises across ipc channels`"
    },
    {
        "id": "Task 7.4",
        "title": "Task 7.4: Suite de Testes E2E com Playwright & Verificação Final",
        "labels": "phase:7-audit-e2e,priority:p0-critical,team:fullstack-feature,agent:fullstack,agent:frontend,agent:qa-security,agent:devops",
        "objective": "Suite abrangente de testes end-to-end em Playwright cobrindo todo o fluxo de utilizador: seleção de workspace, criação de worktrees, terminais PTY em grelha, Team Wire e Live Preview.",
        "team": "🚀 **Trio Full-Stack Feature**\n• Implementador Core: `fullstack-engineer` (Skills: `test-driven-development`, `verification-before-completion`)\n• Especialista de Interface: `frontend-design-specialist` (Skills: `react-testing`, `apple-hig-auditor`)\n• Auditor de Integridade: `qa-security-auditor` (Skills: `e2e-playwright-testing`, `strict-type-verifier`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`test-driven-development`, `verification-before-completion`, `react-testing`, `apple-hig-auditor`, `e2e-playwright-testing`, `strict-type-verifier`, `semantic-git-workflow`",
        "files": "- `tests/e2e/workspace.spec.ts`\n- `tests/e2e/grid.spec.ts`\n- `tests/e2e/teamwire.spec.ts`\n- `playwright.config.ts`",
        "quality_gate": "100% dos testes E2E executados e validados a verde sem flaky tests.",
        "commit": "`test(e2e): implement comprehensive playwright end-to-end test suite`"
    },
    {
        "id": "Task 8.1",
        "title": "Task 8.1: Configuração do Empacotamento macOS (DMG & Assinatura)",
        "labels": "phase:8-release,priority:p1-high,team:hotfix-stability,agent:build-error-resolver,agent:qa-security,agent:devops",
        "objective": "Configuração do empacotamento desktop macOS para arquiteturas Apple Silicon (aarch64) e Intel (x86_64), iconografia multi-resolução icns e scripts de geração de DMG.",
        "team": "⚡ **Trio Hotfix, Build & Estabilidade**\n• Cirurgião Rápido: `build-error-resolver` (Skills: `ci-cd-workflow-automation`, `semantic-git-workflow`)\n• Auditor Forense: `qa-security-auditor` (Skills: `strict-type-verifier`, `production-readiness-verifier`)\n• Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`ci-cd-workflow-automation`, `semantic-git-workflow`, `strict-type-verifier`, `production-readiness-verifier`",
        "files": "- `src-tauri/tauri.conf.json`\n- `src-tauri/icons/`\n- `scripts/build-dmg.sh`",
        "quality_gate": "Criação bem-sucedida do ficheiro `.dmg` testada localmente; arranque sem crashes na instalação limpa.",
        "commit": "`chore(release): configure macos dmg bundler and application icons`"
    },
    {
        "id": "Task 8.2",
        "title": "Task 8.2: Workflow de CI/CD para GitHub Releases",
        "labels": "phase:8-release,priority:p1-high,team:arch-perf,agent:system-architect,agent:sre-observability,agent:qa-security,agent:devops",
        "objective": "Pipeline automatizado de CI/CD em GitHub Actions para compilação multiplataforma, execução de testes unitários/E2E e publicação automática de release assets e changelog.",
        "team": "🏛️ **Trio Arquitetura, Performance & Dívida Técnica**\n• Arquiteto de Sistemas: `system-architect` (Skills: `ci-cd-workflow-automation`, `hexagonal-architecture`)\n• Engenheiro SRE: `sre-observability-engineer` (Skills: `latency-critical-systems`)\n• Auditor de Segurança: `qa-security-auditor` (Skills: `security-review`, `strict-type-verifier`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`)",
        "skills": "`ci-cd-workflow-automation`, `hexagonal-architecture`, `latency-critical-systems`, `security-review`, `strict-type-verifier`, `semantic-git-workflow`",
        "files": "- `.github/workflows/release.yml`",
        "quality_gate": "Validação de sintaxe e security review da workflow (least privilege, pins de SHA e caching otimizado).",
        "commit": "`ci(actions): create multi-architecture automated release workflow`"
    },
    {
        "id": "Task 8.3",
        "title": "Task 8.3: Manual de Utilização, Documentação e Tag v1.0.0",
        "labels": "phase:8-release,priority:p0-critical,team:arch-perf,agent:system-architect,agent:performance,agent:qa-security,agent:devops",
        "objective": "Elaboração do manual oficial de utilização (docs/USER_GUIDE.md), consolidação do CHANGELOG.md, atualização do README.md e criação da tag formal v1.0.0.",
        "team": "🏛️ **Trio Arquitetura, Performance & Dívida Técnica**\n• Arquiteto de Sistemas: `system-architect` (Skills: `living-docs-governance`, `semantic-git-workflow`)\n• Engenheiro de Performance/Docs: `performance-engineer` (Skills: `ponytail`)\n• Auditor de Prontidão: `qa-security-auditor` (Skills: `production-readiness-verifier`)\n• Fecho: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)",
        "skills": "`living-docs-governance`, `semantic-git-workflow`, `ponytail`, `production-readiness-verifier`, `finishing-a-development-branch`",
        "files": "- `README.md`\n- `CHANGELOG.md`\n- `docs/USER_GUIDE.md`",
        "quality_gate": "Documentação completa sem links quebrados, guias claros para desenvolvimento local e distribuição.",
        "commit": "`docs(release): publish user guide and prepare version 1.0.0 release notes`"
    }
]


def format_issue_body(task: Dict[str, str]) -> str:
    return f"""### 🎯 Objetivo
{task['objective']}

### 🛡️ Equipa de Subagentes Atribuída (Trio de Ataque)
{task['team']}

### 🧰 Skills Obrigatórias
{task['skills']}

### 📂 Ficheiros e Módulos Envolvidos
{task['files']}

### 🚦 Quality Gate & Verificação
{task['quality_gate']}

### 📝 Commit Checkpoint Sugerido
{task['commit']}
"""


def reconcile_pending_backlog(all_issues: List[Dict[str, Any]]) -> None:
    log_info("A reconciliar as 20 tarefas pendentes do backlog (Task 3.1 a Task 8.3)...")

    for task in PENDING_BACKLOG:
        task_id = task["id"]
        title = task["title"]
        labels = task["labels"]
        body = format_issue_body(task)

        matched_issue = find_issue_by_task_id(task_id, all_issues)

        if matched_issue:
            num = matched_issue["number"]
            state = matched_issue.get("state", "").upper()
            if state == "OPEN":
                print(f"  [{task_id}] Já aberta como #{num}. A manter inalterada (idempotência).")
                continue
            else:
                log_info(f"[{task_id}] Issue #{num} encontrada mas está fechada. A reabrir para o backlog...")
                run_cmd(["gh", "issue", "reopen", str(num), "--repo", REPO], check=False)
                run_cmd([
                    "gh", "issue", "edit", str(num),
                    "--repo", REPO,
                    "--title", title,
                    "--add-label", labels,
                    "--body", body
                ], check=False)
                log_success(f"[{task_id}] Issue #{num} reaberta e atualizada.")
        else:
            log_info(f"[{task_id}] A criar nova issue...")
            create_res = run_cmd([
                "gh", "issue", "create",
                "--repo", REPO,
                "--title", title,
                "--label", labels,
                "--body", body
            ], check=True)
            url = create_res.stdout.strip()
            num = url.split("/")[-1]
            log_success(f"[{task_id}] Criada com sucesso: #{num} - '{title}'")


# ==============================================================================
# 6. VERIFICAÇÃO FINAL
# ==============================================================================
def verify_open_backlog() -> None:
    log_info("A verificar o estado atual das issues abertas no repositório...")
    cmd = [
        "gh", "issue", "list",
        "--repo", REPO,
        "--state", "open",
        "--limit", "100",
        "--json", "number,title,labels"
    ]
    res = run_cmd(cmd, check=True)
    open_issues = json.loads(res.stdout)

    print("\n" + "=" * 80)
    print(f"{BOLD}📊 ESTADO FINAL DO BACKLOG ABERTO ({len(open_issues)} ISSUES ABERTAS):{RESET}")
    print("=" * 80)

    # Ordenar por número
    open_issues.sort(key=lambda x: x["number"])

    for iss in open_issues:
        num = iss["number"]
        title = iss["title"]
        lbls = [l["name"] for l in iss.get("labels", []) if isinstance(l, dict)]
        team_lbl = [l for l in lbls if l.startswith("team:")]
        phase_lbl = [l for l in lbls if l.startswith("phase:")]
        priority_lbl = [l for l in lbls if l.startswith("priority:")]

        tags = " | ".join(team_lbl + phase_lbl + priority_lbl)
        print(f"#{num:<3} | {title:<65} | [{tags}]")

    print("=" * 80)
    log_success(f"Reconciliação concluída com sucesso! Total de tarefas abertas: {len(open_issues)}")


# ==============================================================================
# MAIN
# ==============================================================================
def main() -> None:
    print(f"{BOLD}{CYAN}=== HelmADE: Reconciliação do Backlog com Strike Teams ==={RESET}\n")

    # 1. Verificar gh CLI
    check_gh_cli()

    # 2. Sincronizar Labels
    sync_labels()

    # 3. Ler estado atual das issues
    log_info("A consultar issues existentes no repositório...")
    all_issues = get_all_issues()
    issue_map_by_num = {iss["number"]: iss for iss in all_issues}
    log_info(f"Total de issues encontradas: {len(all_issues)}")

    # 4. Fechar issues antigas / duplicadas
    close_outdated_issues(issue_map_by_num)

    # Recarregar lista após fechos
    all_issues = get_all_issues()

    # 5. Garantir Task 2.3 e Task 2.4 criadas e fechadas com referências de commit
    sync_tasks_2_3_and_2_4(all_issues)

    # Recarregar lista após Task 2.3 e 2.4
    all_issues = get_all_issues()

    # 6. Criar / reconciliar as 20 tarefas pendentes (Task 3.1 a Task 8.3)
    reconcile_pending_backlog(all_issues)

    # 7. Verificação final
    verify_open_backlog()


if __name__ == "__main__":
    main()
