import type { CSSProperties, InputHTMLAttributes } from 'react';
import { useId, useState } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteFieldMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteField',
  category: 'widgets',
  description: 'Single-line text field with optional label for inspector and form panels',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the field' },
    value: { type: 'string', required: false, description: 'Controlled value' },
    defaultValue: { type: 'string', required: false, description: 'Uncontrolled initial value' },
    placeholder: { type: 'string', required: false, description: 'Placeholder text' },
    disabled: { type: 'boolean', required: false, description: 'Disable the field' },
    onChange: { type: 'function', required: false, description: '(v: string) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteFieldProps extends NCTGraphiteAppearanceProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange?: (v: string) => void;
  hint?: string;
  id?: string;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange' | 'disabled' | 'id' | 'placeholder'>;
  style?: CSSProperties;
}

const fieldStyle: CSSProperties = {
  width: '100%',
  minHeight: 'var(--nct-control-height, 28px)',
  padding: '0 var(--nct-control-padding, 0.5rem)',
  fontSize: 'var(--nct-control-font-size, 11px)',
  borderRadius: 'var(--nct-control-radius, 8px)',
  background: 'var(--nct-field-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
  border: '1px solid var(--nct-border, var(--border, #23232f))',
  color: 'var(--nct-field-text, var(--text, #f5f1e8))',
  outline: 'none',
};

/** Single-line text field (Proshade input-field idiom). Controlled or uncontrolled. */
export function NCTGraphiteField({
  label, value, defaultValue = '', placeholder, disabled = false, onChange, hint, id, inputProps, style,
  opacity, cornerRadius,
}: NCTGraphiteFieldProps) {
  const autoId = useId();
  const fieldId = id ?? `nct-field-${autoId}`;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  return (
    <div className="nctgraphite-field" style={{ ...appearanceStyle({ opacity, cornerRadius }), ...style }}>
      {label ? <NCTGraphiteParamLabel label={label} hint={hint} /> : null}
      <input
        id={fieldId}
        type="text"
        aria-label={label ? undefined : placeholder}
        value={current}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        {...inputProps}
        style={fieldStyle}
      />
    </div>
  );
}
