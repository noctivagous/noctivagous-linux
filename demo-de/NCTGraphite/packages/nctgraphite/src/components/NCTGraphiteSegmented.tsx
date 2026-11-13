import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteSegmentedMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSegmented',
  category: 'widgets',
  description: 'Single-select segmented row for lab mode and option pickers',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the row' },
    options: { type: 'array', required: true, description: '{value, label}[] choices' },
    value: { type: 'string', required: true, description: 'Selected value' },
    onChange: { type: 'function', required: true, description: '(v: string) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteSegmentedOption {
  value: string;
  label: string;
}

export interface NCTGraphiteSegmentedProps extends NCTGraphiteAppearanceProps {
  label?: string;
  options: NCTGraphiteSegmentedOption[];
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}

/** Single-select segmented row for mode/option pickers (lab idiom). */
export function NCTGraphiteSegmented({ label, options, value, onChange, hint, opacity, cornerRadius }: NCTGraphiteSegmentedProps) {
  return (
    <div>
      {label ? <NCTGraphiteParamLabel label={label} hint={hint} /> : null}
      <div
        className="nctgraphite-segmented flex gap-1 p-1 border"
        role="group"
        style={{
          background: 'var(--nct-surface, var(--panel, #15151e))',
          borderColor: 'var(--nct-border, var(--border, #23232f))',
          borderRadius: 'var(--nct-control-radius, 8px)',
          ...appearanceStyle({ opacity, cornerRadius }),
        }}
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(opt.value)}
              className="flex-1 py-1"
              style={{
                paddingLeft: 'var(--nct-control-padding, 0.5rem)',
                paddingRight: 'var(--nct-control-padding, 0.5rem)',
                fontSize: 'var(--nct-control-font-size, 11px)',
                borderRadius: 'calc(var(--nct-control-radius, 8px) - 2px)',
                background: active ? 'var(--nct-accent-bg, var(--accent, #7c5cff))' : 'transparent',
                color: active
                  ? 'var(--nct-accent-text, #fff)'
                  : 'var(--nct-dim-text, var(--text-dim, #7a7680))',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
