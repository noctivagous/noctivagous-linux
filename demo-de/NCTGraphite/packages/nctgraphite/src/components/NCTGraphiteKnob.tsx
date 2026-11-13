import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { useId, useRef } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteKnobMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteKnob',
  category: 'widgets',
  description: 'Rotary knob with drag and arrow-key control for audio parameters',
  props: {
    label: { type: 'string', required: true, description: 'Uppercase control label' },
    value: { type: 'number', required: true, description: 'Current value' },
    min: { type: 'number', required: true, description: 'Range minimum' },
    max: { type: 'number', required: true, description: 'Range maximum' },
    step: { type: 'number', required: false, description: 'Keyboard/detent step' },
    variant: { type: 'string', required: false, description: '"continuous" (default), "detented", or "bipolar"' },
    format: { type: 'function', required: false, description: '(v: number) => string for the readout' },
    onChange: { type: 'function', required: true, description: '(v: number) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  variant?: 'continuous' | 'detented' | 'bipolar';
  size?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
  style?: CSSProperties;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Rotary knob (Pro Audio Control Lab idiom): vertical drag plus full keyboard support. */
export function NCTGraphiteKnob({
  label, value, min, max, step = (max - min) / 100, variant = 'continuous',
  size = 48, format, onChange, hint, style,
}: NCTGraphiteKnobProps) {
  const id = useId();
  const dragging = useRef<number | null>(null);
  const span = max - min || 1;
  const ratio = clamp((value - min) / span, 0, 1);
  const snap = (v: number): number => {
    if (variant !== 'detented') return clamp(v, min, max);
    const steps = Math.round((v - min) / step);
    return clamp(min + steps * step, min, max);
  };
  const commit = (v: number): void => onChange(snap(v));
  const angle = -135 + ratio * 270;
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const px = cx + r * Math.cos(rad);
  const py = cy + r * Math.sin(rad);
  const text = format ? format(value) : String(Math.round(value * 100) / 100);

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
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragging.current = e.clientY;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging.current === null) return;
    const dy = dragging.current - e.clientY;
    dragging.current = e.clientY;
    commit(value + (dy / 150) * span);
  };
  const endDrag = (): void => { dragging.current = null; };

  return (
    <div className="nctgraphite-knob" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4, ...style }}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 1000) / 1000}
        aria-valuetext={text}
        aria-describedby={`${id}-readout`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, var(--nct-surface-2, var(--panel-3, #222230)), var(--nct-surface, var(--panel, #15151e)))',
          border: '1px solid var(--nct-border, var(--border, #23232f))',
          position: 'relative',
          cursor: 'ns-resize',
          outline: 'none',
          touchAction: 'none',
        }}
      >
        <svg width={size} height={size} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
          <line x1={cx} y1={cy} x2={px} y2={py} stroke="var(--nct-accent-bg, var(--accent, #7c5cff))" strokeWidth={2} strokeLinecap="round" />
          {variant === 'bipolar' ? (
            <circle cx={cx} cy={4} r={1.5} fill="var(--nct-dim-text, var(--text-dim, #7a7680))" />
          ) : null}
        </svg>
      </div>
      <NCTGraphiteParamLabel label={label} hint={hint} trailing={text} />
      <span id={`${id}-readout`} hidden>{text}</span>
    </div>
  );
}
