import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteGrid, type NCTGraphiteGridBreakpoint } from './NCTGraphiteGrid.js';

export const NCTGraphiteLayoutShellMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteLayoutShell', category: 'layout',
  description: 'Composable header, footer and responsive body regions without application-specific styling',
  props: {
    header: { type: 'node', required: false, description: 'Content above the body' },
    footer: { type: 'node', required: false, description: 'Content below the body' },
    columns: { type: 'string', default: '1fr', description: 'Body tracks below the breakpoint' },
    wideMinWidth: { type: 'number', required: false, description: 'Viewport width at which wideColumns applies' },
    wideColumns: { type: 'string', required: false, description: 'Body tracks at the breakpoint' },
    breakpoints: { type: 'array', required: false, description: 'Ordered { minWidth, columns?, rows?, gap?, template? } width breakpoints; the last match wins per field' },
    gap: { type: ['number', 'string'], default: 0, description: 'Body region gap' },
    children: { type: 'node', required: true, description: 'Body regions, composed from any React or NCTGraphite components' },
  }, slots: { header: 'Header', default: 'Body regions', footer: 'Footer' }, emits: [], dependencies: ['NCTGraphiteGrid'],
};
export interface NCTGraphiteLayoutShellProps {
  header?: ReactNode; footer?: ReactNode; columns?: string; wideMinWidth?: number; wideColumns?: string;
  breakpoints?: NCTGraphiteGridBreakpoint[];
  gap?: number | string; className?: string; style?: CSSProperties; children: ReactNode;
}
/** Unstyled shell for composing independent regions without imposing a theme. */
export function NCTGraphiteLayoutShell({ header, footer, columns = '1fr', wideMinWidth, wideColumns, breakpoints, gap = 0, className = '', style, children }: NCTGraphiteLayoutShellProps) {
  return <div className={className} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, ...style }}>
    {header}
    <NCTGraphiteGrid columns={columns} wideMinWidth={wideMinWidth} wideColumns={wideColumns} breakpoints={breakpoints} gap={gap} style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0 }}>{children}</NCTGraphiteGrid>
    {footer}
  </div>;
}
