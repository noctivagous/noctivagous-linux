import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteMenuBarMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteMenuBar',
  category: 'widgets',
  description: 'Application menu bar with dropdown menus for File, Edit, View, and other app commands',
  props: {
    children: { type: 'node', required: true, description: 'Top-level menus (real elements, not config strings)' },
  },
  slots: { default: 'Menus' },
  emits: [],
  dependencies: [],
};

export const NCTGraphiteMenuMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteMenu',
  category: 'widgets',
  description: 'One dropdown menu inside a menu bar',
  props: {
    title: { type: 'string', default: 'Menu', description: 'Top-level menu title' },
    disabled: { type: 'boolean', default: false, description: 'Disable the menu' },
    children: { type: 'node', required: true, description: 'Menu items (real elements, not config strings)' },
  },
  slots: { default: 'Menu items' },
  emits: [],
  dependencies: [],
};

export const NCTGraphiteMenuItemMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteMenuItem',
  category: 'widgets',
  description: 'One actionable row inside a menu, with an optional shortcut hint',
  props: {
    label: { type: 'string', default: 'Item', description: 'Item label' },
    shortcut: { type: 'string', default: '', description: 'Shortcut hint shown right-aligned' },
    disabled: { type: 'boolean', default: false, description: 'Disable the item' },
    divider: { type: 'boolean', default: false, description: 'Render as a separator instead of an item' },
    onSelect: { type: 'function', description: 'Called when the item is chosen' },
  },
  slots: {},
  emits: ['select'],
  dependencies: [],
};

interface MenuBarContextValue {
  openName: string | null;
  openMenu: (name: string | null) => void;
}

const MenuBarContext = createContext<MenuBarContextValue>({ openName: null, openMenu: () => {} });

export interface NCTGraphiteMenuBarProps {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Application menu bar. Hosts real menu elements with dropdown behavior. */
export function NCTGraphiteMenuBar({ className = '', style, children }: NCTGraphiteMenuBarProps) {
  const [openName, setOpenName] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openName) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as globalThis.Node)) setOpenName(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenName(null);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openName]);
  return (
    <MenuBarContext.Provider value={{ openName, openMenu: setOpenName }}>
      <div
        ref={ref}
        className={className}
        role="menubar"
        aria-label="Application"
        style={{ display: 'flex', alignItems: 'stretch', gap: 2, ...style }}
      >
        {children}
      </div>
    </MenuBarContext.Provider>
  );
}

export interface NCTGraphiteMenuProps {
  title?: string;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** One dropdown menu inside a menu bar. */
export function NCTGraphiteMenu({ title = 'Menu', disabled = false, className = '', style, children }: NCTGraphiteMenuProps) {
  const { openName, openMenu } = useContext(MenuBarContext);
  const open = openName === title;
  const [hover, setHover] = useState(false);
  return (
    <div className={className} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => openMenu(open ? null : title)}
        onMouseEnter={() => {
          setHover(true);
          if (openName && openName !== title) openMenu(title);
        }}
        onMouseLeave={() => setHover(false)}
        style={{
          height: '100%',
          padding: '4px 12px',
          background: open || hover ? '#384a65' : 'transparent',
          color: 'inherit',
          border: 0,
          borderRadius: 4,
          font: 'inherit',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {title}
      </button>
      {open && !disabled && (
        <div
          role="menu"
          aria-label={title}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: 230,
            padding: 4,
            background: '#26292f',
            color: '#e8eaf0',
            border: '1px solid #101114',
            borderRadius: 6,
            boxShadow: '0 10px 28px #000a',
            zIndex: 60,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export interface NCTGraphiteMenuItemProps {
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  className?: string;
  style?: CSSProperties;
  onSelect?: () => void;
}

/** One actionable row inside a menu. */
export function NCTGraphiteMenuItem({ label = 'Item', shortcut = '', disabled = false, divider = false, className = '', style, onSelect }: NCTGraphiteMenuItemProps) {
  const { openMenu } = useContext(MenuBarContext);
  const [hover, setHover] = useState(false);
  if (divider) {
    return <div role="separator" className={className} style={{ borderTop: '1px solid #101114', margin: '4px 6px', ...style }} />;
  }
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={() => {
        onSelect?.();
        openMenu(null);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={className}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 24,
        padding: '6px 10px',
        background: hover && !disabled ? '#384a65' : 'transparent',
        color: disabled ? '#7e8793' : 'inherit',
        border: 0,
        borderRadius: 4,
        font: 'inherit',
        textAlign: 'left',
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
    >
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut ? <kbd style={{ font: '10px ui-monospace,monospace', color: '#939aa4' }}>{shortcut}</kbd> : null}
    </button>
  );
}
