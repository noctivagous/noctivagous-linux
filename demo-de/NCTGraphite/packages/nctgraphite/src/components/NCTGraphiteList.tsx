import type { CSSProperties, KeyboardEvent } from 'react';
import { useState } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteListMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteList',
  category: 'widgets',
  description: 'Single-select listbox with arrow-key navigation for option lists',
  props: {
    ...appearancePropMeta,
    options: { type: 'string', required: false, description: 'Comma-separated list options in documents, e.g. "Kick, Snare, Hat"' },
    value: { type: 'string', required: false, description: 'Controlled selected value' },
    defaultValue: { type: 'string', required: false, description: 'Uncontrolled initial value' },
    onChange: { type: 'function', required: false, description: '(v: string) => void' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteListOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NCTGraphiteListProps extends NCTGraphiteAppearanceProps {
  options: NCTGraphiteListOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  ariaLabel?: string;
  visibleRows?: number;
  style?: CSSProperties;
}

/** Single-select listbox with arrow-key navigation. Controlled or uncontrolled. */
export function NCTGraphiteList({
  options, value, defaultValue, onChange, ariaLabel, visibleRows = 5, style,
  opacity, cornerRadius,
}: NCTGraphiteListProps) {
  const enabled = options.filter((o) => !o.disabled);
  const [inner, setInner] = useState(defaultValue ?? enabled[0]?.value);
  const current = value ?? inner;
  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const move = (delta: number) => {
    const index = enabled.findIndex((o) => o.value === current);
    const next = enabled[(index + delta + enabled.length) % enabled.length];
    if (next) select(next.value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); if (enabled[0]) select(enabled[0].value); }
    else if (e.key === 'End') { e.preventDefault(); if (enabled[enabled.length - 1]) select(enabled[enabled.length - 1].value); }
  };
  return (
    <ul
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="nctgraphite-list"
      style={{
        margin: 0,
        padding: '4px',
        listStyle: 'none',
        maxHeight: `calc(var(--nct-control-height, 28px) * ${visibleRows})`,
        overflowY: 'auto',
        fontSize: 'var(--nct-control-font-size, 11px)',
        background: 'var(--nct-field-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
        border: '1px solid var(--nct-border, var(--border, #23232f))',
        borderRadius: 'var(--nct-control-radius, 8px)',
        color: 'var(--nct-control-text, var(--text, #f5f1e8))',
        outline: 'none',
        ...style,
        ...appearanceStyle({ opacity, cornerRadius }),
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === current;
        return (
          <li
            key={opt.value}
            role="option"
            aria-selected={selected}
            aria-disabled={opt.disabled || undefined}
            onClick={() => { if (!opt.disabled) select(opt.value); }}
            style={{
              padding: 'calc(var(--nct-control-padding, 0.5rem) / 2) var(--nct-control-padding, 0.5rem)',
              borderRadius: 'calc(var(--nct-control-radius, 8px) - 2px)',
              background: selected ? 'var(--nct-accent-bg, var(--accent, #7c5cff))' : 'transparent',
              color: selected
                ? 'var(--nct-accent-text, #fff)'
                : 'var(--nct-control-text, var(--text, #f5f1e8))',
              opacity: opt.disabled ? 0.5 : 1,
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {opt.label}
          </li>
        );
      })}
    </ul>
  );
}
