import { GRID_DEFAULT_COLUMNS } from './constants';
import { containers, find, labels, moveNode, remove, update, wrapInSceneItem } from '../model';
import type { Kind, Node } from '../model';

export function defaultsFor(kind: Kind): Node['props'] {
  if (kind === 'grid') return { columns: GRID_DEFAULT_COLUMNS };
  if (kind === 'tabs' || kind === 'list' || kind === 'segmented') return { options: 'One, Two, Three' };
  if (kind === 'knob' || kind === 'fader' || kind === 'slider') return { value: 50, min: 0, max: 100 };
  if (kind === 'dualRange') return { min: 0, max: 100 };
  if (kind === 'meter') return { value: 40, min: 0, max: 100 };
  if (kind === 'progress') return { value: 68, max: 100 };
  if (kind === 'valueDisplay') return { value: 0 };
  if (kind === 'toggle') return { checked: false };
  if (kind === 'panel') return { variant: 'raised' };
  if (kind === 'toolbar') return { size: 'md' };
  if (kind === 'iconButton') return { variant: 'ghost' };
  if (kind === 'window') return { resizable: true };
  return {};
}

export function parentOf(node: Node, id: string): Node | undefined {
  for (const child of node.children) {
    if (child.id === id) return node;
    const hit = parentOf(child, id);
    if (hit) return hit;
  }
  return undefined;
}

export function coerceInput(raw: string): string | number | boolean {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw.trim()) && raw.trim() !== '') return Number(raw);
  return raw;
}

export type DropZone = 'before' | 'inside' | 'after';

/** Palette glyphs that read as the control itself, Proshade style. */
/** Device preset glyphs for the preview-size switcher. */
export const DEVICE_ICONS: Record<string, string> = {
  fluid: '⇔', phone: '☎', tablet: '▭', desktop: '⌨',
};

/** Palette category glyphs. */
export const CATEGORY_ICONS: Record<string, string> = {
  layout: '▦', content: '◫', modules: '◈',
};

/** Inspector section glyphs, keyed by section id. */
export const SECTION_ICONS: Record<string, string> = {
  tree: '☷', module: '▢', props: '☰', geom: '⌖', canvas: '◰', vis: '⊙',
  grid: '╬', binding: '⚡', logic: 'ƒ', settings: '✦',
};

/** Palette glyphs that read as the control itself, Proshade style. */
export const PALETTE_ICONS: Record<string, string> = {
  accordion: '▤', columns: '❚❚', grid: '▦', layoutItem: '◽', overlay: '◧',
  panel: '▣', row: '⇔', scene: '◈', sceneItem: '◇', stack: '⊞', toolbar: '⬒',
  button: '◫', checkbox: '☑', dualRange: '↔', fader: '↕', field: '▭',
  iconButton: '◈', imageWell: '◩', knob: '◎', list: '☷', meter: '▂',
  progress: '▬', segmented: '⧉', separator: '―', slider: '◉', tabs: '▥',
  text: 'T', textArea: '☰', toggle: '◐', valueDisplay: '◔', module: '▢',
  window: '⊡',
};

export type ReparentResult =
  | { root: Node; placedId: string; note: string }
  | { error: string };

function lockNote(n: Node): string {
  return `${n.label || labels[n.kind]} is locked`;
}

/** Move a node to a before/inside/after drop position in one edit.
 * Used by both canvas and tree drops so the guards stay identical. */
export function reparentNode(root: Node, nodeId: string, targetId: string, zone: DropZone, pos?: { x: number; y: number }): ReparentResult {
  const node = find(root, nodeId);
  const target = find(root, targetId);
  if (!node || !target) return { error: 'Drop onto a container to reparent' };
  if (nodeId === root.id) return { error: 'Cannot move the root' };
  if (nodeId === targetId) return { error: '' };
  if (node.props.locked === true) return { error: lockNote(node) };
  if (find(node, targetId)) return { error: 'Cannot move into itself' };
  const name = node.label || labels[node.kind];
  if (zone === 'inside') {
    if (!containers.includes(target.kind)) return { error: 'Drop onto a container to reparent' };
    if (target.props.locked === true) return { error: lockNote(target) };
    if (target.kind === 'scene' && node.kind !== 'sceneItem') {
      const placed = wrapInSceneItem({ ...node }, pos?.x ?? 0, pos?.y ?? 0);
      return {
        root: update(remove(root, nodeId), targetId, n => ({ ...n, children: [...n.children, placed] })),
        placedId: placed.children[0].id,
        note: `Moved ${name} into scene`,
      };
    }
    const movedRoot = moveNode(root, nodeId, targetId, target.children.length);
    const positionedRoot = target.kind === 'scene' && node.kind === 'sceneItem' && pos
      ? update(movedRoot, nodeId, n => ({ ...n, props: { ...n.props, left: pos.x, top: pos.y } }))
      : movedRoot;
    return {
      root: positionedRoot,
      placedId: nodeId,
      note: `Moved ${name} into ${target.label || labels[target.kind]}`,
    };
  }
  const parent = parentOf(root, targetId);
  if (!parent) return { error: 'Cannot reorder here' };
  if (parent.props.locked === true) return { error: lockNote(parent) };
  const without = remove(root, nodeId);
  const p = find(without, parent.id);
  if (!p) return { error: 'Cannot reorder here' };
  const ti = p.children.findIndex(c => c.id === targetId);
  if (ti < 0) return { error: 'Cannot reorder here' };
  const at = zone === 'after' ? ti + 1 : ti;
  const moved = { ...node };
  return {
    root: update(without, parent.id, pp => ({ ...pp, children: [...pp.children.slice(0, at), moved, ...pp.children.slice(at)] })),
    placedId: nodeId,
    note: `Moved ${name}`,
  };
}
