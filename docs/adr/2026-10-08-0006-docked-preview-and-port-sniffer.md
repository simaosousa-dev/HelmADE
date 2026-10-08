# 0006. Painel de Live Preview Dockada e Sniffer Automático de Portas Locais

Data: 2026-10-08

## Estado
Aceite

## Contexto
O HelmADE permite orquestrar múltiplos agentes IA em paralelo em diferentes Git Worktrees. Quando um ou mais agentes iniciam servidores locais de desenvolvimento web (ex.: Vite na porta 5173, Next.js na porta 3000, Astro na porta 4321, Webpack, etc.), o utilizador necessita de visualizar imediatamente o resultado da aplicação sem ter de abrir navegadores externos nem copiar/colar URLs manualmente.

Além disso, para garantir máxima performance e custo zero (0.00€), a deteção de URLs deve ocorrer diretamente nos fluxos de saída dos PTYs em Rust através de um sniffer com zero alocações desnecessárias e sem introduzir bloqueios no canal de streaming do PTY.

## Decisão
1. **Sniffer de Portas em Rust (`src-tauri/src/browser/sniffer.rs`)**:
   - Implementar analisador leve de chunks de texto com deteção de padrões de URL (`http://localhost:\d+`, `http://127.0.0.1:\d+`, `http://\[::1\]:\d+`).
   - Reconhecer padrões emitidos por ferramentas populares (`Local:\s+(http://\S+)`, `ready in \d+ ms\s+(http://\S+)`, `running at (http://\S+)`).
   - Emissão de evento Tauri assíncrono `devserver-detected` contendo `{ session_id, url, port }`.
2. **Comandos IPC de Navegador & Estado (`src-tauri/src/commands/browser.rs`)**:
   - Comandos para registar, consultar portas ativas detetadas e abrir URLs no browser/webview.
3. **Hook Reativo & Store de Preview (`src/hooks/useAutoPortDetection.ts`, `src/stores/usePreviewStore.ts`)**:
   - Escuta em tempo real dos eventos `devserver-detected`.
   - Seleção automática da URL mais recente ou permitindo alternar entre servidores de diferentes agentes.
4. **Interface Dockada Apple HIG (`src/components/preview/LiveBrowserDock.tsx`)**:
   - Painel lateral colapsável / dockado com barra de controlos (recarregar, abrir no browser externo, seletor de porta).
   - Iframe de alta performance com sandbox e isolamento seguro para emulação no frontend Tauri.
   - Botão de alternância "Preview" no cabeçalho do cockpit.

## Consequências
- Visualização imediata do produto desenvolvido pelos agentes em menos de 200ms após o servidor arrancar.
- Experiência fluida e unificada de desenvolvimento e revisão sem fricção manual.
- Zero dependências pesadas adicionais mantendo a pegada em memória e custo 0.00€.
