import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const lib = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');
const logic = await server.ssrLoadModule('../../packages/nctgraphite/src/logic/NCTGraphiteAppLogic.ts');
const project = await server.ssrLoadModule('./src/project.ts');
const storage = await server.ssrLoadModule('./src/storage.ts');
const agent = await server.ssrLoadModule('./src/agent.ts');

const doc = (name = 'Test app') => ({
  name,
  density: 'compact',
  modules: [],
  root: {
    id: 'root', kind: 'stack', label: 'App', props: {},
    children: [
      { id: 't', kind: 'text', label: 'Hi', props: {}, children: [] },
      { id: 'b', kind: 'button', label: 'Go', props: {}, children: [] },
    ],
  },
});

test('default logic validates and rejects bad shapes safely', () => {
  const def = logic.defaultAppLogic();
  assert.deepEqual(logic.validateAppLogic(def), []);
  assert.ok(logic.validateAppLogic({}).length > 0);
  assert.ok(logic.validateAppLogic({ ...def, state: [{ key: '', type: 'string', default: '' }] }).some((e) => e.includes('key')));
  assert.ok(logic.validateAppLogic({ ...def, version: 99 }).some((e) => e.includes('version')));
});

test('binding issues name orphans and unknown keys', () => {
  const appLogic = {
    ...logic.defaultAppLogic(),
    state: [{ key: 'name', type: 'string', default: 'Ada' }],
    bindings: [
      { nodeId: 't', prop: 'label', stateKey: 'name' },
      { nodeId: 'missing', prop: 'label', stateKey: 'name' },
      { nodeId: 'b', prop: 'label', stateKey: 'nope' },
    ],
  };
  const issues = logic.getBindingIssues(doc(), appLogic);
  assert.ok(issues.some((i) => i.nodeId === 'missing' && i.kind === 'orphan-node'));
  assert.ok(issues.some((i) => i.nodeId === 'b' && i.kind === 'unknown-state'));
  assert.equal(logic.getBindingIssues(doc(), logic.defaultAppLogic()).length, 0);
});

test('preview resolution never evals: state defaults plus overrides win', () => {
  const appLogic = {
    ...logic.defaultAppLogic(),
    state: [
      { key: 'name', type: 'string', default: 'Ada' },
      { key: 'count', type: 'number', default: 2 },
    ],
    bindings: [{ nodeId: 't', prop: 'label', stateKey: 'name' }],
  };
  const values = logic.resolvePreviewValues(appLogic, { count: 9 });
  assert.equal(values.name, 'Ada');
  assert.equal(values.count, 9);
  assert.equal(logic.resolveNodeProp(doc().root.children[0], appLogic, values), 'Ada');
  assert.equal(logic.resolveNodeProp(doc().root.children[1], appLogic, values), 'Go');
});

test('project snapshot round-trips logic files and tolerates missing logic', async () => {
  const store = new storage.MemoryProjectStorage();
  const snap = {
    manifest: project.defaultManifest('Logic app'),
    views: { [project.PROJECT_MAIN_VIEW]: doc('Logic app') },
    rawViews: {},
    extraFiles: {},
    logic: { ...logic.defaultAppLogic(), state: [{ key: 'name', type: 'string', default: 'Ada' }] },
  };
  const revisions = await project.saveProjectToStorage(store, snap, {});
  assert.ok(revisions[project.PROJECT_LOGIC_PATH]);
  const opened = await project.openProjectFromStorage(store);
  assert.deepEqual(opened.snapshot.logic, snap.logic);

  const legacy = new storage.MemoryProjectStorage({
    [project.PROJECT_MANIFEST_FILENAME]: JSON.stringify(project.defaultManifest('Old')),
    [project.PROJECT_MAIN_VIEW]: lib.serializeLayoutDocument(doc('Old')),
  });
  const openedLegacy = await project.openProjectFromStorage(legacy);
  assert.deepEqual(openedLegacy.snapshot.logic, logic.defaultAppLogic());
});

test('agent tools inspect and edit through the same validators', async () => {
  const snap = {
    manifest: project.defaultManifest('Agent app'),
    views: { [project.PROJECT_MAIN_VIEW]: doc('Agent app') },
    rawViews: {},
    extraFiles: {},
    logic: logic.defaultAppLogic(),
  };
  const files = agent.listProjectFiles(snap);
  assert.ok(files.includes(project.PROJECT_MANIFEST_FILENAME));
  assert.ok(files.includes(project.PROJECT_MAIN_VIEW));
  assert.ok(files.includes(project.PROJECT_LOGIC_PATH));
  const report = agent.validateProjectDocuments(snap);
  assert.equal(report.errors.length, 0);

  const next = agent.applyAgentEdit(snap, { kind: 'add-state', key: 'name', valueType: 'string', defaultValue: 'Ada' });
  assert.equal(next.logic.state.length, 1);
  assert.throws(() => agent.applyAgentEdit(snap, { kind: 'add-state', key: '!!', valueType: 'string', defaultValue: '' }), /key/);
  assert.throws(() => agent.applyAgentEdit(snap, { kind: 'add-binding', nodeId: 'ghost', prop: 'label', stateKey: 'name' }), /Unknown node/);
});

test('bindings on saved module definitions are recognized', () => {
  const document = doc();
  document.modules = [{ id: 'module', name: 'Reusable', root: { id: 'module-root', kind: 'stack', label: 'Module', props: {}, children: [{ id: 'module-text', kind: 'text', label: 'Text', props: {}, children: [] }] } }];
  const appLogic = { ...logic.defaultAppLogic(), state: [{ key: 'name', type: 'string', default: 'Ada' }], bindings: [{ nodeId: 'module-text', prop: 'label', stateKey: 'name' }] };
  assert.deepEqual(logic.getBindingIssues(document, appLogic), []);
});
