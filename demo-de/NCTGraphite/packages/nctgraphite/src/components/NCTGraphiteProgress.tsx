import type { CSSProperties } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteProgressMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteProgress',
  category: 'widgets',
  description: 'Determinate progress bar with accessible value semantics',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the bar' },
    value: { type: 'number', required: true, description: 'Current value' },
    max: { type: 'number', required: false, description: 'Maximum value (default 100)' },
    format: { type: 'function', required: false, description: '(v: number, max: number) => string for the readout' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteProgressProps extends NCTGraphiteAppearanceProps {
  label?: string;
  value: number;
  max?: number;
  format?: (v: number, max: number) => string;
  hint?: string;
  style?: CSSProperties;
}

/** Determinate progress bar (Proshade progress idiom) with `role="progressbar"`. */
export function NCTGraphiteProgress({ label, value, max = 100, format, hint, style, opacity, cornerRadius }: NCTGraphiteProgressProps) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const text = format ? format(value, max) : `${Math.round(ratio * 100)}%`;
  return (
    <div className="nctgraphite-progress" style={{ ...appearanceStyle({ opacity, cornerRadius }), ...style }}>
      {label || text ? <NCTGraphiteParamLabel label={label ?? 'Progress'} hint={hint} trailing={text} /> : null}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        style={{
          height: 8,
          borderRadius: 4,
          background: 'var(--nct-surface-2, var(--panel-3, #222230))',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${ratio * 100}%`,
            height: '100%',
            borderRadius: 4,
            background: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
          }}
        />
      </div>
    </div>
  );
}
