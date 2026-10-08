import type { GridLayoutType } from '../stores/useGridLayoutStore';
import type { TerminalPanelColor, TerminalStatus, AgentRoleType } from '../types/terminal';

/**
 * Configuração de cada painel de agente que compõe um modelo de enxame.
 */
export interface PresetPanelConfig {
  id: string;
  title: string;
  agentId: string;
  role: AgentRoleType;
  color: TerminalPanelColor;
  initialStatus: TerminalStatus;
  envVars: Record<string, string>;
  initialPrompt?: string;
}

/**
 * Definição completa de um Modelo de Enxame pré-configurado (Swarm Preset).
 */
export interface SwarmPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: GridLayoutType;
  badge?: string;
  panels: PresetPanelConfig[];
}

/**
 * Catálogo dos 5 modelos de enxame oficiais alinhados aos Trios de Ataque Oficiais:
 * 1. Trio Full-Stack Feature (layout: 2x3, 6 painéis)
 * 2. Trio UI/UX & Native Desktop (layout: 2x2, 3 painéis)
 * 3. Trio Hotfix & Estabilidade (layout: 2x2, 3 painéis)
 * 4. Trio Arquitetura & Performance (layout: 2x2, 3 painéis)
 * 5. Cockpit Solo / Exploratório (layout: 1x2, 2 painéis)
 */
