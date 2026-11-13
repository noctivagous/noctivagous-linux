/** Safe app-logic model for Studio-built apps: state, bindings, commands.
 * No expression evaluation: bindings reference declared state keys or named
 * commands, and preview resolution is a pure record lookup. `new Function`
 * and attribute-language eval are intentionally unsupported.
 */
import type { LayoutDocument, LayoutNode } from '../xml/NCTGraphiteLayoutDocument.js';
import { findLayoutNode } from '../xml/NCTGraphiteLayoutDocument.js';

export const APP_LOGIC_FORMAT = 'nctgraphite-app-logic';
export const APP_LOGIC_VERSION = 1;

export type AppStateType = 'string' | 'number' | 'boolean';

export interface AppStateDef {
  key: string;
  type: AppStateType;
  default: string | number | boolean;
  description?: string;
}

export interface AppCommandDef {
  id: string;
  label: string;
  defaultKey: string;
}

export interface AppBinding {
  nodeId: string;
  prop: string;
  stateKey?: string;
  commandId?: string;
}

export interface AppLogic {
  format: typeof APP_LOGIC_FORMAT;
  version: number;
  state: AppStateDef[];
  commands: AppCommandDef[];
  bindings: AppBinding[];
}

export interface BindingIssue {
  kind: 'orphan-node' | 'unknown-state' | 'unknown-command' | 'empty-binding';
  nodeId: string;
  prop: string;
  message: string;
}

export function defaultAppLogic(): AppLogic {
  return { format: APP_LOGIC_FORMAT, version: APP_LOGIC_VERSION, state: [], commands: [], bindings: [] };
}

const KEY_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function defaultMatchesType(type: AppStateType, value: unknown): boolean {
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === 'boolean';
}

/** Validate an app-logic value. Returns error messages; empty means valid. */
export function validateAppLogic(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ['logic must be an object'];
  if (value.format !== APP_LOGIC_FORMAT) errors.push(`format must be ${JSON.stringify(APP_LOGIC_FORMAT)}`);
  if (value.version !== APP_LOGIC_VERSION) {
    errors.push(
      value.version === 0
        ? 'logic version 0 must be migrated before use'
        : `version must be ${APP_LOGIC_VERSION}`,
    );
  }
  if (!Array.isArray(value.state)) errors.push('state must be an array');
  if (!Array.isArray(value.commands)) errors.push('commands must be an array');
  if (!Array.isArray(value.bindings)) errors.push('bindings must be an array');
  if (errors.length > 0) return errors;

  const seenKeys = new Set<string>();
  for (const entry of value.state as unknown[]) {
    if (!isRecord(entry) || typeof entry.key !== 'string' || !KEY_RE.test(entry.key)) {
      errors.push(`state key must match ${KEY_RE.source}`);
      continue;
    }
    if (seenKeys.has(entry.key)) errors.push(`duplicate state key ${JSON.stringify(entry.key)}`);
    seenKeys.add(entry.key);
    if (entry.type !== 'string' && entry.type !== 'number' && entry.type !== 'boolean') {
      errors.push(`state ${JSON.stringify(entry.key)} has unknown type`);
    } else if (!defaultMatchesType(entry.type, entry.default)) {
      errors.push(`state ${JSON.stringify(entry.key)} default does not match type ${JSON.stringify(entry.type)}`);
    }
  }
  const seenCommands = new Set<string>();
  for (const entry of value.commands as unknown[]) {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !KEY_RE.test(entry.id)) {
      errors.push('command id must be a valid key');
      continue;
    }
    if (seenCommands.has(entry.id)) errors.push(`duplicate command id ${JSON.stringify(entry.id)}`);
    seenCommands.add(entry.id);
    if (typeof entry.label !== 'string' || !entry.label) errors.push(`command ${JSON.stringify(entry.id)} needs a label`);
    if (typeof entry.defaultKey !== 'string' || !entry.defaultKey) {
      errors.push(`command ${JSON.stringify(entry.id)} needs a defaultKey`);
    }
  }
  const seenBindings = new Set<string>();
  for (const entry of value.bindings as unknown[]) {
    if (!isRecord(entry) || typeof entry.nodeId !== 'string' || !entry.nodeId || typeof entry.prop !== 'string' || !entry.prop) {
      errors.push('binding needs nodeId and prop');
      continue;
    }
    const slot = `${entry.nodeId}::${entry.prop}`;
    if (seenBindings.has(slot)) errors.push(`duplicate binding for ${slot}`);
    seenBindings.add(slot);
    const hasState = typeof entry.stateKey === 'string' && entry.stateKey.length > 0;
    const hasCommand = typeof entry.commandId === 'string' && entry.commandId.length > 0;
    if (hasState === hasCommand) errors.push(`binding ${slot} needs exactly one of stateKey or commandId`);
  }
  return errors;
}

