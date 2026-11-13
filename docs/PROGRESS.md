# HelmADE v1.0 — Progress Ledger

> Single source of truth for the v1.0 push. Re-read at the start of every iteration.
> Branch: `claude/helmade-v1-polish-839425` (never commit to `main`, never push, never `git stash`).

## How to resume after a context reset

1. Read this file top to bottom, then `AGENTS.md`.
2. `git log --oneline main..HEAD` to see what landed.
3. Continue with the first item in **Backlog** whose status is not `done`.
4. Gates (run all before claiming anything): `npm run typecheck`, `npm test`, `npm run build`,
   `cargo test`, `cargo clippy -- -D warnings` (both from repo root; the workspace has one member).

## Baseline (2026-11-13, commit 28a8fc2)

- `npx tsc -b` green, `npm test` green (5 node scripts), `cargo test` green (48), `npm run build` green.
- `cargo clippy -- -D warnings` fails with 3 lints.
- Toolchain: node 24.9, npm 11.6, cargo/rustc 1.99, only `aarch64-apple-darwin` installed.
- Agent CLIs on this machine: `claude`, `codex`, `gemini` (no `ollama`).

## Architecture decisions (details in ADRs)

| # | Decision | ADR |
|---|----------|-----|
| D1 | A **swarm** is a grid tab. Every agent panel gets **its own worktree + branch + port** (`helm/swarm-<swarm>-<panel>`). Supersedes the "one worktree per grid" wording of PRD R2.2; satisfies PRD §4.3 and DoD #2. | 0007 |
| D2 | Agent panels `exec` the agent CLI directly (no shell underneath), chosen from the model's provider (claude / codex / gemini / ollama). Shell panels stay plain shells. | 0007 |
| D3 | A2A channel = Unix domain socket served by the app + `helm` CLI (the app binary in CLI mode) on every panel's `PATH`. Delivery injects into the recipient agent's PTY stdin; shell panels only get a display mirror. | 0008 |
| D4 | SQLite is the source of truth for swarms, panels, A2A messages and settings; restored on project open. PTYs are respawned inside the surviving worktrees. | 0009 |
| D5 | Streamer Shield = streaming redactor in Rust applied at the emit boundary (terminal + Team Wire), bounded regexes, hold-back of secret-prefix tails. | 0010 |
| D6 | Telemetry reads the agent CLIs' own local transcripts (Claude Code / Codex JSONL), keyed by worktree cwd. No proxy, no cloud. | 0011 |
| D7 | E2E drives the real backend: feature-gated HTTP/SSE bridge inside the app (`e2e-bridge`), frontend IPC shim picks Tauri or bridge. Playwright cannot attach to WKWebView. | 0012 |

## Dependencies added (each must be MIT/Apache/BSD, maintained, justified)

| Dependency | Why |
|------------|-----|
| _(filled as they land)_ | |

## Backlog (ordered; `todo` / `doing` / `done <sha>` / `blocked`)

### A. Foundations
- **A1** `todo` Vitest adopted; the 5 node-script tests converted; `npm test` runs Vitest.
  - AC: `npm test` runs `vitest run`, all former assertions preserved, no `node --experimental-strip-types` scripts left.
- **A2** `todo` Clippy clean (`-D warnings`), duplicate `src-tauri/src/pty/` module removed.
- **A3** `todo` CI runs typecheck, Vitest, build, `cargo test`, clippy.

### B. Core loop (Must)
- **B1** `todo` Backend swarm lifecycle: `launch`/`close` primitives create one worktree per agent, symlink deps, allocate a port per agent, clean everything on close; typed errors.
  - AC: cargo integration test creates a 4-agent swarm in a temp repo → 4 worktrees, 4 `helm/swarm-*` branches, symlinked `node_modules`, 4 distinct ports; close removes all of them.
- **B2** `todo` PTY engine: spawn with explicit command (agent CLI via login shell `exec`), exit event, raw byte-capped scrollback replay, output coalescing, kill-all on app quit.
  - AC: tests for exit event + kill-all; no orphan child processes after quit; 16-terminal throughput/latency measured and recorded below.
