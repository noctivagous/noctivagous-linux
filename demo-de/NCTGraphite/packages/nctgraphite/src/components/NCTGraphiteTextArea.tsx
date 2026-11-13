import type { CSSProperties, TextareaHTMLAttributes } from 'react';
import { useId, useState } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteTextAreaMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteTextArea',
  category: 'widgets',
  description: 'Multi-line text area with optional label for notes and longer values',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the area' },
    value: { type: 'string', required: false, description: 'Controlled value' },
    defaultValue: { type: 'string', required: false, description: 'Uncontrolled initial value' },
    placeholder: { type: 'string', required: false, description: 'Placeholder text' },
    rows: { type: 'number', required: false, description: 'Visible text rows' },
    disabled: { type: 'boolean', required: false, description: 'Disable the area' },
    onChange: { type: 'function', required: false, description: '(v: string) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteTextAreaProps extends NCTGraphiteAppearanceProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  onChange?: (v: string) => void;
  hint?: string;
  id?: string;
  textAreaProps?: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange' | 'disabled' | 'id' | 'placeholder' | 'rows'>;
  style?: CSSProperties;
}

/** Multi-line text area. Controlled or uncontrolled. */
export function NCTGraphiteTextArea({
  label, value, defaultValue = '', placeholder, rows = 3, disabled = false,
  onChange, hint, id, textAreaProps, style,
  opacity, cornerRadius,
}: NCTGraphiteTextAreaProps) {
  const autoId = useId();
  const areaId = id ?? `nct-textarea-${autoId}`;
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  return (
    <div className="nctgraphite-textarea" style={{ ...appearanceStyle({ opacity, cornerRadius }), ...style }}>
      {label ? <NCTGraphiteParamLabel label={label} hint={hint} /> : null}
      <textarea
        id={areaId}
        aria-label={label ? undefined : placeholder}
        value={current}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value);
          onChange?.(e.target.value);
        }}
        {...textAreaProps}
        style={{
          width: '100%',
          minHeight: 'calc(var(--nct-control-height, 28px) * 2)',
          padding: 'var(--nct-control-padding, 0.5rem)',
          fontSize: 'var(--nct-control-font-size, 11px)',
          borderRadius: 'var(--nct-control-radius, 8px)',
          background: 'var(--nct-field-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
          border: '1px solid var(--nct-border, var(--border, #23232f))',
          color: 'var(--nct-field-text, var(--text, #f5f1e8))',
          outline: 'none',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
