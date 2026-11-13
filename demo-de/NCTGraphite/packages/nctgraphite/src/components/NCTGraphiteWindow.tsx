import { useRef, useState, type ReactNode } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteWindowMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteWindow',
  category: 'layout',
  description: 'A titled app window with an optional resize control and edge docking',
  props: {
    ...appearancePropMeta,
    title: { type: 'string', required: false, description: 'Window title shown in the title bar' },
    resizable: { type: 'boolean', default: true, description: 'Show the corner resize control' },
    width: { type: 'number', required: false, description: 'Initial window width in px' },
    height: { type: 'number', required: false, description: 'Initial window height in px (auto when unset)' },
    dock: { type: ['none', 'left', 'right', 'top', 'bottom'], default: 'none', description: 'Edge of the parent the window sticks to' },
    onClose: { type: 'function', required: false, description: 'Called when the title-bar close button is pressed' },
    children: { type: 'node', required: true, description: 'Window content' },
    className: { type: 'string', required: false, description: 'Extra classes' },
  },
  slots: { default: 'Window content' },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteWindowProps extends NCTGraphiteAppearanceProps {
  title?: string;
  resizable?: boolean;
  width?: number;
  height?: number;
  dock?: 'none' | 'left' | 'right' | 'top' | 'bottom';
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

const DOCK_STYLE: Record<string, React.CSSProperties> = {
  left: { alignSelf: 'flex-start', marginRight: 'auto' },
  right: { alignSelf: 'flex-end', marginLeft: 'auto' },
  top: { alignSelf: 'flex-start', marginBottom: 'auto' },
  bottom: { alignSelf: 'flex-end', marginTop: 'auto' },
};

/** Titled window that lives inside the app. Drag the corner handle to resize
 * (when `resizable`); `dock` sticks the window to a parent edge. Colors
 * resolve from host `--nct-window-*` tokens with lab-idiom fallbacks. */
export function NCTGraphiteWindow({ title, resizable = true, width, height, dock = 'none', onClose, children, className = '', opacity, cornerRadius }: NCTGraphiteWindowProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const drag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);

  function onResizeDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const rect = frame.current?.getBoundingClientRect();
    drag.current = { x: e.clientX, y: e.clientY, w: rect?.width ?? width ?? 320, h: rect?.height ?? height ?? 240 };
    const move = (ev: PointerEvent) => {
      const d = drag.current; if (!d) return;
      setSize({
        w: Math.max(160, Math.round(d.w + (ev.clientX - d.x))),
        h: Math.max(120, Math.round(d.h + (ev.clientY - d.y))),
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  return (
    <div ref={frame} className={className} role="dialog" aria-label={title} style={{
      display: 'flex', flexDirection: 'column', position: 'relative',
      width: size?.w ?? width, height: size?.h ?? height,
      borderRadius: 'var(--nct-window-radius, 8px)',
      background: 'var(--nct-window-bg, #15151e)',
      border: '1px solid var(--nct-window-border, #23232f)',
      boxShadow: 'var(--nct-window-shadow, 0 8px 24px #0007)',
      ...(DOCK_STYLE[dock] ?? {}),
      ...appearanceStyle({ opacity, cornerRadius }),
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px', fontSize: '12px', fontWeight: 600,
        color: 'var(--nct-window-title, #cfd5dc)',
        background: 'var(--nct-window-title-bg, #23252b)',
        borderBottom: '1px solid var(--nct-window-border, #23232f)',
        borderRadius: 'var(--nct-window-radius, 8px) var(--nct-window-radius, 8px) 0 0',
        userSelect: 'none',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
        {onClose ? <button
          onClick={onClose} title="Close window" aria-label="Close window"
          style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: 'inherit', fontSize: '12px', cursor: 'pointer', padding: '0 2px' }}
        >✕</button> : null}
      </div>
      <div style={{ padding: 'var(--nct-window-padding, 12px)', overflow: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
      {resizable ? <div
        onPointerDown={onResizeDown} title="Drag to resize"
        style={{ position: 'absolute', right: 2, bottom: 0, cursor: 'nwse-resize', color: 'var(--nct-window-title, #cfd5dc)', fontSize: 12, lineHeight: 1, padding: 2 }}
        aria-hidden="true"
      >◢</div> : null}
    </div>
  );
}
