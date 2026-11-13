/** Shared Studio layout-tree document: nodes, saved modules, validation, tree ops.
 * This is the layout-tree document for app building (`*.nctgraphite.xml`).
 * It is distinct from the drawing/layers `NCTGraphiteDocument` (`.nctgdoc.json`).
 */

export const NCTGRAPHITE_LAYOUT_KIND = 'nctgraphite-layout';
export const NCTGRAPHITE_LAYOUT_VERSION = 1;
export const NCTGRAPHITE_LAYOUT_FILE_EXTENSION = 'nctgraphite.xml';

export type LayoutKind =
  | 'stack' | 'row' | 'grid' | 'overlay' | 'accordion'
  | 'columns' | 'scene' | 'sceneItem' | 'layoutItem'
  | 'text' | 'button' | 'iconButton' | 'module'
  | 'field' | 'textArea' | 'checkbox' | 'tabs' | 'list'
  | 'imageWell' | 'separator' | 'progress'
  | 'knob' | 'fader' | 'dualRange' | 'meter' | 'valueDisplay'
  | 'slider' | 'toggle' | 'segmented' | 'panel' | 'toolbar' | 'window';

export type LayoutPropValue = string | number | boolean;

export interface LayoutNode {
  id: string;
  kind: LayoutKind;
  label: string;
  props: Record<string, LayoutPropValue>;
  /** Overrides applied at/above the wide breakpoint (e.g. grid columns). */
  wide?: Record<string, LayoutPropValue>;
  moduleId?: string;
  children: LayoutNode[];
}

export interface SavedLayoutModule {
  id: string;
  name: string;
  root: LayoutNode;
}

export interface LayoutDocument {
  name: string;
  density: 'compact' | 'comfortable';
  /** App-level appearance theme for the edited app (Studio chrome is unaffected). */
  theme?: 'light' | 'dark' | 'lab';
  root: LayoutNode;
  modules: SavedLayoutModule[];
}

export const layoutContainers: LayoutKind[] = [
  'stack', 'row', 'grid', 'overlay', 'accordion', 'columns', 'scene', 'sceneItem', 'layoutItem',
  'panel', 'toolbar', 'window',
];

export const layoutKindLabels: Record<LayoutKind, string> = {
  stack: 'Vertical stack',
  row: 'Horizontal stack',
  grid: 'Grid',
  overlay: 'Overlay',
  accordion: 'Accordion',
  columns: 'Columns',
  scene: 'Scene',
  sceneItem: 'Scene item',
  layoutItem: 'Layout item',
  text: 'Text',
  button: 'Button',
  iconButton: 'Icon button',
  module: 'Module',
  field: 'Text field',
  textArea: 'Text area',
  checkbox: 'Checkbox',
  tabs: 'Tabs',
  list: 'List',
  imageWell: 'Image well',
  separator: 'Separator',
  progress: 'Progress',
  knob: 'Knob',
  fader: 'Fader',
  dualRange: 'Dual range',
  meter: 'Meter',
  valueDisplay: 'Value display',
  slider: 'Slider',
  toggle: 'Toggle',
  segmented: 'Segmented control',
  panel: 'Panel',
  toolbar: 'Toolbar',
  window: 'Window',
};

function freshId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeLayoutNode(kind: LayoutKind, label = layoutKindLabels[kind]): LayoutNode {
  return { id: freshId(), kind, label, props: {}, children: [] };
}

export function findLayoutNode(node: LayoutNode, id: string): LayoutNode | undefined {
  if (node.id === id) return node;
  for (const child of node.children) {
    const hit = findLayoutNode(child, id);
    if (hit) return hit;
  }
  return undefined;
}

export function updateLayoutNode(node: LayoutNode, id: string, fn: (node: LayoutNode) => LayoutNode): LayoutNode {
  if (node.id === id) return fn(node);
  return { ...node, children: node.children.map((child) => updateLayoutNode(child, id, fn)) };
}

export function removeLayoutNode(node: LayoutNode, id: string): LayoutNode {
  return {
    ...node,
    children: node.children.filter((child) => child.id !== id).map((child) => removeLayoutNode(child, id)),
  };
}

/** Deep copy with fresh ids. Module references keep their `moduleId`. */
export function cloneLayoutNode(node: LayoutNode): LayoutNode {
  return {
    ...node,
    id: freshId(),
    props: { ...node.props },
    wide: node.wide ? { ...node.wide } : undefined,
    children: node.children.map(cloneLayoutNode),
  };
}

