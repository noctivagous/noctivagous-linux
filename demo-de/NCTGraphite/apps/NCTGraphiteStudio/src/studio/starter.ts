import { APP_LOGIC_FORMAT, APP_LOGIC_VERSION, type AppLogic } from '@nct/nctgraphite';
import type { Node, Project } from '../model';

function item(id: string, label: string, left: number, top: number, width: number, height: number, child: Node): Node {
  return { id, kind: 'sceneItem', label, props: { left, top, width, height }, children: [child] };
}

function key(id: string, label: string, left: number, top: number, width = 64, height = 56): Node {
  return item(`${id}-item`, `${label} key`, left, top, width, height, { id, kind: 'button', label, props: {}, children: [] });
}

/** Starter project: a calculator composed as an absolute scene region.
 * Demonstrates free placement with snapped coordinates alongside the
 * bound stack/grid layouts. */
export function starterProject(): Project {
  const cols = [16, 88, 160, 232];
  const rows = [96, 160, 224, 288, 352];
  const keys: Node[] = [
    key('btn-c', 'C', cols[0], rows[0]),
    key('btn-neg', '±', cols[1], rows[0]),
    key('btn-pct', '%', cols[2], rows[0]),
    key('btn-div', '÷', cols[3], rows[0]),
    key('btn-7', '7', cols[0], rows[1]),
    key('btn-8', '8', cols[1], rows[1]),
    key('btn-9', '9', cols[2], rows[1]),
    key('btn-mul', '×', cols[3], rows[1]),
    key('btn-4', '4', cols[0], rows[2]),
    key('btn-5', '5', cols[1], rows[2]),
    key('btn-6', '6', cols[2], rows[2]),
    key('btn-sub', '−', cols[3], rows[2]),
    key('btn-1', '1', cols[0], rows[3]),
    key('btn-2', '2', cols[1], rows[3]),
    key('btn-3', '3', cols[2], rows[3]),
    key('btn-add', '+', cols[3], rows[3]),
    key('btn-0', '0', cols[0], rows[4], 136),
    key('btn-dot', '.', cols[2], rows[4]),
    key('btn-eq', '=', cols[3], rows[4]),
  ];
  return {
    name: 'Calculator',
    density: 'compact',
    theme: 'light',
    modules: [],
    root: {
      id: 'calc',
      kind: 'scene',
      label: 'Calculator',
      props: { width: 320, height: 440 },
      children: [
        item('display-item', 'Display item', 16, 16, 288, 64, {
          id: 'display', kind: 'valueDisplay', label: 'Display', props: { value: '0' }, children: [],
        }),
        ...keys,
      ],
    },
  };
}

/** Button id → command id for the starter calculator keys. */
const KEY_COMMANDS: Record<string, string> = {
  'btn-c': 'clear', 'btn-neg': 'neg', 'btn-pct': 'pct', 'btn-div': 'div',
  'btn-7': 'digit7', 'btn-8': 'digit8', 'btn-9': 'digit9', 'btn-mul': 'mul',
  'btn-4': 'digit4', 'btn-5': 'digit5', 'btn-6': 'digit6', 'btn-sub': 'sub',
  'btn-1': 'digit1', 'btn-2': 'digit2', 'btn-3': 'digit3', 'btn-add': 'add',
  'btn-0': 'digit0', 'btn-dot': 'dot', 'btn-eq': 'eq',
};

/** Starter logic: display state bound to the readout, every key bound to a command. */
export function starterLogic(): AppLogic {
  return {
    format: APP_LOGIC_FORMAT,
    version: APP_LOGIC_VERSION,
    state: [{ key: 'display', type: 'string', default: '0' }],
    commands: [
      { id: 'clear', label: 'Clear', defaultKey: 'Escape' },
      { id: 'neg', label: 'Negate', defaultKey: '_' },
      { id: 'pct', label: 'Percent', defaultKey: '%' },
      { id: 'dot', label: 'Decimal point', defaultKey: '.' },
      { id: 'eq', label: 'Equals', defaultKey: 'Enter' },
      { id: 'add', label: 'Add', defaultKey: '+' },
      { id: 'sub', label: 'Subtract', defaultKey: '-' },
      { id: 'mul', label: 'Multiply', defaultKey: '*' },
      { id: 'div', label: 'Divide', defaultKey: '/' },
      ...'0123456789'.split('').map(d => ({ id: `digit${d}`, label: `Digit ${d}`, defaultKey: d })),
    ],
    bindings: [
      { nodeId: 'display', prop: 'value', stateKey: 'display' },
      ...Object.entries(KEY_COMMANDS).map(([nodeId, commandId]) => ({ nodeId, prop: 'label', commandId })),
    ],
  };
}

export interface CalcState { display: string; acc: number | null; op: string | null; fresh: boolean; }

export const calcInitial = (display = '0'): CalcState => ({ display, acc: null, op: null, fresh: true });

function calcFormat(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  return String(parseFloat(n.toPrecision(12)));
}

function calcApply(acc: number, op: string, current: number): number {
  switch (op) {
    case 'add': return acc + current;
    case 'sub': return acc - current;
    case 'mul': return acc * current;
    case 'div': return current === 0 ? NaN : acc / current;
    default: return current;
  }
}

/** Pure reducer: preview command ids drive the starter calculator. Unknown ids are ignored. */
export function calcStep(s: CalcState, id: string): CalcState {
  const num = parseFloat(s.display);
  if (id === 'clear') return calcInitial();
  if (id === 'neg') return Number.isFinite(num) ? { ...s, display: calcFormat(-num) } : s;
  if (id === 'pct') return Number.isFinite(num) ? { ...s, display: calcFormat(num / 100) } : s;
  if (/^digit[0-9]$/.test(id)) {
    const d = id.slice(5);
    const base = s.fresh || s.display === '0' || s.display === 'Error' ? '' : s.display;
    return { ...s, display: (base + d).slice(0, 12) || '0', fresh: false };
  }
  if (id === 'dot') {
    if (s.fresh || s.display === 'Error') return { ...s, display: '0.', fresh: false };
    return s.display.includes('.') ? s : { ...s, display: `${s.display}.`, fresh: false };
  }
  if (id === 'add' || id === 'sub' || id === 'mul' || id === 'div') {
    if (s.acc !== null && s.op !== null && !s.fresh && Number.isFinite(num)) {
      const chained = calcApply(s.acc, s.op, num);
      return { display: calcFormat(chained), acc: chained, op: id, fresh: true };
    }
    return { ...s, acc: Number.isFinite(num) ? num : 0, op: id, fresh: true };
  }
  if (id === 'eq') {
    if (s.acc === null || s.op === null || !Number.isFinite(num)) return { ...s, fresh: true };
    return { display: calcFormat(calcApply(s.acc, s.op, num)), acc: null, op: null, fresh: true };
  }
  return s;
}
