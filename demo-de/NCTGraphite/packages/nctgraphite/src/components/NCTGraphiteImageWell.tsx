import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import { NCTGraphiteParamLabel } from './NCTGraphiteHint.js';

export const NCTGraphiteImageWellMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteImageWell',
  category: 'widgets',
  description: 'Drop-target well that previews an image or shows an empty placeholder',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: false, description: 'Optional uppercase label above the well' },
    src: { type: 'string', required: false, description: 'Image URL to preview; empty shows the placeholder' },
    alt: { type: 'string', required: false, description: 'Alt text for the preview image' },
    emptyText: { type: 'string', required: false, description: 'Placeholder text when no image is set' },
    disabled: { type: 'boolean', required: false, description: 'Disable interaction' },
    onBrowse: { type: 'function', required: false, description: '() => void invoked when the well is activated' },
    hint: { type: 'string', required: false, description: 'Optional ? tooltip beside the label' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteImageWellProps extends NCTGraphiteAppearanceProps {
  label?: string;
  src?: string;
  alt?: string;
  emptyText?: string;
  disabled?: boolean;
  onBrowse?: () => void;
  hint?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

/** Image drop-target well (Proshade image-well idiom): preview or placeholder. */
export function NCTGraphiteImageWell({
  label, src, alt = '', emptyText = 'Drop image', disabled = false, onBrowse, hint, children, style,
  opacity, cornerRadius,
}: NCTGraphiteImageWellProps) {
  const onClick: MouseEventHandler<HTMLButtonElement> = () => {
    if (!disabled) onBrowse?.();
  };
  return (
    <div className="nctgraphite-image-well" style={{ ...appearanceStyle({ opacity, cornerRadius }), ...style }}>
      {label ? <NCTGraphiteParamLabel label={label} hint={hint} /> : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label ?? (src ? alt || 'Image preview' : emptyText)}
        className="nctgraphite-image-well-target"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 'calc(var(--nct-control-height, 28px) * 3)',
          padding: 'var(--nct-control-padding, 0.5rem)',
          background: 'var(--nct-well-bg, var(--panel-deep, var(--bg-deep, #0e0e14)))',
          border: '1px dashed var(--nct-border, var(--border, #23232f))',
          borderRadius: 'var(--nct-control-radius, 8px)',
          color: 'var(--nct-dim-text, var(--text-dim, #7a7680))',
          fontSize: 'var(--nct-control-font-size, 11px)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          overflow: 'hidden',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {children ?? (src ? (
          <img src={src} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span>{emptyText}</span>
        ))}
      </button>
    </div>
  );
}
