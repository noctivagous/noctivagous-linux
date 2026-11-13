export const RECOVERY_STORAGE_KEY = 'nctgraphite-studio:recovery:v1';
export const STUDIO_UI_KEY = 'nctgraphite-studio:ui:v1';

export interface StudioUiPrefs {
  sections: Record<string, boolean>;
  previewWidth: number | null;
  zoom: number;
  showExport: boolean;
  geomTarget: 'base' | 'wide';
  snapEnabled: boolean;
  gridVisible: boolean;
  gridSize: number;
  studioTheme: 'graphite' | 'classic' | 'lab';
  aiOpen: boolean;
  workspace: { x: number; y: number };
  renderMode: 'app' | 'wireframe' | 'outline';
}

const STUDIO_UI_DEFAULTS: StudioUiPrefs = {
  sections: {},
  previewWidth: null,
  zoom: 100,
  showExport: false,
  geomTarget: 'base',
  snapEnabled: true,
  gridVisible: true,
  gridSize: 10,
  studioTheme: 'graphite',
  aiOpen: false,
  workspace: { x: 0, y: 0 },
  renderMode: 'app',
};

/** Studio chrome preferences (open panels, device, zoom, grid) restored on reload. */
export function loadStudioUi(): StudioUiPrefs {
  try {
    const raw = globalThis.localStorage?.getItem(STUDIO_UI_KEY);
    if (!raw) return { ...STUDIO_UI_DEFAULTS, sections: {} };
    const parsed = JSON.parse(raw) as Partial<StudioUiPrefs>;
    const num = (v: unknown, fallback: number, min: number, max: number) =>
      typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
    return {
      sections: parsed.sections && typeof parsed.sections === 'object' ? { ...parsed.sections } : {},
      previewWidth: typeof parsed.previewWidth === 'number' && Number.isFinite(parsed.previewWidth)
        ? Math.min(2560, Math.max(200, parsed.previewWidth))
        : null,
      zoom: num(parsed.zoom, 100, 25, 400),
      showExport: parsed.showExport === true,
      geomTarget: parsed.geomTarget === 'wide' ? 'wide' : 'base',
      snapEnabled: parsed.snapEnabled !== false,
      gridVisible: parsed.gridVisible !== false,
      gridSize: num(parsed.gridSize, 10, 2, 64),
      studioTheme: parsed.studioTheme === 'classic' || parsed.studioTheme === 'lab' ? parsed.studioTheme : 'graphite',
      aiOpen: parsed.aiOpen === true,
      renderMode: parsed.renderMode === 'wireframe' || parsed.renderMode === 'outline' ? parsed.renderMode : 'app',
      workspace: {
        x: typeof parsed.workspace?.x === 'number' && Number.isFinite(parsed.workspace.x)
          ? Math.min(2000, Math.max(-2000, parsed.workspace.x)) : 0,
        y: typeof parsed.workspace?.y === 'number' && Number.isFinite(parsed.workspace.y)
          ? Math.min(2000, Math.max(-2000, parsed.workspace.y)) : 0,
      },
    };
  } catch {
    return { ...STUDIO_UI_DEFAULTS, sections: {} };
  }
}

export const DEVICE_PRESETS = [
  { id: 'fluid', label: 'Fluid', width: null as number | null },
  { id: 'phone', label: 'Phone', width: 390 as number | null },
  { id: 'tablet', label: 'Tablet', width: 768 as number | null },
  { id: 'desktop', label: 'Desktop', width: 1280 as number | null },
];

export const GRID_DEFAULT_COLUMNS = 'repeat(2, minmax(0, 1fr))';
