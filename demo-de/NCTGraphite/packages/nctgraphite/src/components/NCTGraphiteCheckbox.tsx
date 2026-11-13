import type { CSSProperties, ReactNode } from 'react';
import { useId, useState } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteHint } from './NCTGraphiteHint.js';

export const NCTGraphiteCheckboxMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteCheckbox',
  category: 'widgets',
  description: 'Plain checkbox with label for Proshade-style option rows',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: true, description: 'Checkbox label' },
    checked: { type: 'boolean', required: false, description: 'Controlled state' },
    defaultChecked: { type: 'boolean', required: false, description: 'Uncontrolled initial state' },
    disabled: { type: 'boolean', required: false, description: 'Disable the checkbox' },
    onChange: { type: 'function', required: false, description: '(v: boolean) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteCheckboxProps extends NCTGraphiteAppearanceProps {
  label: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
  hint?: string;
  id?: string;
  style?: CSSProperties;
}

/** Plain labeled checkbox (Proshade checkbox idiom). Controlled or uncontrolled. */
export function NCTGraphiteCheckbox({
  label, checked, defaultChecked = false, disabled = false, onChange, hint, id, style,
  opacity, cornerRadius,
}: NCTGraphiteCheckboxProps) {
  const autoId = useId();
  const boxId = id ?? `nct-checkbox-${autoId}`;
  const [inner, setInner] = useState(defaultChecked);
  const current = checked ?? inner;
  return (
    <label
      htmlFor={boxId}
      className="nctgraphite-checkbox"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--nct-control-gap, 6px)',
        minHeight: 'var(--nct-control-height, 28px)',
        fontSize: 'var(--nct-control-font-size, 11px)',
        color: 'var(--nct-control-text, var(--text, #f5f1e8))',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
        ...appearanceStyle({ opacity, cornerRadius }),
      }}
    >
      <input
        id={boxId}
        type="checkbox"
        checked={current}
        disabled={disabled}
        onChange={(e) => {
          if (checked === undefined) setInner(e.target.checked);
          onChange?.(e.target.checked);
        }}
        style={{
          width: 14,
          height: 14,
          accentColor: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
          margin: 0,
        }}
      />
      <span>{label}</span>
      {hint ? <NCTGraphiteHint text={hint} /> : null}
    </label>
  );
}
