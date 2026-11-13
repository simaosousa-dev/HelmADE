import { useEffect, useRef } from 'react';

export interface ConfirmAction {
  label: string;
  kind?: 'default' | 'primary' | 'danger';
  onSelect: () => void;
  testId?: string;
}

export interface ConfirmDialogProps {
  title: string;
  message: string;
  /** Extra detail shown under the message (e.g. how much unmerged work is at stake). */
  detail?: string | null;
  actions: ConfirmAction[];
  onCancel: () => void;
}

const ACTION_STYLES: Record<NonNullable<ConfirmAction['kind']>, string> = {
  default: 'bg-fill text-fg hover:bg-fill-strong',
  primary: 'bg-accent-solid text-on-solid hover:brightness-110',
  danger: 'bg-danger-solid text-on-solid hover:brightness-110',
};

/** Modal question for actions that cannot be undone. Cancel is focused by default; Esc cancels. */
export function ConfirmDialog({ title, message, detail, actions, onCancel }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        data-testid="confirm-dialog"
        className="w-full max-w-md rounded-macos-lg border border-separator bg-raised p-5 shadow-popover"
      >
        <h2 id="confirm-title" className="text-title3 font-semibold text-fg">
          {title}
        </h2>
        <p id="confirm-message" className="mt-2 text-body text-fg-muted">
          {message}
        </p>
        {detail && <p className="mt-2 text-body font-medium text-warning">{detail}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            data-testid="confirm-cancel"
            className="min-h-[44px] min-w-[44px] rounded-macos bg-fill px-4 text-body font-medium text-fg hover:bg-fill-strong"
          >
            Cancelar
          </button>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onSelect}
              data-testid={action.testId}
              className={`min-h-[44px] min-w-[44px] rounded-macos px-4 text-body font-semibold ${ACTION_STYLES[action.kind ?? 'default']}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
