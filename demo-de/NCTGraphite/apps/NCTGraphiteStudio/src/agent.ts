/** AI-agent tool surface: inspect and modify Studio app documents.
 * Every mutation routes through the same validators as the UI (`project.ts`
 * snapshot assembly and `NCTGraphiteAppLogic` validation), so agent edits
 * cannot silently produce an invalid project.
 */
import {
  defaultAppLogic,
  findLayoutNode,
  getBindingIssues,
  migrateAppLogic,
  validateAppLogic,
  validLayoutDocument,
  type AppLogic,
  type LayoutDocument,
} from '@nct/nctgraphite';
import {
  openProjectSnapshot,
  snapshotToFiles,
  validateProjectManifest,
  type ProjectSnapshot,
} from './project';

export interface AgentValidationReport {
  errors: string[];
  bindingIssues: ReturnType<typeof getBindingIssues>;
}

export function listProjectFiles(snapshot: ProjectSnapshot): string[] {
  return Object.keys(snapshotToFiles(snapshot)).sort();
}

export function readProjectFile(snapshot: ProjectSnapshot, path: string): string {
  const files = snapshotToFiles(snapshot);
  const content = files[path];
  if (content === undefined) throw new Error(`Unknown project file: ${path}`);
  return content;
}

export function validateProjectDocuments(snapshot: ProjectSnapshot): AgentValidationReport {
  const errors: string[] = [];
  errors.push(...validateProjectManifest(snapshot.manifest).map((e) => `manifest: ${e}`));
  for (const [path, doc] of Object.entries(snapshot.views)) {
    if (!validLayoutDocument(doc)) errors.push(`view ${path} is invalid`);
  }
  errors.push(...validateAppLogic(snapshot.logic ?? defaultAppLogic()).map((e) => `logic: ${e}`));
  let bindingIssues: AgentValidationReport['bindingIssues'] = [];
  try {
    const entry = snapshot.views[snapshot.manifest.entry];
    if (entry) bindingIssues = getBindingIssues(entry, snapshot.logic ?? defaultAppLogic());
  } catch {
    bindingIssues = [];
  }
  return { errors, bindingIssues };
}

export type AgentEdit =
  | { kind: 'add-state'; key: string; valueType: 'string' | 'number' | 'boolean'; defaultValue: string | number | boolean; description?: string }
  | { kind: 'remove-state'; key: string }
  | { kind: 'add-command'; id: string; label: string; defaultKey: string }
  | { kind: 'remove-command'; id: string }
  | { kind: 'add-binding'; nodeId: string; prop: string; stateKey?: string; commandId?: string }
  | { kind: 'remove-binding'; nodeId: string; prop: string }
  | { kind: 'update-state-value'; key: string; defaultValue: string | number | boolean };

function keyError(kind: string, value: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return `${kind} ${JSON.stringify(value)} must match /^[A-Za-z][A-Za-z0-9_]*$/`;
  return null;
}

/** Apply one validated agent edit; throws on invalid input or unknown targets. */
export function applyAgentEdit(snapshot: ProjectSnapshot, edit: AgentEdit): ProjectSnapshot {
  const logic: AppLogic = structuredClone(snapshot.logic ?? defaultAppLogic());
  const entry: LayoutDocument | undefined = snapshot.views[snapshot.manifest.entry];
  switch (edit.kind) {
    case 'add-state': {
      const bad = keyError('state key', edit.key);
      if (bad) throw new Error(bad);
      if (logic.state.some((s) => s.key === edit.key)) throw new Error(`State key ${JSON.stringify(edit.key)} already exists`);
      logic.state.push({ key: edit.key, type: edit.valueType, default: edit.defaultValue, ...(edit.description ? { description: edit.description } : {}) });
      break;
    }
    case 'remove-state': {
      logic.state = logic.state.filter((s) => s.key !== edit.key);
      logic.bindings = logic.bindings.filter((b) => b.stateKey !== edit.key);
      break;
    }
    case 'add-command': {
      const bad = keyError('command id', edit.id);
      if (bad) throw new Error(bad);
      if (logic.commands.some((c) => c.id === edit.id)) throw new Error(`Command ${JSON.stringify(edit.id)} already exists`);
      if (!edit.label) throw new Error('Command label must be non-empty');
      if (!edit.defaultKey) throw new Error('Command defaultKey must be non-empty');
      logic.commands.push({ id: edit.id, label: edit.label, defaultKey: edit.defaultKey });
      break;
    }
    case 'remove-command': {
      logic.commands = logic.commands.filter((c) => c.id !== edit.id);
      logic.bindings = logic.bindings.filter((b) => b.commandId !== edit.id);
      break;
    }
    case 'add-binding': {
      if (!entry || !findLayoutNode(entry.root, edit.nodeId)) throw new Error(`Unknown node ${JSON.stringify(edit.nodeId)}`);
      if (!edit.prop) throw new Error('Binding prop must be non-empty');
      if ((edit.stateKey ? 1 : 0) + (edit.commandId ? 1 : 0) !== 1) {
        throw new Error('Binding needs exactly one of stateKey or commandId');
      }
      if (edit.stateKey && !logic.state.some((s) => s.key === edit.stateKey)) {
        throw new Error(`Unknown state key ${JSON.stringify(edit.stateKey)}`);
      }
      if (edit.commandId && !logic.commands.some((c) => c.id === edit.commandId)) {
        throw new Error(`Unknown command ${JSON.stringify(edit.commandId)}`);
      }
      const slot = logic.bindings.findIndex((b) => b.nodeId === edit.nodeId && b.prop === edit.prop);
      const record = { nodeId: edit.nodeId, prop: edit.prop, ...(edit.stateKey ? { stateKey: edit.stateKey } : { commandId: edit.commandId! }) };
      if (slot >= 0) logic.bindings[slot] = record;
      else logic.bindings.push(record);
      break;
    }
    case 'remove-binding': {
      logic.bindings = logic.bindings.filter((b) => !(b.nodeId === edit.nodeId && b.prop === edit.prop));
      break;
    }
    case 'update-state-value': {
      const def = logic.state.find((s) => s.key === edit.key);
      if (!def) throw new Error(`Unknown state key ${JSON.stringify(edit.key)}`);
      def.default = edit.defaultValue;
      break;
    }
  }
  const errors = validateAppLogic(logic);
  if (errors.length > 0) throw new Error(`Agent edit produced invalid logic: ${errors.join('; ')}`);
  const next: ProjectSnapshot = { ...snapshot, logic };
  // Round-trip through the file assembly so agent edits meet the same bar as UI edits.
  return openProjectSnapshot(snapshotToFiles(next));
}

/** Tool-call manifest consumed by agents and docs (JSON-serializable). */
export function agentToolManifest(): { name: string; description: string }[] {
  return [
    { name: 'listProjectFiles', description: 'List every file in the project snapshot.' },
    { name: 'readProjectFile', description: 'Read one project file by path.' },
    { name: 'validateProjectDocuments', description: 'Validate manifest, views, logic, and bindings.' },
    { name: 'applyAgentEdit', description: 'Apply one validated logic/binding edit (add/remove state, commands, bindings).' },
  ];
}

export { migrateAppLogic };
