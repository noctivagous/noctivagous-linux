/** Component metadata for AI discovery (React port of the NoctCode contract).
 * Every NCTGraphite component exports a `NCTGraphite…Meta` object so AI can
 * query capability without vector search.
 */
import type { CSSProperties } from 'react';
export interface NCTGraphiteComponentMeta {
  tag: string;
  category: string;
  description: string;
  props: Record<string, NCTGraphitePropMeta>;
  slots?: Record<string, string>;
  emits: string[];
  dependencies: string[];
  examples?: string[];
}

export interface NCTGraphitePropMeta {
  type: string | string[];
  default?: unknown;
  required?: boolean;
  description?: string;
}

/** Shared appearance props (opacity, corner radius) for visual components. */
export interface NCTGraphiteAppearanceProps {
  opacity?: number;
  cornerRadius?: number | string;
}

export const appearancePropMeta: Record<string, NCTGraphitePropMeta> = {
  opacity: { type: 'number', required: false, description: 'Overall opacity from 0 (hidden) to 1 (opaque)' },
  cornerRadius: { type: ['number', 'string'], required: false, description: 'Corner radius in px (number) or any CSS value' },
};

/** Style fragment applying appearance props; spread after component styles. */
export function appearanceStyle(props: NCTGraphiteAppearanceProps): CSSProperties {
  const style: CSSProperties = {};
  if (props.opacity !== undefined) style.opacity = props.opacity;
  if (props.cornerRadius !== undefined) {
    style.borderRadius = typeof props.cornerRadius === 'number' ? `${props.cornerRadius}px` : props.cornerRadius;
  }
  return style;
}
