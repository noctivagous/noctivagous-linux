import { useState } from 'react';

export type NCTParameterDefinition =
  | { id: string; label: string; type: 'number'; min: number; max: number; step: number; defaultValue: number }
  | { id: string; label: string; type: 'boolean'; defaultValue: boolean }
  | { id: string; label: string; type: 'select'; defaultValue: string; options: { value: string; label: string }[] };
export type NCTParameterValues = Record<string, number | boolean | string>;

/** Application-owned state initialized from a parameter schema. */
export function useNCTParameters(definitions: readonly NCTParameterDefinition[]) {
  const [values, setValues] = useState<NCTParameterValues>(() => Object.fromEntries(definitions.map((item) => [item.id, item.defaultValue])));
  const setValue = (id: string, value: number | boolean | string) => setValues((current) => ({ ...current, [id]: value }));
  return { values, setValue, setValues };
}

/** Controlled parameter widgets. Hosts own persistence and the parameter definitions. */
export function NCTParameterPanel({ definitions, values, onChange }: {
  definitions: readonly NCTParameterDefinition[];
  values: NCTParameterValues;
  onChange: (id: string, value: number | boolean | string) => void;
}) {
  return <div className="nct-parameters">{definitions.map((item) => <label className="nct-parameter" key={item.id}>
    <span>{item.label}</span>
    {item.type === 'boolean' ? <input type="checkbox" checked={Boolean(values[item.id])} onChange={(event) => onChange(item.id, event.target.checked)} /> :
      item.type === 'number' ? <span className="nct-parameter-number"><input type="range" min={item.min} max={item.max} step={item.step} value={Number(values[item.id])} onChange={(event) => onChange(item.id, Number(event.target.value))} /><output>{String(values[item.id])}</output></span> :
      <select value={String(values[item.id])} onChange={(event) => onChange(item.id, event.target.value)}>{item.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>}
  </label>)}</div>;
}
