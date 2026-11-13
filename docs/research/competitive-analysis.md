# Competitive Analysis — Agent Cockpits (November 2026)

Scope: only what serves HelmADE's core loop — **launch swarm → agents work in isolation → I supervise → I review and merge**.
Nothing here is copied from the references' branding, copy or visual identity; they are used for capabilities and UX patterns only.

Reliability note: most public material on these tools is vendor-authored (product pages, docs, comparison pages written by
competitors). Claims are tagged **[docs]** (official documentation), **[site]** (marketing page) or **[3p]** (third-party roundup).
Anything not verified is listed under *Unverified*.

## 1. References studied

| Tool | What it is | Sources |
|------|------------|---------|
| **BridgeMind One** (successor of BridgeSpace) | "Agent super app": Agent / Code / Chat modes. Code mode = project folder with terminals, agent threads, files, browser, simulator panes. | bridgemind.ai, docs.bridgemind.ai (Code Mode, Dictation), changelog v0.3.4 |
| **Conductor** | Mac app running Claude Code / Codex / Cursor / OpenCode in parallel, one workspace per task. | conductor.build `llms-full.txt`, compare pages |
| **Superset (Paradev)** | Source-available local workspace launching many CLI agents in isolated worktrees with persistent terminals and a diff viewer. | superset.sh compare pages [site] |
| **cmux** | Native macOS terminal (Ghostty-based) for agent sessions; notification rings; no worktree orchestration. | cmux.com, mintlify docs [docs] |
| **Vibe Kanban / Emdash / T3 Code** | Kanban- or thread-centred orchestrators, worktree per task/agent. | [3p] roundups |

## 2. Findings that matter

### BridgeMind One
- **[docs]** Code mode organises work around a project folder; pane types: Terminal, Thread, Files, Browser, Simulator. Panes split/stack/tab/resize.
- **[docs]** Detects which agent CLIs are installed in the login shell and only offers those. Does **not** bundle agents.
- **[docs]** Session presets: Solo, Pair, Workbench, Swarm. The lineup (count + role per session) is shown *before* launching.
- **[docs]** Command bar sends the prompt to the active session, or starts an agent when nothing runs.
- **[docs]** Dictation: hold-Fn push-to-talk, double-tap for hands-free, status pill; **audio is uploaded to a hosted Whisper service** (not offline).
- **[site]** Changelog 0.3.4: restore agent conversations after restart (`resume`), one line per restored pane explaining how it came back, background terminal host (beta), saved prompts, task cards dragged onto agents, phone approvals, "Quit and End All Sessions".
- **[site]** Earlier BridgeSpace: up to 16 terminals, Kanban, themes.
- **[site]** Paid: Pro $50/month, credits; bring your own AI subscription.
- *Unverified:* any worktree-based isolation between agents. Nothing in the docs mentions it; the dispatched "saved agent works in its own branch" is the only hint.

### Conductor
- **[docs]** Each workspace = own branch, git worktree, run environment. Agents *inside one workspace* share branch and files; separate tasks → separate workspaces.
- **[docs]** Setup script on workspace creation (install deps, symlinks), saved run actions, `CONDUCTOR_PORT` + a port range per workspace.
- **[docs]** `Cmd+Shift+D` diff viewer, Checks tab, flow = review diff → tests → PR → merge → archive. `Cmd+K` command palette, `Cmd+Shift+N` new workspace.
- **[docs]** Mac-only; agents run unsandboxed with the user's permissions.

### cmux
- **[docs]** Attention model: a pane gets a ring when the agent emits OSC 9/99/777 or calls `cmux notify`; sidebar badges; a panel of pending notifications; one shortcut jumps to the newest unread pane.

### Cross-tool consensus
- **[3p]** One worktree per agent/task is the standard isolation primitive; a separate session without a separate worktree gives no file isolation.
- Review happens on a diff of the agent branch against the base, then merge/PR, then archive/cleanup.
- The scarce resource is the human's attention → "who needs me" indicators and fast jump-to-blocked matter more than more panes.

## 3. Feature matrix (HelmADE at the start of the v1.0 push)

Legend: ✅ works · ⚠️ partial / not wired · ❌ missing · — not applicable / unverified