- **B3** `todo` Frontend swarm store with tabs (multiple swarms per project), launcher rewritten on B1/B2, 4-agent preset, agent CLI catalog + detection, auto-approve option (R8.3).
  - AC: launching a preset shows panels whose `cwd` is the agent worktree; `Cmd+T` opens the launcher; tabs switch swarms without killing PTYs.
- **B4** `todo` "Rever & Fundir" targets the active swarm: per-agent branch list, diff, merge, post-merge cleanup of worktree + branch + port.
  - AC: no hardcoded swarm id; merge of one agent leaves the others intact; merged agent's worktree is gone.
- **B5** `todo` Persistence + restore (SQLite): swarms, panels, layout, active tab, A2A history, settings. Restart restores tabs and respawns PTYs in existing worktrees.
  - AC: cargo tests for the repository layer; E2E restart test.
- **B6** `todo` A2A channel: Unix socket + `helm` CLI (`send`, `broadcast`, `peers`, `inbox`), PTY injection for agents, display mirror for shells, protocol paragraph appended to personas.
  - AC: cargo test sends through the socket and observes router history + injection; E2E shows the message in Team Wire.
- **B7** `todo` Global push-to-talk via `tauri-plugin-global-shortcut` (works when the app is not focused), configurable, persisted.
- **B8** `todo` Close/quit hygiene: closing a swarm asks keep vs discard; orphan worktree reconciliation on project open.

### C. Security (Must)
- **C1** `todo` Streamer Shield (task 6.3): `security/redactor.rs`, ≥50 secret formats, terminal + Team Wire + scrollback, private path masking, toggle + shortcut.
  - AC: cargo suite with ≥50 formats × chunk-split positions → zero leaks.
- **C2** `todo` Real CSP in `tauri.conf.json`; capabilities least-privilege.
- **C3** `todo` Typed backend errors; no internal paths / stack traces in errors returned to the frontend; no `unwrap`/`expect` on runtime paths.

### D. Remaining roadmap features (Must)
- **D1** `todo` Telemetry / cost dashboard (task 6.2) from local CLI transcripts; filters by day / swarm / agent; USD + EUR.
- **D2** `todo` Command palette (`Cmd+K`) + shortcut for every primary action; shortcut registry is the single source for palette + user guide.
- **D3** `todo` Attention UX: blocked-prompt detection surfaces on the tab, the panel and as a macOS notification; jump-to-next-blocked shortcut.

### E. Quality (Must)
- **E1** `todo` Design-system pass: tokens in one place, light + dark, semantic materials/vibrancy, SF Pro Text/Display with tracking, 44×44 targets.
- **E2** `todo` HIG/WCAG audit (task 7.1) → `docs/audits/` with screenshots in both appearances, zero critical violations.
- **E3** `todo` Dead-code audit (task 7.2): `a2aProtocol.ts`, `shortcutService.ts`, `useGridStore.ts`, `types/network.ts`, one-off `scripts/*`.
- **E4** `todo` Swallowed-error hunt (task 7.3): every async call has explicit error UI; no empty catches.
- **E5** `todo` Code-split heavy views; main chunk well under the 834 kB baseline.
- **E6** `todo` Playwright E2E of the full core loop (task 7.4) on the real backend.

### F. Release (Must)
- **F1** `todo` DMG packaging (task 8.1): arm64 built + launched standalone here; x86_64 configured.
- **F2** `todo` Release workflow (task 8.2).
- **F3** `todo` README, `docs/USER_GUIDE.md`, `CHANGELOG.md`, `project-brain.md`, ADR index, competitive-analysis final update, local tag `v1.0.0` (task 8.3).

## Done

| Item | Commit | Evidence |
|------|--------|----------|

## Measurements

_(PTY throughput / latency with 16 terminals goes here.)_

## Open risks

- Playwright cannot drive WKWebView; E2E runs Chromium against the real Rust backend through the bridge (D7). Native vibrancy is therefore not covered by screenshots.
- x86_64 DMG cannot be built here unless the `x86_64-apple-darwin` target can be installed offline.
- Signing/notarization needs the owner's Apple Developer certificate (not available) → unsigned DMG.
- Speech recognition and global shortcuts need macOS permission prompts that cannot be exercised headlessly.

## Self-review log

_(every ~5 iterations)_

## Final gate run

_(pasted output of the last fresh run)_
