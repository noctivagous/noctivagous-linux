import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const lib = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');
const model = await server.ssrLoadModule('./src/model.ts');

const doc = () => ({
  name: 'Proshade gaps',
  density: 'compact',
  theme: 'light',
  modules: [],
  root: {
    id: 'root', kind: 'stack', label: 'App', props: {}, children: [
      {
        id: 'panel', kind: 'panel', label: 'Channel Strip', props: { variant: 'raised' }, children: [
          { id: 'slider', kind: 'slider', label: 'Volume', props: { value: 58, min: 0, max: 100 }, children: [] },
          { id: 'toggle', kind: 'toggle', label: 'Mute', props: { checked: false }, children: [] },
          { id: 'seg', kind: 'segmented', label: 'Mode', props: { options: 'One, Two', value: 'One' }, children: [] },
        ],
      },
      {
        id: 'toolbar', kind: 'toolbar', label: 'Toolbar', props: { size: 'sm' }, children: [
          { id: 'icon', kind: 'iconButton', label: 'Star', props: { variant: 'ghost' }, children: [] },
        ],
      },
      { id: 'hidden', kind: 'text', label: 'Secret', props: { hidden: true, locked: true }, children: [] },
    ],
  },
});

test('catalog exposes the Proshade palette gap kinds', () => {
  const catalog = lib.buildLayoutCatalog();
  for (const kind of ['slider', 'toggle', 'segmented', 'panel', 'toolbar', 'iconButton']) {
    assert.ok(catalog.some((e) => e.kind === kind), `catalog covers ${kind}`);
  }
  assert.ok(lib.editablePropsFor('slider').includes('value'));
  assert.ok(lib.editablePropsFor('panel').includes('variant'));
});

test('panel and toolbar are containers; leaf widgets reject children', () => {
  assert.ok(lib.layoutContainers.includes('panel'));
  assert.ok(lib.layoutContainers.includes('toolbar'));
  assert.equal(lib.validLayoutNode({ id: 'x', kind: 'slider', label: 'S', props: {}, children: [{ id: 'y', kind: 'text', label: 'T', props: {}, children: [] }] }), false);
  assert.equal(lib.validLayoutDocument(doc()), true);
});

test('XML round-trips new kinds including the iconButton marker and visibility props', () => {
  const xml = lib.serializeLayoutDocument(doc());
  assert.match(xml, /NCTGraphiteSlider/);
  assert.match(xml, /NCTGraphiteToggle/);
  assert.match(xml, /NCTGraphiteSegmented/);
  assert.match(xml, /NCTGraphitePanel/);
  assert.match(xml, /NCTGraphiteToolbar/);
  assert.match(xml, /iconButton="true"/);
  assert.match(xml, /hidden="true"/);
  const back = lib.parseLayoutDocument(xml);
  assert.deepEqual(back, doc());
  assert.equal(back.root.children[1].children[0].kind, 'iconButton');
});

test('drop coordinates are zoom-corrected and clamped at zero', () => {
  assert.deepEqual(model.dropCoords(100, 80, { left: 20, top: 30 }, 100), { x: 80, y: 50 });
  assert.deepEqual(model.dropCoords(100, 80, { left: 20, top: 30 }, 200), { x: 40, y: 25 });
  assert.deepEqual(model.dropCoords(5, 5, { left: 20, top: 30 }, 100), { x: 0, y: 0 });
});

test('scene drops wrap the widget in a positioned scene item', () => {
  const widget = { ...model.makeNode('button'), props: {} };
  const item = model.wrapInSceneItem(widget, 32, 64);
  assert.equal(item.kind, 'sceneItem');
  assert.deepEqual(item.props, { left: 32, top: 64 });
  assert.deepEqual(item.children, [widget]);
  assert.equal(lib.validLayoutDocument({ name: 'D', density: 'compact', modules: [], root: { id: 'r', kind: 'scene', label: 'S', props: {}, children: [item] } }), true);
});

