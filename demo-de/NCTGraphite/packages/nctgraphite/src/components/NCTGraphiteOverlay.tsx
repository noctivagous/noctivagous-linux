import { Children, isValidElement, type CSSProperties, type ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteOverlayMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteOverlay', category: 'layout',
  description: 'Layers children in one grid cell while retaining their natural size',
  props: {
    align: { type: ['start', 'center', 'end', 'stretch'], default: 'stretch', description: 'Vertical alignment of layers' },
    justify: { type: ['start', 'center', 'end', 'stretch'], default: 'stretch', description: 'Horizontal alignment of layers' },
    children: { type: 'node', required: true, description: 'Layers, painted in document order' },
  },
  slots: { default: 'Layers, painted in document order' }, emits: [], dependencies: [],
};

export interface NCTGraphiteOverlayProps {
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'stretch';
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Overlap content without removing it from normal layout sizing. */
export function NCTGraphiteOverlay({ align = 'stretch', justify = 'stretch', className = '', style, children }: NCTGraphiteOverlayProps) {
  return <div className={className} style={{ display: 'grid', alignItems: align, justifyItems: justify, ...style }}>
    {Children.toArray(children).map((child, index) => <div key={isValidElement(child) ? child.key : index} style={{ gridArea: '1 / 1', minWidth: 0 }}>{child}</div>)}
  </div>;
}
