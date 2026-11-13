import type { CSSProperties, ReactNode } from 'react';
import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';

export const NCTGraphiteSceneMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteScene', category: 'layout',
  description: 'A bounded coordinate space for explicitly positioned content',
  props: {
    width: { type: ['number', 'string'], required: false, description: 'Scene width in pixels or CSS units' },
    height: { type: ['number', 'string'], required: false, description: 'Scene height in pixels or CSS units' },
    overflow: { type: ['visible', 'hidden', 'clip', 'auto', 'scroll'], default: 'visible', description: 'Overflow behavior' },
    children: { type: 'node', required: true, description: 'Scene content, typically NCTGraphiteSceneItem elements' },
  }, slots: { default: 'Scene content' }, emits: [], dependencies: [],
};
export const NCTGraphiteSceneItemMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteSceneItem', category: 'layout',
  description: 'An absolutely positioned item within an NCTGraphiteScene',
  props: {
    left: { type: ['number', 'string'], required: false, description: 'Left inset in pixels or CSS units' },
    top: { type: ['number', 'string'], required: false, description: 'Top inset in pixels or CSS units' },
    right: { type: ['number', 'string'], required: false, description: 'Right inset; can be combined with left to stretch' },
    bottom: { type: ['number', 'string'], required: false, description: 'Bottom inset; can be combined with top to stretch' },
    width: { type: ['number', 'string'], required: false, description: 'Item width' },
    height: { type: ['number', 'string'], required: false, description: 'Item height' },
    zIndex: { type: 'number', required: false, description: 'Stacking order' },
    children: { type: 'node', required: true, description: 'Item content' },
  }, slots: { default: 'Item content' }, emits: [], dependencies: ['NCTGraphiteScene'],
};
type Length = number | string;
export interface NCTGraphiteSceneProps {
  width?: Length; height?: Length; overflow?: 'visible' | 'hidden' | 'clip' | 'auto' | 'scroll';
  className?: string; style?: CSSProperties; children: ReactNode;
}
export interface NCTGraphiteSceneItemProps {
  left?: Length; top?: Length; right?: Length; bottom?: Length; width?: Length; height?: Length;
  zIndex?: number; className?: string; style?: CSSProperties; children: ReactNode;
}
/** Establishes a containing block; give it a height or in-flow content. */
export function NCTGraphiteScene({ width, height, overflow = 'visible', className = '', style, children }: NCTGraphiteSceneProps) {
  return <div className={className} style={{ position: 'relative', width, height, overflow, ...style }}>{children}</div>;
}
/** Position and optionally pin an item relative to its nearest positioned ancestor. */
export function NCTGraphiteSceneItem({ left, top, right, bottom, width, height, zIndex, className = '', style, children }: NCTGraphiteSceneItemProps) {
  return <div className={className} style={{ position: 'absolute', left, top, right, bottom, width, height, zIndex, ...style }}>{children}</div>;
}
