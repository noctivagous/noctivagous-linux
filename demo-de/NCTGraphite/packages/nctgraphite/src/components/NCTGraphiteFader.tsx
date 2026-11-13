import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { useRef } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteFaderMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteFader',
  category: 'widgets',
  description: 'Vertical fader with drag and arrow-key control for mixer channels',
  props: {
    label: { type: 'string', required: true, description: 'Uppercase control label' },
    value: { type: 'number', required: true, description: 'Current value' },
    min: { type: 'number', required: true, description: 'Range minimum' },
    max: { type: 'number', required: true, description: 'Range maximum' },
    step: { type: 'number', required: false, description: 'Keyboard step' },
    height: { type: 'number', required: false, description: 'Track height in pixels' },
    format: { type: 'function', required: false, description: '(v: number) => string for the readout' },
    onChange: { type: 'function', required: true, description: '(v: number) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteFaderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  height?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
  style?: CSSProperties;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Vertical fader (Pro Audio Control Lab fader-bank idiom) with keyboard support. */
export function NCTGraphiteFader({
  label, value, min, max, step = (max - min) / 100, height = 120, format, onChange, hint, style,
}: NCTGraphiteFaderProps) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const span = max - min || 1;
  const ratio = clamp((value - min) / span, 0, 1);
  const text = format ? format(value) : String(Math.round(value * 100) / 100);

  const commit = (v: number): void => onChange(clamp(v, min, max));
  const valueFromClientY = (clientY: number): number => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return value;
    return max - ((clientY - rect.top) / rect.height) * span;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = value + step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = value - step;
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else if (e.key === 'PageUp') next = value + step * 10;
    else if (e.key === 'PageDown') next = value - step * 10;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };

  return (
    <div className="nctgraphite-fader" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }}>
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 1000) / 1000}
        aria-valuetext={text}
        onKeyDown={onKeyDown}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          commit(valueFromClientY(e.clientY));
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => { if (dragging.current) commit(valueFromClientY(e.clientY)); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
        style={{
          width: 'var(--nct-fader-width, 32px)',
          height,
          borderRadius: 'var(--nct-control-radius, 8px)',
          background: 'var(--nct-field-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
          border: '1px solid var(--nct-border, var(--border, #23232f))',
          position: 'relative',
          cursor: 'ns-resize',
          outline: 'none',
          touchAction: 'none',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 6,
            width: 4,
            marginLeft: -2,
            height: `calc((100% - 12px) * ${ratio})`,
            borderRadius: 2,
            background: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 3,
            right: 3,
            height: 10,
            bottom: `calc(6px + (100% - 22px) * ${ratio})`,
            borderRadius: 3,
            background: 'var(--nct-surface-2, var(--panel-3, #222230))',
            border: '1px solid var(--nct-border, var(--border, #23232f))',
          }}
        />
      </div>
      <NCTGraphiteParamLabel label={label} hint={hint} trailing={text} />
    </div>
  );
}
