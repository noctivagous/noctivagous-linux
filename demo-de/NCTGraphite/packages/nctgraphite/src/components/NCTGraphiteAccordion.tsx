import { useState, type ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteAccordionMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteAccordion', category: 'layout',
  description: 'A keyboard-accessible collapsible section for controls or content',
  props: {
    title: { type: 'string', required: true, description: 'Section heading' },
    defaultOpen: { type: 'boolean', default: false, description: 'Initially expanded (uncontrolled mode)' },
    open: { type: 'boolean', required: false, description: 'Expanded state (controlled mode; pairs with onOpenChange)' },
    onOpenChange: { type: 'function', required: false, description: 'Called with the next expanded state (controlled mode)' },
    children: { type: 'node', required: true, description: 'Section content' },
  },
  slots: { default: 'Section content' }, emits: [], dependencies: [],
};

export interface NCTGraphiteAccordionProps {
  title: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/** Native disclosure with styling controlled by the host theme.
 * Uncontrolled by default (`defaultOpen`); pass `open` + `onOpenChange` for
 * controlled state (e.g. coordinated accordion groups managed by the host). */
export function NCTGraphiteAccordion({ title, defaultOpen = false, open, onOpenChange, children, className = '' }: NCTGraphiteAccordionProps) {
  const [internal, setInternal] = useState(defaultOpen);
  const expanded = open ?? internal;
  return <details className={`nctgraphite-accordion ${className}`} open={expanded} onToggle={event => {
    const next = event.currentTarget.open;
    if (open === undefined) setInternal(next);
    onOpenChange?.(next);
  }}>
    <summary className="nctgraphite-accordion-summary">{title}</summary>
    <div className="nctgraphite-accordion-content">{children}</div>
  </details>;
}