/** Move a node to a new parent at the given index (clamped). No-op when invalid. */
export function moveLayoutNode(root: LayoutNode, nodeId: string, parentId: string, index: number): LayoutNode {
  if (nodeId === root.id) return root;
  const node = findLayoutNode(root, nodeId);
  const parent = findLayoutNode(root, parentId);
  if (!node || !parent || !layoutContainers.includes(parent.kind)) return root;
  if (findLayoutNode(node, parentId)) return root; // cannot move into itself
  const without = removeLayoutNode(root, nodeId);
  const at = Math.max(0, Math.min(index, findLayoutNode(without, parentId)?.children.length ?? 0));
  return updateLayoutNode(without, parentId, (p) => ({
    ...p,
    children: [...p.children.slice(0, at), { ...node }, ...p.children.slice(at)],
  }));
}

/** Duplicate a node as the next sibling with fresh ids. */
export function duplicateLayoutNode(root: LayoutNode, id: string): LayoutNode {
  const node = findLayoutNode(root, id);
  if (!node || id === root.id) return root;
  const copy = cloneLayoutNode(node);
  const out = duplicateChild(root, id, copy);
  return out ?? root;
}

function duplicateChild(node: LayoutNode, id: string, copy: LayoutNode): LayoutNode | null {
  const index = node.children.findIndex((child) => child.id === id);
  if (index >= 0) {
    return { ...node, children: [...node.children.slice(0, index + 1), copy, ...node.children.slice(index + 1)] };
  }
  for (let i = 0; i < node.children.length; i++) {
    const next = duplicateChild(node.children[i], id, copy);
    if (next) return { ...node, children: node.children.map((c, j) => (j === i ? next : c)) };
  }
  return null;
}

/** An instance node pointing at a saved definition (a leaf in the using tree). */
export function instantiateLayoutModule(def: SavedLayoutModule): LayoutNode {
  return { id: freshId(), kind: 'module', label: def.name, props: {}, moduleId: def.id, children: [] };
}

/** Strip every instance of a deleted module from a tree. */
export function removeLayoutModuleRefs(node: LayoutNode, moduleId: string): LayoutNode {
  return {
    ...node,
    children: node.children
      .filter((child) => child.moduleId !== moduleId)
      .map((child) => removeLayoutModuleRefs(child, moduleId)),
  };
}

function isPropRecord(value: unknown): value is Record<string, LayoutPropValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((v) => ['string', 'number', 'boolean'].includes(typeof v));
}

export function validLayoutNode(
  value: unknown,
  modules: Pick<SavedLayoutModule, 'id'>[] = [],
  ids = new Set<string>(),
): value is LayoutNode {
  if (!value || typeof value !== 'object') return false;
  const n = value as LayoutNode;
  if (typeof n.id !== 'string' || !n.id || ids.has(n.id)) return false;
  if (!Object.hasOwn(layoutKindLabels, n.kind)) return false;
  if (typeof n.label !== 'string' || !Array.isArray(n.children)) return false;
  // `props` is optional for backward compatibility with early Studio trees.
  if (n.props !== undefined && !isPropRecord(n.props)) return false;
  if (n.wide !== undefined && !isPropRecord(n.wide)) return false;
  if (n.kind === 'module') {
    if (typeof n.moduleId !== 'string' || !modules.some((m) => m.id === n.moduleId) || n.children.length > 0) return false;
  } else {
    if (n.moduleId !== undefined) return false;
    if (!layoutContainers.includes(n.kind) && n.children.length > 0) return false;
  }
  ids.add(n.id);
  return n.children.every((child) => validLayoutNode(child, modules, ids));
}

export function validLayoutModule(
  value: unknown,
  modules: Pick<SavedLayoutModule, 'id'>[] = [],
  ids = new Set<string>(),
): value is SavedLayoutModule {
  if (!value || typeof value !== 'object') return false;
  const m = value as SavedLayoutModule;
  if (typeof m.id !== 'string' || !m.id || ids.has(m.id) || typeof m.name !== 'string') return false;
  ids.add(m.id);
  return layoutContainers.includes(m.root?.kind) && validLayoutNode(m.root, modules, ids);
}

export function validLayoutDocument(value: unknown): value is LayoutDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as LayoutDocument;
  if (typeof doc.name !== 'string' || !['compact', 'comfortable'].includes(doc.density)) return false;
  if (doc.theme !== undefined && !['light', 'dark', 'lab'].includes(doc.theme)) return false;
  if (!Array.isArray(doc.modules)) return false;
  const ids = new Set<string>();
  if (!doc.modules.every((m) => validLayoutModule(m, doc.modules, ids))) return false;
  if (!validLayoutNode(doc.root, doc.modules, ids)) return false;
  return layoutContainers.includes(doc.root.kind);
}
