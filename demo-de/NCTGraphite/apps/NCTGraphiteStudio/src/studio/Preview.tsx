import { NCTGraphiteAccordion, NCTGraphiteButton, NCTGraphiteCheckbox, NCTGraphiteColumns, NCTGraphiteDualRange, NCTGraphiteFader, NCTGraphiteField, NCTGraphiteGrid, NCTGraphiteImageWell, NCTGraphiteKnob, NCTGraphiteLayoutItem, NCTGraphiteList, NCTGraphiteMeter, NCTGraphiteOverlay, NCTGraphitePanel, NCTGraphiteProgress, NCTGraphiteScene, NCTGraphiteSceneItem, NCTGraphiteSegmented, NCTGraphiteSeparator, NCTGraphiteSlider, NCTGraphiteStack, NCTGraphiteTabs, NCTGraphiteTextArea, NCTGraphiteToggle, NCTGraphiteToolbar, NCTGraphiteValueDisplay, NCTGraphiteWindow } from '@nct/nctgraphite';
import { parseNCTOptionList, resolveNodeProp, type AppLogic, type PreviewValues } from '@nct/nctgraphite';
import { containers, labels } from '../model';
import type { Node, SavedModule } from '../model';
import { GRID_DEFAULT_COLUMNS } from './constants';

