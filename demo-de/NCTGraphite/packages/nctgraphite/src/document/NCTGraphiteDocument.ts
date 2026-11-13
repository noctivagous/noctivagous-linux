/**
 * Document-based application model, analogous to AppKit's NSDocument.
 * The snapshot is the file contents. Instances are immutable: each edit
 * returns a new document, which is the form React and undo both need.
 * Mode-specific layer fields (paint data, grids, settings) stay in the
 * application; this module owns identity, layers, dirty state, and undo.
 */

export const NCTGRAPHITE_DOCUMENT_KIND = 'nctgraphite-document';
export const NCTGRAPHITE_DOCUMENT_VERSION = 1;
export const NCTGRAPHITE_DOCUMENT_FILE_TYPE = 'json';
export const NCTGRAPHITE_DOCUMENT_FILE_EXTENSION = 'nctgdoc.json';

const UNDO_LIMIT = 50;

export interface NCTGraphiteDocumentCanvas {
  width: number;
  height: number;
  background: string;
}

export interface NCTGraphiteDocumentView {
  zoom: number;
  panX: number;
  panY: number;
}

/** Minimum layer record. Applications extend this with mode, data, and settings. */
export interface NCTGraphiteLayerRecord {
  id: string;
  name: string;
  visible: boolean;
  locked?: boolean;
  opacity?: number;
}

export interface NCTGraphiteDocumentSnapshot<Layer extends NCTGraphiteLayerRecord = NCTGraphiteLayerRecord> {
  kind: typeof NCTGRAPHITE_DOCUMENT_KIND;
  version: number;
  displayName: string;
  canvas: NCTGraphiteDocumentCanvas;
  view: NCTGraphiteDocumentView;
  /** Bottom to top. Array index is draw order. */
  layers: Layer[];
  activeLayerId: string | null;
}

interface NCTGraphiteUndoEntry<Layer extends NCTGraphiteLayerRecord> {
  snapshot: NCTGraphiteDocumentSnapshot<Layer>;
  revision: number;
}

export interface NCTGraphiteUntitledDocumentOptions<Layer extends NCTGraphiteLayerRecord> {
  displayName?: string;
  canvas?: Partial<NCTGraphiteDocumentCanvas>;
  view?: Partial<NCTGraphiteDocumentView>;
  layers: Layer[];
  activeLayerId?: string | null;
}

function cloneSnapshot<Layer extends NCTGraphiteLayerRecord>(
  snapshot: NCTGraphiteDocumentSnapshot<Layer>,
): NCTGraphiteDocumentSnapshot<Layer> {
  return structuredClone(snapshot);
}

function createId(prefix: string): string {
  const unique = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}

export function createNCTGraphiteDocumentId(): string {
  return createId('doc');
}

export function createNCTGraphiteLayerId(): string {
  return createId('layer');
}

