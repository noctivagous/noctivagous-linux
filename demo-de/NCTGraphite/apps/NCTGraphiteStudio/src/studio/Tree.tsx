import { useState } from 'react';
import { containers, labels } from '../model';
import type { Node, SavedModule } from '../model';
import type { DropZone } from './nodes';

const LEAF_ICONS: Record<string, string> = {
  text: 'T', button: '▣', iconButton: '◉', field: '▭', textArea: '☰',
  checkbox: '☑', toggle: '◐', tabs: '▥', list: '☰', imageWell: '◩',
  separator: '—', progress: '▬', knob: '◎', fader: '↕', dualRange: '↔',
  meter: '▂', valueDisplay: '◔', slider: '◉', segmented: '⧉', module: '▢',
};

export function zoneFor(clientY: number, rect: { top: number; height: number }, isContainer: boolean): DropZone {
  const ratio = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return isContainer ? 'inside' : 'after';
}

export function Tree({ node, modules, selected, select, depth = 0, dragId, onDragStart, onDragEnd, onDrop }: {
  node: Node; modules: SavedModule[]; selected: string; select: (id: string) => void; depth?: number;
  dragId: string | null; onDragStart: (id: string) => void; onDragEnd: () => void;
  onDrop: (dragId: string, targetId: string, zone: DropZone) => void;
}) {
  const [indicator, setIndicator] = useState<DropZone | null>(null);
  const name = node.kind === 'module' ? modules.find(m => m.id === node.moduleId)?.name ?? node.label : node.label || labels[node.kind];
  const dims = node.kind === 'sceneItem' && (node.props.width !== undefined || node.props.height !== undefined)
    ? `${String(node.props.width ?? '?')}×${String(node.props.height ?? '?')}` : null;
  const flags = `${node.props.hidden === true ? ' hidden' : ''}${node.props.locked === true ? ' locked' : ''}${node.kind === 'sceneItem' && node.props.right !== undefined ? ' pinR' : ''}${node.kind === 'sceneItem' && node.props.bottom !== undefined ? ' pinB' : ''}`;
  const isContainer = containers.includes(node.kind);
  const dropClass = indicator ? ` drop-${indicator}` : '';
  return <>
    <button
      className={`tree-item${isContainer ? ' is-container' : ' is-leaf'}${selected === node.id ? 'selected' : ''}${dropClass}`}
      style={{ paddingLeft: 6 + depth * 10 }}
      onClick={() => select(node.id)}
      draggable
      onDragStart={e => {
        e.stopPropagation();
        e.dataTransfer.setData('application/x-nct-move', node.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(node.id);
      }}
      onDragEnd={e => { e.stopPropagation(); setIndicator(null); onDragEnd(); }}
      onDragOver={e => {
        if (!dragId || dragId === node.id) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const zone = zoneFor(e.clientY, e.currentTarget.getBoundingClientRect(), isContainer);
        setIndicator(z => (z === zone ? z : zone));
      }}
      onDragLeave={e => { e.stopPropagation(); setIndicator(null); }}
      onDrop={e => {
        e.preventDefault();
        e.stopPropagation();
        const zone = zoneFor(e.clientY, e.currentTarget.getBoundingClientRect(), isContainer);
        setIndicator(null);
        if (dragId) onDrop(dragId, node.id, zone);
      }}
    >{Array.from({ length: depth }).map((_, i) => <span key={i} className="tree-guide" aria-hidden="true" />)}<span className="tree-icon">{isContainer ? '▾' : (LEAF_ICONS[node.kind] ?? '·')}</span>{name}{node.children.length > 0 ? <span className="tree-count">{node.children.length}</span> : null}{dims ? <span className="tree-dims">{dims}</span> : null}{flags ? <span className="tree-flags">{flags.trim()}</span> : null}<span className="tree-kind">{node.kind}</span></button>
    {node.children.map(child => <Tree key={child.id} node={child} modules={modules} selected={selected} select={select} depth={depth + 1} dragId={dragId} onDragStart={onDragStart} onDragEnd={onDragEnd} onDrop={onDrop} />)}
  </>;
}
