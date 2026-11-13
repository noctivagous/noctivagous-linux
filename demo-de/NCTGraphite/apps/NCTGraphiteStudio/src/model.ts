/** Studio project model: thin layer over the shared layout-tree document.
 * Pure helpers live here (testable without React); `App.tsx` owns the state.
 * Module instances (`kind: 'module'`) reference a saved definition by id, so
 * editing a definition updates every instance. Renderers guard cycles with a
 * `seen` set of module ids. New code should import from `@nct/nctgraphite`
 * directly; these aliases keep existing imports working.
 */
import {
  cloneLayoutNode,
  findLayoutNode,
  instantiateLayoutModule,
  layoutContainers,
  layoutKindLabels,
  makeLayoutNode,
  moveLayoutNode,
  duplicateLayoutNode,
  removeLayoutModuleRefs,
  removeLayoutNode,
  updateLayoutNode,
  validLayoutDocument,
  validLayoutModule,
  validLayoutNode,
  type LayoutDocument,
  type LayoutKind,
  type LayoutNode,
  type SavedLayoutModule,
} from '@nct/nctgraphite';

export type Kind = LayoutKind;
export type Node = LayoutNode;
export type SavedModule = SavedLayoutModule;
export type Project = LayoutDocument;

export const containers = layoutContainers;
export const labels = layoutKindLabels;

export const makeNode = makeLayoutNode;
export const find = findLayoutNode;

/** Zoom-corrected drop coordinates relative to a scene rect, clamped at zero. */
export function dropCoords(clientX: number, clientY: number, rect: { left: number; top: number }, zoomPct: number): { x: number; y: number } {
  const scale = zoomPct > 0 ? zoomPct / 100 : 1;
  return {
    x: Math.max(0, Math.round((clientX - rect.left) / scale)),
    y: Math.max(0, Math.round((clientY - rect.top) / scale)),
  };
}

/** Wrap a widget node in a scene item positioned at the drop point. */
export function wrapInSceneItem(child: Node, x: number, y: number): Node {
  const item = makeLayoutNode('sceneItem', `${child.label} item`);
  item.props = { left: x, top: y };
  item.children = [child];
  return item;
}

export interface SceneRect { left: number; top: number; width: number; height: number }

/** Snap a pointer-derived value to the grid, or round it when snapping is off. */
export function snapValue(value: number, enabled: boolean, size: number): number {
  const step = size >= 2 ? size : 10;
  return enabled ? Math.round(value / step) * step : Math.round(value);
}

export const SCENE_MIN_WIDTH = 20;
export const SCENE_MIN_HEIGHT = 14;

/** Resize a scene rect from a handle direction (n/s/e/w combos) with pointer deltas. */
export function resizeSceneRect(orig: SceneRect, dir: string, dx: number, dy: number, snap: (v: number) => number): SceneRect {
  let { left, top, width, height } = orig;
  if (dir.includes('e')) width = Math.max(SCENE_MIN_WIDTH, snap(orig.width + dx));
  if (dir.includes('s')) height = Math.max(SCENE_MIN_HEIGHT, snap(orig.height + dy));
  if (dir.includes('w')) {
    const w = Math.max(SCENE_MIN_WIDTH, snap(orig.width - dx));
    left = orig.left + (orig.width - w);
    width = w;
  }
  if (dir.includes('n')) {
    const h = Math.max(SCENE_MIN_HEIGHT, snap(orig.height - dy));
    top = orig.top + (orig.height - h);
    height = h;
  }
  return { left, top, width, height };
}
export const update = updateLayoutNode;
export const remove = removeLayoutNode;
export const cloneWithIds = cloneLayoutNode;
export const instantiateModule = instantiateLayoutModule;
export const removeModuleRefs = removeLayoutModuleRefs;
export const validNode = validLayoutNode;
export const validModule = validLayoutModule;
export const validDocument = validLayoutDocument;
export const moveNode = moveLayoutNode;
export const duplicateNode = duplicateLayoutNode;

function toLayoutNode(raw: unknown, modules: Pick<SavedModule, 'id'>[]): LayoutNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Record<string, unknown>;
  const candidate: LayoutNode = {
    id: typeof n.id === 'string' ? n.id : '',
    kind: n.kind as LayoutKind,
    label: typeof n.label === 'string' ? n.label : '',
    props: (n.props as LayoutNode['props']) ?? {},
    wide: n.wide as LayoutNode['wide'],
    moduleId: n.moduleId as string | undefined,
    children: [],
  };
  if (Array.isArray(n.children)) {
    const kids: LayoutNode[] = [];
    for (const c of n.children) {
      const kid = toLayoutNode(c, modules);
      if (!kid) return null;
      kids.push(kid);
    }
    candidate.children = kids;
  }
  if (candidate.wide === undefined) delete candidate.wide;
  if (candidate.moduleId === undefined) delete candidate.moduleId;
  const ids = new Set<string>();
  // Validate standalone shape first (module refs checked against provided ids).
  if (!validLayoutNode(candidate, modules, ids)) return null;
  return candidate;
}

/** Migrate an early `.nctgraphite.json` download (v1 without modules, v2 with)
 * into the shared layout document. Returns null when invalid. */
export function migrateLegacyStudioProject(data: unknown): Project | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.format !== 'nctgraphite-studio' || (d.version !== 1 && d.version !== 2)) return null;
  if (typeof d.name !== 'string' || !['compact', 'comfortable'].includes(d.density as string)) return null;
  const rawModules: unknown[] = d.version === 2 && Array.isArray(d.modules) ? d.modules : [];
  const modules: SavedModule[] = [];
  const moduleIds = new Set<string>();
  for (const raw of rawModules) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const root = toLayoutNode(r.root, rawModules as Pick<SavedModule, 'id'>[]);
    if (typeof r.id !== 'string' || !r.id || typeof r.name !== 'string' || !root) return null;
    if (moduleIds.has(r.id) || !layoutContainers.includes(root.kind)) return null;
    moduleIds.add(r.id);
    modules.push({ id: r.id, name: r.name, root });
  }
  const root = toLayoutNode(d.root, modules);
  if (!root || !layoutContainers.includes(root.kind)) return null;
  const doc: Project = {
    name: d.name as string,
    density: d.density as Project['density'],
    root,
    modules,
  };
  if (!validLayoutDocument(doc)) return null;
  return doc;
}