function assertCanvas(canvas: NCTGraphiteDocumentCanvas): void {
  if (![canvas.width, canvas.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Document canvas dimensions must be finite and positive');
  }
}

function resolveActiveLayerId<Layer extends NCTGraphiteLayerRecord>(
  layers: readonly Layer[],
  activeLayerId: string | null | undefined,
): string | null {
  if (activeLayerId && layers.some((layer) => layer.id === activeLayerId)) return activeLayerId;
  return layers.at(-1)?.id ?? null;
}

/** One open document: snapshot, file name, change count, and undo stacks. */
export class NCTGraphiteDocument<Layer extends NCTGraphiteLayerRecord = NCTGraphiteLayerRecord> {
  private constructor(
    readonly id: string,
    readonly snapshot: NCTGraphiteDocumentSnapshot<Layer>,
    readonly revision: number,
    readonly savedRevision: number,
    readonly fileName: string | null,
    private readonly past: readonly NCTGraphiteUndoEntry<Layer>[],
    private readonly future: readonly NCTGraphiteUndoEntry<Layer>[],
  ) {}

  get displayName(): string {
    return this.snapshot.displayName;
  }

  get edited(): boolean {
    return this.revision !== this.savedRevision;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get layers(): readonly Layer[] {
    return this.snapshot.layers;
  }

  get activeLayerId(): string | null {
    return this.snapshot.activeLayerId;
  }

  get activeLayer(): Layer | null {
    const id = this.snapshot.activeLayerId;
    return this.snapshot.layers.find((layer) => layer.id === id) ?? null;
  }

  /** Visible layers in draw order, bottom to top. */
  get visibleLayers(): Layer[] {
    return this.snapshot.layers.filter((layer) => layer.visible);
  }

  static untitled<Layer extends NCTGraphiteLayerRecord>(
    options: NCTGraphiteUntitledDocumentOptions<Layer>,
  ): NCTGraphiteDocument<Layer> {
    const canvas: NCTGraphiteDocumentCanvas = {
      width: options.canvas?.width ?? 960,
      height: options.canvas?.height ?? 720,
      background: options.canvas?.background ?? '#fdfaf3',
    };
    assertCanvas(canvas);
    const layers = options.layers.map((layer) => ({ ...layer, id: layer.id || createNCTGraphiteLayerId() }));
    const snapshot: NCTGraphiteDocumentSnapshot<Layer> = {
      kind: NCTGRAPHITE_DOCUMENT_KIND,
      version: NCTGRAPHITE_DOCUMENT_VERSION,
      displayName: options.displayName ?? 'Untitled',
      canvas,
      view: { zoom: options.view?.zoom ?? 1, panX: options.view?.panX ?? 0, panY: options.view?.panY ?? 0 },
      layers,
      activeLayerId: resolveActiveLayerId(layers, options.activeLayerId),
    };
    return new NCTGraphiteDocument(createNCTGraphiteDocumentId(), snapshot, 0, 0, null, [], []);
  }

  static fromSnapshot<Layer extends NCTGraphiteLayerRecord>(
    snapshot: NCTGraphiteDocumentSnapshot<Layer>,
    fileName?: string | null,
  ): NCTGraphiteDocument<Layer> {
    if (snapshot.kind !== NCTGRAPHITE_DOCUMENT_KIND) {
      throw new TypeError(`Unsupported document kind: ${String(snapshot.kind)}`);
    }
    if (snapshot.version > NCTGRAPHITE_DOCUMENT_VERSION) {
      throw new RangeError(`Document version ${snapshot.version} is newer than this library`);
    }
    assertCanvas(snapshot.canvas);
    const layers = snapshot.layers;
    const next: NCTGraphiteDocumentSnapshot<Layer> = {
      ...cloneSnapshot(snapshot),
      version: NCTGRAPHITE_DOCUMENT_VERSION,
      activeLayerId: resolveActiveLayerId(layers, snapshot.activeLayerId),
    };
    return new NCTGraphiteDocument(createNCTGraphiteDocumentId(), next, 0, 0, fileName ?? null, [], []);
  }

  static parse<Layer extends NCTGraphiteLayerRecord>(
    text: string,
    fileName?: string | null,
  ): NCTGraphiteDocument<Layer> {
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new SyntaxError('Document JSON is malformed');
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new TypeError('Document JSON must be an object');
    }
    const snapshot = data as NCTGraphiteDocumentSnapshot<Layer>;
    if (!Array.isArray(snapshot.layers)) throw new TypeError('Document layers must be an array');
    return NCTGraphiteDocument.fromSnapshot(snapshot, fileName);
  }

  toJSON(): string {
    return `${JSON.stringify(this.snapshot, null, 2)}\n`;
  }

  activating(activeLayerId: string | null): NCTGraphiteDocument<Layer> {
    const id = resolveActiveLayerId(this.snapshot.layers, activeLayerId);
    if (id === this.snapshot.activeLayerId) return this;
    return this.editing({ ...this.snapshot, activeLayerId: id });
  }

  renaming(displayName: string): NCTGraphiteDocument<Layer> {
    if (displayName === this.snapshot.displayName) return this;
    return this.editing({ ...this.snapshot, displayName });
  }

  updatingCanvas(canvas: Partial<NCTGraphiteDocumentCanvas>): NCTGraphiteDocument<Layer> {
    const next = { ...this.snapshot.canvas, ...canvas };
    assertCanvas(next);
    return this.editing({ ...this.snapshot, canvas: next });
  }

  updatingLayer(
    id: string,
    updater: (layer: Layer) => Layer,
    options: { recordUndo?: boolean } = {},
  ): NCTGraphiteDocument<Layer> {
    const index = this.snapshot.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return this;
    const current = this.snapshot.layers[index];
    const updated = updater(current);
    if (updated === current) return this;
    if (updated.id !== current.id) throw new Error('Layer updates must preserve layer id');
    const layers = this.snapshot.layers.slice();
    layers[index] = updated;
    const snapshot = { ...this.snapshot, layers };
    return options.recordUndo === false ? this.mutating(snapshot) : this.editing(snapshot);
  }

  insertingLayer(layer: Layer, index = this.snapshot.layers.length): NCTGraphiteDocument<Layer> {
    const nextLayer = { ...layer, id: layer.id || createNCTGraphiteLayerId() };
    const layers = this.snapshot.layers.slice();
    const at = Math.max(0, Math.min(index, layers.length));
    layers.splice(at, 0, nextLayer);
    return this.editing({ ...this.snapshot, layers, activeLayerId: nextLayer.id });
  }

  removingLayer(id: string): NCTGraphiteDocument<Layer> {
    const layers = this.snapshot.layers.filter((layer) => layer.id !== id);
    if (layers.length === this.snapshot.layers.length) return this;
    return this.editing({ ...this.snapshot, layers, activeLayerId: resolveActiveLayerId(layers, this.snapshot.activeLayerId) });
  }

  movingLayer(id: string, toIndex: number): NCTGraphiteDocument<Layer> {
    const from = this.snapshot.layers.findIndex((layer) => layer.id === id);
    if (from < 0) return this;
    const layers = this.snapshot.layers.slice();
    const [layer] = layers.splice(from, 1);
    const at = Math.max(0, Math.min(toIndex, layers.length));
    layers.splice(at, 0, layer);
    return this.editing({ ...this.snapshot, layers });
  }

  markingSaved(fileName: string | null = this.fileName): NCTGraphiteDocument<Layer> {
    return new NCTGraphiteDocument(this.id, this.snapshot, this.revision, this.revision, fileName, this.past, this.future);
  }

  /**
   * After a run of `recordUndo: false` edits (a paint stroke), keep one undo
   * step that restores `base` — the document from before the stroke.
   */
  recordingUndoFrom(base: NCTGraphiteDocument<Layer>): NCTGraphiteDocument<Layer> {
    if (base.id !== this.id) return this;
    const past = [...base.past, { snapshot: cloneSnapshot(base.snapshot), revision: base.revision }].slice(-UNDO_LIMIT);
    return new NCTGraphiteDocument(this.id, this.snapshot, this.revision, this.savedRevision, this.fileName, past, []);
  }

  undo(): NCTGraphiteDocument<Layer> {
    const previous = this.past.at(-1);
    if (!previous) return this;
    const past = this.past.slice(0, -1);
    const future = [...this.future, { snapshot: cloneSnapshot(this.snapshot), revision: this.revision }];
    return new NCTGraphiteDocument(this.id, cloneSnapshot(previous.snapshot), previous.revision, this.savedRevision, this.fileName, past, future);
  }

  redo(): NCTGraphiteDocument<Layer> {
    const next = this.future.at(-1);
    if (!next) return this;
    const future = this.future.slice(0, -1);
    const past = [...this.past, { snapshot: cloneSnapshot(this.snapshot), revision: this.revision }];
    return new NCTGraphiteDocument(this.id, cloneSnapshot(next.snapshot), next.revision, this.savedRevision, this.fileName, past, future);
  }

  private editing(snapshot: NCTGraphiteDocumentSnapshot<Layer>): NCTGraphiteDocument<Layer> {
    const past = [...this.past, { snapshot: cloneSnapshot(this.snapshot), revision: this.revision }].slice(-UNDO_LIMIT);
    return new NCTGraphiteDocument(this.id, snapshot, this.revision + 1, this.savedRevision, this.fileName, past, []);
  }

  private mutating(snapshot: NCTGraphiteDocumentSnapshot<Layer>): NCTGraphiteDocument<Layer> {
    return new NCTGraphiteDocument(this.id, snapshot, this.revision + 1, this.savedRevision, this.fileName, this.past, this.future);
  }
}

/** Analogous to NSDocumentController: the open-document list and current document. */
export class NCTGraphiteDocumentController<Layer extends NCTGraphiteLayerRecord = NCTGraphiteLayerRecord> {
  constructor(
    readonly documents: readonly NCTGraphiteDocument<Layer>[] = [],
    readonly currentId: string | null = documents[0]?.id ?? null,
  ) {}

  get current(): NCTGraphiteDocument<Layer> | null {
    return this.documents.find((document) => document.id === this.currentId) ?? null;
  }

  opening(document: NCTGraphiteDocument<Layer>, makeCurrent = true): NCTGraphiteDocumentController<Layer> {
    const documents = [...this.documents.filter((item) => item.id !== document.id), document];
    return new NCTGraphiteDocumentController(documents, makeCurrent ? document.id : this.currentId);
  }

  replacing(document: NCTGraphiteDocument<Layer>): NCTGraphiteDocumentController<Layer> {
    const documents = this.documents.map((item) => (item.id === document.id ? document : item));
    if (documents.every((item, index) => item === this.documents[index])) return this;
    return new NCTGraphiteDocumentController(documents, this.currentId);
  }

  closing(id: string): NCTGraphiteDocumentController<Layer> {
    const documents = this.documents.filter((document) => document.id !== id);
    const currentId = this.currentId === id ? (documents.at(-1)?.id ?? null) : this.currentId;
    return new NCTGraphiteDocumentController(documents, currentId);
  }

  makingCurrent(id: string | null): NCTGraphiteDocumentController<Layer> {
    if (id === this.currentId) return this;
    if (id && !this.documents.some((document) => document.id === id)) return this;
    return new NCTGraphiteDocumentController(this.documents, id);
  }
}
