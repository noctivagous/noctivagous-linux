import type { CSSProperties, KeyboardEvent } from 'react';
import { useState } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteTabsMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteTabs',
  category: 'widgets',
  description: 'Tab bar with arrow-key navigation for switching panels and modes',
  props: {
    ...appearancePropMeta,
    options: { type: 'string', required: false, description: 'Comma-separated tab options in documents, e.g. "Mix, Edit, Browser" or "mix:Mix, edit:Edit"' },
    value: { type: 'string', required: false, description: 'Controlled selected tab value' },
    defaultValue: { type: 'string', required: false, description: 'Uncontrolled initial tab value' },
    onChange: { type: 'function', required: false, description: '(v: string) => void' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteTabOption {
  value: string;
  label: string;
}

export interface NCTGraphiteTabsProps extends NCTGraphiteAppearanceProps {
  options: NCTGraphiteTabOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
  ariaLabel?: string;
  style?: CSSProperties;
}

/** Tab bar (Proshade tab-bar idiom) with roving tabindex and arrow-key support. */
export function NCTGraphiteTabs({ options, value, defaultValue, onChange, ariaLabel, style, opacity, cornerRadius }: NCTGraphiteTabsProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  const select = (v: string) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const index = options.findIndex((o) => o.value === current);
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % options.length;
    if (e.key === 'ArrowLeft') next = (index - 1 + options.length) % options.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = options.length - 1;
    const target = options[next];
    if (target) {
      select(target.value);
      (e.currentTarget.querySelector(`[data-tab-value="${target.value}"]`) as HTMLElement | null)?.focus();
    }
  };
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className="nctgraphite-tabs"
      style={{
        display: 'flex',
        gap: 'var(--nct-control-gap, 6px)',
        borderBottom: '1px solid var(--nct-border, var(--border, #23232f))',
        ...style,
        ...appearanceStyle({ opacity, cornerRadius }),
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === current;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            data-tab-value={opt.value}
            onClick={() => select(opt.value)}
            style={{
              minHeight: 'var(--nct-control-height, 28px)',
              padding: '0 var(--nct-control-padding, 0.5rem)',
              fontSize: 'var(--nct-control-font-size, 11px)',
              fontWeight: selected ? 700 : 400,
              background: 'transparent',
              border: 'none',
              borderBottom: selected
                ? '2px solid var(--nct-accent-bg, var(--accent, #7c5cff))'
                : '2px solid transparent',
              color: selected
                ? 'var(--nct-control-text, var(--text, #f5f1e8))'
                : 'var(--nct-dim-text, var(--text-dim, #7a7680))',
              cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