export function Preview({ node, modules, selected, select, logic, values, onValue, onCommand, widePreview = false, seen = new Set<string>(), dropId = null, onNodeDragStart = null }: { node: Node; modules: SavedModule[]; selected: string; select: (id: string) => void; logic?: AppLogic; values?: PreviewValues; onValue?: (key: string, value: string | number | boolean) => void; onCommand?: (id: string) => void; widePreview?: boolean; seen?: Set<string>; dropId?: string | null; onNodeDragStart?: ((id: string, e: React.DragEvent) => void) | null }) {
  const children = node.children.map(child => <Preview key={child.id} node={child} modules={modules} selected={selected} select={select} logic={logic} values={values} onValue={onValue} onCommand={onCommand} widePreview={widePreview} seen={seen} dropId={dropId} onNodeDragStart={onNodeDragStart} />);
  const wide = widePreview ? node.wide ?? {} : {};
  const valueBinding = logic?.bindings.find(b => b.nodeId === node.id && b.prop === 'value' && b.stateKey);
  const boundValue = valueBinding?.stateKey && values ? values[valueBinding.stateKey] : undefined;
  const changeBoundValue = (value: string | number | boolean) => {
    if (valueBinding?.stateKey) onValue?.(valueBinding.stateKey, value);
  };
  const command = logic?.bindings.find(b => b.nodeId === node.id && b.commandId)?.commandId;
  const hidden = node.props.hidden === true;
  const locked = node.props.locked === true;
  if (hidden && logic) return <></>;
  let content;
  switch (node.kind) {
    case 'stack': case 'row': content = <NCTGraphiteStack direction={node.kind === 'row' ? 'row' : 'column'} gap="var(--nct-content-gap)" {...node.props}>{children}</NCTGraphiteStack>; break;
    case 'grid': content = <NCTGraphiteGrid gap="var(--nct-content-gap)" {...node.props} columns={(wide.columns as string) ?? (node.props.columns as string) ?? GRID_DEFAULT_COLUMNS}>{children}</NCTGraphiteGrid>; break;
    case 'overlay': content = <NCTGraphiteOverlay {...node.props}>{children}</NCTGraphiteOverlay>; break;
    case 'accordion': content = <NCTGraphiteAccordion title={node.label} defaultOpen {...node.props}>{children}</NCTGraphiteAccordion>; break;
    case 'columns': content = <NCTGraphiteColumns {...node.props}>{children}</NCTGraphiteColumns>; break;
    case 'scene': content = <NCTGraphiteScene {...node.props}>{children}</NCTGraphiteScene>; break;
    case 'sceneItem': {
      const wideGeo: Record<string, string | number> = {};
      if (widePreview) {
        const len = (v: unknown) => typeof v === 'string' || typeof v === 'number' ? v : undefined;
        for (const k of ['left', 'top', 'right', 'bottom', 'width', 'height'] as const) {
          const v = len(node.wide?.[k]);
          if (v !== undefined) wideGeo[k] = v;
        }
        if (typeof node.wide?.zIndex === 'number') wideGeo.zIndex = node.wide.zIndex;
      }
      content = <NCTGraphiteSceneItem {...node.props} {...wideGeo}>{children}</NCTGraphiteSceneItem>; break;
    }
    case 'layoutItem': content = <NCTGraphiteLayoutItem {...node.props}>{children}</NCTGraphiteLayoutItem>; break;
    case 'text': content = <span className="preview-text">{logic && values ? String(resolveNodeProp(node, logic, values)) : node.label}</span>; break;
    case 'button': content = <NCTGraphiteButton label={logic && values ? String(resolveNodeProp(node, logic, values)) : node.label} {...node.props} onClick={command ? () => onCommand?.(command) : undefined} />; break;
    case 'field': content = <NCTGraphiteField {...node.props} label={logic && values ? String(resolveNodeProp(node, logic, values)) : node.label} {...(typeof boundValue === 'string' ? { value: boundValue } : {})} onChange={changeBoundValue} />; break;
    case 'textArea': content = <NCTGraphiteTextArea {...node.props} label={logic && values ? String(resolveNodeProp(node, logic, values)) : node.label} {...(typeof boundValue === 'string' ? { value: boundValue } : {})} onChange={changeBoundValue} />; break;
    case 'checkbox': content = <NCTGraphiteCheckbox {...node.props} label={logic && values ? String(resolveNodeProp(node, logic, values)) : node.label} {...(typeof boundValue === 'boolean' ? { checked: boundValue } : {})} onChange={changeBoundValue} />; break;
    case 'tabs': {
      const options = parseNCTOptionList(node.props.options) ?? [{ value: 'one', label: 'One' }];
      content = <NCTGraphiteTabs {...node.props} options={options} {...(typeof boundValue === 'string' ? { value: boundValue } : {})} onChange={changeBoundValue} />; break;
    }
    case 'list': {
      const options = parseNCTOptionList(node.props.options) ?? [{ value: 'one', label: 'One' }];
      content = <NCTGraphiteList {...node.props} options={options} {...(typeof boundValue === 'string' ? { value: boundValue } : {})} onChange={changeBoundValue} />; break;
    }
    case 'imageWell': content = <NCTGraphiteImageWell {...node.props} label={node.label} onBrowse={() => {}} />; break;
    case 'separator': content = <NCTGraphiteSeparator {...node.props} />; break;
    case 'progress': content = <NCTGraphiteProgress {...node.props} value={Number(boundValue ?? node.props.value ?? 0)} max={Number(node.props.max ?? 100)} />; break;
    case 'knob': content = <NCTGraphiteKnob {...node.props} label={node.label} value={Number(boundValue ?? node.props.value ?? 50)} min={Number(node.props.min ?? 0)} max={Number(node.props.max ?? 100)} onChange={changeBoundValue} />; break;
    case 'fader': content = <NCTGraphiteFader {...node.props} label={node.label} value={Number(boundValue ?? node.props.value ?? 50)} min={Number(node.props.min ?? 0)} max={Number(node.props.max ?? 100)} onChange={changeBoundValue} />; break;
    case 'dualRange': content = <NCTGraphiteDualRange {...node.props} label={node.label} min={Number(node.props.min ?? 0)} max={Number(node.props.max ?? 100)} onChange={() => {}} />; break;
    case 'meter': content = <NCTGraphiteMeter {...node.props} label={node.label} value={Number(boundValue ?? node.props.value ?? 0)} min={Number(node.props.min ?? 0)} max={Number(node.props.max ?? 100)} />; break;
    case 'valueDisplay': {
      const bound = logic && values ? logic.bindings.find(b => b.nodeId === node.id && b.prop === 'value' && b.stateKey) : undefined;
      const boundValue = bound?.stateKey && values ? values[bound.stateKey] : undefined;
      content = <NCTGraphiteValueDisplay {...node.props} label={node.label} value={(boundValue as string | number) ?? (node.props.value as string | number) ?? ''} />; break;
    }
    case 'slider': content = <NCTGraphiteSlider {...node.props} label={node.label} value={Number(typeof boundValue === 'number' ? boundValue : node.props.value ?? 50)} min={Number(node.props.min ?? 0)} max={Number(node.props.max ?? 100)} step={Number(node.props.step ?? 1)} onChange={changeBoundValue} />; break;
    case 'toggle': {
      const checkedBinding = logic?.bindings.find(b => b.nodeId === node.id && b.prop === 'checked' && b.stateKey);
      const checkedValue = checkedBinding?.stateKey && values ? values[checkedBinding.stateKey] : undefined;
      content = <NCTGraphiteToggle {...node.props} label={node.label} checked={typeof checkedValue === 'boolean' ? checkedValue : Boolean(node.props.checked ?? false)} onChange={(v) => { if (checkedBinding?.stateKey) onValue?.(checkedBinding.stateKey, v); else changeBoundValue(v); }} />; break;
    }
    case 'segmented': {
      const options = parseNCTOptionList(node.props.options) ?? [{ value: 'one', label: 'One' }];
      content = <NCTGraphiteSegmented {...node.props} label={node.label} options={options} value={typeof boundValue === 'string' ? boundValue : String(node.props.value ?? options[0].value)} onChange={changeBoundValue} />; break;
    }
    case 'panel': content = <NCTGraphitePanel title={node.label} {...node.props}>{children}</NCTGraphitePanel>; break;
    case 'toolbar': content = <NCTGraphiteToolbar {...node.props}>{children}</NCTGraphiteToolbar>; break;
    case 'window': content = <NCTGraphiteWindow title={node.label} {...node.props}>{children}</NCTGraphiteWindow>; break;
    case 'iconButton': content = <NCTGraphiteButton label={logic && values ? String(resolveNodeProp(node, logic, values)) : node.label} {...node.props} variant="ghost" onClick={command ? () => onCommand?.(command) : undefined} />; break;
    case 'module': {
      const def = modules.find(m => m.id === node.moduleId);
      content = def && !seen.has(def.id)
        ? <Preview node={def.root} modules={modules} selected={selected} select={select} logic={logic} values={values} onValue={onValue} onCommand={onCommand} widePreview={widePreview} seen={new Set(seen).add(def.id)} dropId={dropId} onNodeDragStart={onNodeDragStart} />
        : <span className="preview-text">{node.label}</span>;
      break;
    }
  }
  const movable = onNodeDragStart != null && selected === node.id && !locked && !logic;
  const previewing = logic !== undefined;
  return <div className={`preview-node ${selected === node.id && !previewing ? 'is-selected' : ''}${hidden && !previewing ? ' is-hidden' : ''}${locked ? ' is-locked' : ''}${dropId === node.id ? ' drop-target' : ''}`} data-node-id={node.id} data-kind={node.kind} {...(containers.includes(node.kind) ? { 'data-container': 'true' } : {})} draggable={movable} onDragStart={movable && onNodeDragStart ? e => onNodeDragStart(node.id, e) : undefined} style={hidden && !previewing ? { opacity: 0.45 } : undefined} onClick={previewing ? undefined : e => { e.stopPropagation(); if (!locked) select(node.id); }}><span className="node-tag">{locked ? 'locked · ' : ''}{hidden ? 'hidden · ' : ''}{dropId === node.id ? 'drop here · ' : ''}{labels[node.kind]}</span>{content}</div>;
}
