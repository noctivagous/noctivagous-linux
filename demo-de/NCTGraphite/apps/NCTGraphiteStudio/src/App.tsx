import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { NCTGraphiteAccordion, NCTGraphiteLayoutItem, NCTGraphiteLayoutShell, NCTGraphiteMenu, NCTGraphiteMenuBar, NCTGraphiteMenuItem, NCTGraphitePanel, NCTGraphiteToolbar, NCTGraphiteWindow } from '@nct/nctgraphite';
import { buildLayoutCatalog, defaultAppLogic, editablePropsFor, getBindingIssues, parseLayoutDocument, resolvePreviewValues, serializeLayoutDocument, validateAppLogic, type AppBinding, type AppLogic, type PreviewValues } from '@nct/nctgraphite';
import { cloneWithIds, containers, dropCoords, duplicateNode, find, instantiateModule, labels, makeNode, moveNode, remove, removeModuleRefs, snapValue, update, validDocument, validModule, validNode, migrateLegacyStudioProject, wrapInSceneItem, type Kind, type Node, type Project, type SavedModule } from './model';
import { DEVICE_PRESETS, GRID_DEFAULT_COLUMNS, RECOVERY_STORAGE_KEY, STUDIO_UI_KEY, loadStudioUi } from './studio/constants';
import { CATEGORY_ICONS, DEVICE_ICONS, PALETTE_ICONS, SECTION_ICONS, coerceInput, defaultsFor, parentOf, reparentNode, type DropZone } from './studio/nodes';
import { Tree } from './studio/Tree';
import { Preview } from './studio/Preview';
import { SceneSelectionOverlay } from './studio/SceneSelectionOverlay';
import { calcInitial, calcStep, starterLogic, starterProject, type CalcState } from './studio/starter';
import {
  ProjectConflictError,
  decodeProjectBundle,
  decodeRecovery,
  defaultManifest,
  encodeProjectBundle,
  encodeRecovery,
  openProjectFromStorage,
  saveProjectToStorage,
  snapshotFingerprint,
  type OpenedProject,
  type ProjectManifest,
  type ProjectSnapshot,
  type RecoveryPayload,
} from './project';
import { FileSystemProjectStorage, canPickFolders, type StorageProvider } from './storage';

type PickerWindow = Window & { showDirectoryPicker?: (options?: { mode?: string }) => Promise<FileSystemDirectoryHandle> };

const initial: Project = starterProject();



