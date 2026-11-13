import type { CSSProperties, MouseEventHandler, ReactNode } from 'react';
import { appearancePropMeta, appearanceStyle, type NCTGraphiteAppearanceProps } from './NCTGraphiteMeta.js';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteButtonMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteButton',
  category: 'widgets',
  description: 'Lab action button with optional small leading SVG icon',
  props: {
    ...appearancePropMeta,
    label: { type: 'string', required: true, description: 'Button text label' },
    icon: { type: 'node', required: false, description: 'Optional small leading SVG icon (14px, stroke="currentColor")' },
    onClick: { type: 'function', required: false, description: '() => void click handler' },
    variant: { type: 'string', required: false, description: '"default" dark, "primary" accent fill, or "ghost" borderless' },
    disabled: { type: 'boolean', required: false, description: 'Disable the button' },
    title: { type: 'string', required: false, description: 'Native tooltip text' },
  },
  emits: [],
  dependencies: [],
};

export interface NCTGraphiteButtonProps extends NCTGraphiteAppearanceProps {
  label: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: 'default' | 'primary' | 'ghost';
  disabled?: boolean;
  title?: string;
  className?: string;
  style?: CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

const variantStyle: Record<NCTGraphiteButtonProps['variant'] & string, CSSProperties> = {
  default: {
    background: 'var(--nct-btn-bg, var(--panel-2, #1a1a24))',
    borderColor: 'var(--nct-btn-border, var(--border, #23232f))',
    color: 'var(--nct-btn-text, var(--text, #f5f1e8))',
  },
  primary: {
    background: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
    borderColor: 'var(--nct-accent-bg, var(--accent, #7c5cff))',
    color: 'var(--nct-accent-text, #fff)',
  },
  ghost: {
    background: 'transparent',
    borderColor: 'transparent',
    color: 'var(--nct-btn-dim-text, var(--text-dim, #7a7680))',
  },
};

/** Lab action button: label with an optional small leading SVG icon. */
export function NCTGraphiteButton({
  label,
  icon,
  onClick,
  variant = 'default',
  disabled = false,
  title,
  className = '',
  style,
  type = 'button',
  opacity,
  cornerRadius,
}: NCTGraphiteButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`nctgraphite-button inline-flex items-center justify-center border font-bold disabled:opacity-50 ${className}`}
      style={{
        gap: 'var(--nct-control-gap, 6px)',
        padding: 'var(--nct-control-padding, 0.5rem) 12px',
        minHeight: 'var(--nct-control-height, 28px)',
        fontSize: 'var(--nct-control-font-size, 11px)',
        borderRadius: 'var(--nct-control-radius, 8px)',
        ...variantStyle[variant],
        ...style,
        ...appearanceStyle({ opacity, cornerRadius }),
      }}
    >
      {icon ? (
        <span className="inline-flex flex-none items-center [&>svg]:block" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
