import type { CSSProperties } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteValueDisplayMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteValueDisplay',
  category: 'widgets',
  description: 'Digital readout for parameter values, time, and status text',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase caption above the readout' },
    value: { type: ['string', 'number'], required: true, description: 'Value to display' },
    unit: { type: 'string', required: false, description: 'Optional unit suffix' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteValueDisplayProps extends NCTGraphiteAppearanceProps {
  label?: string;
  value: string | number;
  unit?: string;
  style?: CSSProperties;
}

/** Digital readout display (Pro Audio Control Lab display idiom). Read-only. */
export function NCTGraphiteValueDisplay({ label, value, unit, style, opacity, cornerRadius }: NCTGraphiteValueDisplayProps) {
  const text = unit ? `${value} ${unit}` : String(value);
  return (
    <div
      className="nctgraphite-value-display"
      role="status"
      aria-label={label ? `${label}: ${text}` : text}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        gap: 2,
        minWidth: 64,
        padding: 'calc(var(--nct-control-padding, 0.5rem) / 2) var(--nct-control-padding, 0.5rem)',
        borderRadius: 'var(--nct-control-radius, 8px)',
        background: 'var(--nct-field-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
        border: '1px solid var(--nct-border, var(--border, #23232f))',
        ...style,
        ...appearanceStyle({ opacity, cornerRadius }),
      }}
    >
      {label ? (
        <span style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--nct-dim-text, var(--text-dim, #7a7680))' }}>
          {label}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: 'var(--font-alt-mono, ui-monospace, monospace)',
          fontSize: 'calc(var(--nct-control-font-size, 11px) + 2px)',
          color: 'var(--nct-display-text, var(--accent-2, #00e5ff))',
        }}
      >
        {text}
      </span>
    </div>
  );
}
