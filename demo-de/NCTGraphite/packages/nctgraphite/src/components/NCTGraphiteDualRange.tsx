import type { CSSProperties } from 'react';
import { useState } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteDualRangeMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteDualRange',
  category: 'widgets',
  description: 'Two-handle range selector for loops, bands, and zones',
  props: {
    label: { type: 'string', required: false, description: 'Optional uppercase label above the control' },
    low: { type: 'number', required: false, description: 'Controlled lower value' },
    high: { type: 'number', required: false, description: 'Controlled upper value' },
    min: { type: 'number', required: true, description: 'Range minimum' },
    max: { type: 'number', required: true, description: 'Range maximum' },
    step: { type: 'number', required: false, description: 'Step for both handles' },
    onChange: { type: 'function', required: false, description: '({low, high}) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteDualRangeProps {
  label?: string;
  low?: number;
  high?: number;
  defaultLow?: number;
  defaultHigh?: number;
  min: number;
  max: number;
  step?: number;
  onChange?: (v: { low: number; high: number }) => void;
  hint?: string;
  style?: CSSProperties;
}

/** Dual-handle range selector: two native sliders sharing one band visual. */
export function NCTGraphiteDualRange({
  label, low, high, defaultLow, defaultHigh, min, max, step = 1, onChange, hint, style,
}: NCTGraphiteDualRangeProps) {
  const [innerLow, setInnerLow] = useState(defaultLow ?? min);
  const [innerHigh, setInnerHigh] = useState(defaultHigh ?? max);
  const lo = low ?? innerLow;
  const hi = high ?? innerHigh;
  const span = max - min || 1;
  const set = (nextLow: number, nextHigh: number): void => {
    const ordered: [number, number] = nextLow <= nextHigh ? [nextLow, nextHigh] : [nextHigh, nextLow];
    if (low === undefined) setInnerLow(ordered[0]);
    if (high === undefined) setInnerHigh(ordered[1]);
    onChange?.({ low: ordered[0], high: ordered[1] });
  };
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;
  const sliderStyle: CSSProperties = {
    width: '100%',
    accentColor: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
    margin: 0,
  };
  return (
    <div className="nctgraphite-dual-range" role="group" aria-label={label} style={style}>
      {label ? <NCTGraphiteParamLabel label={label} hint={hint} trailing={`${lo} – ${hi}`} /> : null}
      <div
        aria-hidden="true"
        style={{
          height: 4,
          borderRadius: 2,
          margin: '4px 0 8px',
          background: `linear-gradient(to right,
            var(--nct-surface-2, var(--panel-3, #222230)) 0%,
            var(--nct-surface-2, var(--panel-3, #222230)) ${loPct}%,
            var(--nct-accent-bg, var(--accent, #7c5cff)) ${loPct}%,
            var(--nct-accent-bg, var(--accent, #7c5cff)) ${hiPct}%,
            var(--nct-surface-2, var(--panel-3, #222230)) ${hiPct}%,
            var(--nct-surface-2, var(--panel-3, #222230)) 100%)`,
        }}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--nct-control-gap, 6px)', fontSize: 'var(--nct-control-font-size, 11px)' }}>
        <span style={{ minWidth: 28, color: 'var(--nct-dim-text, var(--text-dim, #7a7680))' }}>Low</span>
        <input type="range" aria-label={label ? `${label} low` : 'Range low'} min={min} max={max} step={step} value={lo} onChange={(e) => set(Number(e.target.value), hi)} style={sliderStyle} />
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--nct-control-gap, 6px)', fontSize: 'var(--nct-control-font-size, 11px)' }}>
        <span style={{ minWidth: 28, color: 'var(--nct-dim-text, var(--text-dim, #7a7680))' }}>High</span>
        <input type="range" aria-label={label ? `${label} high` : 'Range high'} min={min} max={max} step={step} value={hi} onChange={(e) => set(lo, Number(e.target.value))} style={sliderStyle} />
      </label>
    </div>
  );
}
