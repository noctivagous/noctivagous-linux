import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteSwatchMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSwatch',
  category: 'widgets',
  description: 'Round color swatch button for lab palettes, with selected ring',
  props: {
    color: { type: 'string', required: true, description: 'CSS color' },
    selected: { type: 'boolean', default: false, description: 'Selected state' },
    title: { type: 'string', required: false, description: 'Accessible label' },
    onSelect: { type: 'function', required: true, description: '() => void' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteSwatchProps {
  color: string;
  selected?: boolean;
  title?: string;
  onSelect: () => void;
}

/** Round color swatch button with selected ring (lab palette idiom). */
export function NCTGraphiteSwatch({ color, selected = false, title, onSelect }: NCTGraphiteSwatchProps) {
  return (
    <button
      type="button"
      title={title ?? color}
      aria-label={title ?? color}
      onClick={onSelect}
      className="w-[16px] h-[16px] rounded-full"
      style={{
        background: color,
        outline: selected ? '2px solid #f5f1e8' : '1px solid #23232f',
        outlineOffset: '1px',
      }}
    />
  );
}
