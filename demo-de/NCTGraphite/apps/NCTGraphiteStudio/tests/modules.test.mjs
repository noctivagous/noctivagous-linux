import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const model = await server.ssrLoadModule('./src/model.ts');

test('instantiate keeps a live reference with fresh ids', () => {
  const def = { id: 'mod-1', name: 'Card', root: { id: 'r', kind: 'stack', label: 'Card', children: [{ id: 'c', kind: 'text', label: 'Hi', children: [] }] } };
  const a = model.instantiateModule(def);
  const b = model.instantiateModule(def);
  assert.equal(a.kind, 'module'); assert.equal(a.moduleId, 'mod-1'); assert.deepEqual(a.children, []);
  assert.notEqual(a.id, b.id);
});

test('clone gives a definition copy with unique ids', () => {
  const node = { id: 'r', kind: 'stack', label: 'Card', children: [{ id: 'c', kind: 'text', label: 'Hi', children: [] }] };
  const copy = model.cloneWithIds(node);
  assert.notEqual(copy.id, 'r'); assert.notEqual(copy.children[0].id, 'c');
  assert.equal(copy.children[0].label, 'Hi');
});

test('validation rejects dangling module references', () => {
  const ids = new Set();
  assert.equal(model.validNode({ id: 'i', kind: 'module', label: 'M', moduleId: 'missing', children: [] }, [], ids), false);
  const ids2 = new Set();
  assert.equal(model.validNode({ id: 'i', kind: 'module', label: 'M', moduleId: 'mod-1', children: [] }, [{ id: 'mod-1' }], ids2), true);
});

test('validation rejects duplicate ids across the project and modules', () => {
  const def = { id: 'mod-1', name: 'Card', root: { id: 'dup', kind: 'stack', label: 'Card', children: [] } };
  const ids = new Set();
  assert.equal(model.validModule(def, [def], ids), true);
  assert.equal(model.validNode({ id: 'dup', kind: 'text', label: 'Hi', children: [] }, [def], ids), false);
});

test('deleting a module strips its instances everywhere', () => {
  const inst = { id: 'i', kind: 'module', label: 'Card', moduleId: 'mod-1', children: [] };
  const tree = { id: 'root', kind: 'stack', label: 'App', children: [inst, { id: 't', kind: 'text', label: 'Keep', children: [] }] };
  const stripped = model.removeModuleRefs(tree, 'mod-1');
  assert.equal(stripped.children.length, 1); assert.equal(stripped.children[0].id, 't');
});
