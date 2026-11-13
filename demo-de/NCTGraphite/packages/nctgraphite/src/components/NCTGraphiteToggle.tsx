import type { CSSProperties } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteHint } from './NCTGraphiteHint.js';

export const NCTGraphiteToggleMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteToggle',
  category: 'widgets',
  description: 'Checkbox card row for lab boolean options',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: true, description: 'Option label' },
    checked: { type: 'boolean', required: true, description: 'Current state' },
    onChange: { type: 'function', required: true, description: '(v: boolean) => void' },
    controlStyle: { type: 'string', required: false, description: '"checkbox" (default) card-row checkbox, or "switch" sliding pill' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteToggleProps extends NCTGraphiteAppearanceProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  controlStyle?: 'checkbox' | 'switch';
  hint?: string;
}

/** Boolean option row (lab idiom): checkbox card by default, sliding pill with controlStyle="switch". */
export function NCTGraphiteToggle({ label, checked, onChange, controlStyle = 'checkbox', hint, opacity, cornerRadius }: NCTGraphiteToggleProps) {
  const labelRow = (
    <span className="flex items-center gap-1 min-w-0">
      <span className="text-[11px] truncate">{label}</span>
      {hint ? <NCTGraphiteHint text={hint} /> : null}
    </span>
  );
  const surface: CSSProperties = {
    background: 'var(--nct-surface, var(--panel, #15151e))',
    borderColor: 'var(--nct-border, var(--border, #23232f))',
    borderRadius: 'var(--nct-control-radius, 8px)',
    padding: 'var(--nct-control-padding, 0.5rem)',
    ...appearanceStyle({ opacity, cornerRadius }),
  };
  if (controlStyle === 'switch') {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="nctgraphite-toggle w-full flex items-center justify-between border cursor-pointer"
        style={surface}
      >
        {labelRow}
        <span
          className="w-9 h-5 rounded-full p-0.5 flex shrink-0 justify-start"
          style={{
            justifyContent: checked ? 'flex-end' : 'flex-start',
            background: checked
              ? 'var(--nct-accent-bg, var(--accent, #7c5cff))'
              : 'var(--nct-surface-2, var(--panel-3, #222230))',
          }}
        >
          <span className="w-4 h-4 rounded-full bg-white" />
        </span>
      </button>
    );
  }
  return (
    <label className="nctgraphite-toggle flex items-center justify-between border cursor-pointer" style={surface}>
      {labelRow}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: 'var(--nct-accent-bg, var(--accent, #7c5cff))' }}
      />
    </label>
  );
}
