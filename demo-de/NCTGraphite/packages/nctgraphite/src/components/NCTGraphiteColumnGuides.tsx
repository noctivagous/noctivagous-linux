import type { CSSProperties } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteColumnGuidesMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteColumnGuides', category: 'layout',
  description: 'Visual column/gutter guides mirroring a content grid: translucent cells over a gutter bed that shows through the gaps',
  props: {
    columns: { type: 'string', default: '1fr', description: 'Track list mirroring the content grid (grid-template-columns)' },
    gap: { type: ['number', 'string'], default: 0, description: 'Gutter mirroring the content grid (px number or CSS value)' },
    count: { type: 'number', required: true, description: 'Number of column cells to paint' },
    columnColor: { type: 'string', required: false, description: 'Cell tint (CSS color)' },
    gutterColor: { type: 'string', required: false, description: 'Bed color showing through the gaps (CSS color)' },
    className: { type: 'string', required: false, description: 'Extra classes' },
  },
  slots: {}, emits: [], dependencies: [],
};

export interface NCTGraphiteColumnGuidesProps {
  columns?: string;
  gap?: number | string;
  count: number;
  columnColor?: string;
  gutterColor?: string;
  className?: string;
  style?: CSSProperties;
}

/** Column/gutter guide layer. Mirror the content grid's `columns` and `gap`,
 * then layer inside NCTGraphiteOverlay next to the content (and optionally
 * NCTGraphiteBaseline); the overlay stretches this layer to the content size
 * so guides span it without affecting layout. */
export function NCTGraphiteColumnGuides({
  columns = '1fr', gap = 0, count, columnColor = 'currentColor', gutterColor = 'transparent',
  className = '', style,
}: NCTGraphiteColumnGuidesProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        background: gutterColor,
        ...style,
      }}
    >
      {Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => (
        <div key={i} style={{ background: columnColor, minWidth: 0, minHeight: 0 }} />
      ))}
    </div>
  );
}
