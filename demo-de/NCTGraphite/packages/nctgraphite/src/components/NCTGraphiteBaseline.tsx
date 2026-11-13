import type { CSSProperties } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteBaselineMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteBaseline', category: 'layout',
  description: 'Visual baseline-rhythm guide: paints horizontal rules every line unit for snapping stacks and text to a shared rhythm',
  props: {
    line: { type: ['number', 'string'], default: 8, description: 'Rhythm unit between rules (px number or CSS value)' },
    offset: { type: ['number', 'string'], required: false, description: 'Distance of the first rule from the top (px number or CSS value)' },
    color: { type: 'string', required: false, description: 'Rule color (CSS color)' },
    className: { type: 'string', required: false, description: 'Extra classes' },
  },
  slots: {}, emits: [], dependencies: [],
};

export interface NCTGraphiteBaselineProps {
  line?: number | string;
  offset?: number | string;
  color?: string;
  className?: string;
  style?: CSSProperties;
}

/** Baseline-rhythm guide layer. Layer inside NCTGraphiteOverlay next to content;
 * the overlay stretches this empty layer to the content size so rules span it. */
export function NCTGraphiteBaseline({ line = 8, offset = 0, color = 'currentColor', className = '', style }: NCTGraphiteBaselineProps) {
  const unit = typeof line === 'number' ? `${line}px` : line;
  const fromTop = typeof offset === 'number' ? `${offset}px` : offset;
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        minHeight: unit,
        backgroundImage: `repeating-linear-gradient(to bottom, ${color} 0, ${color} 1px, transparent 1px, transparent ${unit})`,
        backgroundPositionY: fromTop,
        ...style,
      }}
    />
  );
}
