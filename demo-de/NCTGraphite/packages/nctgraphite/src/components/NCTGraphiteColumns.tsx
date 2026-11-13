import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteColumnsMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteColumns', category: 'layout',
  description: 'Flows content through typographic columns using CSS multicolumn layout',
  props: {
    count: { type: 'number', required: false, description: 'Maximum number of columns' },
    width: { type: ['number', 'string'], required: false, description: 'Ideal column width' },
    gap: { type: ['number', 'string'], required: false, description: 'Gap between columns' },
    children: { type: 'node', required: true, description: 'Content in reading order' },
  }, slots: { default: 'Content in reading order' }, emits: [], dependencies: [],
};
export interface NCTGraphiteColumnsProps {
  count?: number; width?: number | string; gap?: number | string;
  className?: string; style?: CSSProperties; children: ReactNode;
}
/** Flow text and other content across columns, preserving document order. */
export function NCTGraphiteColumns({ count, width, gap, className = '', style, children }: NCTGraphiteColumnsProps) {
  return <div className={className} style={{ columnCount: count, columnWidth: width, columnGap: gap, ...style }}>{children}</div>;
}