export const SWARM_PRESETS: SwarmPreset[] = [
  {
    id: 'trio-fullstack',
    name: 'Trio Full-Stack Feature',
    description:
      'Nova funcionalidade end-to-end com liderança arquitetural, implementação fullstack, interface web, conformidade Apple HIG, base de dados relacional e auditoria contínua de integridade.',
    icon: 'rocket',
    layout: '2x3',
    badge: '6 Agentes · E2E',
    panels: [
      {
        id: 'architect',
        title: 'Principal Architect',
        agentId: 'system-architect',
        role: 'architect',
        color: 'gold',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'architect',
          HELM_AGENT_ID: 'system-architect',
          HELM_SKILLS: 'architectural-decision-record,api-design-openapi,hexagonal-architecture',
        },
        initialPrompt: 'Formalizar ADR, definir limites modulares e arquitetura hexagonal para o novo requisito.',
      },
      {
        id: 'fullstack-core',
        title: 'Fullstack Core',
        agentId: 'fullstack-engineer',
        role: 'fullstack',
        color: 'blue',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'fullstack',
          HELM_AGENT_ID: 'fullstack-engineer',
          HELM_SKILLS: 'backend-patterns,test-driven-development,ponytail',
        },
        initialPrompt: 'Implementar a lógica de negócio, endpoints e integrações seguindo ciclos Red-Green de TDD.',
      },
      {
        id: 'frontend-ui',
        title: 'Frontend UI',
        agentId: 'frontend-design-specialist',
        role: 'frontend',
        color: 'blue',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'frontend',
          HELM_AGENT_ID: 'frontend-design-specialist',
          HELM_SKILLS: 'design-taste-frontend,react-patterns',
        },
        initialPrompt: 'Desenvolver componentes React táteis, responsivos e sem boilerplate genérico.',
      },
      {
        id: 'apple-hig',
        title: 'Apple HIG & A11y',
        agentId: 'apple-hig-specialist',
        role: 'apple-hig',
        color: 'purple',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'apple-hig',
          HELM_AGENT_ID: 'apple-hig-specialist',
          HELM_SKILLS: 'apple-hig-auditor,design-system-catalog',
        },
        initialPrompt: 'Auditar tipografia SF Pro (<=19pt / >=20pt), contraste WCAG 2.1 AA e materiais macOS.',
      },
      {
        id: 'database-specialist',
        title: 'Database Specialist',
        agentId: 'database-specialist',
        role: 'database',
        color: 'green',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'database',
          HELM_AGENT_ID: 'database-specialist',
          HELM_SKILLS: 'schema-and-db-migration,database-migrations',
        },
        initialPrompt: 'Executar migrações seguras expand-contract com lock timeout e integridade referencial.',
      },
      {
        id: 'qa-integrity',
        title: 'QA & Integrity',
        agentId: 'qa-security-auditor',
        role: 'qa-security',
        color: 'red',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'qa-security',
          HELM_AGENT_ID: 'qa-security-auditor',
          HELM_SKILLS: 'strict-type-verifier,security-review,e2e-playwright-testing',
        },
        initialPrompt: 'Executar typecheck estrito, verificação de segurança e testes de regressão automatizados.',
      },
    ],
  },
  {
    id: 'trio-ui-desktop',
    name: 'Trio UI/UX & Native Desktop',
    description:
      'Desenvolvimento e polimento de interfaces de utilizador nativas com foco em materiais macOS, conformidade ergonómica Apple HIG, design systems e verificação de acessibilidade.',
    icon: 'sparkles',
    layout: '2x2',
    badge: '3 Agentes · Interface',
    panels: [
      {
        id: 'frontend-specialist',
        title: 'Frontend Specialist',
        agentId: 'frontend-design-specialist',
        role: 'frontend',
        color: 'blue',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'frontend',
          HELM_AGENT_ID: 'frontend-design-specialist',
          HELM_SKILLS: 'design-taste-frontend,design-system-catalog',
        },
        initialPrompt: 'Construir vistas táteis e componentes reativos em conformidade com o design system.',
      },
      {
        id: 'apple-hig-specialist',
        title: 'Apple HIG Specialist',
        agentId: 'apple-hig-specialist',
        role: 'apple-hig',
        color: 'purple',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'apple-hig',
          HELM_AGENT_ID: 'apple-hig-specialist',
          HELM_SKILLS: 'apple-hig-auditor',
        },
        initialPrompt: 'Verificar alvos de toque de 44x44px, escala ótica de tipos e materiais translúcidos.',
      },
      {
        id: 'qa-visual-auditor',
        title: 'QA & Visual Auditor',
        agentId: 'qa-security-auditor',
        role: 'qa-security',
        color: 'red',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'qa-security',
          HELM_AGENT_ID: 'qa-security-auditor',
          HELM_SKILLS: 'strict-type-verifier,e2e-playwright-testing',
        },
        initialPrompt: 'Validar renderização e testes de regressão de layout com Playwright.',
      },
    ],
  },
  {
    id: 'trio-hotfix',
    name: 'Trio Hotfix & Estabilidade',
    description:
      'Correção cirúrgica de erros críticos de compilação, análise forense de exceções e fecho seguro de versões com auditoria de tipos e Conventional Commits 1.0.0.',
    icon: 'wrench',
    layout: '2x2',
    badge: '3 Agentes · Estabilidade',
    panels: [
      {
        id: 'build-error-resolver',
        title: 'Build Error Resolver',
        agentId: 'build-error-resolver',
        role: 'devops',
        color: 'red',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'devops',
          HELM_AGENT_ID: 'build-error-resolver',
          HELM_SKILLS: 'strict-type-verifier,systematic-debugging',
        },
        initialPrompt: 'Isolar a falha de compilação ou build, reproduzir o erro e aplicar a correção mínima.',
      },
      {
        id: 'forensic-qa-auditor',
        title: 'Forensic QA Auditor',
        agentId: 'qa-security-auditor',
        role: 'qa-security',
        color: 'purple',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'qa-security',
          HELM_AGENT_ID: 'qa-security-auditor',
          HELM_SKILLS: 'error-handling,security-review',
        },
        initialPrompt: 'Inspecionar causas-raiz, capturar falhas silenciosas e verificar cobertura de testes.',
      },
      {
        id: 'devops-release',
        title: 'DevOps & Release',
        agentId: 'devops-release',
        role: 'devops',
        color: 'purple',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'devops',
          HELM_AGENT_ID: 'devops-release',
          HELM_SKILLS: 'semantic-git-workflow,finishing-a-development-branch',
        },
        initialPrompt: 'Criar commit atómico com Conventional Commits 1.0.0 e assegurar qualidade de release.',
      },
    ],
  },
  {
    id: 'trio-architecture',
    name: 'Trio Arquitetura & Performance',
    description:
      'Refatoração estrutural profunda, auditoria Ponytail de complexidade, otimização de latência p99 e desacoplamento de limites de domínio.',
    icon: 'cpu',
    layout: '2x2',
    badge: '3 Agentes · Performance',
    panels: [
      {
        id: 'system-architect',
        title: 'System Architect',
        agentId: 'system-architect',
        role: 'architect',
        color: 'gold',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'architect',
          HELM_AGENT_ID: 'system-architect',
          HELM_SKILLS: 'architectural-decision-record,hexagonal-architecture',
        },
        initialPrompt: 'Elaborar MADR, mapear fronteiras de domínio e isolar dependências externas.',
      },
      {
        id: 'performance-sre',
        title: 'Performance & SRE',
        agentId: 'performance-sre-engineer',
        role: 'system',
        color: 'blue',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'system',
          HELM_AGENT_ID: 'performance-sre-engineer',
          HELM_SKILLS: 'performance-profiling-benchmark,latency-critical-systems',
        },
        initialPrompt: 'Analisar gargalos de latência p95/p99, consumos de memória e concorrência assíncrona.',
      },
      {
        id: 'qa-integrity',
        title: 'QA & Integrity',
        agentId: 'qa-security-auditor',
        role: 'qa-security',
        color: 'red',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'qa-security',
          HELM_AGENT_ID: 'qa-security-auditor',
          HELM_SKILLS: 'ponytail-review,ponytail-debt,security-scan',
        },
        initialPrompt: 'Auditar o codebase eliminando complexidade acidental e atualizando débitos Ponytail.',
      },
    ],
  },
  {
    id: 'cockpit-solo',
    name: 'Cockpit Solo / Exploratório',
    description:
      'Ambiente compacto de exploração rápida com Orquestrador dedicado para triagem e terminal shell aberto para prototipagem imediata.',
    icon: 'terminal',
    layout: '1x2',
    badge: '2 Painéis · Prototipagem',
    panels: [
      {
        id: 'orchestrator-lead',
        title: 'Orchestrator Lead',
        agentId: 'orchestrator',
        role: 'architect',
        color: 'gold',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'architect',
          HELM_AGENT_ID: 'orchestrator',
          HELM_SKILLS: 'agents,brainstorming',
        },
        initialPrompt: 'Analisar o contexto do projeto e orientar a estratégia de execução do enxame.',
      },
      {
        id: 'shell-sandbox',
        title: 'Shell Sandbox',
        agentId: 'terminal-sandbox',
        role: 'custom',
        color: 'blue',
        initialStatus: 'idle',
        envVars: {
          HELM_AGENT_ROLE: 'custom',
          HELM_AGENT_ID: 'terminal-sandbox',
        },
        initialPrompt: 'Sessão interativa pronta para execução de comandos e validações em tempo real.',
      },
    ],
  },
];

/**
 * Procura um modelo de enxame por identificador único.
 */
export function getSwarmPreset(id: string): SwarmPreset | undefined {
  return SWARM_PRESETS.find((preset) => preset.id === id);
}
