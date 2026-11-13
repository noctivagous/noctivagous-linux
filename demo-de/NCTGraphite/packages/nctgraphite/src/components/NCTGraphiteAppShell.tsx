import { Children, useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteGrid } from './NCTGraphiteGrid.js';
import { bindStageFocus } from '../bindings/NCTGraphiteStageFocus.js';

export const NCTGraphiteAppShellMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteAppShell',
  category: 'layout',
  description:
    'App shell: header, N body sections, and footer. Default is 3 sections (the shading-lab arrangement). Row shells stack to one column below lg and apply proportion at/above lg. The body fills leftover viewport height; each section is a stretched grid cell so its child gets a definite height. Any section may hold a nested NCTGraphiteAppShell for subdivisions.',
  props: {
    header: { type: 'node', required: false, description: 'Header node (title bar / toolbar). Omitted header collapses to zero height.' },
    footer: { type: 'node', required: false, description: 'Footer node (status readout). Omitted footer collapses to zero height.' },
    sectionCount: { type: 'number', default: 3, description: 'Number of body sections; extra children clamp, missing sections render as empty containers' },
    orientation: { type: ['row', 'column'], default: 'row', description: 'Body section axis: row (left-to-right) or column (top-to-bottom)' },
    proportion: { type: ['string', 'number[]'], required: false, description: 'Per-section sizing: grid track list (e.g. "220px 1fr 300px") or flex weights (e.g. [1, 2, 1]); defaults to equal splits' },
    minWidth: { type: 'number', required: false, description: 'Minimum shell width in px' },
    maxWidth: { type: 'number', default: 1600, description: 'Maximum shell width in px' },
    gap: { type: ['number', 'string'], default: 12, description: 'Gap between header, body, footer, and sections (px number or CSS value)' },
    stackMinWidth: { type: 'number', default: 1024, description: 'Viewport px at/above which row shells apply the proportion tracks (below stacks to one column)' },
    sectionClassName: { type: ['string', 'array'], required: false, description: 'Class for every body region, or one per region' },
    sectionStyle: { type: ['object', 'array'], required: false, description: 'Style for every body region, or one per region' },
    children: { type: 'node', required: true, description: 'Section content, one node per section in order' },
    className: { type: 'string', required: false, description: 'Extra root classes' },
  },
  slots: {
    header: 'Header node',
    default: 'One node per body section; a section may be a nested NCTGraphiteAppShell',
    footer: 'Footer node',
  },
  emits: [],
  dependencies: ['NCTGraphiteGrid'],
  examples: [
    '<NCTGraphiteAppShell header={<Bar />} footer={<Status />}><Keys /><Canvas /><Controls /></NCTGraphiteAppShell>',
    '<NCTGraphiteAppShell sectionCount={2} orientation="column"><Top /><NCTGraphiteAppShell sectionCount={2}><Left /><Right /></NCTGraphiteAppShell></NCTGraphiteAppShell>',
  ],
};

export interface NCTGraphiteAppShellProps {
  header?: ReactNode;
  footer?: ReactNode;
  sectionCount?: number;
  orientation?: 'row' | 'column';
  proportion?: string | number[];
  minWidth?: number;
  maxWidth?: number;
  gap?: number | string;
  stackMinWidth?: number;
  sectionClassName?: string | string[];
  sectionStyle?: CSSProperties | CSSProperties[];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

function resolveTracks(
  proportion: string | number[] | undefined,
  count: number,
  orientation: 'row' | 'column',
): { columns?: string; rows?: string } {
  let track: string;
  if (typeof proportion === 'string' && proportion.trim() !== '') {
    track = proportion.trim();
  } else if (Array.isArray(proportion) && proportion.length > 0) {
    const weights = proportion.slice(0, count);
    while (weights.length < count) weights.push(1);
    track = weights.map((w) => `${w}fr`).join(' ');
  } else {
    track = Array.from({ length: count }, () => '1fr').join(' ');
  }
  return orientation === 'row' ? { columns: track } : { rows: track };
}

function toCssWidth(value: number | undefined): string | undefined {
  return value == null ? undefined : `${value}px`;
}

/** App shell: header, N body sections, footer. Body and sections fill leftover viewport height. */
export function NCTGraphiteAppShell({
  header,
  footer,
  sectionCount = 3,
  orientation = 'row',
  proportion,
  minWidth,
  maxWidth = 1600,
  gap = 12,
  stackMinWidth = 1024,
  sectionClassName,
  sectionStyle,
  className = '',
  style,
  children,
}: NCTGraphiteAppShellProps) {
  const count = Math.max(1, Math.floor(sectionCount));
  const items: ReactNode[] = Children.toArray(children).slice(0, count);
  while (items.length < count) items.push(null);
  const tracks = resolveTracks(proportion, count, orientation);
  const gapCss = typeof gap === 'number' ? `${gap}px` : gap;
  // Row shells stack to a single column below lg (the StageBody / shading-lab
  // idiom); the proportion track applies at/above lg. Column shells stack natively.
  const wideTracks = orientation === 'row' ? tracks.columns : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    return bindStageFocus(root);
  }, []);

  return (
    <div
      ref={rootRef}
      data-safe-area-inset-root
      className={`min-h-screen w-full flex flex-col ${className}`}
      style={{ boxSizing: 'border-box', paddingTop: 'var(--safe-area-inset-top)', maxWidth: toCssWidth(maxWidth), minWidth: toCssWidth(minWidth), marginInline: 'auto', ...style }}
    >
      {header ? <header>{header}</header> : null}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, padding: gapCss }}>
        <NCTGraphiteGrid
          columns="1fr"
          rows={tracks.rows ?? 'auto'}
          wideMinWidth={stackMinWidth}
          wideColumns={wideTracks}
          wideRows={orientation === 'row' ? '1fr' : undefined}
          gap={gap}
          style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0 }}
        >
          {items.map((child, i) => (
            <section
              key={`region-${i}`}
              className={Array.isArray(sectionClassName) ? sectionClassName[i] : sectionClassName}
              style={{
                minWidth: 0, minHeight: 0, height: '100%', display: 'grid',
                ...(Array.isArray(sectionStyle) ? sectionStyle[i] : sectionStyle),
              }}
            >
              {child}
            </section>
          ))}
        </NCTGraphiteGrid>
      </div>
      {footer ? <footer>{footer}</footer> : null}
    </div>
  );
}
