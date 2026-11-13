import type { ReactNode } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphitePanelMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphitePanel',
  category: 'layout',
  description: 'Themed panel card or inset well for control clusters and sidebar sections',
  props: {
    ...appearancePropMeta,
    title: { type: 'string', required: false, description: 'Optional uppercase section title' },
    variant: { type: ['raised', 'well'], default: 'raised', description: 'Raised card or inset well' },
    children: { type: 'node', required: true, description: 'Panel content' },
    className: { type: 'string', required: false, description: 'Extra classes' },
  },
  slots: { default: 'Panel content' },
  emits: [],
  dependencies: [],
};

export interface NCTGraphitePanelProps extends NCTGraphiteAppearanceProps {
  title?: string;
  variant?: 'raised' | 'well';
  children: ReactNode;
  className?: string;
}

/** Panel card (or inset well) for control clusters. Colors resolve from host
 * `--nct-panel-*` tokens and fall back to the lab idiom, so hosts can theme
 * panels without overriding internals. */
export function NCTGraphitePanel({ title, variant = 'raised', children, className = '', opacity, cornerRadius }: NCTGraphitePanelProps) {
  const well = variant === 'well';
  return (
    <div className={className} style={{
      padding: 'var(--nct-panel-padding, 0.625rem)',
      borderRadius: 'var(--nct-panel-radius, 8px)',
      background: well ? 'var(--nct-well-bg, #101018)' : 'var(--nct-panel-bg, #15151e)',
      border: `1px solid ${well ? 'var(--nct-well-border, #0a0a10)' : 'var(--nct-panel-border, #23232f)'}`,
      boxShadow: well ? 'var(--nct-well-shadow, inset 0 1px 3px #0009)' : 'var(--nct-panel-shadow, none)',
      ...appearanceStyle({ opacity, cornerRadius }),
    }}>
      {title ? <div style={{
        fontSize: '11px', letterSpacing: '0.18em', marginBottom: '0.75rem',
        color: 'var(--nct-panel-title, #7a7680)',
      }}>{title}</div> : null}
      {children}
    </div>
  );
}
