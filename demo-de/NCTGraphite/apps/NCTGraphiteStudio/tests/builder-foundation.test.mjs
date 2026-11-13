import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const lib = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');
const model = await server.ssrLoadModule('./src/model.ts');

const doc = () => ({
  name: 'Test app',
  density: 'compact',
  theme: 'light',
  modules: [{ id: 'mod-1', name: 'Card', root: { id: 'card', kind: 'stack', label: 'Card', props: { gap: 8 }, children: [{ id: 't', kind: 'text', label: 'Hi', props: {}, children: [] }] } }],
  root: {
    id: 'root', kind: 'grid', label: 'App', props: { columns: '1fr 1fr', gap: 4 }, wide: { columns: '1fr 1fr 1fr' },
    children: [
      { id: 'a', kind: 'text', label: 'A & B', props: {}, children: [] },
      { id: 'm', kind: 'module', label: 'Card', props: {}, moduleId: 'mod-1', children: [] },
    ],
  },
});

test('XML round-trips the document including props, wide overrides, and modules', () => {
  const xml = lib.serializeLayoutDocument(doc());
  assert.match(xml, /<\?xml/);
  assert.match(xml, /NCTGraphiteGrid/);
  assert.match(xml, /wide-columns="1fr 1fr 1fr"/);
  assert.match(xml, /A &amp; B/);
  const back = lib.parseLayoutDocument(xml);
  assert.deepEqual(back, doc());
});

test('XML parse rejects unknown tags and newer versions', () => {
  const bad = lib.serializeLayoutDocument(doc()).replaceAll('NCTGraphiteGrid', 'NCTGraphiteNope');
  assert.throws(() => lib.parseLayoutDocument(bad), /Unknown layout tag/);
  const newer = lib.serializeLayoutDocument(doc()).replace('version="1"', 'version="99"');
  assert.throws(() => lib.parseLayoutDocument(newer), RangeError);
  assert.throws(() => lib.parseLayoutDocument('<NCTGraphiteLayout version="1"><Root/></NCTGraphiteLayout>'), TypeError);
});

test('validator rejects dangling module refs and duplicate ids', () => {
  assert.equal(lib.validLayoutNode({ id: 'i', kind: 'module', label: 'M', props: {}, moduleId: 'missing', children: [] }, [], new Set()), false);
  const ids = new Set(['dup']);
  assert.equal(lib.validLayoutNode({ id: 'dup', kind: 'text', label: 'Hi', props: {}, children: [] }, [], ids), false);
  assert.equal(lib.validLayoutDocument({ ...doc(), density: 'huge' }), false);
});

test('catalog is generated from library metadata and drives editing', () => {
  const catalog = lib.buildLayoutCatalog();
  for (const kind of ['stack', 'row', 'grid', 'overlay', 'accordion', 'columns', 'scene', 'sceneItem', 'layoutItem', 'text', 'button', 'module']) {
    assert.ok(catalog.some((e) => e.kind === kind), `catalog covers ${kind}`);
  }
  const gridProps = lib.editablePropsFor('grid');
  assert.ok(gridProps.includes('columns'));
  assert.ok(!gridProps.includes('children'));
});

test('tree reorder, reparent, and duplicate keep valid documents', () => {
  const root = doc().root;
  const moved = lib.moveLayoutNode(root, 'm', 'root', 0);
  assert.deepEqual(moved.children.map((c) => c.id), ['m', 'a']);
  assert.equal(lib.validLayoutNode(moved, doc().modules), true);
  // Cannot move a node into itself.
  assert.equal(lib.moveLayoutNode(root, 'root', 'a', 0), root);
  const duped = lib.duplicateLayoutNode(root, 'a');
  assert.equal(duped.children.length, 3);
  assert.notEqual(duped.children[1].id, 'a');
  assert.equal(duped.children[1].label, 'A & B');
  assert.equal(lib.validLayoutNode(duped, doc().modules), true);
});

test('legacy Studio JSON v1 and v2 migrate to the shared document', () => {
  const v1 = { format: 'nctgraphite-studio', version: 1, name: 'Old', density: 'compact', root: { id: 'root', kind: 'stack', label: 'App', children: [{ id: 't', kind: 'text', label: 'Hi', children: [] }] } };
  const next = model.migrateLegacyStudioProject(v1);
  assert.ok(next);
  assert.deepEqual(next.modules, []);
  assert.deepEqual(next.root.children[0].props, {});
  assert.equal(lib.validLayoutDocument(next), true);

  const v2 = { ...v1, version: 2, modules: [{ id: 'mod-1', name: 'Card', root: { id: 'card', kind: 'stack', label: 'Card', children: [] } }], root: { id: 'root', kind: 'stack', label: 'App', children: [{ id: 'i', kind: 'module', label: 'Card', moduleId: 'mod-1', children: [] }] } };
  const migrated = model.migrateLegacyStudioProject(v2);
  assert.ok(migrated);
  assert.equal(migrated.modules.length, 1);
  assert.equal(lib.validLayoutDocument(migrated), true);

  assert.equal(model.migrateLegacyStudioProject({ format: 'nope' }), null);
  assert.equal(model.migrateLegacyStudioProject({ format: 'nctgraphite-studio', version: 3, name: 'x', density: 'compact', root: v1.root }), null);
});
