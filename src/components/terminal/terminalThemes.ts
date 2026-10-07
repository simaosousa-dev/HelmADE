import type { ITheme, ITerminalOptions } from '@xterm/xterm';

/**
 * Tema Terminal Escuro Nativo macOS / Apple HIG
 * Calibrado com cores semânticas vibrantes do macOS e contraste WCAG 2.1 AA (> 4.5:1).
 */
export const appleDarkTheme: ITheme = {
  background: '#0d1117',
  foreground: '#e6edf3',
  cursor: '#0a84ff', // macOS System Accent Blue
  cursorAccent: '#0d1117',
  selectionBackground: 'rgba(10, 132, 255, 0.35)',
  selectionForeground: '#ffffff',
  selectionInactiveBackground: 'rgba(255, 255, 255, 0.1)',

  // Cores ANSI Padrão (macOS Vibrancy)
  black: '#1e2228',
  red: '#ff453a', // macOS Semantic Red
  green: '#30d158', // macOS Semantic Green
  yellow: '#ffd60a', // macOS Semantic Gold / Yellow
  blue: '#0a84ff', // macOS Semantic Blue
  magenta: '#bf5af2', // macOS Semantic Purple
  cyan: '#64d2ff', // macOS Semantic Cyan
  white: '#e6edf3',

  // Cores ANSI Brilhantes
  brightBlack: '#6e7681',
  brightRed: '#ff6961',
  brightGreen: '#34d399',
  brightYellow: '#fde047',
  brightBlue: '#60a5fa',
  brightMagenta: '#d8b4fe',
  brightCyan: '#93c5fd',
  brightWhite: '#ffffff',
};

/**
 * Tema Terminal Claro Nativo macOS / Apple HIG
 */
export const appleLightTheme: ITheme = {
  background: '#f6f8fa',
  foreground: '#1f2328',
  cursor: '#0071e3',
  cursorAccent: '#ffffff',
  selectionBackground: 'rgba(0, 113, 227, 0.25)',
  selectionForeground: '#000000',
  selectionInactiveBackground: 'rgba(0, 0, 0, 0.08)',

  black: '#24292f',
  red: '#cf222e',
  green: '#1a7f37',
  yellow: '#9a6700',
  blue: '#0969da',
  magenta: '#8250df',
  cyan: '#1b7c83',
  white: '#6e7781',

  brightBlack: '#57606a',
  brightRed: '#a40e26',
  brightGreen: '#116329',
  brightYellow: '#4d2d00',
  brightBlue: '#0550ae',
  brightMagenta: '#6639ba',
  brightCyan: '#125a60',
  brightWhite: '#8c959f',
};

/**
 * Opções recomendadas por omissão para instanciar terminais no HelmADE
 */
export const defaultTerminalOptions: ITerminalOptions = {
  theme: appleDarkTheme,
  fontFamily: "'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
  fontSize: 12.5,
  lineHeight: 1.35,
  letterSpacing: 0,
  cursorBlink: true,
  cursorStyle: 'block',
  allowTransparency: true,
  scrollback: 10_000,
  convertEol: true,
};
