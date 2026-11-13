/** Component catalog generated from library `NCTGraphite*Meta` objects.
 * The Studio palette and inspector are driven by this catalog — no hardcoded
 * component list.
 */
import type { NCTGraphiteComponentMeta } from '../components/NCTGraphiteMeta.js';
import { NCTGraphiteStackMeta } from '../components/NCTGraphiteStack.js';
import { NCTGraphiteGridMeta } from '../components/NCTGraphiteGrid.js';
import { NCTGraphiteOverlayMeta } from '../components/NCTGraphiteOverlay.js';
import { NCTGraphiteAccordionMeta } from '../components/NCTGraphiteAccordion.js';
import { NCTGraphiteColumnsMeta } from '../components/NCTGraphiteColumns.js';
import { NCTGraphiteSceneMeta, NCTGraphiteSceneItemMeta } from '../components/NCTGraphiteScene.js';
import { NCTGraphiteLayoutItemMeta } from '../components/NCTGraphiteLayoutItem.js';
import { NCTGraphiteButtonMeta } from '../components/NCTGraphiteButton.js';
import { NCTGraphiteFieldMeta } from '../components/NCTGraphiteField.js';
import { NCTGraphiteTextAreaMeta } from '../components/NCTGraphiteTextArea.js';
import { NCTGraphiteCheckboxMeta } from '../components/NCTGraphiteCheckbox.js';
import { NCTGraphiteTabsMeta } from '../components/NCTGraphiteTabs.js';
import { NCTGraphiteListMeta } from '../components/NCTGraphiteList.js';
import { NCTGraphiteImageWellMeta } from '../components/NCTGraphiteImageWell.js';
import { NCTGraphiteSeparatorMeta } from '../components/NCTGraphiteSeparator.js';
import { NCTGraphiteProgressMeta } from '../components/NCTGraphiteProgress.js';
import { NCTGraphiteKnobMeta } from '../components/NCTGraphiteKnob.js';
import { NCTGraphiteFaderMeta } from '../components/NCTGraphiteFader.js';
import { NCTGraphiteDualRangeMeta } from '../components/NCTGraphiteDualRange.js';
import { NCTGraphiteMeterMeta } from '../components/NCTGraphiteMeter.js';
import { NCTGraphiteValueDisplayMeta } from '../components/NCTGraphiteValueDisplay.js';
import { NCTGraphiteSliderMeta } from '../components/NCTGraphiteSlider.js';
import { NCTGraphiteToggleMeta } from '../components/NCTGraphiteToggle.js';
import { NCTGraphiteSegmentedMeta } from '../components/NCTGraphiteSegmented.js';
import { NCTGraphitePanelMeta } from '../components/NCTGraphitePanel.js';
import { NCTGraphiteToolbarMeta } from '../components/NCTGraphiteToolbar.js';
import { NCTGraphiteWindowMeta } from '../components/NCTGraphiteWindow.js';
import type { LayoutKind } from './NCTGraphiteLayoutDocument.js';

export interface LayoutCatalogEntry {
  kind: LayoutKind;
  tag: string;
  category: string;
  description: string;
  meta: NCTGraphiteComponentMeta;
}

const META_BY_KIND: { kind: LayoutKind; meta: NCTGraphiteComponentMeta }[] = [
  { kind: 'stack', meta: NCTGraphiteStackMeta },
  { kind: 'row', meta: NCTGraphiteStackMeta },
  { kind: 'grid', meta: NCTGraphiteGridMeta },
  { kind: 'overlay', meta: NCTGraphiteOverlayMeta },
  { kind: 'accordion', meta: NCTGraphiteAccordionMeta },
  { kind: 'columns', meta: NCTGraphiteColumnsMeta },
  { kind: 'scene', meta: NCTGraphiteSceneMeta },
  { kind: 'sceneItem', meta: NCTGraphiteSceneItemMeta },
  { kind: 'layoutItem', meta: NCTGraphiteLayoutItemMeta },
  { kind: 'button', meta: NCTGraphiteButtonMeta },
  { kind: 'field', meta: NCTGraphiteFieldMeta },
  { kind: 'textArea', meta: NCTGraphiteTextAreaMeta },
  { kind: 'checkbox', meta: NCTGraphiteCheckboxMeta },
  { kind: 'tabs', meta: NCTGraphiteTabsMeta },
  { kind: 'list', meta: NCTGraphiteListMeta },
  { kind: 'imageWell', meta: NCTGraphiteImageWellMeta },
  { kind: 'separator', meta: NCTGraphiteSeparatorMeta },
  { kind: 'progress', meta: NCTGraphiteProgressMeta },
  { kind: 'knob', meta: NCTGraphiteKnobMeta },
  { kind: 'fader', meta: NCTGraphiteFaderMeta },
  { kind: 'dualRange', meta: NCTGraphiteDualRangeMeta },
  { kind: 'meter', meta: NCTGraphiteMeterMeta },
  { kind: 'valueDisplay', meta: NCTGraphiteValueDisplayMeta },
  { kind: 'slider', meta: NCTGraphiteSliderMeta },
  { kind: 'toggle', meta: NCTGraphiteToggleMeta },
  { kind: 'segmented', meta: NCTGraphiteSegmentedMeta },
  { kind: 'panel', meta: NCTGraphitePanelMeta },
  { kind: 'toolbar', meta: NCTGraphiteToolbarMeta },
  { kind: 'window', meta: NCTGraphiteWindowMeta },
  { kind: 'iconButton', meta: NCTGraphiteButtonMeta },
  {
    kind: 'text',
    meta: {
      tag: 'NCTGraphiteText', category: 'content', description: 'Plain text run',
      props: { label: { type: 'string', required: true, description: 'Text content' } },
      emits: [], dependencies: [],
    },
  },
  {
    kind: 'module',
    meta: {
      tag: 'NCTGraphiteModuleInstance', category: 'modules', description: 'Live instance of a saved module',
      props: {},
      emits: [], dependencies: [],
    },
  },
];

const CATEGORY_ORDER = ['layout', 'content', 'widgets', 'modules'];

export function buildLayoutCatalog(): LayoutCatalogEntry[] {
  const entries = META_BY_KIND.map(({ kind, meta }) => ({
    kind,
    tag: kind === 'row' ? 'NCTGraphiteStack' : meta.tag,
    category: meta.category === 'widgets' ? 'content' : meta.category,
    description: kind === 'row' ? 'Horizontal stack (Stack with direction row)' : meta.description,
    meta,
  }));
  return entries.sort((a, b) => {
    const order = (c: string): number => {
      const i = CATEGORY_ORDER.indexOf(c);
      return i < 0 ? 99 : i;
    };
    return order(a.category) - order(b.category) || a.kind.localeCompare(b.kind);
  });
}

/** Editable prop names for a kind: structural props minus children/handlers. */
export function editablePropsFor(kind: LayoutKind): string[] {
  const entry = META_BY_KIND.find((e) => e.kind === kind);
  if (!entry) return [];
  return Object.entries(entry.meta.props)
    .filter(([name, p]) => {
      if (name === 'children' || name === 'icon') return false;
      const types = Array.isArray(p.type) ? p.type : [p.type];
      if (types.includes('function') || types.includes('node')) return false;
      return true;
    })
    .map(([name]) => name);
}
