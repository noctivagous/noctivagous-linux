import { useEffect } from 'react';
import type { ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteDialogMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteDialog',
  category: 'widgets',
  description: 'Modal overlay dialog for help sheets and confirmations (lab idiom)',
  props: {
    open: { type: 'boolean', required: true, description: 'Whether the dialog is visible' },
    onClose: { type: 'function', required: true, description: '() => void on backdrop click, x, or Escape' },
    title: { type: 'string', required: true, description: 'Dialog title' },
    children: { type: 'node', required: true, description: 'Dialog body content' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/** Modal overlay dialog (lab idiom): backdrop click, x button, and Escape close. */
export function NCTGraphiteDialog({ open, onClose, title, children }: NCTGraphiteDialogProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[640px] max-h-[80vh] overflow-auto rounded-[16px] bg-[#0e0e14] border border-[#2a2a3a]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#24243a]">
          <span className="text-[12px] font-bold tracking-[0.18em] text-white">{title}</span>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-7 h-7 rounded-[7px] bg-[#1a1a24] border border-[#2a2a3a] text-[#7a7680] hover:text-white font-bold"
          >
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
