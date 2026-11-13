import { useCallback, useEffect, useRef, useState } from 'react';
import type { NCTGraphiteComponentMeta } from '../components/NCTGraphiteMeta.js';
import { isTextEntryTarget } from './NCTGraphiteStageFocus.js';

export const NCTGraphiteCommandsMeta: NCTGraphiteComponentMeta = {
  tag: 'useNCTGraphiteCommands',
  category: 'bindings',
  description: 'Named command registry with keyboard shortcuts, held-state tracking, and rebinding',
  props: {
    commands: { type: 'array', required: true, description: '{id, label, desc, defaultKey, aliases?}[] command definitions' },
    onAction: { type: 'function', required: false, description: '(id, event?) => void for discrete command invocations' },
    onKeyUp: { type: 'function', required: false, description: '(key) => void on every key release' },
    onRebind: { type: 'function', required: false, description: '(id, key) => void after a shortcut is rebound' },
    ignoreInputs: { type: 'boolean', default: false, description: 'Skip shortcuts while typing in inputs' },
    enabled: { type: 'boolean', default: true, description: 'Enable keyboard handling for this command scope' },
    preventDefaultKeys: { type: 'array', required: false, description: 'Keys to preventDefault when they trigger a command' },
  },
  emits: ['action'],
  dependencies: [],
};

export interface NCTGraphiteCommandDef {
  id: string;
  label: string;
  desc: string;
  defaultKey: string;
  aliases?: string[];
}

export interface NCTGraphiteCommandsOptions {
  commands: NCTGraphiteCommandDef[];
  onAction?: (id: string, e?: KeyboardEvent) => void;
  onKeyUp?: (key: string) => void;
  onRebind?: (id: string, key: string) => void;
  ignoreInputs?: boolean;
  enabled?: boolean;
  preventDefaultKeys?: string[];
}

export interface NCTGraphiteCommands {
  keyMap: Record<string, string>;
  heldActions: Set<string>;
  rebinding: string | null;
  beginRebind: (id: string | null) => void;
  invoke: (id: string, e?: KeyboardEvent) => void;
}

/**
 * Named command registry with keyboard shortcuts and rebinding.
 * Owns the keymap, the held-action set (for hold-to-paint idioms), and the
 * rebinding flow; hosts render their own key rows and indicators from it.
 * Key-to-action resolution runs through a ref mirror so window listeners
 * never close over stale state. Discrete invocations fan out to onAction.
 */
export function useNCTGraphiteCommands({ commands, onAction, onKeyUp, onRebind, ignoreInputs = false, enabled = true, preventDefaultKeys = [] }: NCTGraphiteCommandsOptions): NCTGraphiteCommands {
  const [keyMap, setKeyMap] = useState<Record<string, string>>(() =>
    Object.fromEntries(commands.map((c) => [c.id, c.defaultKey]))
  );
  const [heldActions, setHeldActions] = useState<Set<string>>(new Set());
  const [rebinding, setRebinding] = useState<string | null>(null);

  const keyMapRef = useRef(keyMap);
  useEffect(() => {
    keyMapRef.current = keyMap;
  }, [keyMap]);
  const heldRef = useRef<Set<string>>(new Set());
  const onActionRef = useRef(onAction);
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);
  const onRebindRef = useRef(onRebind);
  useEffect(() => {
    onRebindRef.current = onRebind;
  }, [onRebind]);
  const onKeyUpRef = useRef(onKeyUp);
  useEffect(() => {
    onKeyUpRef.current = onKeyUp;
  }, [onKeyUp]);
  const keyListRef = useRef(commands);
  useEffect(() => {
    keyListRef.current = commands;
  }, [commands]);
  const preventDefaultKeysRef = useRef(preventDefaultKeys);
  useEffect(() => {
    preventDefaultKeysRef.current = preventDefaultKeys;
  }, [preventDefaultKeys]);
  const rebindingRef = useRef(rebinding);
  useEffect(() => {
    rebindingRef.current = rebinding;
  }, [rebinding]);

  const invoke = useCallback((id: string, e?: KeyboardEvent) => {
    onActionRef.current?.(id, e);
  }, []);

  const beginRebind = useCallback((id: string | null) => {
    setRebinding(id);
  }, []);

  useEffect(() => {
    const clearHeld = () => {
      if (heldRef.current.size) {
        heldRef.current.clear();
        setHeldActions(new Set());
      }
    };
    if (!enabled) {
      clearHeld();
      setRebinding(null);
      return;
    }
    const match = (key: string): string[] => {
      const found: string[] = [];
      for (const [action, mapped] of Object.entries(keyMapRef.current)) {
        if (mapped !== key) {
          const def = keyListRef.current.find((c) => c.id === action);
          if (!def || !(def.aliases ?? []).includes(key)) continue;
        }
        found.push(action);
      }
      return found;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (ignoreInputs && isTextEntryTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (rebindingRef.current) {
        e.preventDefault();
        const action = rebindingRef.current;
        setKeyMap((prev) => ({ ...prev, [action]: key }));
        setRebinding(null);
        onRebindRef.current?.(action, key);
        return;
      }
      const acts = match(key);
      if (acts.length > 0 && preventDefaultKeysRef.current.includes(key)) e.preventDefault();
      for (const act of acts) {
        if (!heldRef.current.has(act)) {
          heldRef.current.add(act);
          setHeldActions(new Set(heldRef.current));
        }
        invoke(act, e);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      onKeyUpRef.current?.(key);
      let changed = false;
      for (const act of match(key)) {
        if (heldRef.current.delete(act)) changed = true;
      }
      if (changed) setHeldActions(new Set(heldRef.current));
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearHeld);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearHeld);
    };
  }, [invoke, enabled, ignoreInputs]);

  return { keyMap, heldActions, rebinding, beginRebind, invoke };
}
