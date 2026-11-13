import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const project = await server.ssrLoadModule('./src/project.ts');
const storage = await server.ssrLoadModule('./src/storage.ts');
const lib = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');

const doc = (name = 'Test app') => ({
  name,
  density: 'compact',
  theme: 'light',
  modules: [],
  root: {
    id: 'root', kind: 'stack', label: 'App', props: {},
    children: [{ id: 't', kind: 'text', label: 'Hi', props: {}, children: [] }],
  },
});

const snapshot = (name = 'Test app') => ({
  manifest: project.defaultManifest(name),
  views: { [project.PROJECT_MAIN_VIEW]: doc(name) },
  rawViews: {},
  extraFiles: {},
  logic: lib.defaultAppLogic(),
});

test('manifest validation accepts v1 and names each problem', () => {
  assert.deepEqual(project.validateProjectManifest(project.defaultManifest('A')), []);
  assert.ok(project.validateProjectManifest({}).length > 0);
  assert.ok(project.validateProjectManifest({ ...project.defaultManifest('A'), views: ['other.xml'] }).some((e) => e.includes('entry')));
  assert.ok(project.validateProjectManifest({ ...project.defaultManifest('A'), version: '1' }).some((e) => e.includes('version')));
  assert.ok(project.validateProjectManifest({ ...project.defaultManifest('A'), format: 'nope' }).some((e) => e.includes('format')));
});

test('manifest migration upgrades v0, tolerates sparse v1, rejects newer', () => {
  const migrated = project.migrateProjectManifest({ format: 'nctgraphite-project', version: 0, name: 'Old', entry: 'views/main.nctgraphite.xml' });
  assert.equal(migrated.version, 1);
  assert.deepEqual(migrated.views, ['views/main.nctgraphite.xml']);
  assert.deepEqual(project.validateProjectManifest(migrated), []);

  const sparse = project.migrateProjectManifest({ format: 'nctgraphite-project', version: 1, name: 'S', entry: 'views/main.nctgraphite.xml' });
  assert.deepEqual(sparse.views, ['views/main.nctgraphite.xml']);

  assert.throws(() => project.migrateProjectManifest({ format: 'nctgraphite-project', version: 99, name: 'N', entry: 'views/main.nctgraphite.xml' }), RangeError);
  assert.throws(() => project.migrateProjectManifest({ format: 'nope' }), TypeError);
  assert.throws(() => project.migrateProjectManifest(null), TypeError);
});

test('project round-trips through storage byte-stably', async () => {
  const store = new storage.MemoryProjectStorage();
  const first = snapshot();
  const revisions = await project.saveProjectToStorage(store, first, {});
  assert.ok(revisions[project.PROJECT_MANIFEST_FILENAME]);
  assert.ok(revisions[project.PROJECT_MAIN_VIEW]);

  const opened = await project.openProjectFromStorage(store);
  assert.deepEqual(opened.snapshot.manifest, { ...first.manifest });
  assert.deepEqual(opened.snapshot.views, first.views);

  // Saving an unchanged project rewrites nothing.
  const before = await store.readFile(project.PROJECT_MAIN_VIEW);
  const again = await project.saveProjectToStorage(store, opened.snapshot, opened.revisions);
  const afterReSave = await store.readFile(project.PROJECT_MAIN_VIEW);
  assert.deepEqual(again, opened.revisions);
  assert.equal(afterReSave.content, before.content);
  assert.equal(afterReSave.revision, before.revision);
});

test('open validates the manifest and names missing files', async () => {
  const empty = new storage.MemoryProjectStorage();
  await assert.rejects(project.openProjectFromStorage(empty), /missing nctgraphite\.project\.json/);

  const badManifest = new storage.MemoryProjectStorage({ [project.PROJECT_MANIFEST_FILENAME]: '{nope' });
  await assert.rejects(project.openProjectFromStorage(badManifest), /not valid JSON/);

  const missingView = new storage.MemoryProjectStorage({
    [project.PROJECT_MANIFEST_FILENAME]: JSON.stringify(project.defaultManifest('M')),
  });
  await assert.rejects(project.openProjectFromStorage(missingView), /missing view/);
});