/** Migrate stored logic to the current version. Throws TypeError/RangeError. */
export function migrateAppLogic(data: unknown): AppLogic {
  if (!isRecord(data)) throw new TypeError('Invalid app logic: must be an object');
  if (data.format !== APP_LOGIC_FORMAT) throw new TypeError('Invalid app logic: unknown format');
  if (data.version === 0) {
    const migrated: AppLogic = {
      format: APP_LOGIC_FORMAT,
      version: APP_LOGIC_VERSION,
      state: Array.isArray(data.state) ? (data.state as AppLogic['state']) : [],
      commands: [],
      bindings: [],
    };
    const errors = validateAppLogic(migrated);
    if (errors.length > 0) throw new TypeError(`Invalid app logic: ${errors.join('; ')}`);
    return migrated;
  }
  if (data.version !== APP_LOGIC_VERSION) {
    if (typeof data.version === 'number' && data.version > APP_LOGIC_VERSION) {
      throw new RangeError(`Unsupported app-logic version ${data.version}`);
    }
    throw new TypeError('Invalid app logic: version must be 1');
  }
  const candidate: AppLogic = {
    format: APP_LOGIC_FORMAT,
    version: APP_LOGIC_VERSION,
    state: Array.isArray(data.state) ? (data.state as AppLogic['state']) : [],
    commands: Array.isArray(data.commands) ? (data.commands as AppLogic['commands']) : [],
    bindings: Array.isArray(data.bindings) ? (data.bindings as AppLogic['bindings']) : [],
  };
  const errors = validateAppLogic(candidate);
  if (errors.length > 0) throw new TypeError(`Invalid app logic: ${errors.join('; ')}`);
  return candidate;
}

/** Parse logic file text without throwing for missing files (caller decides). */
export function parseAppLogicFile(text: string): AppLogic {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid app logic: not valid JSON');
  }
  return migrateAppLogic(data);
}

export function serializeAppLogic(logicValue: AppLogic): string {
  return `${JSON.stringify(logicValue, null, 2)}\n`;
}

/** Cross-check bindings against a layout document and declared keys. */
export function getBindingIssues(doc: LayoutDocument, logicValue: AppLogic): BindingIssue[] {
  const issues: BindingIssue[] = [];
  const states = new Set(logicValue.state.map((s) => s.key));
  const commands = new Set(logicValue.commands.map((c) => c.id));
  for (const binding of logicValue.bindings) {
    if (!binding.stateKey && !binding.commandId) {
      issues.push({ kind: 'empty-binding', nodeId: binding.nodeId, prop: binding.prop, message: `${binding.nodeId}.${binding.prop} has neither stateKey nor commandId` });
      continue;
    }
    if (!findLayoutNode(doc.root, binding.nodeId) && !doc.modules.some(module => findLayoutNode(module.root, binding.nodeId))) {
      issues.push({ kind: 'orphan-node', nodeId: binding.nodeId, prop: binding.prop, message: `Node ${binding.nodeId} no longer exists` });
      continue;
    }
    if (binding.stateKey && !states.has(binding.stateKey)) {
      issues.push({ kind: 'unknown-state', nodeId: binding.nodeId, prop: binding.prop, message: `Unknown state key ${JSON.stringify(binding.stateKey)}` });
    }
    if (binding.commandId && !commands.has(binding.commandId)) {
      issues.push({ kind: 'unknown-command', nodeId: binding.nodeId, prop: binding.prop, message: `Unknown command ${JSON.stringify(binding.commandId)}` });
    }
  }
  return issues;
}

export type PreviewValues = Record<string, string | number | boolean>;

/** Merge declared defaults with caller overrides; unknown keys are dropped. */
export function resolvePreviewValues(logicValue: AppLogic, overrides: PreviewValues = {}): PreviewValues {
  const values: PreviewValues = {};
  for (const def of logicValue.state) values[def.key] = def.default;
  for (const [key, value] of Object.entries(overrides)) {
    const def = logicValue.state.find((s) => s.key === key);
    if (def && defaultMatchesType(def.type, value)) values[key] = value;
  }
  return values;
}

/** Resolve one node's display prop through state bindings (pure lookup). */
export function resolveNodeProp(node: LayoutNode, logicValue: AppLogic, values: PreviewValues): string | number | boolean {
  const binding = logicValue.bindings.find((b) => b.nodeId === node.id && b.prop === 'label' && b.stateKey);
  if (!binding?.stateKey) {
    const fallback = node.props.label ?? node.label;
    return typeof fallback === 'string' || typeof fallback === 'number' || typeof fallback === 'boolean' ? fallback : node.label;
  }
  const value = values[binding.stateKey];
  return value === undefined ? node.label : value;
}