export default function App() {
  const [project, setProject] = useState<Project>(initial);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const [selectedId, setSelected] = useState('display');
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [notice, setNotice] = useState('Ready');
  const [uiInit] = useState(loadStudioUi);
  const [sections, setSections] = useState<Record<string, boolean>>(uiInit.sections);
  const secOpen = (id: string, fallback: boolean) => sections[id] ?? fallback;
  const setSec = (id: string, v: boolean) => setSections(s => (s[id] === v ? s : { ...s, [id]: v }));
  const secIcon = (icon: string) => <span className="sec-icon" aria-hidden="true">{icon}</span>;
  const [previewWidth, setPreviewWidth] = useState<number | null>(uiInit.previewWidth);
  const [wsPos, setWsPos] = useState(uiInit.workspace);
  const [renderMode, setRenderMode] = useState(uiInit.renderMode);
  const RENDER_MODES = [{ id: 'app', label: 'App' }, { id: 'wireframe', label: 'Wire' }, { id: 'outline', label: 'Outline' }] as const;
  const [zoom, setZoom] = useState(uiInit.zoom);
  const [showExport, setShowExport] = useState(uiInit.showExport);
  const [aiOpen, setAiOpen] = useState(uiInit.aiOpen);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'AI assistance is a placeholder in this build. Describe the layout change you want.' },
  ]);
  const [aiInput, setAiInput] = useState('');
  function sendAi() {
    const text = aiInput.trim();
    if (!text) return;
    setAiMessages(m => [...m.slice(-49), { role: 'user', text }, { role: 'ai', text: `Placeholder reply — no AI backend is connected yet. You asked: “${text}”` }]);
    setAiInput('');
  }
  const [dropId, setDropId] = useState<string | null>(null);
  const [treeDragId, setTreeDragId] = useState<string | null>(null);
  function treeDrop(dragId: string, targetId: string, zone: DropZone) {
    setTreeDragId(null);
    const res = reparentNode(activeRoot, dragId, targetId, zone);
    if ('error' in res) { if (res.error) setNotice(res.error); return; }
    changeTree(() => res.root);
    setSelected(res.placedId);
    setNotice(res.note);
  }
  const [geomTarget, setGeomTarget] = useState<'base' | 'wide'>(uiInit.geomTarget);
  const [snapEnabled, setSnapEnabled] = useState(uiInit.snapEnabled);
  const [gridVisible, setGridVisible] = useState(uiInit.gridVisible);
  const [gridSize, setGridSize] = useState(uiInit.gridSize);
  const [scrollTick, setScrollTick] = useState(0);
  const snapVal = (v: number) => snapValue(v, snapEnabled, gridSize);
  const dragKind = useRef<Kind | null>(null);
  const moveDrag = useRef<string | null>(null);
  function containerFromPoint(target: EventTarget | null): { id: string; kind: Kind } | null {
    const el = (target as HTMLElement | null)?.closest?.('.preview-node[data-container="true"]') as HTMLElement | null;
    const id = el?.dataset.nodeId;
    const kind = el?.dataset.kind as Kind | undefined;
    if (!el || !id || !kind || !labels[kind]) return null;
    return { id, kind };
  }
  const wsDrag = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const panDrag = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  function trackPointer(move: (e: PointerEvent) => void) {
    const up = () => {
      wsDrag.current = null; panDrag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  /** Drag the app window around the workspace by its header (design mode only). */
  function onArtboardHeaderDown(e: React.PointerEvent) {
    if (previewMode || e.button !== 0) return;
    e.preventDefault();
    wsDrag.current = { startX: e.clientX, startY: e.clientY, origX: wsPos.x, origY: wsPos.y };
    trackPointer(ev => {
      const d = wsDrag.current; if (!d) return;
      const k = 100 / zoom;
      setWsPos({
        x: Math.min(2000, Math.max(-2000, Math.round(d.origX + (ev.clientX - d.startX) * k))),
        y: Math.min(2000, Math.max(-2000, Math.round(d.origY + (ev.clientY - d.startY) * k))),
      });
    });
  }
  /** Drag the workspace background to pan across the working space. */
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.artboard, .ai-chat, button, input, select, textarea, a')) return;
    const el = canvasRef.current; if (!el) return;
    panDrag.current = { startX: e.clientX, startY: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    trackPointer(ev => {
      const d = panDrag.current; if (!d || !canvasRef.current) return;
      canvasRef.current.scrollLeft = d.left - (ev.clientX - d.startX);
      canvasRef.current.scrollTop = d.top - (ev.clientY - d.startY);
    });
  }
  function onCanvasDragOver(e: React.DragEvent) {
    if (previewMode || (!dragKind.current && !moveDrag.current)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = moveDrag.current ? 'move' : 'copy';
    const hit = containerFromPoint(e.target);
    setDropId(cur => (cur === (hit?.id ?? null) ? cur : (hit?.id ?? null)));
  }
  function onCanvasDrop(e: React.DragEvent) {
    const kind = dragKind.current;
    const moveId = moveDrag.current;
    dragKind.current = null;
    moveDrag.current = null;
    setDropId(null);
    if (previewMode) return;
    if (moveId) { e.preventDefault(); reparentDrop(e, moveId); return; }
    if (!kind) return;
    e.preventDefault();
    const hit = containerFromPoint(e.target);
    if (!hit) { setNotice(`Drop ${labels[kind]} onto a container or scene`); return; }
    const target = find(activeRoot, hit.id);
    if (target?.props.locked === true) { setNotice(`${target.label || labels[hit.kind]} is locked`); return; }
    const widget = { ...makeNode(kind), props: defaultsFor(kind) };
    if (hit.kind === 'scene') {
      const sceneEl = artboard.current?.querySelector(`[data-node-id="${hit.id}"]`) as HTMLElement | null;
      const rect = sceneEl?.getBoundingClientRect();
      const pt = rect ? dropCoords(e.clientX, e.clientY, rect, zoom) : { x: 0, y: 0 };
      const x = snapVal(pt.x);
      const y = snapVal(pt.y);
      const item = wrapInSceneItem(widget, x, y);
      changeTree(root => update(root, hit.id, n => ({ ...n, children: [...n.children, item] })));
      setSelected(item.id);
      setNotice(`Dropped ${labels[kind]} into scene at ${x}, ${y}`);
      return;
    }
    changeTree(root => update(root, hit.id, n => ({ ...n, children: [...n.children, widget] })));
    setSelected(widget.id);
    setNotice(`Dropped ${labels[kind]} into ${target?.label || labels[hit.kind]}`);
  }
  function reparentDrop(e: React.DragEvent, moveId: string) {
    const hit = containerFromPoint(e.target);
    if (!hit) { setNotice('Drop onto a container or scene to reparent'); return; }
    let pos: { x: number; y: number } | undefined;
    if (hit.kind === 'scene') {
      const sceneEl = artboard.current?.querySelector(`[data-node-id="${hit.id}"]`) as HTMLElement | null;
      const sceneRect = sceneEl?.getBoundingClientRect();
      const pt = sceneRect ? dropCoords(e.clientX, e.clientY, sceneRect, zoom) : { x: 0, y: 0 };
      pos = { x: snapVal(pt.x), y: snapVal(pt.y) };
    }
    const res = reparentNode(activeRoot, moveId, hit.id, 'inside', pos);
    if ('error' in res) { if (res.error) setNotice(res.error); return; }
    changeTree(() => res.root);
    setSelected(res.placedId);
    setNotice(pos ? `${res.note} at ${pos.x}, ${pos.y}` : res.note);
  }
  const canvasRef = useRef<HTMLDivElement>(null);
  function fitZoom() {
    const canvas = canvasRef.current;
    const art = artboard.current;
    if (!canvas || !art) { setZoom(100); return; }
    const avail = canvas.clientWidth - 60;
    const cur = art.offsetWidth || avail;
    const trueW = cur;
    const target = previewWidth ?? trueW;
    if (!target || target <= 0) { setZoom(100); return; }
    const next = Math.max(25, Math.min(200, Math.round((avail / target) * 100)));
    setZoom(next);
    setNotice(`Zoom fit to ${next}%`);
  }
  const input = useRef<HTMLInputElement>(null);
  const artboard = useRef<HTMLDivElement>(null);
  const [artboardWidth, setArtboardWidth] = useState(0);
  useEffect(() => {
    const element = artboard.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => setArtboardWidth(entries[0].contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const [manifest, setManifest] = useState<ProjectManifest>(() => defaultManifest(initial.name));
  const [otherViews, setOtherViews] = useState<Record<string, string>>({});
  const [extraFiles, setExtraFiles] = useState<Record<string, string>>({});
  const [store, setStore] = useState<StorageProvider | null>(null);
  const [revisions, setRevisions] = useState<Record<string, string>>({});
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);
  const [conflictPath, setConflictPath] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryPayload | null>(null);
  const [logic, setLogic] = useState<AppLogic>(() => starterLogic());
  const [previewMode, setPreviewMode] = useState(false);
  const [previewOverrides, setPreviewOverrides] = useState<PreviewValues>({});
  const [commandLog, setCommandLog] = useState<string[]>([]);
  const [calc, setCalc] = useState<CalcState>(() => calcInitial());
  function fireCommand(id: string) {
    setCommandLog(l => [...l.slice(-19), id]);
    const next = calcStep(calc, id);
    if (next === calc) return;
    setCalc(next);
    if (next.display !== calc.display) setPreviewOverrides(o => ({ ...o, display: next.display }));
  }
  const [studioTheme, setStudioTheme] = useState<'graphite' | 'classic' | 'lab'>(uiInit.studioTheme);
  const [newStateKey, setNewStateKey] = useState('');
  const [newCommandId, setNewCommandId] = useState('');
  const [bindProp, setBindProp] = useState('label');
  const [bindTarget, setBindTarget] = useState('');
  const editingModule = editingModuleId ? project.modules.find(m => m.id === editingModuleId) ?? null : null;
  const activeRoot = editingModule?.root ?? project.root;
  const selected = find(activeRoot, selectedId) ?? activeRoot;
  const catalog = useMemo(buildLayoutCatalog, []);
  const fitSceneWidth = activeRoot.kind === 'scene' && typeof activeRoot.props.width === 'number' && Number.isFinite(activeRoot.props.width) && activeRoot.props.width > 0
    ? Math.round(activeRoot.props.width) + 50
    : null;
  const artboardMax = previewWidth ?? fitSceneWidth;

  const commit = (next: Project) => {
    setPast(p => [...p.slice(-49), structuredClone(project)]);
    setFuture([]);
    setProject(next);
  };
  const previewValues = useMemo(() => resolvePreviewValues(logic, previewOverrides), [logic, previewOverrides]);
  const bindingIssues = useMemo(() => getBindingIssues(project, logic), [project, logic]);
  const logicErrors = useMemo(() => validateAppLogic(logic), [logic]);
  const updateLogic = (next: AppLogic) => {
    const errors = validateAppLogic(next);
    if (errors.length > 0) { setNotice(`Logic invalid: ${errors[0]}`); return; }
    setLogic(next);
  };
  const currentSnapshot = (): ProjectSnapshot => ({
    manifest: { ...manifest, name: project.name },
    views: { [manifest.entry]: project },
    rawViews: otherViews,
    extraFiles,
    logic,
  });
  const dirty = savedFingerprint === null || snapshotFingerprint(currentSnapshot()) !== savedFingerprint;
  function clearRecovery() {
    try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* private mode */ }
    setRecovery(null);
  }
  function confirmDiscard(): boolean {
    if (!dirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }
  function applyOpened(opened: OpenedProject, nextStore: StorageProvider | null) {
    const entryDoc = opened.snapshot.views[opened.snapshot.manifest.entry];
    setProject(entryDoc);
    setManifest(opened.snapshot.manifest);
    setOtherViews(opened.snapshot.rawViews);
    setExtraFiles(opened.snapshot.extraFiles);
    setLogic(opened.snapshot.logic ?? defaultAppLogic());
    setPreviewOverrides({});
    setCommandLog([]);
    setRevisions(opened.revisions);
    setStore(nextStore);
    setSavedFingerprint(snapshotFingerprint(opened.snapshot));
    setPast([]);
    setFuture([]);
    setEditingModuleId(null);
    setSelected(entryDoc.root.id);
    setConflictPath(null);
  }
  function newProject() {
    if (!confirmDiscard()) return;
    const fresh = structuredClone(initial);
    setProject(fresh);
    setManifest(defaultManifest(fresh.name));
    setOtherViews({});
    setExtraFiles({});
    setLogic(starterLogic());
    setPreviewOverrides({});
    setCommandLog([]);
    setRevisions({});
    setStore(null);
    setSavedFingerprint(null);
    setPast([]);
    setFuture([]);
    setEditingModuleId(null);
    setSelected(fresh.root.id);
    clearRecovery();
    setNotice('New project — unsaved');
  }
  async function openFolder() {
    const picker = window as PickerWindow;
    if (!canPickFolders(picker) || !picker.showDirectoryPicker) { input.current?.click(); return; }
    if (!confirmDiscard()) return;
    try {
      const dir = await picker.showDirectoryPicker({ mode: 'readwrite' });
      const nextStore = new FileSystemProjectStorage(dir);
      const opened = await openProjectFromStorage(nextStore);
      applyOpened(opened, nextStore);
      clearRecovery();
      setNotice(`Opened ${opened.snapshot.manifest.name}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setNotice(`Could not open this project: ${(err as Error).message}`);
    }
  }
  function downloadBundle(snap: ProjectSnapshot) {
    const blob = new Blob([encodeProjectBundle(snap)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
    a.download = `${snap.manifest.name.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'project'}.nctgraphite-project.json`;
    a.click(); URL.revokeObjectURL(url);
  }
  async function save() {
    const snap = currentSnapshot();
    const fingerprint = snapshotFingerprint(snap);
    if (store?.canWriteDirectly) {
      try {
        const next = await saveProjectToStorage(store, snap, revisions);
        setRevisions(next);
        setSavedFingerprint(fingerprint);
        clearRecovery();
        setNotice('Project saved');
      } catch (err) {
        if (err instanceof ProjectConflictError) {
          setConflictPath(err.path);
          setNotice(`External change in ${err.path} — review before saving`);
        } else {
          setNotice(`Could not save: ${(err as Error).message}`);
        }
      }
      return;
    }
    downloadBundle(snap);
    setSavedFingerprint(fingerprint);
    clearRecovery();
    setNotice('Project exported — use Open with a folder picker to save directly');
  }
  async function saveAs() {
    const snap = currentSnapshot();
    const picker = window as PickerWindow;
    if (!canPickFolders(picker) || !picker.showDirectoryPicker) {
      downloadBundle(snap);
      setNotice('Project exported as a copy');
      return;
    }
    try {
      const dir = await picker.showDirectoryPicker({ mode: 'readwrite' });
      const nextStore = new FileSystemProjectStorage(dir);
      const next = await saveProjectToStorage(nextStore, snap, {});
      setStore(nextStore);
      setRevisions(next);
      setSavedFingerprint(snapshotFingerprint(snap));
      clearRecovery();
      setNotice(`Saved a copy in ${snap.manifest.name}`);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setNotice(err instanceof ProjectConflictError ? `Save As stopped: ${err.path} already exists in that folder` : `Could not save a copy: ${(err as Error).message}`);
    }
  }
  async function overwriteConflict() {
    if (!store || !conflictPath) return;
    try {
      const snap = currentSnapshot();
      const next = await saveProjectToStorage(store, snap, revisions, { forcePaths: [conflictPath] });
      setRevisions(next);
      setSavedFingerprint(snapshotFingerprint(snap));
      clearRecovery();
      setConflictPath(null);
      setNotice('Saved — external changes overwritten');
    } catch (err) {
      if (err instanceof ProjectConflictError) { setConflictPath(err.path); setNotice(`External change in ${err.path} — review before saving`); }
      else setNotice(`Could not save: ${(err as Error).message}`);
    }
  }
  async function reloadFromDisk() {
    if (!store) return;
    try {
      const opened = await openProjectFromStorage(store);
      applyOpened(opened, store);
      setNotice('Reloaded from disk — your edits were discarded');
    } catch (err) {
      setNotice(`Could not reload: ${(err as Error).message}`);
    }
  }
  function resumeRecovery() {
    if (!recovery) return;
    const snap = recovery.snapshot;
    const entryDoc = snap.views[snap.manifest.entry];
    if (!entryDoc) { setNotice('Recovery data is incomplete'); return; }
    setProject(entryDoc);
    setManifest(snap.manifest);
    setOtherViews(snap.rawViews);
    setExtraFiles(snap.extraFiles);
    setLogic(snap.logic ?? defaultAppLogic());
    setStore(null);
    setRevisions({});
    setPast([]);
    setFuture([]);
    setEditingModuleId(null);
    setSelected(entryDoc.root.id);
    setSavedFingerprint(null);
    setRecovery(null);
    setNotice('Recovered unsaved work — save to keep it');
  }
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
      if (!raw) return;
      setRecovery(decodeRecovery(raw));
    } catch {
      try { localStorage.removeItem(RECOVERY_STORAGE_KEY); } catch { /* private mode */ }
    }
  }, []);
  useEffect(() => {
    if (!dirty || recovery) return;
    const id = window.setTimeout(() => {
      try { localStorage.setItem(RECOVERY_STORAGE_KEY, encodeRecovery(currentSnapshot())); } catch { /* private mode */ }
    }, 800);
    return () => window.clearTimeout(id);
  });
  // No beforeunload warning: dirty work autosaves to recovery storage above,
  // so Vite HMR reloads during development must not nag. Resume restores it.
  useEffect(() => {
    try {
      localStorage.setItem(STUDIO_UI_KEY, JSON.stringify({
        sections, previewWidth, zoom, showExport, geomTarget,
        snapEnabled, gridVisible, gridSize, studioTheme, aiOpen, workspace: wsPos, renderMode,
      }));
    } catch { /* private mode */ }
  }, [sections, previewWidth, zoom, showExport, geomTarget, snapEnabled, gridVisible, gridSize, studioTheme, aiOpen, wsPos, renderMode]);
  const changeTree = (fn: (root: Node) => Node) => {
    const next: Project = editingModuleId
      ? { ...project, modules: project.modules.map(m => m.id === editingModuleId ? { ...m, root: fn(m.root) } : m) }
      : { ...project, root: fn(project.root) };
    commit(next);
  };
  function undo() {
    const prev = past[past.length - 1];
    if (!prev) { setNotice('Nothing to undo'); return; }
    setPast(p => p.slice(0, -1));
    setFuture(f => [...f, structuredClone(project)]);
    setProject(prev);
    setNotice('Undone');
  }
  function redo() {
    const next = future[future.length - 1];
    if (!next) { setNotice('Nothing to redo'); return; }
    setFuture(f => f.slice(0, -1));
    setPast(p => [...p.slice(-49), structuredClone(project)]);
    setProject(next);
    setNotice('Redone');
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      const mod = e.metaKey || e.ctrlKey;
      if (mod) {
        if (e.key.toLowerCase() === 's') { e.preventDefault(); if (e.shiftKey) void saveAs(); else void save(); return; }
        if (e.key.toLowerCase() === 'n') { e.preventDefault(); newProject(); return; }
        if (inField) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(z => Math.min(200, z + 25)); return; }
        if (e.key === '-') { e.preventDefault(); setZoom(z => Math.max(50, z - 25)); return; }
        if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        else if (e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelected(); }
        return;
      }
      if (inField) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveSelected(e.key === 'ArrowUp' ? -1 : 1); return; }
      if (e.key.startsWith('Arrow') && selected.kind === 'sceneItem' && selected.props.locked !== true) {
        const ae = document.activeElement;
        if (ae && ae !== document.body) return;
        e.preventDefault();
        const step = e.shiftKey ? 1 : gridSize;
        const id = selected.id;
        const key = e.key;
        changeTree(root => update(root, id, n => {
          const values = geomTarget === 'wide' ? { ...n.props, ...n.wide } : n.props;
          const left = typeof values.left === 'number' ? values.left : 0;
          const top = typeof values.top === 'number' ? values.top : 0;
          const props = geomTarget === 'wide' ? { ...n.wide } : { ...n.props };
          if (key === 'ArrowLeft') props.left = left - step;
          else if (key === 'ArrowRight') props.left = left + step;
          else if (key === 'ArrowUp') props.top = top - step;
          else props.top = top + step;
          return geomTarget === 'wide' ? { ...n, wide: props } : { ...n, props };
        }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function add(kind: Kind) {
    const parent = containers.includes(selected.kind) ? selected : activeRoot;
    const child = { ...makeNode(kind), props: defaultsFor(kind) };
    const placed = parent.kind === 'scene' && child.kind !== 'sceneItem' ? wrapInSceneItem(child, 0, 0) : child;
    changeTree(root => update(root, parent.id, n => ({ ...n, children: [...n.children, placed] })));
    setSelected(placed.id);
    setNotice(`Added ${labels[kind]} to ${parent.label}`);
  }
  function moveSelected(delta: -1 | 1) {
    if (selected.id === activeRoot.id) return;
    if (selected.props.locked === true) { setNotice(`${selected.label || labels[selected.kind]} is locked`); return; }
    const parent = parentOf(activeRoot, selected.id);
    if (!parent) return;
    const index = parent.children.findIndex(c => c.id === selected.id);
    changeTree(root => moveNode(root, selected.id, parent.id, index + delta));
    setNotice(`Moved ${selected.label || labels[selected.kind]} ${delta < 0 ? 'up' : 'down'}`);
  }
  function duplicateSelected() {
    if (selected.id === activeRoot.id) { setNotice('Cannot duplicate the root'); return; }
    if (selected.props.locked === true) { setNotice(`${selected.label || labels[selected.kind]} is locked`); return; }
    changeTree(root => duplicateNode(root, selected.id));
    setNotice(`Duplicated ${selected.label || labels[selected.kind]}`);
  }
  function deleteSelected() {
    if (selected.id === activeRoot.id) { setNotice('Cannot delete the root'); return; }
    if (selected.props.locked === true) { setNotice(`${selected.label || labels[selected.kind]} is locked`); return; }
    changeTree(root => remove(root, selected.id));
    setSelected(activeRoot.id);
    setNotice('Component deleted');
  }
  function setSelectedProp(name: string, value: string | number | boolean) {
    const id = selected.id;
    changeTree(root => update(root, id, n => ({ ...n, props: { ...n.props, [name]: value } })));
  }
  function setSelectedSize(name: 'width' | 'height') {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim();
      const id = selected.id;
      if (raw === '') {
        changeTree(root => update(root, id, n => { const props = { ...n.props }; delete props[name]; return { ...n, props }; }));
        setNotice('Canvas size cleared — artboard sizes fluidly');
        return;
      }
      const v = coerceInput(raw);
      const size = typeof v === 'number' ? Math.max(0, Math.round(v)) : v;
      changeTree(root => update(root, id, n => ({ ...n, props: { ...n.props, [name]: size } })));
    };
  }
  function setSelectedWide(name: string, value: string | undefined) {
    const id = selected.id;
    changeTree(root => update(root, id, n => {
      const wide = { ...n.wide };
      if (value) wide[name] = value;
      else delete wide[name];
      const next: Node = { ...n };
      if (Object.keys(wide).length > 0) next.wide = wide;
      else delete next.wide;
      return next;
    }));
  }
  function saveAsModule() {
    if (editingModuleId) { setNotice('Finish editing this module before saving a nested module'); return; }
    const node = find(project.root, selectedId);
    if (!node || node.id === project.root.id) { setNotice('Select a component to save as a module'); return; }
    const source = node.kind === 'module' ? project.modules.find(m => m.id === node.moduleId)?.root : node;
    if (!source) { setNotice('That module no longer exists'); return; }
    const cloned = cloneWithIds(source);
    const moduleRoot = containers.includes(cloned.kind) ? cloned : { ...makeNode('stack'), label: `${source.label} layout`, children: [cloned] };
    const def: SavedModule = { id: crypto.randomUUID(), name: `${source.label} module`, root: moduleRoot };
    commit({ ...project, modules: [...project.modules, def] });
    setNotice(`Saved module ${def.name}`);
  }
  function insertModule(id: string) {
    const def = project.modules.find(m => m.id === id);
    if (!def) return;
    if (editingModuleId) { setNotice('Finish editing this module before inserting'); return; }
    const parent = containers.includes(selected.kind) ? selected : activeRoot;
    const child = instantiateModule(def);
    changeTree(root => update(root, parent.id, n => ({ ...n, children: [...n.children, child] })));
    setSelected(child.id);
    setNotice(`Inserted ${def.name} into ${parent.label}`);
  }
  function deleteModule(id: string) {
    const def = project.modules.find(m => m.id === id);
    if (!def) return;
    if (editingModuleId === id) { setEditingModuleId(null); setSelected(project.root.id); }
    commit({
      ...project,
      modules: project.modules.filter(m => m.id !== id).map(m => ({ ...m, root: removeModuleRefs(m.root, id) })),
      root: removeModuleRefs(project.root, id),
    });
    setNotice(`Deleted module ${def.name} and its instances`);
  }
  function saveJson() {
    const blob = new Blob([JSON.stringify({ format: 'nctgraphite-studio', version: 2, ...project }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.name.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'project'}.nctgraphite.json`; a.click(); URL.revokeObjectURL(url); setNotice('Project downloaded as JSON');
  }
  function saveXml() {
    const blob = new Blob([serializeLayoutDocument(project)], { type: 'application/xml' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${project.name.trim().replace(/[^a-z0-9_-]+/gi, '-') || 'project'}.nctgraphite.xml`; a.click(); URL.revokeObjectURL(url); setNotice('Project downloaded as XML');
  }
  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (!confirmDiscard()) return;
    try {
      const text = await file.text();
      if (!text.trimStart().startsWith('<')) {
        const data = JSON.parse(text);
        if (data && typeof data === 'object' && (data as { format?: unknown }).format === 'nctgraphite-project-bundle') {
          const snap = decodeProjectBundle(text);
          applyOpened({ snapshot: snap, revisions: {} }, null);
          setSavedFingerprint(null);
          clearRecovery(); setNotice('Project imported — save to keep it');
          return;
        }
      }
      let next: Project | null = null;
      if (text.trimStart().startsWith('<')) {
        next = parseLayoutDocument(text);
      } else {
        const data = JSON.parse(text);
        next = migrateLegacyStudioProject(data);
        if (!next && validDocument(data)) next = data as Project;
      }
      if (!next) throw new Error('Invalid project');
      setPast([]);
      setFuture([]);
      setProject(next);
      setManifest(defaultManifest(next.name));
      setOtherViews({});
      setExtraFiles({});
      setLogic(defaultAppLogic());
      setPreviewOverrides({});
      setCommandLog([]);
      setRevisions({});
      setStore(null);
      setSavedFingerprint(null);
      setEditingModuleId(null); setSelected(next.root.id); clearRecovery(); setNotice('Project opened');
    } catch { setNotice('Could not open this project: invalid or unsupported file'); }
  }
  const selectedModuleDef = selected.kind === 'module' ? project.modules.find(m => m.id === selected.moduleId) : undefined;
  const selectedEntry = catalog.find(e => e.kind === selected.kind);
  const propNames = editablePropsFor(selected.kind).filter(n => n !== 'label' && n !== 'title');
  const topbar = <header className="topbar"><div className="brand"><span className="brand-mark">N</span></div><NCTGraphiteMenuBar className="top-actions"><NCTGraphiteMenu title="File"><NCTGraphiteMenuItem label="New" shortcut="⌘N" onSelect={newProject} /><NCTGraphiteMenuItem label="Open…" onSelect={openFolder} /><NCTGraphiteMenuItem label="Import file…" onSelect={() => input.current?.click()} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Save" shortcut="⌘S" onSelect={save} /><NCTGraphiteMenuItem label="Save As…" shortcut="⇧⌘S" onSelect={saveAs} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Export JSON" onSelect={saveJson} /><NCTGraphiteMenuItem label="Export XML" onSelect={saveXml} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Export app" disabled /></NCTGraphiteMenu><NCTGraphiteMenu title="Edit"><NCTGraphiteMenuItem label="Undo" shortcut="⌘Z" disabled={past.length === 0} onSelect={undo} /><NCTGraphiteMenuItem label="Redo" shortcut="⇧⌘Z" disabled={future.length === 0} onSelect={redo} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Duplicate" shortcut="⌘D" onSelect={duplicateSelected} /><NCTGraphiteMenuItem label="Delete component" shortcut="⌫" onSelect={deleteSelected} /></NCTGraphiteMenu><NCTGraphiteMenu title="View">{DEVICE_PRESETS.map(d => <NCTGraphiteMenuItem key={d.id} label={`${previewWidth === d.width ? '✓ ' : ''}${DEVICE_ICONS[d.id] ?? ''} ${d.label}${d.width != null ? ` ${d.width}` : ''}`} onSelect={() => { setPreviewWidth(d.width); setNotice(d.width == null ? 'Fluid preview' : `${d.label} preview · ${d.width}px`); }} />)}<NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Zoom in" shortcut="⌘+" onSelect={() => setZoom(z => Math.min(200, z + 25))} /><NCTGraphiteMenuItem label="Zoom out" shortcut="⌘−" onSelect={() => setZoom(z => Math.max(50, z - 25))} /><NCTGraphiteMenuItem label="Fit canvas" onSelect={fitZoom} /><NCTGraphiteMenuItem divider />{RENDER_MODES.map(m => <NCTGraphiteMenuItem key={m.id} label={`${renderMode === m.id ? '✓ ' : ''}Render: ${m.label}`} onSelect={() => { setRenderMode(m.id); setNotice(`Render mode: ${m.label}`); }} />)}<NCTGraphiteMenuItem label="Reset zoom" onSelect={() => setZoom(100)} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label={`Density: ${project.density === 'compact' ? 'Compact ✓' : 'Comfortable ✓'}`} onSelect={() => { const next: Project = { ...project, density: project.density === 'compact' ? 'comfortable' : 'compact' }; setPast(p => [...p.slice(-49), structuredClone(project)]); setFuture([]); setProject(next); setNotice('Preview density toggled'); }} /><NCTGraphiteMenuItem label={`Studio theme: ${studioTheme[0].toUpperCase() + studioTheme.slice(1)}`} onSelect={() => setStudioTheme(studioTheme === 'graphite' ? 'classic' : studioTheme === 'classic' ? 'lab' : 'graphite')} /></NCTGraphiteMenu><NCTGraphiteMenu title="AI"><NCTGraphiteMenuItem label="Open AI chat" onSelect={() => { setAiOpen(true); setNotice('AI chat opened'); }} /><NCTGraphiteMenuItem label="Close AI chat" onSelect={() => { setAiOpen(false); setNotice('AI chat closed'); }} /><NCTGraphiteMenuItem divider /><NCTGraphiteMenuItem label="Clear chat" onSelect={() => { setAiMessages([{ role: 'ai', text: 'AI assistance is a placeholder in this build. Describe the layout change you want.' }]); setNotice('AI chat cleared'); }} /></NCTGraphiteMenu><input ref={input} hidden type="file" accept=".json,.xml,application/json,application/xml" onChange={load} /></NCTGraphiteMenuBar><NCTGraphiteLayoutItem className="project-title" grow={1}><span className="title-sub">NCTGraphite Studio · </span>{project.name}{dirty ? ' • unsaved' : ''}<span className="title-sub"> / Design workspace</span></NCTGraphiteLayoutItem></header>;
  const banners = <>
    {recovery && <div className="banner recovery" role="alert"><span>Unsaved work from {recovery.savedAt} was found.</span><span className="banner-actions"><button onClick={resumeRecovery}>Resume</button><button onClick={clearRecovery}>Discard</button></span></div>}
    {conflictPath && <div className="banner conflict" role="alert"><span>{conflictPath} changed on disk. Reload it, or overwrite it with your version.</span><span className="banner-actions"><button onClick={reloadFromDisk}>Reload from disk</button><button onClick={overwriteConflict}>Overwrite</button><button onClick={() => setConflictPath(null)}>Cancel</button></span></div>}
  </>;
  const statusbar = <footer className="statusbar"><span><i className="status-dot" /> {notice}</span><span>NCTGRAPHITE STUDIO &nbsp; / &nbsp; EARLY BUILD</span></footer>;
  const groups = new Map<string, typeof catalog>();
  for (const entry of catalog) {
    const list = groups.get(entry.category) ?? [];
    list.push(entry);
    groups.set(entry.category, list);
  }
  return <NCTGraphiteLayoutShell className={`studio studio-theme-${studioTheme}`} header={topbar} footer={statusbar} columns="190px minmax(280px, 1fr)" wideMinWidth={801} wideColumns="244px minmax(300px, 1fr) 244px" gap={0} style={{ height: '100dvh', overflow: 'hidden' }}>
      <aside className="sidebar left"><div className="sidebar-title">{secIcon('◫')}COMPONENTS <span>01</span></div><div className="sidebar-intro">Build from the structure up.<br /><span>Select a container, then add a component.</span></div>{[...groups].map(([category, entries]) => <NCTGraphiteAccordion key={category} title={<>{secIcon(CATEGORY_ICONS[category] ?? '▦')}{category[0].toUpperCase() + category.slice(1)}</>} open={secOpen(`palette:${category}`, category === 'layout')} onOpenChange={v => setSec(`palette:${category}`, v)}><NCTGraphitePanel variant="well"><div className="palette">{entries.map(e => <button key={e.kind} draggable onClick={() => add(e.kind)} onDragStart={ev => { dragKind.current = e.kind; ev.dataTransfer.setData('application/x-nct-kind', e.kind); ev.dataTransfer.effectAllowed = 'copy'; }} onDragEnd={() => { dragKind.current = null; moveDrag.current = null; setDropId(null); }} title={`${e.description} — drag onto the canvas or click to add`}><span>{PALETTE_ICONS[e.kind] ?? '▦'}</span>{labels[e.kind]}<b>+</b></button>)}</div></NCTGraphitePanel></NCTGraphiteAccordion>)}<div className="sidebar-title">{secIcon('◈')}MODULES <span>{String(project.modules.length).padStart(2, '0')}</span></div>{editingModule
        ? <div className="sidebar-intro">Editing <strong>{editingModule.name}</strong>.<br /><span>Changes update every instance.</span><br /><button className="primary" onClick={() => { setEditingModuleId(null); setSelected(project.root.id); setNotice('Back to app layout'); }} style={{ marginTop: 8 }}>Done editing</button></div>
        : <><div className="sidebar-intro"><span>Save components as reusable modules, then insert them anywhere.</span><br /><button onClick={saveAsModule} style={{ marginTop: 8 }}>Save selection as module</button></div><div className="tree">{project.modules.map(m => <div key={m.id} className={`tree-item ${selectedModuleDef?.id === m.id ? 'selected' : ''}`}><span className="tree-icon">▣</span>{m.name}<span className="tree-kind"><button onClick={() => insertModule(m.id)} title={`Insert ${m.name}`}>insert</button> <button onClick={() => { setEditingModuleId(m.id); setSelected(m.root.id); setNotice(`Editing ${m.name}`); }} title={`Edit ${m.name}`}>edit</button> <button onClick={() => deleteModule(m.id)} title={`Delete ${m.name}`}>✕</button></span></div>)}</div></>}</aside>
      <main className="editor"><div className="editor-bar"><div><span className="eyebrow">{previewMode ? 'PREVIEW' : 'DESIGN'}</span><span className="bar-separator" /> <strong>{editingModule ? `Module: ${editingModule.name}` : 'Layout canvas'}</strong></div><div className="canvas-mode"><button className={previewMode ? 'primary' : ''} onClick={() => { if (!previewMode) { setCalc(calcInitial(String(previewValues.display ?? '0'))); setPreviewOverrides({}); } setPreviewMode(!previewMode); }} title="Play the app with live state">{previewMode ? '■ Stop' : '▶ Play'}</button><span className="preview-sizes" role="group" aria-label="Device preset">{DEVICE_PRESETS.map(d => <button key={d.id} className={previewWidth === d.width ? 'primary' : ''} onClick={() => { setPreviewWidth(d.width); setNotice(d.width == null ? 'Fluid preview' : `${d.label} preview · ${d.width}px`); }} title={d.width == null ? 'Fluid width' : `${d.label} · ${d.width}px viewport`} aria-pressed={previewWidth === d.width}>{secIcon(DEVICE_ICONS[d.id] ?? '▦')}{d.label}{d.width != null ? ` ${d.width}` : ''}</button>)}</span><span className="preview-sizes" role="group" aria-label="Canvas zoom"><button onClick={() => setZoom(z => Math.max(50, z - 25))} title="Zoom out">−</button><button title="Canvas zoom" onClick={() => setZoom(100)}>{zoom}%</button><button onClick={() => setZoom(z => Math.min(200, z + 25))} title="Zoom in">+</button><button onClick={fitZoom} title="Fit canvas to available width">{secIcon('⤢')}Fit</button><button onClick={() => setZoom(100)} title="Reset zoom to 100%">{secIcon('⟲')}Reset</button></span><span className="preview-sizes" role="group" aria-label="Render mode">{RENDER_MODES.map(m => <button key={m.id} className={renderMode === m.id ? 'primary' : ''} onClick={() => { setRenderMode(m.id); setNotice(m.id === 'app' ? 'Themed app render' : m.id === 'wireframe' ? 'Wireframe render (unthemed)' : 'Outline render (unthemed)'); }} title={m.id === 'app' ? 'Themed app controls' : m.id === 'wireframe' ? 'Wireframe: gray boxes, no theme' : 'Outline: structure outlines only'} aria-pressed={renderMode === m.id}>{m.label}</button>)}</span><span className="status-dot" /> LIVE PREVIEW</div></div>{banners}{previewMode && <div className="banner preview" role="status"><span>Previewing with {logic.state.length} state keys{previewOverrides && Object.keys(previewOverrides).length > 0 ? ` (${Object.keys(previewOverrides).length} overrides)` : ''}{commandLog.length > 0 ? ` — last command: ${commandLog[commandLog.length - 1]}` : ''}</span><span className="banner-actions">{logic.commands.map(c => <button key={c.id} onClick={() => fireCommand(c.id)}>{c.label}</button>)}</span></div>}<div ref={canvasRef} className="canvas" data-grid={gridVisible} style={{ '--workspace-grid': `${gridSize}px` } as React.CSSProperties} onPointerDown={onCanvasPointerDown} onDragOver={onCanvasDragOver} onDrop={onCanvasDrop} onDragLeave={() => setDropId(null)} onScroll={() => setScrollTick(t => t + 1)}><div className="workspace"><div className="canvas-label"><span>{editingModule ? 'MODULE PREVIEW' : 'APP PREVIEW'}</span><span>RESPONSIVE LAYOUT</span></div><div ref={artboard} className={`artboard ${project.density}`} data-nct-density={project.density} data-device={DEVICE_PRESETS.find(d => d.width === previewWidth)?.id ?? 'fluid'} data-apptheme={project.theme ?? 'light'} data-rendermode={renderMode} data-grid={gridVisible} style={{ ...(artboardMax ? { maxWidth: artboardMax } : {}), '--scene-grid-size': `${gridSize}px`, transform: `translate(calc(-50% + ${wsPos.x}px), ${wsPos.y}px) scale(${zoom / 100})`, transformOrigin: 'center top' } as React.CSSProperties}><div className="artboard-header" onPointerDown={onArtboardHeaderDown} title={previewMode ? undefined : 'Drag to move the window around the workspace'}><span className="artboard-dot" />{editingModule?.name ?? project.name}{artboardMax ? <span> · {artboardMax}px{previewWidth ? '' : ' (fits scene)'}</span> : null}<span>•••</span></div><div className="artboard-body"><Preview node={activeRoot} modules={project.modules} selected={selectedId} select={setSelected} logic={previewMode ? logic : undefined} values={previewMode ? previewValues : undefined} onValue={(key, value) => setPreviewOverrides(o => ({ ...o, [key]: value }))} onCommand={fireCommand} widePreview={(artboardWidth || previewWidth || 0) >= 768} dropId={dropId} onNodeDragStart={(id, ev) => { moveDrag.current = id; dragKind.current = null; ev.dataTransfer.setData('application/x-nct-move', id); ev.dataTransfer.effectAllowed = 'move'; }} /></div>{!previewMode && selected.kind === 'sceneItem' && selected.props.locked !== true ? <SceneSelectionOverlay artRef={artboard} node={(artboardWidth || previewWidth || 0) >= 768 ? { ...selected, props: { ...selected.props, ...selected.wide } } : selected} zoom={zoom} snap={snapVal} revision={`${scrollTick}:${selectedId}:${JSON.stringify(selected.props)}`} onCommit={(id, patch) => { changeTree(root => update(root, id, n => geomTarget === 'wide' ? { ...n, wide: { ...n.wide, ...patch } } : { ...n, props: { ...n.props, ...patch } })); setNotice(`Scene item updated (${geomTarget})`); }} /> : null}</div><div className="canvas-help">Select a component on the canvas or in the document tree. Shortcuts: Delete removes selection · Ctrl/⌘+D duplicates · Ctrl/⌘+Z / Shift+Ctrl/⌘+Z undo/redo. Drag a selected canvas item onto another container to reparent it.</div></div><div className="canvas-help">Drag the window header to move it around the workspace · drag the background to pan.</div></div><div className="editor-footer"><span>◈ &nbsp; {selected.kind === 'module' ? selectedModuleDef?.name ?? selected.label : selected.label || labels[selected.kind]} · {labels[selected.kind]} · {selected.children.length} children · {DEVICE_PRESETS.find(d => d.width === previewWidth)?.label ?? 'Fluid'}{previewWidth ? ` ${previewWidth}px` : ''} · {zoom}%</span><span>Tree-based composition</span></div>{aiOpen && <div className="ai-chat"><NCTGraphiteWindow title="AI · placeholder" resizable width={320} onClose={() => setAiOpen(false)}><div className="ai-chat-log">{aiMessages.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>)}</div><form className="ai-chat-input" onSubmit={e => { e.preventDefault(); sendAi(); }}><input value={aiInput} onChange={e => setAiInput(e.target.value)} placeholder="Ask for a layout change…" aria-label="AI request" /><button type="submit">Send</button></form></NCTGraphiteWindow></div>}</main>
      <aside className="sidebar right"><div className="sidebar-title">{secIcon('⚙')}INSPECTOR <span>02</span></div><div className="selection"><span className="selection-icon">◈</span><div><strong>{selected.kind === 'module' ? selectedModuleDef?.name ?? selected.label : selected.label || labels[selected.kind]}</strong><small>NCTGraphite {labels[selected.kind]}</small></div></div><NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.tree)}Tree</>} open={secOpen('insp:tree', true)} onOpenChange={v => setSec('insp:tree', v)}><NCTGraphitePanel><div className="property tree-ops"><button onClick={duplicateSelected}>+ Duplicate</button><button onClick={undo} disabled={past.length === 0}>↩ Undo</button><button onClick={redo} disabled={future.length === 0}>↪ Redo</button></div><div className="property"><p>Drag rows to reorder or nest. Alt+↑/↓ moves the selection.</p></div><div className="tree"><Tree node={activeRoot} modules={project.modules} selected={selectedId} select={setSelected} dragId={treeDragId} onDragStart={setTreeDragId} onDragEnd={() => setTreeDragId(null)} onDrop={treeDrop} /></div></NCTGraphitePanel></NCTGraphiteAccordion>{selected.kind === 'module' && selectedModuleDef
        ? <NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.module)}Module instance</>} open={secOpen('insp:module', true)} onOpenChange={v => setSec('insp:module', v)}><NCTGraphitePanel><div className="property"><p>Instances reference {selectedModuleDef.name}. Editing the module updates every instance.</p></div><div className="property"><button onClick={() => { setEditingModuleId(selectedModuleDef.id); setSelected(selectedModuleDef.root.id); setNotice(`Editing ${selectedModuleDef.name}`); }}>Edit module</button></div></NCTGraphitePanel></NCTGraphiteAccordion>
        : <NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.props)}Properties</>} open={secOpen('insp:props', true)} onOpenChange={v => setSec('insp:props', v)}><div className="property"><label htmlFor="node-label">{selected.kind === 'text' ? 'TEXT' : 'LABEL'}</label><input id="node-label" value={selected.label} onChange={e => changeTree(root => update(root, selected.id, n => ({ ...n, label: e.target.value })))} /></div>{selectedEntry ? <div className="property"><label>TYPE</label><div className="readout">{selectedEntry.tag}</div><p>{selectedEntry.description}</p></div> : <div className="property"><label>TYPE</label><div className="readout">{labels[selected.kind]}</div></div>}{propNames.map(name => {
          const meta = selectedEntry?.meta.props[name];
          const value = selected.props[name];
          const types = meta ? (Array.isArray(meta.type) ? meta.type : [meta.type]) : [];
          if (types.includes('boolean')) {
            return <div className="property" key={name}><label htmlFor={`prop-${name}`}>{name}</label><select id={`prop-${name}`} value={String(value ?? meta?.default ?? false)} onChange={e => setSelectedProp(name, e.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select>{meta?.description ? <p>{meta.description}</p> : null}</div>;
          }
          if (types.length > 0 && types.every(t => typeof t === 'string' && !['number', 'string', 'boolean', 'node', 'function', 'array'].includes(t))) {
            return <div className="property" key={name}><label htmlFor={`prop-${name}`}>{name}</label><select id={`prop-${name}`} value={String(value ?? meta?.default ?? types[0])} onChange={e => setSelectedProp(name, e.target.value)}>{types.map(t => <option key={t} value={t}>{t}</option>)}</select>{meta?.description ? <p>{meta.description}</p> : null}</div>;
          }
          return <div className="property" key={name}><label htmlFor={`prop-${name}`}>{name}</label><input id={`prop-${name}`} value={String(value ?? meta?.default ?? '')} placeholder={String(meta?.default ?? '')} onChange={e => setSelectedProp(name, coerceInput(e.target.value))} />{meta?.description ? <p>{meta.description}</p> : null}</div>;
        })}{selected.kind === 'grid' ? <div className="property"><label htmlFor="wide-columns">WIDE COLUMNS (≥ breakpoint)</label><input id="wide-columns" value={String(selected.wide?.columns ?? '')} placeholder={GRID_DEFAULT_COLUMNS} onChange={e => setSelectedWide('columns', e.target.value || undefined)} /><p>Applied in the wide preview; base columns apply below it.</p></div> : null}</NCTGraphiteAccordion>}{selected.kind === 'sceneItem' ? <NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.geom)}Geometry</>} open={secOpen('insp:geom', true)} onOpenChange={v => setSec('insp:geom', v)}><NCTGraphitePanel><div className="property"><label htmlFor="geom-target">EDITING</label><select id="geom-target" value={geomTarget} onChange={e => setGeomTarget(e.target.value as 'base' | 'wide')}><option value="base">Base layout (all sizes)</option><option value="wide">Wide ≥768px override</option></select><p>{geomTarget === 'wide' ? 'Values apply at and above the wide breakpoint; base values apply below it.' : 'Shared values apply at every size unless a wide override exists.'}</p></div>{(['left', 'top', 'width', 'height', 'right', 'bottom'] as const).map(name => {
          const overridden = selected.wide?.[name] !== undefined;
          const shown = geomTarget === 'wide' ? (selected.wide?.[name] ?? selected.props[name]) : selected.props[name];
          return <div className="property" key={name}><label htmlFor={`geom-${name}`}>{name.toUpperCase()} (px or CSS){geomTarget === 'base' && overridden ? ' ● wide' : ''}</label><input id={`geom-${name}`} value={String(shown ?? '')} placeholder={geomTarget === 'wide' ? String(selected.props[name] ?? 'inherited') : '—'} onChange={e => {
            const raw = e.target.value.trim();
            const id = selected.id;
            if (geomTarget === 'wide') {
              if (raw === '') changeTree(root => update(root, id, n => { const wide = { ...(n.wide ?? {}) }; delete wide[name]; const next: Node = { ...n }; if (Object.keys(wide).length > 0) next.wide = wide; else delete next.wide; return next; }));
              else changeTree(root => update(root, id, n => ({ ...n, wide: { ...(n.wide ?? {}), [name]: coerceInput(raw) } })));
            } else if (raw === '') changeTree(root => update(root, id, n => { const props = { ...n.props }; delete props[name]; return { ...n, props }; }));
            else changeTree(root => update(root, id, n => ({ ...n, props: { ...n.props, [name]: coerceInput(raw) } })));
          }} /></div>;
        })}<div className="property"><p>RIGHT and BOTTOM insets pin the item to the scene's edges; LEFT+RIGHT (or TOP+BOTTOM) stretches it when the scene resizes across viewport sizes. An explicit width wins over right (and height over bottom).</p></div><div className="property"><label htmlFor="geom-z">Z-INDEX</label><input id="geom-z" value={String(selected.props.zIndex ?? '')} placeholder="auto" onChange={e => { const raw = e.target.value.trim(); const id = selected.id; if (raw === '' || !/^-?\d+$/.test(raw)) { if (raw === '') changeTree(root => update(root, id, n => { const props = { ...n.props }; delete props.zIndex; return { ...n, props }; })); return; } changeTree(root => update(root, id, n => ({ ...n, props: { ...n.props, zIndex: Number(raw) } }))); }} /><p>Two-way synced with the canvas scene item.</p></div>{selected.wide && Object.keys(selected.wide).some(k => ['left', 'top', 'width', 'height', 'right', 'bottom'].includes(k)) ? <div className="property tree-ops"><button onClick={() => { const id = selected.id; changeTree(root => update(root, id, n => { const wide = { ...(n.wide ?? {}) }; for (const k of ['left', 'top', 'width', 'height', 'right', 'bottom']) delete wide[k]; const next: Node = { ...n }; if (Object.keys(wide).length > 0) next.wide = wide; else delete next.wide; return next; })); setNotice('Wide geometry reverted to base'); }}>Revert wide geometry</button></div> : null}</NCTGraphitePanel></NCTGraphiteAccordion> : null}{selected.kind === 'scene' ? <NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.canvas)}Canvas size</>} open={secOpen('insp:canvas', true)} onOpenChange={v => setSec('insp:canvas', v)}><NCTGraphitePanel><div className="property"><label htmlFor="scene-w">WIDTH (px)</label><input id="scene-w" value={String(selected.props.width ?? '')} placeholder="auto" onChange={setSelectedSize('width')} /></div><div className="property"><label htmlFor="scene-h">HEIGHT (px)</label><input id="scene-h" value={String(selected.props.height ?? '')} placeholder="auto" onChange={setSelectedSize('height')} /><p>With no device preset, the fluid artboard fits this size. Device presets override it.</p></div></NCTGraphitePanel></NCTGraphiteAccordion> : null}<NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.vis)}Visibility</>} open={secOpen('insp:vis', true)} onOpenChange={v => setSec('insp:vis', v)}><NCTGraphitePanel><div className="property"><label htmlFor="vis-hidden">HIDDEN</label><select id="vis-hidden" value={String(selected.props.hidden ?? false)} onChange={e => { const id = selected.id; const v = e.target.value === 'true'; changeTree(root => update(root, id, n => { const props = { ...n.props }; if (v) props.hidden = true; else delete props.hidden; return { ...n, props }; })); setNotice(v ? 'Component hidden in preview' : 'Component visible'); }}><option value="true">true</option><option value="false">false</option></select><p>Hidden components stay in the tree but render nothing in preview and export.</p></div><div className="property"><label htmlFor="vis-locked">LOCKED</label><select id="vis-locked" value={String(selected.props.locked ?? false)} onChange={e => { const id = selected.id; const v = e.target.value === 'true'; changeTree(root => update(root, id, n => { const props = { ...n.props }; if (v) props.locked = true; else delete props.locked; return { ...n, props }; })); setNotice(v ? 'Component locked' : 'Component unlocked'); }}><option value="true">true</option><option value="false">false</option></select><p>Locked components ignore canvas selection, moves, and delete until unlocked.</p></div></NCTGraphitePanel></NCTGraphiteAccordion><NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.grid)}Grid & snap</>} open={secOpen('insp:grid', true)} onOpenChange={v => setSec('insp:grid', v)}><NCTGraphitePanel><div className="property"><label htmlFor="grid-snap">SNAPPING</label><select id="grid-snap" value={String(snapEnabled)} onChange={e => { setSnapEnabled(e.target.value === 'true'); setNotice(e.target.value === 'true' ? 'Snapping on' : 'Snapping off'); }}><option value="true">true</option><option value="false">false</option></select><p>Snap scene drops, moves, and resizes to the grid.</p></div><div className="property"><label htmlFor="grid-visible">GRID GUIDES</label><select id="grid-visible" value={String(gridVisible)} onChange={e => setGridVisible(e.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select></div><div className="property"><label htmlFor="grid-size">GRID SPACING (px)</label><input id="grid-size" value={String(gridSize)} onChange={e => { const n = Math.round(Number(e.target.value)); if (Number.isFinite(n)) setGridSize(Math.max(2, Math.min(64, n))); }} /><p>Absolute scene regions use this spacing; bound stack and grid layouts are unaffected.</p></div></NCTGraphitePanel></NCTGraphiteAccordion><NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.binding)}Binding</>} open={secOpen('insp:binding', true)} onOpenChange={v => setSec('insp:binding', v)}><div className="property"><label htmlFor="bind-prop">PROP</label><select id="bind-prop" value={bindProp} onChange={e => { setBindProp(e.target.value); setBindTarget(''); }}><option value="label">label</option><option value="value">value</option></select><p>Bind {selected.id}.{bindProp} to state or a command.</p></div><div className="property"><label htmlFor="bind-target">TARGET</label><select id="bind-target" value={bindTarget} onChange={e => setBindTarget(e.target.value)}><option value="">— none —</option><optgroup label="State">{logic.state.map(s => <option key={s.key} value={`state:${s.key}`}>state:{s.key}</option>)}</optgroup><optgroup label="Commands">{logic.commands.map(c => <option key={c.id} value={`command:${c.id}`}>command:{c.id}</option>)}</optgroup></select></div><div className="property tree-ops"><button onClick={() => { if (!bindTarget) return; const [kind, id] = bindTarget.split(':'); const record: AppBinding = kind === 'state' ? { nodeId: selected.id, prop: bindProp, stateKey: id } : { nodeId: selected.id, prop: bindProp, commandId: id }; const rest = logic.bindings.filter(b => !(b.nodeId === selected.id && b.prop === bindProp)); updateLogic({ ...logic, bindings: [...rest, record] }); setNotice(`Bound ${selected.id}.${bindProp} to ${bindTarget}`); }}>Apply binding</button><button onClick={() => { updateLogic({ ...logic, bindings: logic.bindings.filter(b => !(b.nodeId === selected.id && b.prop === bindProp)) }); setBindTarget(''); setNotice('Binding cleared'); }}>Clear</button></div>{logic.bindings.filter(b => b.nodeId === selected.id).map(b => <div className="property" key={`${b.nodeId}:${b.prop}`}><div className="readout">{b.prop} → {b.stateKey ? `state:${b.stateKey}` : `command:${b.commandId}`}</div></div>)}{bindingIssues.filter(i => i.nodeId === selected.id).map(i => <div className="property" key={`${i.prop}:${i.message}`}><p>{i.message}</p></div>)}</NCTGraphiteAccordion><NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.logic)}{`Logic (${logic.state.length} keys, ${logic.bindings.length} bindings)`}</>} open={secOpen('insp:logic', true)} onOpenChange={v => setSec('insp:logic', v)}><div className="property"><label>STATE KEYS</label>{logic.state.length === 0 ? <p>No state yet. Add a key, then bind a node prop to it.</p> : logic.state.map(s => <div key={s.key} className="readout" style={{ marginBottom: 4 }}>{s.key} : {s.type} = {String(s.default)} <button onClick={() => updateLogic({ ...logic, state: logic.state.filter(k => k.key !== s.key), bindings: logic.bindings.filter(b => b.stateKey !== s.key) })} title={`Remove ${s.key}`}>✕</button></div>)}</div><div className="property tree-ops"><input value={newStateKey} onChange={e => setNewStateKey(e.target.value)} placeholder="newKey" aria-label="New state key" /><button onClick={() => { const key = newStateKey.trim(); if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) { setNotice('State key must match /^[A-Za-z][A-Za-z0-9_]*$/'); return; } if (logic.state.some(s => s.key === key)) { setNotice('State key already exists'); return; } updateLogic({ ...logic, state: [...logic.state, { key, type: 'string', default: '' }] }); setNewStateKey(''); }}>Add state</button></div><div className="property"><label>COMMANDS</label>{logic.commands.length === 0 ? <p>No commands yet.</p> : logic.commands.map(c => <div key={c.id} className="readout" style={{ marginBottom: 4 }}>{c.id} — {c.label} ({c.defaultKey}) <button onClick={() => updateLogic({ ...logic, commands: logic.commands.filter(k => k.id !== c.id), bindings: logic.bindings.filter(b => b.commandId !== c.id) })} title={`Remove ${c.id}`}>✕</button></div>)}</div><div className="property tree-ops"><input value={newCommandId} onChange={e => setNewCommandId(e.target.value)} placeholder="commandId" aria-label="New command id" /><button onClick={() => { const id = newCommandId.trim(); if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(id)) { setNotice('Command id must be a valid key'); return; } if (logic.commands.some(c => c.id === id)) { setNotice('Command already exists'); return; } updateLogic({ ...logic, commands: [...logic.commands, { id, label: id, defaultKey: id }] }); setNewCommandId(''); }}>Add command</button></div>{previewMode && <div className="property"><label>PREVIEW STATE</label>{logic.state.map(s => <div key={s.key} style={{ marginBottom: 4 }}><label htmlFor={`preview-${s.key}`}>{s.key}</label><input id={`preview-${s.key}`} value={String(previewValues[s.key] ?? '')} onChange={e => setPreviewOverrides(o => ({ ...o, [s.key]: s.type === 'number' ? Number(e.target.value) : e.target.value }))} /></div>)}</div>}{logicErrors.length > 0 && <div className="property"><p>{logicErrors[0]}</p></div>}{bindingIssues.length > 0 && <div className="property"><label>BINDING ISSUES ({bindingIssues.length})</label>{bindingIssues.map((i, n) => <p key={n}>{i.message}</p>)}</div>}</NCTGraphiteAccordion><NCTGraphiteAccordion title={<>{secIcon(SECTION_ICONS.settings)}App settings</>} open={secOpen('insp:settings', true)} onOpenChange={v => setSec('insp:settings', v)}><div className="property"><label htmlFor="project-name">PROJECT NAME</label><input id="project-name" value={project.name} onChange={e => { const next = { ...project, name: e.target.value }; setPast(p => [...p.slice(-49), structuredClone(project)]); setFuture([]); setProject(next); }} /></div><div className="property"><label htmlFor="density">PREVIEW DENSITY</label><select id="density" value={project.density} onChange={e => { const next = { ...project, density: e.target.value as Project['density'] }; setPast(p => [...p.slice(-49), structuredClone(project)]); setFuture([]); setProject(next); }}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select><p>Preview spacing can vary independently of the Studio.</p></div><div className="property"><label htmlFor="apptheme">APP THEME</label><select id="apptheme" value={project.theme ?? 'light'} onChange={e => { const next: Project = { ...project, theme: e.target.value as NonNullable<Project['theme']> }; setPast(p => [...p.slice(-49), structuredClone(project)]); setFuture([]); setProject(next); setNotice(`App theme: ${e.target.value}`); }}><option value="light">Light</option><option value="dark">Dark</option><option value="lab">Lab</option></select><p>The edited app's appearance; Studio chrome is unaffected.</p></div><div className="property"><label htmlFor="studio-theme">STUDIO THEME</label><select id="studio-theme" value={studioTheme} onChange={e => setStudioTheme(e.target.value as typeof studioTheme)}><option value="graphite">Graphite</option><option value="classic">Classic</option><option value="lab">Lab</option></select><p>Studio chrome follows NCTGraphite tokens; the edited app is unaffected.</p></div></NCTGraphiteAccordion><NCTGraphiteAccordion title="Export inspection" open={showExport} onOpenChange={setShowExport}><NCTGraphitePanel><div className="property tree-ops"><button onClick={() => setShowExport(v => !v)}>{showExport ? 'Hide serialized layout' : 'Show serialized layout'}</button></div>{showExport ? <div className="property"><label>ACTUAL SERIALIZED XML</label><textarea readOnly rows={12} style={{ width: '100%', fontFamily: 'ui-monospace,monospace', fontSize: 10 }} value={serializeLayoutDocument(editingModule ? { ...project, root: editingModule.root } : project)} aria-label="Serialized layout XML" /><p>Runnable app export remains a separate task.</p></div> : <div className="property"><p>Shows the exact XML that Export XML writes.</p></div>}</NCTGraphitePanel></NCTGraphiteAccordion><div className="inspector-bottom"><button disabled={selected.id === activeRoot.id || selected.props.locked === true} onClick={deleteSelected}>Delete component</button></div></aside>
    </NCTGraphiteLayoutShell>;
}
