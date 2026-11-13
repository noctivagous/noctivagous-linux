/** Versioned Studio app-project model: manifest + file assembly.
 * Pure helpers live here (testable without React); `App.tsx` owns session
 * state and `storage.ts` owns the host. The layout trees themselves stay the
 * shared `LayoutDocument` model: each `views/*.nctgraphite.xml` file parses
 * and serializes with the XML codec in `@nct/nctgraphite`.
 */
import {
  defaultAppLogic,
  migrateAppLogic,
  parseAppLogicFile,
  serializeAppLogic,
  parseLayoutDocument,
  serializeLayoutDocument,
  validLayoutDocument,
  type AppLogic,
  type LayoutDocument,
} from '@nct/nctgraphite';
import type { StorageProvider } from './storage';

export const PROJECT_MANIFEST_FILENAME = 'nctgraphite.project.json';
export const PROJECT_FORMAT = 'nctgraphite-project';
/** Current manifest version. Manifest and layout-XML versions are independent. */
export const PROJECT_VERSION = 1;
export const PROJECT_MAIN_VIEW = 'views/main.nctgraphite.xml';
export const PROJECT_VIEW_EXTENSION = '.nctgraphite.xml';
export const PROJECT_LOGIC_PATH = 'logic/app.nctgraphite-logic.json';
export const PROJECT_BUNDLE_FORMAT = 'nctgraphite-project-bundle';
export const PROJECT_RECOVERY_KIND = 'nctgraphite-studio-recovery';

export interface ProjectManifest {
  format: typeof PROJECT_FORMAT;
  version: number;
  name: string;
  /** Path of the entry view, relative to the project root. */
  entry: string;
  /** All builder-managed view paths, entry first. */
  views: string[];
  themes: string[];
  dependencies: Record<string, string>;
}

export interface ProjectSnapshot {
  manifest: ProjectManifest;
  /** View path -> layout document. Holds the views Studio parses and edits. */
  views: Record<string, LayoutDocument>;
  /** View paths Studio does not edit, carried through byte-identical. */
  rawViews: Record<string, string>;
  /** Files Studio does not understand; carried through untouched. */
  extraFiles: Record<string, string>;
  /** Safe app-logic model (state, bindings, commands). Defaults when absent. */
  logic: AppLogic;
}

export class ProjectConflictError extends Error {
  readonly path: string;
  readonly currentRevision: string;
  constructor(path: string, currentRevision: string) {
    super(`External change detected in ${path}`);
    this.name = 'ProjectConflictError';
    this.path = path;
    this.currentRevision = currentRevision;
  }
}

