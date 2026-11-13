import { toastStore, useToasts, type ToastKind } from '../../stores/useToastStore';

const KIND_STYLES: Record<ToastKind, { bar: string; label: string }> = {
  error: { bar: 'bg-danger', label: 'Erro' },
  warning: { bar: 'bg-warning', label: 'Aviso' },
  success: { bar: 'bg-success', label: 'Concluído' },
  info: { bar: 'bg-accent', label: 'Informação' },
};

/** Stack of transient messages. Every failed async action ends up here. */
export function ToastHost() {
  const toasts = useToasts();

  return (
    <div
      aria-label="Notificações"
      className="fixed bottom-4 right-4 z-[70] flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const style = KIND_STYLES[toast.kind];
        return (
          <div
            key={toast.id}
            role={toast.kind === 'error' ? 'alert' : 'status'}
            data-testid={`toast-${toast.kind}`}
            className="flex items-stretch overflow-hidden rounded-macos border border-separator bg-raised shadow-popover"
          >
            <span className={`w-1 shrink-0 ${style.bar}`} aria-hidden="true" />
            <div className="min-w-0 flex-1 px-3 py-2.5">
              <p className="text-caption2 font-semibold uppercase text-fg-subtle">{style.label}</p>
              <p className="text-body text-fg break-words" data-selectable>
                {toast.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => toastStore.dismiss(toast.id)}
              aria-label="Dispensar notificação"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-fg-subtle hover:bg-fill hover:text-fg"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
