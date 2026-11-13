import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, FocusEvent, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphitePopoverMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphitePopover',
  category: 'widgets',
  description: 'Hover/focus popover anchored to a trigger; panel is portaled and clamped inside the viewport',
  props: {
    content: { type: 'node', required: true, description: 'Popover body' },
    children: { type: 'node', required: true, description: 'Trigger element (e.g. ? button)' },
    maxWidth: { type: 'number', default: 280, description: 'Panel max width in px' },
    padding: { type: 'number', default: 8, description: 'Minimum inset from viewport edges' },
    gap: { type: 'number', default: 6, description: 'Space between trigger and panel' },
  },
  slots: { default: 'Trigger', content: 'Popover body' },
  emits: [],
  dependencies: [],
};

export interface NCTGraphitePopoverProps {
  content: ReactNode;
  children: ReactNode;
  maxWidth?: number;
  padding?: number;
  gap?: number;
}

export type PopoverRect = { width: number; height: number };

/** Pick fixed top/left so the panel stays inside the viewport. */
export function computeNCTGraphitePopoverPosition(
  trigger: DOMRect,
  panel: PopoverRect,
  padding = 8,
  gap = 6,
  viewport?: { width: number; height: number },
): { top: number; left: number } {
  const vw = viewport?.width ?? window.innerWidth;
  const vh = viewport?.height ?? window.innerHeight;

  const candidates: { left: number; top: number }[] = [
    { left: trigger.right + gap, top: trigger.top + trigger.height / 2 - panel.height / 2 },
    { left: trigger.left - gap - panel.width, top: trigger.top + trigger.height / 2 - panel.height / 2 },
    { left: trigger.left + trigger.width / 2 - panel.width / 2, top: trigger.bottom + gap },
    { left: trigger.left + trigger.width / 2 - panel.width / 2, top: trigger.top - gap - panel.height },
  ];

  const clamp = (left: number, top: number) => ({
    left: Math.max(padding, Math.min(vw - padding - panel.width, left)),
    top: Math.max(padding, Math.min(vh - padding - panel.height, top)),
  });

  const fits = (left: number, top: number) =>
    left >= padding &&
    top >= padding &&
    left + panel.width <= vw - padding &&
    top + panel.height <= vh - padding;

  for (const c of candidates) {
    const p = clamp(c.left, c.top);
    if (fits(p.left, p.top)) return p;
  }
  return clamp(candidates[0].left, candidates[0].top);
}

/** Lab popover: trigger stays inline; panel portals to document.body with viewport clamping. */
export function NCTGraphitePopover({
  content,
  children,
  maxWidth = 280,
  padding = 8,
  gap = 6,
}: NCTGraphitePopoverProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const tr = anchor.getBoundingClientRect();
    const pw = panel.offsetWidth;
    const ph = panel.offsetHeight;
    if (pw <= 0 || ph <= 0) return;
    setCoords(computeNCTGraphitePopoverPosition(tr, { width: pw, height: ph }, padding, gap));
  }, [padding, gap]);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return undefined;
    }
    reposition();
    const id = requestAnimationFrame(reposition);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(reposition) : null;
    if (ro && panelRef.current) ro.observe(panelRef.current);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      ro?.disconnect();
    };
  }, [open, reposition, content]);

  const panelStyle: CSSProperties = {
    position: 'fixed',
    top: coords?.top ?? 0,
    left: coords?.left ?? 0,
    maxWidth,
    visibility: coords ? 'visible' : 'hidden',
    pointerEvents: 'none',
  };

  const onBlur = (e: FocusEvent<HTMLSpanElement>) => {
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    if (panelRef.current?.contains(next ?? null)) return;
    setOpen(false);
  };

  return (
    <span
      ref={anchorRef}
      className="nctgraphite-popover-anchor inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={onBlur}
    >
      {children}
      {open &&
        createPortal(
          <div ref={panelRef} role="tooltip" className="nctgraphite-popover" style={panelStyle}>
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