test('grid snapping rounds to spacing or to whole pixels when off', () => {
  assert.equal(model.snapValue(83, true, 10), 80);
  assert.equal(model.snapValue(87, true, 10), 90);
  assert.equal(model.snapValue(83.4, false, 10), 83);
  assert.equal(model.snapValue(83, true, 20), 80);
});

test('scene resize honors handle direction and minimum dimensions', () => {
  const snap = (v) => Math.round(v);
  const orig = { left: 32, top: 64, width: 340, height: 200 };
  assert.deepEqual(model.resizeSceneRect(orig, 'se', 15, 10, snap), { left: 32, top: 64, width: 355, height: 210 });
  assert.deepEqual(model.resizeSceneRect(orig, 'w', 500, 0, snap), { left: 352, top: 64, width: 20, height: 200 });
  assert.deepEqual(model.resizeSceneRect(orig, 'n', 0, 500, snap), { left: 32, top: 250, width: 340, height: 14 });
});

test('calculator starter is a valid bound scene with bound display logic', async () => {
  const starter = await server.ssrLoadModule('./src/studio/starter.ts');
  const project = starter.starterProject();
  assert.equal(lib.validLayoutDocument(project), true);
  assert.equal(project.root.kind, 'scene');
  const display = lib.findLayoutNode(project.root, 'display');
  assert.equal(display?.kind, 'valueDisplay');
  assert.equal(project.root.props.width, 320);
  assert.equal(project.root.props.height, 440);
  const logic = starter.starterLogic();
  assert.deepEqual(lib.validateAppLogic(logic), []);
  assert.equal(lib.getBindingIssues(project, logic).length, 0);
});

test('wide scene geometry overrides persist and revert to base', () => {
  const node = { id: 's', kind: 'sceneItem', label: 'S', props: { left: 16, top: 16, width: 100, height: 50 }, wide: { left: 32, width: 200 }, children: [] };
  const xml = lib.serializeLayoutDocument({ name: 'D', density: 'compact', modules: [], root: { id: 'r', kind: 'scene', label: 'R', props: {}, children: [node] } });
  assert.match(xml, /wide-left="32"/);
  assert.match(xml, /wide-width="200"/);
  const back = lib.parseLayoutDocument(xml);
  assert.deepEqual(lib.findLayoutNode(back.root, 's').wide, { left: 32, width: 200 });
  const reverted = lib.updateLayoutNode(back.root, 's', (n) => { const next = { ...n }; delete next.wide; return next; });
  assert.equal(lib.findLayoutNode(reverted, 's').wide, undefined);
  assert.equal(lib.validLayoutDocument({ name: 'D', density: 'compact', modules: [], root: reverted }), true);
});

test('scene styles keep item wrappers pass-through and children filling frames', () => {
  const css = readFileSync(new URL('../src/studio.css', import.meta.url), 'utf8');
  assert.match(css, /\.preview-node\[data-kind="scene"\][\s\S]*?position:\s*static/);
  assert.match(css, /\.preview-node\[data-kind="sceneItem"\][\s\S]*?width:\s*100%/);
});

test('canvas reparent keeps documents valid and refuses cycles', () => {
  const root = doc().root;
  const moved = lib.moveLayoutNode(root, 'slider', 'toolbar', 1);
  assert.equal(moved.children[1].children[1].id, 'slider');
  assert.equal(lib.validLayoutDocument({ name: 'D', density: 'compact', modules: [], root: moved }), true);
  const panel = lib.findLayoutNode(root, 'panel');
  assert.ok(lib.findLayoutNode(panel, 'slider'));
  assert.deepEqual(lib.moveLayoutNode(root, 'panel', 'slider', 0), root);
  assert.deepEqual(lib.moveLayoutNode(root, 'root', 'panel', 0), root);
});