test('files Studio does not understand survive the round trip', async () => {
  const store = new storage.MemoryProjectStorage();
  const withExtras = { ...snapshot(), extraFiles: { 'logic/app.ts': 'export const x = 1;\n', 'README.md': '# Mine\n' } };
  await project.saveProjectToStorage(store, withExtras, {});
  const opened = await project.openProjectFromStorage(store);
  assert.deepEqual(opened.snapshot.extraFiles, withExtras.extraFiles);
  // Editing the layout leaves extras byte-identical.
  const edited = { ...opened.snapshot, views: { ...opened.snapshot.views, [project.PROJECT_MAIN_VIEW]: doc('Renamed') } };
  await project.saveProjectToStorage(store, edited, opened.revisions);
  assert.equal((await store.readFile('logic/app.ts')).content, 'export const x = 1;\n');
});

test('views Studio does not edit are validated but kept byte-identical', async () => {
  const store = new storage.MemoryProjectStorage();
  const otherPath = 'views/other.nctgraphite.xml';
  const manifest = { ...project.defaultManifest('Multi'), views: [project.PROJECT_MAIN_VIEW, otherPath] };
  // An exact byte string standing in for a view Studio did not produce.
  const rawOther = lib.serializeLayoutDocument(doc('Other'));
  const multi = { manifest, views: { [project.PROJECT_MAIN_VIEW]: doc('Multi') }, rawViews: { [otherPath]: rawOther }, extraFiles: {} };
  await project.saveProjectToStorage(store, multi, {});

  const opened = await project.openProjectFromStorage(store);
  assert.deepEqual(opened.snapshot.rawViews, { [otherPath]: rawOther });

  const edited = { ...opened.snapshot, views: { [project.PROJECT_MAIN_VIEW]: doc('Edited') } };
  await project.saveProjectToStorage(store, edited, opened.revisions);
  assert.equal((await store.readFile(otherPath)).content, rawOther);
});

test('external changes conflict instead of overwriting silently', async () => {
  const store = new storage.MemoryProjectStorage();
  const revisions = await project.saveProjectToStorage(store, snapshot(), {});
  store.tamper(project.PROJECT_MAIN_VIEW, '<NCTGraphiteLayout kind="nctgraphite-layout" version="1" name="X" density="compact"><Modules></Modules><Root><NCTGraphiteText id="r" label="X"/></Root></NCTGraphiteLayout>');

  const stale = { ...snapshot(), views: { [project.PROJECT_MAIN_VIEW]: doc('Mine') } };
  await assert.rejects(project.saveProjectToStorage(store, stale, revisions), (err) => {
    assert.equal(err.name, 'ProjectConflictError');
    assert.equal(err.path, project.PROJECT_MAIN_VIEW);
    return true;
  });
  // The external content is still intact after the rejected save.
  assert.match((await store.readFile(project.PROJECT_MAIN_VIEW)).content, /label="X"/);

  // Forced overwrite (post-review) succeeds and re-bases revisions.
  const rebased = await project.saveProjectToStorage(store, stale, revisions, { force: true });
  assert.notEqual(rebased[project.PROJECT_MAIN_VIEW], revisions[project.PROJECT_MAIN_VIEW]);
});

test('bundle export/import preserves the project', () => {
  const withExtras = { ...snapshot('Bundled'), extraFiles: { 'notes.txt': 'hi' } };
  const back = project.decodeProjectBundle(project.encodeProjectBundle(withExtras));
  assert.deepEqual(back, withExtras);
  assert.throws(() => project.decodeProjectBundle('{}'), /Invalid project bundle/);
  assert.throws(() => project.decodeProjectBundle(project.encodeProjectBundle(withExtras).replace('views/main', 'views/gone')), /missing view/);
});

test('recovery payloads validate before they restore', () => {
  const payload = project.decodeRecovery(project.encodeRecovery(snapshot('Crashed')));
  assert.equal(payload.kind, 'nctgraphite-studio-recovery');
  assert.equal(payload.snapshot.manifest.name, 'Crashed');
  assert.throws(() => project.decodeRecovery('{}'), /Invalid recovery data/);
  const corrupt = JSON.parse(project.encodeRecovery(snapshot()));
  corrupt.snapshot.views[project.PROJECT_MAIN_VIEW].density = 'huge';
  assert.throws(() => project.decodeRecovery(JSON.stringify(corrupt)), /corrupt entry view/);
});

