import React from 'react';
import { NCTGraphiteStack } from '../components/NCTGraphiteStack.js';
import { NCTGraphiteGrid } from '../components/NCTGraphiteGrid.js';
import { NCTGraphiteOverlay } from '../components/NCTGraphiteOverlay.js';
import { NCTGraphiteAccordion } from '../components/NCTGraphiteAccordion.js';
import { NCTGraphiteColumns } from '../components/NCTGraphiteColumns.js';
import { NCTGraphiteScene, NCTGraphiteSceneItem } from '../components/NCTGraphiteScene.js';
import { NCTGraphiteLayoutItem } from '../components/NCTGraphiteLayoutItem.js';
import { NCTGraphiteButton } from '../components/NCTGraphiteButton.js';
import { NCTGraphiteField } from '../components/NCTGraphiteField.js';
import { NCTGraphiteTextArea } from '../components/NCTGraphiteTextArea.js';
import { NCTGraphiteCheckbox } from '../components/NCTGraphiteCheckbox.js';
import { NCTGraphiteTabs, type NCTGraphiteTabOption } from '../components/NCTGraphiteTabs.js';
import { NCTGraphiteList, type NCTGraphiteListOption } from '../components/NCTGraphiteList.js';
import { NCTGraphiteImageWell } from '../components/NCTGraphiteImageWell.js';
import { NCTGraphiteSeparator } from '../components/NCTGraphiteSeparator.js';
import { NCTGraphiteProgress } from '../components/NCTGraphiteProgress.js';
import { NCTGraphiteKnob } from '../components/NCTGraphiteKnob.js';
import { NCTGraphiteFader } from '../components/NCTGraphiteFader.js';
import { NCTGraphiteDualRange } from '../components/NCTGraphiteDualRange.js';
import { NCTGraphiteMeter } from '../components/NCTGraphiteMeter.js';
import { NCTGraphiteValueDisplay } from '../components/NCTGraphiteValueDisplay.js';
import { NCTGraphiteSlider } from '../components/NCTGraphiteSlider.js';
import { NCTGraphiteToggle } from '../components/NCTGraphiteToggle.js';
import { NCTGraphiteSegmented } from '../components/NCTGraphiteSegmented.js';
import { NCTGraphitePanel } from '../components/NCTGraphitePanel.js';
import { NCTGraphiteToolbar } from '../components/NCTGraphiteToolbar.js';
import { NCTGraphiteWindow } from '../components/NCTGraphiteWindow.js';
import type { LayoutNode, SavedLayoutModule } from './NCTGraphiteLayoutDocument.js';

/** Parse a document `options` prop ("One, Two, Three") into labeled options.
 * Returns null when the prop is absent so callers can use their own default.
 */
export function parseNCTOptionList(raw: unknown): { value: string; label: string }[] | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const items = raw.split(',').map((s) => s.trim()).filter((s) => s !== '');
  if (items.length === 0) return null;
  return items.map((item) => {
    const sep = item.indexOf(':');
    if (sep < 0) return { value: item, label: item };
    return { value: item.slice(0, sep).trim() || item, label: item.slice(sep + 1).trim() || item };
  });
}

const DEFAULT_OPTIONS: { value: string; label: string }[] = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two' },
  { value: 'three', label: 'Three' },
];

const noop = (): void => {};

/** Scene overrides follow the same viewport breakpoint as grid overrides. */
function ResponsiveSceneItem({ node, children }: { node: LayoutNode; children: React.ReactNode }) {
  const [wide, setWide] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 768px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const overrides: Record<string, string | number> = {};
  if (wide) {
    for (const key of ['left', 'top', 'right', 'bottom', 'width', 'height'] as const) {
      const value = node.wide?.[key];
      if (typeof value === 'string' || typeof value === 'number') overrides[key] = value;
    }
    if (typeof node.wide?.zIndex === 'number') overrides.zIndex = node.wide.zIndex;
  }
  return <NCTGraphiteSceneItem {...node.props} {...overrides}>{children}</NCTGraphiteSceneItem>;
}

