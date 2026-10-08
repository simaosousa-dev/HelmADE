# Motor PTY Multiplexer em Rust com Buffer Circular e Streaming IPC

* **Status**: accepted
* **Deciders**: Principal Architect (Orchestrator), Simão Sousa
* **Date**: 2026-10-07

## Context and Problem Statement

O HelmADE (Módulo 3: Grelha Tiled & Multiplexador de Terminais) requer um motor local em Rust de execução de terminais concorrentes (até 16 sessões simultâneas) capaz de instanciar shells interativas (`/bin/zsh` nativo do macOS ou `/bin/bash`), efetuar leitura e escrita assíncrona bidirecional, redimensionar janelas dinamicamente (`resize`), manter histórico de scrollback em memória sem fugas de memória e emitir o stream de saída para o frontend React via eventos IPC do Tauri 2.x com alta eficiência (throughput >= 10MB/s sem bloquear a UI ou o loop principal).

## Decision Drivers

* **Custo Absoluto ZERO (0.00€)**: Execução estritamente local de shells do sistema sem agentes cloud ou dependências proprietárias.
* **Concorrência e Baixa Latência**: Suporte a 16 processos PTY paralelos com throughput de saída de 10 MB/s e latência < 10ms.
* **Integridade de Memória & Prevenção de Bloqueio**: Ring buffer de scrollback circular delimitado (100.000 linhas ou 16 MB por sessão) prevenindo exaustão de RAM em saídas massivas de logs.
* **Isolamento de Worktree**: Cada PTY deve ser instanciado opcionalmente com o `cwd` apontando para o diretório isolado do Git Worktree (`.helm/worktrees/<swarm-id>`).
* **Segurança e Thread-Safety**: Gestão de processos filhos e canais assíncronos protegidos com `Arc<Mutex<...>>` no estado do Tauri.

## Considered Options

* **Opção A — `portable-pty` com Thread Dedicada de Leitura por PTY e Eventos Tauri 2**: Uso da crate Rust `portable-pty` (0.8), spawn de processo nativo, reader thread assíncrona canalizando dados para um `RingBuffer` em memória e disparando `app_handle.emit(&format!("pty-output-{}", id), payload)` em lotes (batching de 8ms para evitar saturação do canal IPC).
* **Opção B — `tokio::process::Command` com pipes padrão (stdin/stdout)**: Simples, mas pipes padrão não são PTYs reais — falham em emular comandos interativos ANSI (`vim`, `htop`, prompts com cores, readline, sinais de redimensionamento `SIGWINCH`).
* **Opção C — Subprocesso em Node.js (`node-pty`) via sidecar**: Quebraria o invariante de pegada mínima de memória (<50MB) e adicionaria dependências pesadas de runtime externo.

## Decision Outcome

Chosen option: **"Opção A — portable-pty com RingBuffer circular e emissão de eventos Tauri"**, porque fornece emulação PTY completa em código nativo Rust com suporte a sequências ANSI TrueColor, controle de tamanho de terminal (cols/rows), ring-buffer eficiente e pegada de memória desprezível por sessão.

### Positive Consequences

* Sessões de terminal 100% nativas suportando `zsh`, `bash`, comandos interativos e coloridos.
* Ring buffer circular configurável (100.000 linhas) permite que componentes frontend (como `@xterm/xterm`) recuperem o histórico completo ao desmontar/remontar painéis.
* Comunicação reativa assíncrona via eventos Tauri (`pty-output-<session_id>`) desacopla a leitura de I/O do loop de renderização.
* Gestão segura de encerramento (`kill`) limpa processos órfãos no sistema operativo.

### Negative Consequences

* Requer a dependência `portable-pty = "0.8"` no manifesto `Cargo.toml`.
* Cada sessão ativa mantém uma thread de leitura bloqueante em background até o processo terminar (16 threads para 16 PTYs, com overhead de CPU/RAM irrelevante no macOS).

## Implementation Plan

1. **`fullstack-engineer`**: Implementar `src-tauri/src/terminal/ring_buffer.rs`, `src-tauri/src/terminal/pty.rs`, `src-tauri/src/terminal/manager.rs`, `src-tauri/src/commands/terminal.rs`, e serviços frontend `src/types/terminal.ts` e `src/services/terminalService.ts`.
2. **`performance-engineer`**: Avaliar throughput e contenção de lock no RingBuffer garantindo taxa de transferência >= 10MB/s e zero I/O jitter.
3. **`qa-security-auditor`**: Verificar sanitização de comandos, variáveis de ambiente injetadas e limpeza de processos no encerramento.
4. **`devops-release`**: Executar verificação automatizada via `scripts/verify-task-2.1.sh` e preparar commit convencional `feat(pty): build high-throughput pty multiplexer and ring buffer in rust`.