test('fingerprint drives dirty state: edits change it, clean saves keep it', () => {
  const clean = project.snapshotFingerprint(snapshot());
  assert.equal(project.snapshotFingerprint(snapshot()), clean);
  const edited = snapshot();
  edited.views[project.PROJECT_MAIN_VIEW] = doc('Renamed');
  assert.notEqual(project.snapshotFingerprint(edited), clean);
});

test('binary and marker-prefixed text survive the storage and bundle representation', () => {
  const bytes = Uint8Array.from([0, 255, 128, 13, 10, 42]);
  const encoded = storage.encodeStoredBytes(bytes);
  assert.deepEqual(storage.decodeStoredBytes(encoded), bytes);
  const text = '\0NCTGraphite:file:base64:not-binary';
  assert.deepEqual(storage.decodeStoredBytes(storage.encodeStoredBytes(new TextEncoder().encode(text))), new TextEncoder().encode(text));
  const withAsset = { ...snapshot(), extraFiles: { 'assets/image.png': encoded } };
  const reopened = project.decodeProjectBundle(project.encodeProjectBundle(withAsset));
  assert.deepEqual(storage.decodeStoredBytes(reopened.extraFiles['assets/image.png']), bytes);
});

test('conflicts are checked before any project file is written', async () => {
  const store = new storage.MemoryProjectStorage();
  const revisions = await project.saveProjectToStorage(store, snapshot(), {});
  const originalManifest = await store.readFile(project.PROJECT_MANIFEST_FILENAME);
  store.tamper(project.PROJECT_MAIN_VIEW, 'external change');
  const changed = snapshot('Changed');
  await assert.rejects(project.saveProjectToStorage(store, changed, revisions), project.ProjectConflictError);
  assert.equal((await store.readFile(project.PROJECT_MANIFEST_FILENAME)).content, originalManifest.content);
  assert.equal((await store.readFile(project.PROJECT_MAIN_VIEW)).content, 'external change');
});

test('saving a copy does not overwrite an existing destination', async () => {
  const store = new storage.MemoryProjectStorage({ [project.PROJECT_MAIN_VIEW]: 'existing file' });
  await assert.rejects(project.saveProjectToStorage(store, snapshot(), {}), project.ProjectConflictError);
  assert.equal((await store.readFile(project.PROJECT_MAIN_VIEW)).content, 'existing file');
  await assert.rejects(store.readFile(project.PROJECT_MANIFEST_FILENAME));
});

test('overwriting one reviewed conflict does not overwrite another', async () => {
  const store = new storage.MemoryProjectStorage();
  const revisions = await project.saveProjectToStorage(store, snapshot(), {});
  store.tamper(project.PROJECT_MANIFEST_FILENAME, 'external manifest');
  store.tamper(project.PROJECT_MAIN_VIEW, 'external view');
  await assert.rejects(project.saveProjectToStorage(store, snapshot('Changed'), revisions, { forcePaths: [project.PROJECT_MANIFEST_FILENAME] }), err => err.path === project.PROJECT_MAIN_VIEW);
  assert.equal((await store.readFile(project.PROJECT_MANIFEST_FILENAME)).content, 'external manifest');
});

test('manifest and bundle reject unsafe paths and malformed data without rewriting', () => {
  const invalid = { ...project.defaultManifest('App'), entry: '../outside.xml', views: ['../outside.xml'] };
  assert.throws(() => project.migrateProjectManifest(invalid), /safe|paths/);
  assert.throws(() => project.migrateProjectManifest({ ...project.defaultManifest('App'), views: [project.PROJECT_MAIN_VIEW, 5] }), /views/);
  assert.throws(() => project.migrateProjectManifest({ ...project.defaultManifest('App'), dependencies: { react: 5 } }), /dependencies/);
  const bundle = JSON.parse(project.encodeProjectBundle(snapshot()));
  bundle.version = 2;
  assert.throws(() => project.decodeProjectBundle(JSON.stringify(bundle)), /Invalid project bundle/);
  bundle.version = 1;
  bundle.files['../outside.txt'] = 'bad';
  assert.throws(() => project.decodeProjectBundle(JSON.stringify(bundle)), /Invalid project path/);
});
