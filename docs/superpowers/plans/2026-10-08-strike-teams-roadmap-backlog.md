# 📋 Backlog Mestre: Mapeamento de Tarefas para Trios de Ataque & Skills

> **Documento de Governação de Backlog — HelmADE v1.0**  
> Alinhado com o [docs/ROADMAP.md](file:///Users/simaosousa/HelmADE/docs/ROADMAP.md), [docs/project-brain.md](file:///Users/simaosousa/HelmADE/docs/project-brain.md) e as Diretrizes Globais de Orquestração.

---

## 🏛️ Os 4 Trios de Ataque Oficiais (Strike Teams)

| Trio de Ataque | Missão Principal | Composição da Equipa | Skills Nucleares |
| :--- | :--- | :--- | :--- |
| 🚀 **Trio Full-Stack Feature** | Novas funcionalidades E2E, serviços Rust, IPC, endpoints e reatividade | • Core: `fullstack-engineer`<br>• UI: `frontend-design-specialist`<br>• QA: `qa-security-auditor`<br>• Fecho: `devops-release` | `backend-patterns`, `test-driven-development`, `ponytail`, `schema-and-db-migration`, `design-taste-frontend`, `apple-hig-auditor`, `strict-type-verifier`, `semantic-git-workflow` |
| 🎨 **Trio UI/UX & Native Desktop** | Interfaces ricas, Apple HIG, micro-interações táteis e dashboards | • UI: `frontend-design-specialist`<br>• QA: `qa-security-auditor`<br>• Fecho: `devops-release` | `design-taste-frontend`, `design-system-catalog`, `apple-hig-auditor`, `minimalist-ui`, `high-end-visual-design`, `strict-type-verifier`, `e2e-playwright-testing` |
| ⚡ **Trio Hotfix, Build & Estabilidade** | Correções cirúrgicas, estabilidade de compilação, hunting de falhas e empacotamento | • Cirurgião: `build-error-resolver`<br>• QA Forense: `qa-security-auditor`<br>• Fecho: `devops-release` | `strict-type-verifier`, `systematic-debugging`, `error-handling`, `safety-guard`, `ci-cd-workflow-automation` |
| 🏛️ **Trio Arquitetura, Performance & Dívida Técnica** | Refactors estruturais, benchmarking de concorrência, auditorias Ponytail e CI/CD | • Arquiteto: `system-architect`<br>• Perf/SRE: `performance-engineer` / `sre-observability-engineer`<br>• Auditor: `qa-security-auditor`<br>• Fecho: `devops-release` | `architectural-decision-record`, `api-design-openapi`, `hexagonal-architecture`, `performance-profiling-benchmark`, `latency-critical-systems`, `ponytail-review`, `ponytail-audit` |

---

## 📌 Estado das Tarefas Concluídas (Fases 0 a 2)

* ✅ **Task 0.1**: Scaffolding do Monorepo Tauri 2 + React 19 + Tailwind v4 (`chore(scaffold)`)
* ✅ **Task 0.2**: Definição das ADRs Fundacionais 0001 a 0004 (`docs(adr)`)
* ✅ **Task 0.3**: Configuração de Guardrails de Qualidade e Commitlint (`ci(guardrails)`)
* ✅ **Task 1.1**: Persistência Local em SQLite & Gestão de Projetos (`feat(workspace)`)
* ✅ **Task 1.2**: Ecrã Inicial de Seleção de Projetos e Recentes (`feat(ui)`)
* ✅ **Task 1.3**: Gestor de Git Worktrees e Criação Isolada de Grelhas (`feat(git)`)
* ✅ **Task 1.4**: Gestor de Symlinks de Dependências com Zero Desperdício (`feat(git)`)
* ✅ **Task 1.5**: Alocador Dinâmico de Portas de Servidores Locais (`feat(network)`)
* ✅ **Task 1.6**: Interface de Revisão e Fusão Segura (Diff & Merge View) (`feat(ui)`)
* ✅ **Task 2.1**: Motor PTY Multiplexer em Rust com Buffer Circular (`feat(pty)`)
* ✅ **Task 2.2**: Integração do @xterm/xterm com WebGL e Renderização Rápida (`feat(terminal)`)
* ✅ **Task 2.3**: Layouts de Grelha Tiled (1x1 a 4x4) e Zoom em 1 Toque (`feat(grid)`)
* ✅ **Task 2.4**: Cabeçalhos Semânticos, Badges de Cor e Indicadores de Estado (`feat(terminal)`)

---

## 🚀 Backlog Ativo: Tarefas Pendentes (Fases 3 a 8)

### FASE 3: Módulo 4 & 5 — Motor de Agentes Antigravity (.md), Team Wire & Protocolo A2A

#### Task 3.1: Descoberta e Leitura de Personas `.md` no Sistema (Módulo 4)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `living-docs-governance`, `error-handling`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p0-critical`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/agents/scanner.rs`, `src-tauri/src/agents/parser.rs`, `src-tauri/src/commands/agents.rs`, `src/services/agentRegistry.ts`, `src/types/agent.ts`.
* **Commit**: `feat(agents): build local md persona scanner and yaml metadata parser`

#### Task 3.2: Modelos de Enxame com 1 Clique (Swarm Presets) & Injeção de Contexto (Módulo 4)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `background-agent-orchestration`, `apple-hig-auditor`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p1-high`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/config/swarmPresets.ts`, `src/components/swarm/SwarmPresetSelector.tsx`, `src/services/swarmLauncher.ts`, `src/stores/useSwarmStore.ts`.
* **Commit**: `feat(swarm): implement 1-click swarm preset catalog and transparent context injection`

#### Task 3.3: Protocolo de Troca de Mensagens Inter-Agentes A2A & Espelhamento (Módulo 5)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `omni-agents-a2a`, `error-handling`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p0-critical`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/agents/router.rs`, `src-tauri/src/agents/protocol.rs`, `src-tauri/src/commands/message.rs`, `src/services/a2aProtocol.ts`.
* **Commit**: `feat(a2a): implement inter-agent message router and terminal visual mirroring`

#### Task 3.4: Painel Lateral "Team Wire" (Feed de Chat dos IAs) (Módulo 5)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `high-end-visual-design`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p1-high`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/components/teamwire/TeamWireSidebar.tsx`, `src/components/teamwire/MessageBubble.tsx`, `src/components/teamwire/AgentAvatar.tsx`, `src/hooks/useTeamWire.ts`.
* **Commit**: `feat(ui): build team wire realtime agent communication feed sidebar`

#### Task 3.5: Caixa de Prompt Primário do Orquestrador & Modo Broadcast (Módulo 5)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `ponytail`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p1-high`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/components/teamwire/PromptInput.tsx`, `src/components/teamwire/BroadcastToggle.tsx`, `src/stores/useTeamWireStore.ts`.
* **Commit**: `feat(ui): add orchestrator prompt input box with broadcast mode toggle`

#### Task 3.6: Seletor de Modelo de IA por Agente & Perfis Cognitivos (Módulo 4)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `schema-and-db-migration`, `omni-models`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:3-agents-teamwire`, `priority:p1-high`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/components/terminal/ModelSelectorDropdown.tsx`, `src/components/swarm/AgentModelConfigModal.tsx`, `src/config/modelCatalog.ts`, `src-tauri/src/db/schema.rs`, `src-tauri/src/commands/agents.rs`, `src/stores/useAgentConfigStore.ts`.
* **Commit**: `feat(agents): implement per-agent ai model selector and cognitive profile routing`

---

### FASE 4: Módulo 6 — Live Preview & Navegador Integrado

#### Task 4.1: Painel de Webview Dockada & Deteção Automática de Portas (Módulo 6)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `design-taste-frontend`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:4-live-preview`, `priority:p1-high`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/browser/sniffer.rs`, `src-tauri/src/commands/browser.rs`, `src/components/preview/LiveBrowserDock.tsx`, `src/hooks/useAutoPortDetection.ts`.
* **Commit**: `feat(preview): create docked webview panel and automatic dev server port sniffer`

#### Task 4.2: Controlos de Navegação, Alternador de Viewport e Consola de Erros (Módulo 6)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`, `minimalist-ui`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:4-live-preview`, `priority:p2-medium`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/components/preview/BrowserToolbar.tsx`, `src/components/preview/ViewportSelector.tsx`, `src/components/preview/ConsoleDrawer.tsx`.
* **Commit**: `feat(ui): add responsive viewport switcher and embedded browser console drawer`

---

### FASE 5: Módulo 7 — HelmVoice: Módulo de Voz a Custo Zero (0.00€)

#### Task 5.1: Bindings Nativos de Reconhecimento de Fala macOS em Rust (Módulo 7)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `react-patterns`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:5-helmvoice`, `priority:p1-high`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/voice/macos_speech.rs`, `src-tauri/src/voice/engine.rs`, `src-tauri/src/commands/voice.rs`, `src-tauri/build.rs`.
* **Commit**: `feat(voice): implement zero-cost local speech recognition via native macos apis`

#### Task 5.2: Gestor de Atalho Global Push-to-Talk & Dicionário de Código (Módulo 7)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `apple-hig-auditor`, `react-patterns`, `design-taste-frontend`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:5-helmvoice`, `priority:p2-medium`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/voice/hotkey.rs`, `src-tauri/src/voice/dictionary.rs`, `src/services/voiceService.ts`, `src/components/voice/VoiceOverlay.tsx`.
* **Commit**: `feat(voice): add global push-to-talk hotkey and technical coding vocabulary tuner`

---

### FASE 6: Módulo 8, 9 & 10 — Governação, Telemetria & Streamer Shield

#### Task 6.1: Standby de Grelhas em Segundo Plano & Alertas de Bloqueio `y/N` (Módulo 8)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `rust-patterns`, `latency-critical-systems`, `error-handling`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `strict-type-verifier`, `security-review`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:6-governance`, `priority:p1-high`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/terminal/block_detector.rs`, `src-tauri/src/terminal/throttler.rs`, `src/components/grid/BlockAlertIndicator.tsx`, `src/stores/useGridStore.ts`.
* **Commit**: `feat(governance): add background grid cpu throttler and interactive prompt block detector`

#### Task 6.2: Dashboard de Telemetria de Tokens & Custos Reais (Módulo 9)
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `design-taste-frontend`, `industrial-brutalist-ui`, `apple-hig-auditor`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `e2e-playwright-testing`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:6-governance`, `priority:p1-high`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/views/UsageDashboardView.tsx`, `src/components/telemetry/CostMetricCard.tsx`, `src/components/telemetry/TokenUsageChart.tsx`, `src/services/pricingTable.ts`.
* **Commit**: `feat(telemetry): build token usage and financial cost estimation analytics dashboard`

#### Task 6.3: Streamer Shield (Mascaramento de Segredos & Modo Apresentação) (Módulo 10)
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `security-review`, `rust-testing`, `strict-type-verifier`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `design-taste-frontend`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `security-scan`, `strict-type-verifier`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:6-governance`, `priority:p1-high`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/src/security/redactor.rs`, `src/components/security/StreamerShieldToggle.tsx`, `src/stores/useSecurityStore.ts`.
* **Commit**: `feat(security): build streamer shield with realtime secret masking and private path hiding`

---

### FASE 7: Auditoria Apple HIG, Performance, Segurança & Verificação E2E

#### Task 7.1: Auditoria Apple HIG & Refinamento de Acessibilidade
* **Equipa Atribuída**: 🎨 **Trio UI/UX & Native Desktop**
  - Implementador UI: `frontend-design-specialist` (Skills: `apple-hig-auditor`, `a11y-auditor`, `design-taste-frontend`)
  - Auditor de Qualidade: `qa-security-auditor` (Skills: `strict-type-verifier`, `apple-hig-auditor`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:7-audit-e2e`, `priority:p0-critical`, `team:ui-desktop`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src/index.css`, `src/components/**/*.tsx`, `src/styles/higTokens.ts`.
* **Commit**: `style(hig): enforce strict apple human interface guidelines and wcag aa contrast`

#### Task 7.2: Auditoria Ponytail de Economia de Código e Limpeza de Código Morto
* **Equipa Atribuída**: 🏛️ **Trio Arquitetura, Performance & Dívida Técnica**
  - Arquiteto de Sistemas: `system-architect` (Skills: `ponytail-review`, `ponytail-debt`, `ponytail`)
  - Engenheiro de Performance: `performance-engineer` (Skills: `performance-profiling-benchmark`, `latency-critical-systems`)
  - Auditor de Código: `qa-security-auditor` (Skills: `ponytail-audit`, `strict-type-verifier`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:7-audit-e2e`, `priority:p1-high`, `team:arch-perf`, `agent:system-architect`, `agent:performance`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: Repositório completo (`src/`, `src-tauri/`).
* **Commit**: `refactor(economy): prune speculative abstractions and dead code via ponytail audit`

#### Task 7.3: Caça a Falhas Silenciosas e Resiliência de Erros
* **Equipa Atribuída**: ⚡ **Trio Hotfix, Build & Estabilidade**
  - Cirurgião Rápido: `build-error-resolver` (Skills: `error-handling`, `safety-guard`, `systematic-debugging`)
  - Auditor Forense: `qa-security-auditor` (Skills: `strict-type-verifier`, `error-handling`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:7-audit-e2e`, `priority:p1-high`, `team:hotfix-stability`, `agent:build-error-resolver`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: Repositório completo.
* **Commit**: `fix(resilience): eliminate swallowed errors and dangling promises across ipc channels`

#### Task 7.4: Suite de Testes E2E com Playwright & Verificação Final
* **Equipa Atribuída**: 🚀 **Trio Full-Stack Feature**
  - Implementador Core: `fullstack-engineer` (Skills: `test-driven-development`, `verification-before-completion`)
  - Especialista de Interface: `frontend-design-specialist` (Skills: `react-testing`, `apple-hig-auditor`)
  - Auditor de Integridade: `qa-security-auditor` (Skills: `e2e-playwright-testing`, `strict-type-verifier`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:7-audit-e2e`, `priority:p0-critical`, `team:fullstack-feature`, `agent:fullstack`, `agent:frontend`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `tests/e2e/workspace.spec.ts`, `tests/e2e/grid.spec.ts`, `tests/e2e/teamwire.spec.ts`, `playwright.config.ts`.
* **Commit**: `test(e2e): implement comprehensive playwright end-to-end test suite`

---

### FASE 8: Packaging, CI/CD & Finalização da Release v1.0.0

#### Task 8.1: Configuração do Empacotamento macOS (DMG & Assinatura)
* **Equipa Atribuída**: ⚡ **Trio Hotfix, Build & Estabilidade**
  - Cirurgião Rápido: `build-error-resolver` (Skills: `ci-cd-workflow-automation`, `semantic-git-workflow`)
  - Auditor Forense: `qa-security-auditor` (Skills: `strict-type-verifier`, `production-readiness-verifier`)
  - Finalizador de Versão: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:8-release`, `priority:p1-high`, `team:hotfix-stability`, `agent:build-error-resolver`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `src-tauri/tauri.conf.json`, `src-tauri/icons/`, `scripts/build-dmg.sh`.
* **Commit**: `chore(release): configure macos dmg bundler and application icons`

#### Task 8.2: Workflow de CI/CD para GitHub Releases
* **Equipa Atribuída**: 🏛️ **Trio Arquitetura, Performance & Dívida Técnica**
  - Arquiteto de Sistemas: `system-architect` (Skills: `ci-cd-workflow-automation`, `hexagonal-architecture`)
  - Engenheiro SRE: `sre-observability-engineer` (Skills: `latency-critical-systems`)
  - Auditor de Segurança: `qa-security-auditor` (Skills: `security-review`, `strict-type-verifier`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`)
* **Labels**: `phase:8-release`, `priority:p1-high`, `team:arch-perf`, `agent:system-architect`, `agent:sre-observability`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `.github/workflows/release.yml`.
* **Commit**: `ci(actions): create multi-architecture automated release workflow`

#### Task 8.3: Manual de Utilização, Documentação e Tag v1.0.0
* **Equipa Atribuída**: 🏛️ **Trio Arquitetura, Performance & Dívida Técnica**
  - Arquiteto de Sistemas: `system-architect` (Skills: `living-docs-governance`, `semantic-git-workflow`)
  - Engenheiro de Performance/Docs: `performance-engineer` (Skills: `ponytail`)
  - Auditor de Prontidão: `qa-security-auditor` (Skills: `production-readiness-verifier`)
  - Fecho: `devops-release` (Skills: `semantic-git-workflow`, `finishing-a-development-branch`)
* **Labels**: `phase:8-release`, `priority:p0-critical`, `team:arch-perf`, `agent:system-architect`, `agent:performance`, `agent:qa-security`, `agent:devops`
* **Ficheiros**: `README.md`, `CHANGELOG.md`, `docs/USER_GUIDE.md`.
* **Commit**: `docs(release): publish user guide and prepare version 1.0.0 release notes`
