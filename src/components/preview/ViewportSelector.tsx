import React from 'react';
import type { ViewportMode, ViewportPreset } from '../../types/preview';

export interface ViewportSelectorProps {
  currentMode: ViewportMode;
  onSelectMode: (mode: ViewportMode) => void;
  className?: string;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  {
    id: 'desktop',
    name: 'Desktop',
    width: '100%',
    height: '100%',
    description: 'Ecrã Completo (100%)',
  },
  {
    id: 'tablet',
    name: 'Tablet',
    width: 768,
    height: 1024,
    description: 'iPad / Tablet (768×1024)',
  },
  {
    id: 'mobile',
    name: 'Mobile',
    width: 390,
    height: 844,
    description: 'iPhone / Mobile (390×844)',
  },
];

export const ViewportSelector: React.FC<ViewportSelectorProps> = ({
  currentMode,
  onSelectMode,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Seletor de Viewport Responsivo"
      className={`inline-flex items-center p-1 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md shrink-0 shadow-inner ${className}`}
    >
      {VIEWPORT_PRESETS.map((preset) => {
        const isActive = currentMode === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelectMode(preset.id)}
            aria-pressed={isActive}
            aria-label={`Modo de visualização ${preset.name} (${preset.description})`}
            title={preset.description}
            className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium transition-all ${
              isActive
                ? 'bg-white/15 text-white shadow-sm border border-white/15 font-semibold'
                : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
            } active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none`}
          >
            {/* Ícones de Dispositivos Apple Style */}
            {preset.id === 'desktop' && (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            )}

            {preset.id === 'tablet' && (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            )}

            {preset.id === 'mobile' && (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            )}

            <span className="hidden sm:inline tracking-tight">{preset.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ViewportSelector;