export function defaultManifest(name: string): ProjectManifest {
  return {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name,
    entry: PROJECT_MAIN_VIEW,
    views: [PROJECT_MAIN_VIEW],
    themes: [],
    dependencies: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Paths are project-relative, with no traversal or platform-dependent separators. */
export function isSafeProjectPath(path: string): boolean {
  return path.length > 0 && !path.includes('\\') && !path.includes('\0') &&
    path.split('/').every(part => part !== '' && part !== '.' && part !== '..' && part !== '__proto__' && part !== 'constructor' && part !== 'prototype');
}

/** Validate a manifest value. Returns error messages; empty means valid. */
export function validateProjectManifest(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['manifest must be an object'];
  if (value.format !== PROJECT_FORMAT) errors.push(`format must be ${JSON.stringify(PROJECT_FORMAT)}`);
  if (typeof value.version !== 'number' || !Number.isInteger(value.version)) {
    errors.push('version must be an integer');
  }
  if (typeof value.name !== 'string' || !value.name) errors.push('name must be a non-empty string');
  if (typeof value.entry !== 'string' || !isSafeProjectPath(value.entry)) errors.push('entry must be a safe project-relative view path');
  if (!Array.isArray(value.views) || value.views.some((v) => typeof v !== 'string' || !isSafeProjectPath(v))) {
    errors.push('views must be an array of paths');
  } else if (typeof value.entry === 'string' && !value.views.includes(value.entry)) {
    errors.push('views must include the entry view');
  }
  if (value.themes !== undefined && (!Array.isArray(value.themes) || value.themes.some((t) => typeof t !== 'string' || !isSafeProjectPath(t))) ) {
    errors.push('themes must be an array of paths');
  }
  if (value.dependencies !== undefined) {
    if (!isRecord(value.dependencies) || Object.values(value.dependencies).some((v) => typeof v !== 'string')) {
      errors.push('dependencies must map names to version strings');
    }
  }
  return errors;
}

/** Migrate a stored manifest to the current version.
 * Throws RangeError for newer versions (never rewritten here) and
 * TypeError for malformed values.
 */
export function migrateProjectManifest(data: unknown): ProjectManifest {
  if (!isRecord(data)) throw new TypeError('Invalid project manifest: must be an object');
  if (data.format !== PROJECT_FORMAT) throw new TypeError('Invalid project manifest: unknown format');
  const version = data.version;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    throw new TypeError('Invalid project manifest: version must be an integer');
  }
  if (version < 0) throw new TypeError(`Invalid project version ${version}`);
  if (version > PROJECT_VERSION) {
    throw new RangeError(`Unsupported project version ${version} (newest supported is ${PROJECT_VERSION})`);
  }
  if (typeof data.name !== 'string' || !data.name) throw new TypeError('Invalid project manifest: missing name');
  if (typeof data.entry !== 'string' || !data.entry) throw new TypeError('Invalid project manifest: missing entry');
  // v0 had no views/themes/dependencies lists; v1 reads also tolerate them missing.
  for (const key of ['views', 'themes'] as const) {
    const value = data[key];
    if (value !== undefined && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) {
      throw new TypeError(`Invalid project manifest: ${key} must be an array of paths`);
    }
  }
  if (data.dependencies !== undefined && (!isRecord(data.dependencies) || Object.values(data.dependencies).some(value => typeof value !== 'string'))) {
    throw new TypeError('Invalid project manifest: dependencies must map names to version strings');
  }
  const views = Array.isArray(data.views)
    ? data.views.filter((v): v is string => typeof v === 'string')
    : [data.entry as string];
  if (!views.includes(data.entry as string)) views.unshift(data.entry as string);
  const dependencies: Record<string, string> = {};
  if (isRecord(data.dependencies)) {
    for (const [key, value] of Object.entries(data.dependencies)) {
      if (typeof value === 'string') dependencies[key] = value;
    }
  }
  const manifest: ProjectManifest = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: data.name,
    entry: data.entry as string,
    views,
    themes: Array.isArray(data.themes) ? data.themes.filter((t): t is string => typeof t === 'string') : [],
    dependencies,
  };
  const errors = validateProjectManifest(manifest);
  if (errors.length > 0) throw new TypeError(`Invalid project manifest: ${errors.join('; ')}`);
  return manifest;
}

