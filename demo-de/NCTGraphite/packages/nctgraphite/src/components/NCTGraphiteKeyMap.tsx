import type { NCTGraphiteComponentMeta } from './NCTGraphiteMeta.js';
import type { NCTGraphiteCommandDef } from '../bindings/NCTGraphiteCommands.js';

export const NCTGraphiteKeyMapMeta: NCTGraphiteComponentMeta = {
  tag: 'NCTGraphiteKeyMap',
  category: 'widgets',
  description: 'Rebindable key-click map rows: kbd chip, label, desc, rebind button',
  props: {
    commands: { type: 'array', required: true, description: '{id, label, desc, defaultKey}[] command definitions' },
    keyMap: { type: 'object', required: true, description: 'action id → current key, from useNCTGraphiteCommands' },
    rebinding: { type: 'string', required: false, description: 'id currently capturing a replacement key, or null' },
    onRebind: { type: 'function', required: true, description: '(id | null) => void to arm/cancel rebinding' },
    heldActions: { type: 'object', required: false, description: 'held action ids, from useNCTGraphiteCommands; held rows highlight' },
    emphasizeIds: { type: 'object', required: false, description: 'action ids whose chips carry the accent treatment persistently' },
    showRebind: { type: 'boolean', required: false, description: 'When true, show per-row REBIND buttons (default false)' },
  },
  emits: [],
  dependencies: ['useNCTGraphiteCommands'],
};

export interface NCTGraphiteKeyMapProps {
  commands: NCTGraphiteCommandDef[];
  keyMap: Record<string, string>;
  rebinding?: string | null;
  onRebind?: (id: string | null) => void;
  heldActions?: Set<string>;
  emphasizeIds?: Set<string>;
  /** Per-row REBIND controls (off by default in talk/demo labs). */
  showRebind?: boolean;
}

/**
 * Key-click map rows (Dot Shading / Hull lab idiom): card row, kbd chip, label/desc, rebind.
 * Held rows highlight violet while their key is down.
 */
export function NCTGraphiteKeyMap({
  commands,
  keyMap,
  rebinding = null,
  onRebind,
  heldActions,
  emphasizeIds,
  showRebind = false,
}: NCTGraphiteKeyMapProps) {
  const held = heldActions ?? new Set<string>();
  const emphasized = emphasizeIds ?? new Set<string>();
  return (
    <div className="space-y-2">
      {commands.map((c) => {
        const active = held.has(c.id);
        const isRebinding = showRebind && rebinding === c.id;
        const keyDisplay = (keyMap[c.id] ?? c.defaultKey).toUpperCase();
        const chipAccent = !active && emphasized.has(c.id);
        return (
          <div
            key={c.id}
            className={`group flex items-center gap-2.5 rounded-[12px] border px-2.5 py-2.5 transition ${
              active
                ? 'bg-[#7c5cff] border-[#7c5cff] text-white shadow-[0_0_0_3px_rgba(124,92,255,0.25)]'
                : isRebinding
                  ? 'bg-[#1a1a24] border-[#00e5ff]'
                  : 'bg-[#1a1a24] border-white/10 hover:border-white/20'
            }`}
          >
            <div
              className={`h-8 min-w-[40px] shrink-0 grid place-items-center rounded-[8px] text-[12px] font-bold border [font-family:var(--font-alt-mono)] ${
                active
                  ? 'bg-white text-[#0e0e14] border-white'
                  : chipAccent
                    ? 'bg-[#7c5cff] border-[#7c5cff] text-white'
                    : 'bg-[#0e0e14] border-white/15 text-white'
              }`}
            >
              {keyDisplay}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold tracking-wide leading-none truncate [font-family:var(--font-alt-mono)]">
                {c.label.toUpperCase()}
              </div>
              <div className="text-[10px] opacity-60 truncate [font-family:var(--font-alt-mono)]">{c.desc}</div>
            </div>
            {showRebind && onRebind && (
              <button
                type="button"
                onClick={() => onRebind(isRebinding ? null : c.id)}
                className={`shrink-0 text-[9px] tracking-[0.08em] px-2 py-1.5 rounded-[8px] border font-bold transition [font-family:var(--font-alt-mono)] ${
                  isRebinding
                    ? 'bg-[#00e5ff] text-black border-[#00e5ff]'
                    : active
                      ? 'bg-white/15 border-white/30 text-white hover:bg-white/25'
                      : 'bg-[#0e0e14] border-white/15 text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                {isRebinding ? 'KEY…' : 'REBIND'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
