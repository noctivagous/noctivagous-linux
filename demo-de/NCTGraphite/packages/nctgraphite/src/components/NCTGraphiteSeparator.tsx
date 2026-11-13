import type { CSSProperties } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteSeparatorMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSeparator',
  category: 'widgets',
  description: 'Visual divider between control groups, horizontal or vertical',
  props: {
    orientation: { type: 'string', required: false, description: '"horizontal" (default) or "vertical"' },
    label: { type: 'string', required: false, description: 'Optional accessible label; unlabeled separators are hidden from assistive tech' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteSeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  style?: CSSProperties;
}

/** Divider between control groups (Proshade separator idiom). */
export function NCTGraphiteSeparator({ orientation = 'horizontal', label, style }: NCTGraphiteSeparatorProps) {
  const vertical = orientation === 'vertical';
  return (
    <div
      role="separator"
      aria-orientation={vertical ? 'vertical' : undefined}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="nctgraphite-separator"
      style={{
        background: 'var(--nct-border, var(--border, #23232f))',
        alignSelf: 'stretch',
        ...(vertical
          ? { width: 1, minHeight: 'var(--nct-control-height, 28px)' }
          : { height: 1, minWidth: '100%' }),
        ...style,
      }}
    />
  );
}
