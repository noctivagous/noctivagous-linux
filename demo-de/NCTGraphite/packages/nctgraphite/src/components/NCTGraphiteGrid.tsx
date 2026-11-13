import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export interface NCTGraphiteGridBreakpoint {
  minWidth: number;
  columns?: string;
  rows?: string;
  gap?: number | string;
  template?: string;
}

/** Last breakpoint at or below the viewport width (undefined when none match; SSR renders base). */
function useBreakpoint(breakpoints: NCTGraphiteGridBreakpoint[] | undefined): NCTGraphiteGridBreakpoint | undefined {
  const [match, setMatch] = useState<NCTGraphiteGridBreakpoint | undefined>(undefined);
  useEffect(() => {
    if (breakpoints == null || breakpoints.length === 0 || typeof window === 'undefined') return;
    const ordered = [...breakpoints].sort((a, b) => a.minWidth - b.minWidth);
    const mqls = ordered.map(bp => window.matchMedia(`(min-width: ${bp.minWidth}px)`));
    const onChange = () => {
      let next: NCTGraphiteGridBreakpoint | undefined;
      mqls.forEach((mql, i) => { if (mql.matches) next = ordered[i]; });
      setMatch(next);
    };
    onChange();
    mqls.forEach(mql => mql.addEventListener('change', onChange));
    return () => mqls.forEach(mql => mql.removeEventListener('change', onChange));
  }, [breakpoints]);
  return match;
}

/** Tracks a min-width media query (client-only; labs render client-side). */
function useWide(minWidth: number | undefined): boolean {
  const [match, setMatch] = useState<boolean>(false);
  useEffect(() => {
    if (minWidth == null || typeof window === 'undefined') return;
    const mql = window.matchMedia(`(min-width: ${minWidth}px)`);
    const onChange = () => setMatch(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [minWidth]);
  return match;
}

export const NCTGraphiteGridMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteGrid',
  category: 'layout',
  description: 'CSS Grid layout with deterministic behavior for reliable composition',
  props: {
    columns: { type: 'string', default: '1fr', description: 'Grid template columns (grid-template-columns)' },
    rows: { type: 'string', default: 'auto', description: 'Grid template rows (grid-template-rows)' },
    gap: { type: ['number', 'string'], default: 0, description: 'Gap between items (px number or CSS value)' },
    template: { type: 'string', required: false, description: 'Full grid-template shorthand (overrides columns/rows)' },
    autoFlow: { type: 'string', required: false, description: 'Placement direction for implicit grid items' },
    autoRows: { type: 'string', required: false, description: 'Size of implicit rows' },
    autoColumns: { type: 'string', required: false, description: 'Size of implicit columns' },
    align: { type: 'string', required: false, description: 'Cross-axis alignment of grid items' },
    justify: { type: 'string', required: false, description: 'Inline-axis alignment of grid items' },
    alignContent: { type: 'string', required: false, description: 'Distribution of grid tracks on the block axis (align-content)' },
    justifyContent: { type: 'string', required: false, description: 'Distribution of grid tracks on the inline axis (justify-content)' },
    padding: { type: ['number', 'string'], required: false, description: 'Inner spacing (px number or CSS value)' },
    wideMinWidth: { type: 'number', required: false, description: 'Viewport px at which the wide* variants apply (matchMedia)' },
    wideColumns: { type: 'string', required: false, description: 'grid-template-columns at/above wideMinWidth' },
    wideRows: { type: 'string', required: false, description: 'grid-template-rows at/above wideMinWidth' },
    wideGap: { type: ['number', 'string'], required: false, description: 'Gap at/above wideMinWidth' },
    wideTemplate: { type: 'string', required: false, description: 'Full grid-template at/above wideMinWidth' },
    breakpoints: { type: 'array', required: false, description: 'Ordered { minWidth, columns?, rows?, gap?, template? } width breakpoints; the last match at/below the viewport wins per field and extends the wide* variants' },
    children: { type: 'node', required: true, description: 'Grid items' },
  },
  slots: { default: 'Grid items' },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteGridProps {
  columns?: string;
  rows?: string;
  gap?: number | string;
  template?: string;
  autoFlow?: CSSProperties['gridAutoFlow'];
  autoRows?: CSSProperties['gridAutoRows'];
  autoColumns?: CSSProperties['gridAutoColumns'];
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyItems'];
  alignContent?: CSSProperties['alignContent'];
  justifyContent?: CSSProperties['justifyContent'];
  padding?: number | string;
  wideMinWidth?: number;
  wideColumns?: string;
  wideRows?: string;
  wideGap?: number | string;
  wideTemplate?: string;
  breakpoints?: NCTGraphiteGridBreakpoint[];
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** CSS Grid with deterministic columns/rows/gap, plus optional wide-viewport variants. */
export function NCTGraphiteGrid({
  columns = '1fr', rows = 'auto', gap = 0, template, autoFlow, autoRows, autoColumns, align, justify,
  alignContent, justifyContent, padding,
  wideMinWidth, wideColumns, wideRows, wideGap, wideTemplate, breakpoints,
  className = '', style, children,
}: NCTGraphiteGridProps) {
  const wide = useWide(wideMinWidth);
  const bp = useBreakpoint(breakpoints);
  const effTemplate = bp?.template ?? (wide && wideTemplate ? wideTemplate : template);
  const effColumns = bp?.columns ?? (wide && wideColumns ? wideColumns : columns);
  const effRows = bp?.rows ?? (wide && wideRows ? wideRows : rows);
  const effGap = bp?.gap ?? (wide && wideGap != null ? wideGap : gap);
  // A slash-less template is a column track list, not grid-template
  // shorthand (which would wrongly produce rows).
  const templateIsColumns = effTemplate != null && !effTemplate.includes('/');
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridAutoFlow: autoFlow, gridAutoRows: autoRows, gridAutoColumns: autoColumns,
        alignItems: align, justifyItems: justify,
        alignContent, justifyContent,
        padding: typeof padding === 'number' ? `${padding}px` : padding,
        ...(effTemplate && !templateIsColumns
          ? { gridTemplate: effTemplate }
          : {
              gridTemplateColumns: templateIsColumns ? (effTemplate as string) : effColumns,
              gridTemplateRows: effRows,
            }),
        gap: typeof effGap === 'number' ? `${effGap}px` : effGap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
