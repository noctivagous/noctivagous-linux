import type { CSSProperties } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteMeterMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteMeter',
  category: 'widgets',
  description: 'Read-only level meter for signal, gain, and progress levels',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the meter' },
    value: { type: 'number', required: true, description: 'Current level' },
    min: { type: 'number', required: false, description: 'Scale minimum (default 0)' },
    max: { type: 'number', required: false, description: 'Scale maximum (default 100)' },
    peak: { type: 'number', required: false, description: 'Optional held peak marker' },
    orientation: { type: 'string', required: false, description: '"horizontal" (default) or "vertical"' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteMeterProps extends NCTGraphiteAppearanceProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  peak?: number;
  orientation?: 'horizontal' | 'vertical';
  width?: number;
  height?: number;
  style?: CSSProperties;
}

/** Read-only level meter (`role="meter"`). Never interactive. */
export function NCTGraphiteMeter({
  label, value, min = 0, max = 100, peak, orientation = 'horizontal',
  width, height = 96, style,
  opacity, cornerRadius,
}: NCTGraphiteMeterProps) {
  const span = max - min || 1;
  const ratio = Math.max(0, Math.min(1, (value - min) / span));
  const peakRatio = peak === undefined ? null : Math.max(0, Math.min(1, (peak - min) / span));
  const vertical = orientation === 'vertical';
  return (
    <div className="nctgraphite-meter" style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, ...style, ...appearanceStyle({ opacity, cornerRadius }) }}>
      {label ? <NCTGraphiteParamLabel label={label} trailing={String(Math.round(ratio * 100))} /> : null}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 1000) / 1000}
        style={{
          position: 'relative',
          width: vertical ? (width ?? 12) : (width ?? 120),
          height: vertical ? height : 8,
          borderRadius: 4,
          background: 'var(--nct-surface-2, var(--panel-3, #222230))',
          overflow: 'hidden',
        }}
      >
        <div
          aria-hidden="true"
          style={vertical
            ? { position: 'absolute', left: 0, right: 0, bottom: 0, height: `${ratio * 100}%`, background: 'var(--nct-meter-fill, var(--success, #4ecdc4))' }
            : { position: 'absolute', left: 0, top: 0, bottom: 0, width: `${ratio * 100}%`, background: 'var(--nct-meter-fill, var(--success, #4ecdc4))' }}
        />
        {peakRatio !== null ? (
          <div
            aria-hidden="true"
            style={vertical
              ? { position: 'absolute', left: 0, right: 0, bottom: `${peakRatio * 100}%`, height: 2, background: 'var(--nct-meter-peak, var(--danger, #e84855))' }
              : { position: 'absolute', top: 0, bottom: 0, left: `${peakRatio * 100}%`, width: 2, background: 'var(--nct-meter-peak, var(--danger, #e84855))' }}
          />
        ) : null}
      </div>
    </div>
  );
}
