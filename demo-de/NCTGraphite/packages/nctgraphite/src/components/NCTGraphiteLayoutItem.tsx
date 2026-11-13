import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteLayoutItemMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteLayoutItem', category: 'layout',
  description: 'Controls an item’s sizing and placement within a stack or grid',
  props: {
    grow: { type: 'number', required: false, description: 'Flex grow factor' },
    shrink: { type: 'number', required: false, description: 'Flex shrink factor' },
    basis: { type: ['number', 'string'], required: false, description: 'Flex basis' },
    align: { type: ['auto', 'start', 'end', 'center', 'stretch', 'baseline'], required: false, description: 'Self alignment' },
    column: { type: 'string', required: false, description: 'Grid column placement' },
    row: { type: 'string', required: false, description: 'Grid row placement' },
    area: { type: 'string', required: false, description: 'Named grid area' },
    children: { type: 'node', required: true, description: 'Item content' },
  }, slots: { default: 'Item content' }, emits: [], dependencies: [],
};
export interface NCTGraphiteLayoutItemProps {
  grow?: number; shrink?: number; basis?: number | string;
  align?: 'auto' | 'start' | 'end' | 'center' | 'stretch' | 'baseline';
  column?: string; row?: string; area?: string;
  className?: string; style?: CSSProperties; children: ReactNode;
}
/** A composition boundary for per-child flex and grid placement. */
export function NCTGraphiteLayoutItem({ grow, shrink, basis, align, column, row, area, className = '', style, children }: NCTGraphiteLayoutItemProps) {
  return <div className={className} style={{ minWidth: 0, minHeight: 0, flexGrow: grow, flexShrink: shrink, flexBasis: basis, alignSelf: align, gridColumn: column, gridRow: row, gridArea: area, ...style }}>{children}</div>;
}
