import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteStageMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteStage',
  category: 'layout',
  description: 'Full-viewport lab shell: root column, body row, side panels, canvas main, and footer. Compound pieces: StageBody, StagePanel, StageMain, StageFooter.',
  props: {
    children: { type: 'node', required: true, description: 'StageBody content (panels + main)' },
    className: { type: 'string', required: false, description: 'Extra root classes' },
  },
  slots: { default: 'StageBody content' },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteStageProps {
  className?: string;
  children: ReactNode;
}

/** Full-viewport lab shell root (safe-area column). */
export function NCTGraphiteStage({ className = '', children }: NCTGraphiteStageProps) {
  return (
    <div
      data-safe-area-inset-root
      style={{ boxSizing: 'border-box', paddingTop: 'var(--safe-area-inset-top)' }}
      className={`min-h-screen w-full bg-[var(--bg)] text-[var(--text)] flex flex-col overflow-x-clip ${className}`}
    >
      {children}
    </div>
  );
}

export interface NCTGraphiteStageBodyProps {
  className?: string;
  children: ReactNode;
}

/** Body row: stacks on small screens, splits into panels on lg+. */
export function NCTGraphiteStageBody({ className = '', children }: NCTGraphiteStageBodyProps) {
  return <div className={`nctgraphite-stage-body ${className}`}>{children}</div>;
}

export interface NCTGraphiteStagePanelProps {
  side: 'left' | 'right';
  width?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Side panel with fixed desktop width (var-driven, plain CSS). */
export function NCTGraphiteStagePanel({ side, width = 240, className = '', style, children }: NCTGraphiteStagePanelProps) {
  void side;
  return (
    <aside
      className={`nctgraphite-stage-panel ${className}`}
      style={{ '--nct-w': `${width}px`, ...style } as CSSProperties}
    >
      {children}
    </aside>
  );
}

export interface NCTGraphiteStageMainProps {
  className?: string;
  children: ReactNode;
}

/** Canvas main area. Holds keyboard focus so panel controls do not keep it. */
export function NCTGraphiteStageMain({ className = '', children }: NCTGraphiteStageMainProps) {
  return (
    <main data-nct-stage="" tabIndex={-1} className={`nctgraphite-stage-main ${className}`}>
      {children}
    </main>
  );
}

export interface NCTGraphiteStageFooterProps {
  className?: string;
  children: ReactNode;
}

/** Footer readout bar (lab idiom): status line pinned under the body row. */
export function NCTGraphiteStageFooter({ className = '', children }: NCTGraphiteStageFooterProps) {
  return (
    <footer className={`border-t border-[var(--panel-2)] bg-[var(--bg)] px-4 py-2 text-[10px] tracking-widest text-[var(--text-dim)] flex justify-between gap-4 ${className}`}>
      {children}
    </footer>
  );
}
