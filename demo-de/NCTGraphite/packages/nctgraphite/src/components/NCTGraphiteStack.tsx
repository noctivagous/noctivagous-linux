import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteStackMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteStack',
  category: 'layout',
  description: 'Flexbox stack for vertical or horizontal arrangement of controls and content',
  props: {
    direction: { type: ['row', 'column', 'row-reverse', 'column-reverse'], default: 'column', description: 'Stack direction (flex-direction)' },
    gap: { type: ['number', 'string'], default: 0, description: 'Gap between items (px number or CSS value)' },
    align: { type: ['start', 'center', 'end', 'stretch', 'baseline'], default: 'stretch', description: 'Cross-axis alignment (align-items)' },
    justify: { type: ['start', 'center', 'end', 'between', 'around', 'evenly'], default: 'start', description: 'Main-axis distribution (justify-content)' },
    wrap: { type: 'boolean', default: false, description: 'Allow wrapping (flex-wrap)' },
    alignContent: { type: ['start', 'center', 'end', 'stretch', 'between', 'around', 'evenly'], required: false, description: 'Distribution of wrapped lines (align-content)' },
    padding: { type: ['number', 'string'], required: false, description: 'Inner spacing (px number or CSS value)' },
    children: { type: 'node', required: true, description: 'Stacked items' },
  },
  slots: { default: 'Stacked items' },
  emits: [],
  dependencies: [],
};

const alignMap: Record<string, string> = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', baseline: 'baseline' };
const justifyMap: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end',
  between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};
const alignContentMap: Record<string, string> = {
  start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch',
  between: 'space-between', around: 'space-around', evenly: 'space-evenly',
};

export interface NCTGraphiteStackProps {
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  gap?: number | string;
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  alignContent?: 'start' | 'center' | 'end' | 'stretch' | 'between' | 'around' | 'evenly';
  padding?: number | string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Flexbox stack (row/column) with gap and alignment. */
export function NCTGraphiteStack({
  direction = 'column', gap = 0, align = 'stretch', justify = 'start',
  wrap = false, alignContent, padding, className = '', style, children,
}: NCTGraphiteStackProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: direction,
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignContent: alignContent == null ? undefined : alignContentMap[alignContent],
        ...style,
      }}
    >
      {children}
    </div>
  );
}