/** Assemble stored file contents into a validated snapshot. */
export function openProjectSnapshot(files: Record<string, string>): ProjectSnapshot {
  for (const path of Object.keys(files)) if (!isSafeProjectPath(path)) throw new Error(`Invalid project path: ${path}`);
  const raw = files[PROJECT_MANIFEST_FILENAME];
  if (raw === undefined) throw new Error(`Not a Studio project: missing ${PROJECT_MANIFEST_FILENAME}`);
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid project manifest: not valid JSON`);
  }
  const manifest = migrateProjectManifest(data);
  const entryText = files[manifest.entry];
  if (entryText === undefined) throw new Error(`Project is missing view ${manifest.entry}`);
  let entry: LayoutDocument;
  try {
    entry = parseLayoutDocument(entryText);
  } catch (err) {
    throw new Error(`Invalid view ${manifest.entry}: ${(err as Error).message}`);
  }
  // Studio edits the entry view. Other listed views are validated but kept
  // byte-identical so an edit never reformats files it did not touch.
  const rawViews: Record<string, string> = {};
  for (const path of manifest.views) {
    if (path === manifest.entry) continue;
    const text = files[path];
    if (text === undefined) throw new Error(`Project is missing view ${path}`);
    try {
      parseLayoutDocument(text);
    } catch (err) {
      throw new Error(`Invalid view ${path}: ${(err as Error).message}`);
    }
    rawViews[path] = text;
  }
  const extraFiles: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (path !== PROJECT_MANIFEST_FILENAME && path !== PROJECT_LOGIC_PATH && !manifest.views.includes(path)) {
      extraFiles[path] = content;
    }
  }
  let logic = defaultAppLogic();
  if (files[PROJECT_LOGIC_PATH] !== undefined) {
    try {
      logic = parseAppLogicFile(files[PROJECT_LOGIC_PATH]);
    } catch (err) {
      throw new Error(`Invalid app logic ${PROJECT_LOGIC_PATH}: ${(err as Error).message}`);
    }
  }
  return { manifest, views: { [manifest.entry]: entry }, rawViews, extraFiles, logic };
}

/** Flatten a snapshot to file contents. Key order is fixed so output is stable. */
export function snapshotToFiles(snapshot: ProjectSnapshot): Record<string, string> {
  const { manifest } = snapshot;
  const orderedManifest: ProjectManifest = {
    format: manifest.format,
    version: manifest.version,
    name: manifest.name,
    entry: manifest.entry,
    views: [...manifest.views],
    themes: [...manifest.themes],
    dependencies: Object.fromEntries(Object.entries(manifest.dependencies).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  const files: Record<string, string> = {
    [PROJECT_MANIFEST_FILENAME]: `${JSON.stringify(orderedManifest, null, 2)}\n`,
  };
  for (const path of [...manifest.views].sort()) {
    if (path !== manifest.entry && snapshot.rawViews[path] !== undefined) {
      files[path] = snapshot.rawViews[path];
      continue;
    }
    const doc = snapshot.views[path];
    if (!doc) throw new Error(`Project is missing view ${path}`);
    files[path] = serializeLayoutDocument(doc);
  }
  files[PROJECT_LOGIC_PATH] = serializeAppLogic(snapshot.logic ?? defaultAppLogic());
  for (const path of Object.keys(snapshot.extraFiles ?? {}).sort()) files[path] = snapshot.extraFiles[path];
  return files;
}

/** Stable fingerprint of everything that would be written. Drives dirty state. */
export function snapshotFingerprint(snapshot: ProjectSnapshot): string {
  return JSON.stringify(snapshotToFiles(snapshot));
}

export interface OpenedProject {
  snapshot: ProjectSnapshot;
  revisions: Record<string, string>;
}

export async function openProjectFromStorage(storage: StorageProvider): Promise<OpenedProject> {
  const paths = await storage.listFiles();
  const files: Record<string, string> = {};
  const revisions: Record<string, string> = {};
  for (const path of paths) {
    const file = await storage.readFile(path);
    files[path] = file.content;
    revisions[path] = file.revision;
  }
  return { snapshot: openProjectSnapshot(files), revisions };
}

/** Write changed files only. Unchanged content is never rewritten, so a
 * clean save is byte-stable. Throws ProjectConflictError (from the storage)
 * when a file changed on disk since `revisions` were recorded; pass
 * `force: true` to overwrite after the user reviews the conflict.
 */
export async function saveProjectToStorage(
  storage: StorageProvider,
  snapshot: ProjectSnapshot,
  revisions: Record<string, string>,
  options: { force?: boolean; forcePaths?: readonly string[] } = {},
): Promise<Record<string, string>> {
  const files = snapshotToFiles(snapshot);
  const next: Record<string, string> = { ...revisions };
  const pending: Array<{ path: string; content: string; expected: string | null }> = [];
  // Check every destination before writing any file so an ordinary conflict
  // does not leave a partially saved project.
  for (const [path, content] of Object.entries(files)) {
    let current: { content: string; revision: string } | null = null;
    try { current = await storage.readFile(path); } catch { current = null; }
    if (current && current.content === content) {
      next[path] = current.revision;
      continue;
    }
    const expected = options.force || options.forcePaths?.includes(path) ? null : (revisions[path] ?? '');
    if (expected !== null && (current?.revision ?? '') !== expected) {
      throw new ProjectConflictError(path, current?.revision ?? '');
    }
    pending.push({ path, content, expected });
  }
  for (const { path, content, expected } of pending) {
    next[path] = await storage.writeFile(path, content, expected);
  }
  return next;
}

/** Single-file export/import fallback for hosts without folder access. */
export function encodeProjectBundle(snapshot: ProjectSnapshot): string {
  return JSON.stringify({ format: PROJECT_BUNDLE_FORMAT, version: 1, files: snapshotToFiles(snapshot) }, null, 2);
}

export function decodeProjectBundle(text: string): ProjectSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid project bundle: not valid JSON');
  }
  if (!isRecord(data) || data.format !== PROJECT_BUNDLE_FORMAT || data.version !== 1 || !isRecord(data.files)) {
    throw new Error('Invalid project bundle');
  }
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(data.files)) {
    if (typeof content !== 'string') throw new Error(`Invalid project bundle: ${path} is not text`);
    files[path] = content;
  }
  return openProjectSnapshot(files);
}

export interface RecoveryPayload {
  kind: typeof PROJECT_RECOVERY_KIND;
  version: 1;
  savedAt: string;
  snapshot: ProjectSnapshot;
}

export function encodeRecovery(snapshot: ProjectSnapshot): string {
  const payload: RecoveryPayload = {
    kind: PROJECT_RECOVERY_KIND,
    version: 1,
    savedAt: new Date().toISOString(),
    snapshot,
  };
  return JSON.stringify(payload);
}

export function decodeRecovery(text: string): RecoveryPayload {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid recovery data');
  }
  if (!isRecord(data) || data.kind !== PROJECT_RECOVERY_KIND || data.version !== 1 || !isRecord(data.snapshot)) {
    throw new Error('Invalid recovery data');
  }
  const raw = data.snapshot as Record<string, unknown>;
  const manifest = migrateProjectManifest(raw.manifest);
  if (!isRecord(raw.views)) throw new Error('Invalid recovery data: missing views');
  if (!validLayoutDocument(raw.views[manifest.entry])) throw new Error('Invalid recovery data: corrupt entry view');
  for (const doc of Object.values(raw.views)) {
    if (!validLayoutDocument(doc)) throw new Error('Invalid recovery data: corrupt view');
  }
  const rawViews: Record<string, string> = {};
  if (isRecord(raw.rawViews)) {
    for (const [key, value] of Object.entries(raw.rawViews)) {
      if (typeof value === 'string') rawViews[key] = value;
    }
  }
  const extraFiles: Record<string, string> = {};
  if (isRecord(raw.extraFiles)) {
    for (const [key, value] of Object.entries(raw.extraFiles)) {
      if (typeof value === 'string') extraFiles[key] = value;
    }
  }
  let logic = defaultAppLogic();
  if (raw.logic !== undefined) {
    try {
      logic = migrateAppLogic(raw.logic);
    } catch {
      throw new Error('Invalid recovery data: corrupt app logic');
    }
  }
  const snapshot: ProjectSnapshot = {
    manifest,
    views: raw.views as ProjectSnapshot['views'],
    rawViews,
    extraFiles,
    logic,
  };
  return { kind: PROJECT_RECOVERY_KIND, version: 1, savedAt: String(data.savedAt ?? ''), snapshot };
}