test('scene reparent repositions with snapped coordinates in one edit', () => {
  const root = doc().root;
  const node = lib.findLayoutNode(root, 'slider');
  const pt = model.dropCoords(120, 90, { left: 20, top: 30 }, 100);
  const placed = { ...node, props: { ...node.props, left: model.snapValue(pt.x, true, 10), top: model.snapValue(pt.y, true, 10) } };
  const next = lib.updateLayoutNode(lib.removeLayoutNode(root, 'slider'), 'toolbar', (n) => ({ ...n, children: [...n.children, placed] }));
  assert.equal(lib.findLayoutNode(next, 'slider').props.left, 100);
  assert.equal(lib.findLayoutNode(next, 'slider').props.top, 60);
  assert.equal(lib.findLayoutNode(next, 'panel').children.length, 2);
});

test('tree moves respect containers and cycles for the new kinds', () => {
  const root = doc().root;
  const moved = lib.moveLayoutNode(root, 'slider', 'toolbar', 1);
  assert.equal(moved.children[1].children[1].id, 'slider');
  assert.deepEqual(lib.moveLayoutNode(root, 'panel', 'slider', 0), root);
});

test('studio UI prefs remember open panels and AI chat across reload', async () => {
  const ui = await server.ssrLoadModule('./src/studio/constants.ts');
  const g = globalThis;
  const prev = g.localStorage;
  const mem = {};
  g.localStorage = {
    getItem: k => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: k => { delete mem[k]; },
  };
  try {
    assert.equal(ui.loadStudioUi().aiOpen, false);
    assert.deepEqual(ui.loadStudioUi().sections, {});
    mem['nctgraphite-studio:ui:v1'] = JSON.stringify({ aiOpen: true, zoom: 150, sections: { 'insp:tree': false } });
    const loaded = ui.loadStudioUi();
    assert.equal(loaded.aiOpen, true);
    assert.equal(loaded.zoom, 150);
    assert.equal(loaded.renderMode, 'app');
    assert.deepEqual(loaded.workspace, { x: 0, y: 0 });
    mem['nctgraphite-studio:ui:v1'] = JSON.stringify({ renderMode: 'outline', workspace: { x: 9999, y: -30 } });
    const again = ui.loadStudioUi();
    assert.equal(again.renderMode, 'outline');
    assert.deepEqual(again.workspace, { x: 2000, y: -30 });
    mem['nctgraphite-studio:ui:v1'] = JSON.stringify({ renderMode: 'neon' });
    assert.equal(loaded.sections['insp:tree'], false);
    mem['nctgraphite-studio:ui:v1'] = 'not json';
    assert.equal(ui.loadStudioUi().aiOpen, false);
  } finally {
    if (prev === undefined) delete g.localStorage; else g.localStorage = prev;
  }
});

test('calculator commands drive the starter app in play mode', async () => {
  const starter = await server.ssrLoadModule('./src/studio/starter.ts');
  const run = ids => ids.reduce((s, id) => starter.calcStep(s, id), starter.calcInitial());
  assert.equal(run(['digit7', 'add', 'digit8', 'eq']).display, '15');
  assert.equal(run(['digit2', 'mul', 'digit3', 'add']).display, '6');
  assert.equal(run(['digit5', 'div', 'digit0', 'eq']).display, 'Error');
  assert.equal(run(['digit5', 'div', 'digit0', 'eq', 'digit1']).display, '1');
  assert.equal(run(['digit5', 'dot', 'digit5', 'add', 'digit2', 'eq']).display, '7.5');
  assert.equal(run(['digit9', 'neg']).display, '-9');
  assert.equal(run(['digit5', 'digit0', 'pct']).display, '0.5');
  assert.equal(run(['digit1', 'clear']).display, '0');
  const fresh = starter.calcInitial();
  assert.equal(starter.calcStep(fresh, 'nope'), fresh);
  const logic = starter.starterLogic();
  const commandIds = new Set(logic.commands.map(c => c.id));
  for (const key of starter.starterProject().root.children.flatMap(c => c.children)) {
    if (key.kind !== 'button') continue;
    const binding = logic.bindings.find(b => b.nodeId === key.id && typeof b.commandId === 'string');
    assert.ok(binding, `${key.id} has no command binding`);
    assert.ok(commandIds.has(binding.commandId), `${key.id} binds unknown command ${binding.commandId}`);
  }
});

