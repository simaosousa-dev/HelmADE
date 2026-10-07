// Declarações de tipo ambientais para o ecossistema @xterm

declare module '@xterm/xterm' {
  export interface IDisposable {
    dispose(): void;
  }

  export interface ITheme {
    foreground?: string;
    background?: string;
    cursor?: string;
    cursorAccent?: string;
    selectionBackground?: string;
    selectionForeground?: string;
    selectionInactiveBackground?: string;
    black?: string;
    red?: string;
    green?: string;
    yellow?: string;
    blue?: string;
    magenta?: string;
    cyan?: string;
    white?: string;
    brightBlack?: string;
    brightRed?: string;
    brightGreen?: string;
    brightYellow?: string;
    brightBlue?: string;
    brightMagenta?: string;
    brightCyan?: string;
    brightWhite?: string;
    extendedAnsi?: string[];
  }

  export interface ITerminalOptions {
    theme?: ITheme;
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number;
    fontWeightBold?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number;
    lineHeight?: number;
    letterSpacing?: number;
    cursorBlink?: boolean;
    cursorStyle?: 'block' | 'underline' | 'bar';
    cursorWidth?: number;
    cursorInactiveStyle?: 'outline' | 'block' | 'bar' | 'underline' | 'none';
    scrollback?: number;
    convertEol?: boolean;
    disableStdin?: boolean;
    allowProposedApi?: boolean;
    allowTransparency?: boolean;
    cols?: number;
    rows?: number;
    tabStopWidth?: number;
  }

  export interface ITerminalAddon extends IDisposable {
    activate(terminal: Terminal): void;
  }

  export class Terminal implements IDisposable {
    constructor(options?: ITerminalOptions);
    readonly element?: HTMLElement;
    readonly cols: number;
    readonly rows: number;
    readonly options: ITerminalOptions;

    open(parent: HTMLElement): void;
    write(data: string | Uint8Array, callback?: () => void): void;
    writeln(data: string | Uint8Array, callback?: () => void): void;
    clear(): void;
    reset(): void;
    focus(): void;
    blur(): void;
    resize(cols: number, rows: number): void;
    loadAddon(addon: ITerminalAddon): void;
    onData(listener: (data: string) => void): IDisposable;
    onKey(listener: (event: { key: string; domEvent: KeyboardEvent }) => void): IDisposable;
    onResize(listener: (event: { cols: number; rows: number }) => void): IDisposable;
    onRender(listener: (event: { start: number; end: number }) => void): IDisposable;
    dispose(): void;
  }
}

declare module '@xterm/addon-fit' {
  import { ITerminalAddon, Terminal } from '@xterm/xterm';

  export class FitAddon implements ITerminalAddon {
    activate(terminal: Terminal): void;
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
    dispose(): void;
  }
}

declare module '@xterm/addon-webgl' {
  import { ITerminalAddon, Terminal, IDisposable } from '@xterm/xterm';

  export class WebglAddon implements ITerminalAddon {
    constructor(preserveDrawingBuffer?: boolean);
    activate(terminal: Terminal): void;
    onContextLoss(listener: (e: Event) => void): IDisposable;
    dispose(): void;
  }
}
