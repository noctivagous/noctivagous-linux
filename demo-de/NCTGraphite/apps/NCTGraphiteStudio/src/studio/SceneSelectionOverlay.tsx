import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { resizeSceneRect, type Node, type SceneRect } from '../model';

const RESIZE_HANDLES: { dir: string; cursor: string; pos: CSSProperties }[] = [
  { dir: 'nw', cursor: 'nwse-resize', pos: { left: -6, top: -6 } },
  { dir: 'n', cursor: 'ns-resize', pos: { left: '50%', top: -6, marginLeft: -6 } },
  { dir: 'ne', cursor: 'nesw-resize', pos: { right: -6, top: -6 } },
  { dir: 'e', cursor: 'ew-resize', pos: { right: -6, top: '50%', marginTop: -6 } },
  { dir: 'se', cursor: 'nwse-resize', pos: { right: -6, bottom: -6 } },
  { dir: 's', cursor: 'ns-resize', pos: { left: '50%', bottom: -6, marginLeft: -6 } },
  { dir: 'sw', cursor: 'nesw-resize', pos: { left: -6, bottom: -6 } },
  { dir: 'w', cursor: 'ew-resize', pos: { left: -6, top: '50%', marginTop: -6 } },
];

/** Pointer move/resize overlay for the selected scene item (design mode only).
 * Live-updates the scene element during the gesture and commits one undo step
 * on release. Pointer deltas are corrected for canvas zoom. */
export function SceneSelectionOverlay({ artRef, node, zoom, snap, revision, onCommit }: {
  artRef: React.RefObject<HTMLDivElement | null>; node: Node; zoom: number;
  snap: (v: number) => number; revision: unknown;
  onCommit: (id: string, patch: Record<string, string | number | boolean>) => void;
}) {
  const [box, setBox] = useState<SceneRect | null>(null);
  const gesture = useRef<null | { mode: 'move' | 'resize'; dir: string; startX: number; startY: number; orig: SceneRect; origBox: SceneRect; inline: { left: string; top: string; width: string; height: string }; el: HTMLElement; moved: boolean }>(null);
  useLayoutEffect(() => {
    const art = artRef.current;
    const wrap = art?.querySelector(`[data-node-id="${node.id}"]`);
    const el = wrap?.lastElementChild as HTMLElement | null;
    if (!art || !wrap || !el) { setBox(null); return; }
    const scale = zoom > 0 ? zoom / 100 : 1;
    const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    const r = el.getBoundingClientRect();
    const artRect = art.getBoundingClientRect();
    setBox({
      left: (r.left - artRect.left) / scale,
      top: (r.top - artRect.top) / scale,
      width: num(node.props.width, r.width / scale),
      height: num(node.props.height, r.height / scale),
    });
    void revision;
  }, [artRef, node, zoom, revision]);
  if (!box) return null;
  const scale = zoom > 0 ? zoom / 100 : 1;
  const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  function sceneEl(): HTMLElement | null {
    const wrap = artRef.current?.querySelector(`[data-node-id="${node.id}"]`);
    return (wrap?.lastElementChild as HTMLElement | null) ?? null;
  }
  function paint(el: HTMLElement, rect: SceneRect, includeSize: boolean) {
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    if (includeSize) { el.style.width = `${rect.width}px`; el.style.height = `${rect.height}px`; }
    const g = gesture.current;
    if (g) setBox({ left: g.origBox.left + rect.left - g.orig.left, top: g.origBox.top + rect.top - g.orig.top, width: rect.width, height: rect.height });
  }
  function cancel() {
    const g = gesture.current;
    if (g) {
      Object.assign(g.el.style, g.inline);
      setBox(g.origBox);
    }
    gesture.current = null;
  }
  function begin(e: React.PointerEvent, mode: 'move' | 'resize', dir: string) {
    const el = sceneEl();
    if (!el || !box) return;
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    gesture.current = {
      mode, dir, startX: e.clientX, startY: e.clientY, moved: false, el, origBox: box,
      inline: { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height },
      orig: {
        left: num(node.props.left, el.offsetLeft),
        top: num(node.props.top, el.offsetTop),
        width: num(node.props.width, r.width / scale),
        height: num(node.props.height, r.height / scale),
      },
    };
  }
  function advance(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    e.preventDefault();
    const dx = (e.clientX - g.startX) / scale;
    const dy = (e.clientY - g.startY) / scale;
    if (!g.moved && Math.abs(e.clientX - g.startX) + Math.abs(e.clientY - g.startY) < 3) return;
    g.moved = true;
    if (g.mode === 'move') {
      const rect = { ...g.orig, left: Math.max(0, snap(g.orig.left + dx)), top: Math.max(0, snap(g.orig.top + dy)) };
      paint(g.el, rect, false);
    } else {
      paint(g.el, resizeSceneRect(g.orig, g.dir, dx, dy, snap), true);
    }
  }
  function finish(e: React.PointerEvent) {
    const g = gesture.current;
    gesture.current = null;
    if (!g?.moved) return;
    const style = g.el.style;
    const patch: Record<string, string | number | boolean> = {
      left: Math.round(parseFloat(style.left) || 0),
      top: Math.round(parseFloat(style.top) || 0),
    };
    if (g.mode === 'resize') {
      patch.width = Math.round(parseFloat(style.width) || g.orig.width);
      patch.height = Math.round(parseFloat(style.height) || g.orig.height);
    }
    onCommit(node.id, patch);
    void e;
  }
  return <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
    <div
      onPointerDown={e => begin(e, 'move', '')} onPointerMove={advance} onPointerUp={finish} onPointerCancel={cancel}
      title="Drag to move"
      style={{ position: 'absolute', left: box.left, top: box.top, width: Math.max(box.width, 8), height: Math.max(box.height, 8), cursor: 'move', pointerEvents: 'auto', border: '1px solid #679ce8' }}
    >
      {RESIZE_HANDLES.map(h => <span
        key={h.dir}
        onPointerDown={e => begin(e, 'resize', h.dir)} onPointerMove={advance} onPointerUp={finish} onPointerCancel={cancel}
        title={`Resize ${h.dir}`}
        style={{ position: 'absolute', width: 12, height: 12, background: '#679ce8', border: '1px solid white', borderRadius: 2, cursor: h.cursor, pointerEvents: 'auto', ...h.pos }}
      />)}
    </div>
  </div>;
}