test('layout documents carry an app-level appearance theme', () => {
  const base = { name: 'D', density: 'compact', modules: [], root: { id: 'r', kind: 'scene', label: 'R', props: {}, children: [] } };
  assert.equal(lib.validLayoutDocument({ ...base, theme: 'dark' }), true);
  assert.equal(lib.validLayoutDocument({ ...base, theme: 'lab' }), true);
  assert.equal(lib.validLayoutDocument(base), true);
  assert.equal(lib.validLayoutDocument({ ...base, theme: 'neon' }), false);
  const xml = lib.serializeLayoutDocument({ ...base, theme: 'dark' });
  assert.match(xml, /theme="dark"/);
  assert.equal(lib.parseLayoutDocument(xml).theme, 'dark');
  assert.equal(lib.parseLayoutDocument(lib.serializeLayoutDocument(base)).theme, 'light');
});

test('window kind registers with resizable and dock props', async () => {
  const nodes = await server.ssrLoadModule('./src/studio/nodes.ts');
  assert.ok(lib.layoutContainers.includes('window'));
  assert.equal(lib.layoutKindLabels.window, 'Window');
  const entry = lib.buildLayoutCatalog().find(e => e.kind === 'window');
  assert.equal(entry.tag, 'NCTGraphiteWindow');
  assert.equal(entry.meta.props.resizable.default, true);
  assert.deepEqual(entry.meta.props.dock.type, ['none', 'left', 'right', 'top', 'bottom']);
  assert.ok(lib.editablePropsFor('window').includes('resizable'));
  assert.deepEqual(nodes.defaultsFor('window'), { resizable: true });
  const doc = { name: 'W', density: 'compact', theme: 'light', modules: [], root: { id: 'r', kind: 'stack', label: 'App', props: {}, children: [{ id: 'w', kind: 'window', label: 'Palette', props: { resizable: false, dock: 'right', width: 280 }, children: [] }] } };
  const back = lib.parseLayoutDocument(lib.serializeLayoutDocument(doc));
  assert.deepEqual(back, doc);
  assert.match(lib.serializeLayoutDocument(doc), /NCTGraphiteWindow/);
});

test('scene items pin and stretch with right/bottom insets', () => {
  const doc = {
    name: 'P', density: 'compact', theme: 'light', modules: [],
    root: { id: 's', kind: 'scene', label: 'S', props: { width: 320, height: 440 }, children: [
      { id: 'a', kind: 'sceneItem', label: 'A', props: { left: 16, top: 16, right: 16, height: 64 }, children: [] },
      { id: 'b', kind: 'sceneItem', label: 'B', props: { left: 16, top: 96, width: 64, height: 56 }, children: [],
        wide: { right: 16 } },
    ] },
  };
  assert.equal(lib.validLayoutDocument(doc), true);
  assert.deepEqual(lib.parseLayoutDocument(lib.serializeLayoutDocument(doc)), doc);
});

test('reparenting an existing scene item places it at the new drop coordinates', async () => {
  const { reparentNode } = await server.ssrLoadModule('./src/studio/nodes.ts');
  const item = { id: 'item', kind: 'sceneItem', label: 'Item', props: { left: 5, top: 6, width: 40, height: 30 }, children: [] };
  const root = { id: 'root', kind: 'stack', label: 'Root', props: {}, children: [item, { id: 'scene', kind: 'scene', label: 'Scene', props: {}, children: [] }] };
  const result = reparentNode(root, 'item', 'scene', 'inside', { x: 90, y: 80 });
  assert.ok(result.root);
  assert.equal(lib.findLayoutNode(result.root, 'item').props.left, 90);
  assert.equal(lib.findLayoutNode(result.root, 'item').props.top, 80);
  assert.equal(lib.findLayoutNode(result.root, 'scene').children[0].id, 'item');
});
