import { Children, useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteSplitterMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSplitter', category: 'layout',
  description: 'Resizable pane splitter: drag handles (and arrow keys) distribute space between panes as fractions',
  props: {
    direction: { type: ['row', 'column'], default: 'row', description: 'Pane axis (flex-direction)' },
    defaultSizes: { type: 'array', required: false, description: 'Initial per-pane fractions summing to 1 (uncontrolled mode)' },
    sizes: { type: 'array', required: false, description: 'Per-pane fractions summing to 1 (controlled mode; pairs with onSizesChange)' },
    onSizesChange: { type: 'function', required: false, description: 'Called with the next fractions after drag or keyboard resize' },
    minSize: { type: 'number', default: 0.1, description: 'Minimum pane fraction (0-1) during resize' },
    handleSize: { type: ['number', 'string'], default: 8, description: 'Handle thickness (px number or CSS value)' },
    children: { type: 'node', required: true, description: 'Two or more panes' },
  },
  slots: { default: 'Resizable panes' }, emits: [], dependencies: [],
};

export interface NCTGraphiteSplitterProps {
  direction?: 'row' | 'column';
  defaultSizes?: number[];
  sizes?: number[];
  onSizesChange?: (sizes: number[]) => void;
  minSize?: number;
  handleSize?: number | string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

function normalize(sizes: number[] | undefined, count: number): number[] {
  if (!sizes || sizes.length !== count || sizes.some(s => !(s > 0))) {
    return Array.from({ length: count }, () => 1 / count);
  }
  const total = sizes.reduce((a, b) => a + b, 0);
  return total > 0 ? sizes.map(s => s / total) : Array.from({ length: count }, () => 1 / count);
}

/** Move `deltaFraction` of total space from pane `index + 1` to pane `index`,
 * clamped so neither pane drops below `minSize`. Pure; powers drag + keyboard. */
export function shiftPaneSizes(base: number[], index: number, deltaFraction: number, minSize: number): number[] {
  const next = [...base];
  const clamped = Math.min(
    Math.max(base[index] + deltaFraction, minSize),
    base[index] + base[index + 1] - minSize,
  );
  next[index + 1] = base[index] + base[index + 1] - clamped;
  next[index] = clamped;
  return next;
}

/** Resizable panes separated by draggable, keyboard-adjustable handles. */
export function NCTGraphiteSplitter({
  direction = 'row', defaultSizes, sizes, onSizesChange, minSize = 0.1,
  handleSize = 8, className = '', style, children,
}: NCTGraphiteSplitterProps) {
  const panes = Children.toArray(children);
  const count = Math.max(2, panes.length);
  const [internal, setInternal] = useState<number[]>(() => normalize(defaultSizes, count));
  const effective = normalize(sizes ?? internal, count);
  const rootRef = useRef<HTMLDivElement>(null);
  const row = direction === 'row';

  const applySizes = useCallback((next: number[]) => {
    if (sizes === undefined) setInternal(next);
    onSizesChange?.(next);
  }, [sizes, onSizesChange]);

  const shift = useCallback((base: number[], index: number, deltaFraction: number) => {
    applySizes(shiftPaneSizes(base, index, deltaFraction, minSize));
  }, [minSize, applySizes]);

  const startDrag = (index: number, clientOrigin: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const span = (row ? rect.width : rect.height) || 1;
    const start = [...effective];
    const move = (event: PointerEvent) => {
      const at = row ? event.clientX : event.clientY;
      shift(start, index, (at - clientOrigin) / span);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div ref={rootRef} className={className} style={{ display: 'flex', flexDirection: direction, minWidth: 0, minHeight: 0, ...style }}>
      {panes.slice(0, count).map((pane, i) => (
        <div key={i} style={{ display: 'flex', minWidth: 0, minHeight: 0, flex: `0 0 ${effective[i] * 100}%` }}>
          <div style={{ flex: '1 1 auto', minWidth: 0, minHeight: 0, overflow: 'auto' }}>{pane}</div>
          {i < count - 1 ? (
            <div
              role="separator"
              aria-orientation={row ? 'vertical' : 'horizontal'}
              aria-label={`Resize pane ${i + 1} and ${i + 2}`}
              tabIndex={0}
              onPointerDown={event => {
                (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
                startDrag(i, row ? event.clientX : event.clientY);
              }}
              onKeyDown={event => {
                const forward = row ? event.key === 'ArrowRight' || event.key === 'ArrowDown' : event.key === 'ArrowDown' || event.key === 'ArrowRight';
                const back = row ? event.key === 'ArrowLeft' || event.key === 'ArrowUp' : event.key === 'ArrowUp' || event.key === 'ArrowLeft';
                if (forward || back) { event.preventDefault(); shift(effective, i, back ? -0.02 : 0.02); }
              }}
              style={{
                flex: '0 0 auto', cursor: row ? 'col-resize' : 'row-resize', touchAction: 'none',
                ...(row ? { width: typeof handleSize === 'number' ? `${handleSize}px` : handleSize } : { height: typeof handleSize === 'number' ? `${handleSize}px` : handleSize }),
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
