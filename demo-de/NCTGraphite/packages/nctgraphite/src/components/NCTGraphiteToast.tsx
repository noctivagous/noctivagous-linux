import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteToastMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteToast',
  category: 'widgets',
  description: 'Transient bottom-center status pill (lab idiom); hosts own the timeout',
  props: {
    message: { type: 'string', required: false, description: 'Text to show; null hides the toast' },
    className: { type: 'string', required: false, description: 'Extra pill classes (e.g. tone override)' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteToastProps {
  message: string | null;
  className?: string;
}

/** Transient bottom-center status pill (lab idiom). */
export function NCTGraphiteToast({ message, className = '' }: NCTGraphiteToastProps) {
  if (!message) return null;
  return (
    <div className={`fixed left-1/2 bottom-6 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-[#00e5ff] text-black text-[11px] font-bold whitespace-nowrap ${className}`}>
      {message}
    </div>
  );
}