| Capability | HelmADE (baseline) | BridgeMind One | Conductor | Superset | cmux |
|------------|--------------------|----------------|-----------|----------|------|
| Multi-pane terminals (≥16) | ✅ 1–16 tiled | ✅ | ⚠️ per workspace | ✅ | ✅ |
| One-click multi-agent presets | ⚠️ presets open plain shells | ✅ Solo/Pair/Workbench/Swarm | ❌ | ❌ | ❌ |
| Launches real agent CLIs, detects installed ones | ❌ | ✅ | ✅ | ✅ | ⚠️ manual |
| Worktree isolation per agent | ❌ modules exist, never called | — unverified | ✅ per workspace | ✅ | ❌ |
| Dependency symlinks into worktrees | ❌ not wired | — | ⚠️ via setup script | — | ❌ |
| Port per agent/workspace | ❌ one port per preset id | — | ✅ | — | ❌ |
| Agent-to-agent messaging | ⚠️ router + UI, no channel for a CLI | ⚠️ orchestrating agent | ❌ | ❌ | ❌ |
| Team feed of agent messages | ⚠️ UI only | ⚠️ dashboard | ❌ | ❌ | ❌ |
| Broadcast prompt to all agents | ✅ | — | ❌ | ❌ | ❌ |
| "Agent needs me" detection | ✅ y/N heuristic per panel | ✅ approvals | ⚠️ | ⚠️ | ✅ rings + jump |
| Embedded live preview + port sniffing | ✅ | ✅ browser pane | ❌ | ⚠️ | ⚠️ browser |
| Diff review + merge | ⚠️ hardcoded swarm id | ⚠️ | ✅ + PR | ✅ | ❌ |
| Cleanup after merge | ❌ | — | ✅ archive | ✅ | — |
| Session restore after restart | ❌ tables unused | ✅ | ✅ | ✅ | ✅ |
| Voice / push-to-talk | ⚠️ in-window only | ✅ global Fn, **cloud** | ❌ | ❌ | ❌ |
| Voice fully offline | ✅ Apple Speech on-device | ❌ | — | — | — |
| Usage / cost telemetry | ❌ | ⚠️ credits | ❌ | ❌ | ❌ |
| Secret masking for screen sharing | ❌ | ❌ | ❌ | ❌ | ❌ |
| Command palette | ❌ | ✅ command bar | ✅ | ✅ | ✅ |
| Price | 0.00€ | $50/month Pro | free tier / team plans | free | free |

## 4. UX patterns worth adopting

1. **Show the lineup before launch** (how many sessions, which role, which CLI/model, which branch) — BridgeMind. HelmADE's preset selector already lists panels; add CLI availability + worktree/branch preview.
2. **Detect installed agent CLIs** and disable unavailable choices instead of failing at spawn — BridgeMind.
3. **Per-worktree port + env injection** so two dev servers never collide — Conductor.
4. **Attention routing**: badge on the tab and panel, system notification, one shortcut to jump to the next blocked agent — cmux.
5. **Review → merge → archive as one flow**, with the workspace cleaned up at the end — Conductor.
6. **Restore explains itself**: each restored pane says how it came back (resumed conversation vs fresh shell) — BridgeMind.
7. **Command palette + a shortcut for every primary action** — all of them.
8. **Quit semantics are explicit**: quitting ends sessions and says so — BridgeMind.

## 5. Prioritised gap list

### Must (v1.0)
| # | Gap | Why it serves the core loop |
|---|-----|-----------------------------|
| M1 | Swarm launch creates a worktree + branch + port per agent, symlinks deps, cleans up on close | *agents work in isolation* is the product's central promise and is not true today |
| M2 | Panels launch real agent CLIs (claude / codex / gemini / ollama) with persona + model; detect installed CLIs | a "swarm" of bare shells is not a swarm |
| M3 | Real A2A channel a CLI process can use (`helm send …`), visible in Team Wire, delivered to the recipient | *I supervise* needs the team's conversation to be real |
| M4 | Review & merge targets the active swarm's real branches; cleanup after merge | *I review and merge* is hardcoded to id `1` today |
| M5 | Persist + restore swarms, layout, sessions, A2A history | losing the cockpit on restart breaks supervision of long runs |
| M6 | Multiple swarms per project as tabs | supervising parallel missions (PRD R2.1) |
| M7 | Attention routing (tab badge, notification, jump-to-blocked) | the human is the bottleneck |
| M8 | Command palette + complete shortcuts | keyboard-first supervision (PRD §5) |
| M9 | Global push-to-talk | PRD R7.1; voice is only useful if it works from anywhere |
| M10 | Streamer Shield | roadmap 6.3; unique differentiator, zero competitors have it |
| M11 | Usage/cost telemetry | roadmap 6.2; "what is this swarm costing me" is a supervision question |
| M12 | Hardening: CSP, typed errors, no orphan processes/worktrees, E2E, packaging | shippable v1.0 |

### Should (post-1.0)
- Resume the agent's previous conversation on restore (`claude --continue`, `codex resume --last`) — wired as an opt-in per CLI if cheap, otherwise next.
- Setup script per project (custom commands after worktree creation) — symlinks cover the common case.
- "Open PR" via `gh` in the review flow — local merge covers the loop.
- Saved prompts library.
- Persist scrollback to disk across restarts.
- OSC 9/99/777 notification support in addition to the prompt heuristic.

### Won't (with reason)
| Feature | Reason |
|---------|--------|
| Files pane / code editor / LSP | PRD §4.1: HelmADE is not an IDE; agents edit, humans review diffs |
| iOS Simulator pane | unrelated to the swarm loop |
| Kanban board / task cards | planning surface; the orchestrator agent owns task decomposition |
| Persistent "teammates" with memory, routines, plugins marketplace | a different product (assistant platform), not a cockpit |
| Phone approvals / remote control | needs a relay service → violates the zero-cost/no-cloud invariant |
| Background terminal host surviving app quit | large daemon surface; explicit quit semantics + restore cover v1.0 |
| Cloud dictation / hosted models | violates the zero-cost invariant; on-device Apple Speech stays |
| Chat-style "thread" rendering of agent sessions | needs per-CLI adapters; the terminal is the universal interface |
| Shared-worktree swarms (several agents in one checkout) | PRD §4.3 forbids concurrent edits in one checkout; agents share work by merging each other's branches |
| Windows / Linux builds | macOS-native product (Speech.framework, vibrancy); out of scope for 1.0 |

## 6. Where HelmADE stands after v1.0

_(updated at the end of the push — see the final section appended below when the work lands)_
