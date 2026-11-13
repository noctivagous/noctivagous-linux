import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteSliderMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSlider',
  category: 'widgets',
  description: 'Labeled range slider with live value readout for lab control panels',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: true, description: 'Uppercase control label' },
    value: { type: 'number', required: true, description: 'Current value' },
    min: { type: 'number', required: true, description: 'Range minimum' },
    max: { type: 'number', required: true, description: 'Range maximum' },
    step: { type: 'number', default: 1, description: 'Range step' },
    format: { type: 'function', required: false, description: '(v: number) => string for the readout' },
    onChange: { type: 'function', required: true, description: '(v: number) => void' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteSliderProps extends NCTGraphiteAppearanceProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  hint?: string;
}

/** Labeled range slider with live value readout (lab control-panel idiom). */
export function NCTGraphiteSlider({ label, value, min, max, step = 1, format, onChange, hint, opacity, cornerRadius }: NCTGraphiteSliderProps) {
  const text = format ? format(value) : String(value);
  return (
    <div style={appearanceStyle({ opacity, cornerRadius })}>
      <NCTGraphiteParamLabel label={label} hint={hint} trailing={text} />
      <input
        type="range"
        className="nctgraphite-slider w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}