/** React renderer for the shared layout-tree document. */
export function NCTGraphiteLayoutView({
  node, modules, seen = new Set<string>(),
}: {
  node: LayoutNode;
  modules: SavedLayoutModule[];
  seen?: Set<string>;
}): React.ReactElement {
  if (node.props.hidden === true) return <></>;
  const children = node.children.map((child) => (
    <NCTGraphiteLayoutView key={child.id} node={child} modules={modules} seen={seen} />
  ));
  const wide = node.wide ?? {};
  switch (node.kind) {
    case 'stack':
      return <NCTGraphiteStack {...node.props}>{children}</NCTGraphiteStack>;
    case 'row':
      return <NCTGraphiteStack direction="row" {...node.props}>{children}</NCTGraphiteStack>;
    case 'grid':
      return (
        <NCTGraphiteGrid
          {...node.props}
          columns={(node.props.columns as string) ?? 'repeat(2, minmax(0, 1fr))'}
          wideMinWidth={768}
          wideColumns={wide.columns as string | undefined}
        >
          {children}
        </NCTGraphiteGrid>
      );
    case 'overlay':
      return <NCTGraphiteOverlay {...node.props}>{children}</NCTGraphiteOverlay>;
    case 'accordion':
      return <NCTGraphiteAccordion title={node.label} defaultOpen {...node.props}>{children}</NCTGraphiteAccordion>;
    case 'columns':
      return <NCTGraphiteColumns {...node.props}>{children}</NCTGraphiteColumns>;
    case 'scene':
      return <NCTGraphiteScene {...node.props}>{children}</NCTGraphiteScene>;
    case 'sceneItem':
      return <ResponsiveSceneItem node={node}>{children}</ResponsiveSceneItem>;
    case 'layoutItem':
      return <NCTGraphiteLayoutItem {...node.props}>{children}</NCTGraphiteLayoutItem>;
    case 'text':
      return <span className="preview-text">{node.label}</span>;
    case 'button':
      return <NCTGraphiteButton label={node.label} {...node.props} />;
    case 'field':
      return <NCTGraphiteField {...node.props} label={node.label} onChange={noop} />;
    case 'textArea':
      return <NCTGraphiteTextArea {...node.props} label={node.label} onChange={noop} />;
    case 'checkbox':
      return <NCTGraphiteCheckbox {...node.props} label={node.label} onChange={noop} />;
    case 'tabs': {
      const options: NCTGraphiteTabOption[] = parseNCTOptionList(node.props.options) ?? DEFAULT_OPTIONS;
      return <NCTGraphiteTabs {...node.props} options={options} onChange={noop} />;
    }
    case 'list': {
      const options: NCTGraphiteListOption[] = parseNCTOptionList(node.props.options) ?? DEFAULT_OPTIONS;
      return <NCTGraphiteList {...node.props} options={options} onChange={noop} />;
    }
    case 'imageWell':
      return <NCTGraphiteImageWell {...node.props} label={node.label} onBrowse={noop} />;
    case 'separator':
      return <NCTGraphiteSeparator {...node.props} />;
    case 'progress': {
      const { value, max, ...rest } = node.props;
      return <NCTGraphiteProgress {...rest} value={Number(value ?? 0)} max={Number(max ?? 100)} />;
    }
    case 'knob': {
      const { value, min, max, ...rest } = node.props;
      return <NCTGraphiteKnob {...rest} label={node.label} value={Number(value ?? 50)} min={Number(min ?? 0)} max={Number(max ?? 100)} onChange={noop} />;
    }
    case 'fader': {
      const { value, min, max, ...rest } = node.props;
      return <NCTGraphiteFader {...rest} label={node.label} value={Number(value ?? 50)} min={Number(min ?? 0)} max={Number(max ?? 100)} onChange={noop} />;
    }
    case 'dualRange': {
      const { min, max, ...rest } = node.props;
      return <NCTGraphiteDualRange {...rest} label={node.label} min={Number(min ?? 0)} max={Number(max ?? 100)} onChange={noop} />;
    }
    case 'meter': {
      const { value, min, max, ...rest } = node.props;
      return <NCTGraphiteMeter {...rest} label={node.label} value={Number(value ?? 0)} min={Number(min ?? 0)} max={Number(max ?? 100)} />;
    }
    case 'valueDisplay': {
      const { value, ...rest } = node.props;
      return <NCTGraphiteValueDisplay {...rest} label={node.label} value={(value as string | number) ?? ''} />;
    }
    case 'slider': {
      const { value, min, max, step, ...rest } = node.props;
      return <NCTGraphiteSlider {...rest} label={node.label} value={Number(value ?? 50)} min={Number(min ?? 0)} max={Number(max ?? 100)} step={Number(step ?? 1)} onChange={noop} />;
    }
    case 'toggle': {
      const { checked, ...rest } = node.props;
      return <NCTGraphiteToggle {...rest} label={node.label} checked={Boolean(checked ?? false)} onChange={noop} />;
    }
    case 'segmented': {
      const options = parseNCTOptionList(node.props.options) ?? DEFAULT_OPTIONS;
      const { value, ...rest } = node.props;
      return <NCTGraphiteSegmented {...rest} label={node.label} options={options} value={String(value ?? options[0].value)} onChange={noop} />;
    }
    case 'panel':
      return <NCTGraphitePanel {...node.props} title={node.label}>{children}</NCTGraphitePanel>;
    case 'toolbar':
      return <NCTGraphiteToolbar {...node.props}>{children}</NCTGraphiteToolbar>;
    case 'window':
      return <NCTGraphiteWindow title={node.label} {...node.props}>{children}</NCTGraphiteWindow>;
    case 'iconButton':
      return <NCTGraphiteButton label={node.label} {...node.props} />;
    case 'module': {
      const def = modules.find((m) => m.id === node.moduleId);
      if (!def || seen.has(def.id)) return <span className="preview-text">{node.label}</span>;
      return <NCTGraphiteLayoutView node={def.root} modules={modules} seen={new Set(seen).add(def.id)} />;
    }
  }
}
