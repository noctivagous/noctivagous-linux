import type { ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphitePopover } from './NCTGraphitePopover.js';

export const NCTGraphiteHintMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteHint',
  category: 'widgets',
  description: 'Question-mark trigger using NCTGraphitePopover for parameter help',
  props: {
    text: { type: 'string', required: true, description: 'Popover body (plain text)' },
    maxWidth: { type: 'number', required: false, description: 'Passed to NCTGraphitePopover' },
  },
  emits: [],
  dependencies: ['NCTGraphitePopover'],
};

export interface NCTGraphiteHintProps {
  text: string;
  maxWidth?: number;
}

/** Small ? in a vector circle; help opens in a viewport-clamped NCTGraphitePopover. */
export function NCTGraphiteHint({ text, maxWidth }: NCTGraphiteHintProps) {
  return (
    <NCTGraphitePopover content={text} maxWidth={maxWidth}>
      <button type="button" className="nctgraphite-hint-trigger" aria-label="Parameter help">
        <svg className="nctgraphite-hint-icon" viewBox="0 0 16 16" width={14} height={14} aria-hidden>
          <circle className="nctgraphite-hint-circle" cx={8} cy={8} r={6.5} />
          <text className="nctgraphite-hint-glyph" x={8} y={8.5} textAnchor="middle" dominantBaseline="middle">
            ?
          </text>
        </svg>
      </button>
    </NCTGraphitePopover>
  );
}

/** Label row: uppercase label + optional ? hint (value slot on the right). */
export function NCTGraphiteParamLabel({
  label,
  hint,
  trailing,
}: {
  label: string;
  hint?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-2 text-[10px] mb-1 min-w-0">
      <span className="flex items-center gap-1 min-w-0">
        <span className="truncate">{label}</span>
        {hint ? <NCTGraphiteHint text={hint} /> : null}
      </span>
      {trailing != null ? <span className="shrink-0 tabular-nums">{trailing}</span> : null}
    </div>
  );
}
