/** Versioned `*.nctgraphite.xml` codec for the shared layout-tree document.
 * Hand-rolled restricted-subset codec (no DOM dependency): tags map 1:1 to
 * layout kinds with full `NCTGraphite…` names; props are string/number/boolean
 * attributes; `wide-*` attributes hold wide-breakpoint overrides.
 */
import {
  NCTGRAPHITE_LAYOUT_KIND,
  NCTGRAPHITE_LAYOUT_VERSION,
  layoutContainers,
  validLayoutDocument,
  type LayoutDocument,
  type LayoutKind,
  type LayoutNode,
  type LayoutPropValue,
  type SavedLayoutModule,
} from './NCTGraphiteLayoutDocument.js';

export const LAYOUT_XML_ROOT = 'NCTGraphiteLayout';

const KIND_TO_TAG: Record<LayoutKind, string> = {
  stack: 'NCTGraphiteStack',
  row: 'NCTGraphiteStack',
  grid: 'NCTGraphiteGrid',
  overlay: 'NCTGraphiteOverlay',
  accordion: 'NCTGraphiteAccordion',
  columns: 'NCTGraphiteColumns',
  scene: 'NCTGraphiteScene',
  sceneItem: 'NCTGraphiteSceneItem',
  layoutItem: 'NCTGraphiteLayoutItem',
  text: 'NCTGraphiteText',
  button: 'NCTGraphiteButton',
  module: 'NCTGraphiteModuleInstance',
  field: 'NCTGraphiteField',
  textArea: 'NCTGraphiteTextArea',
  checkbox: 'NCTGraphiteCheckbox',
  tabs: 'NCTGraphiteTabs',
  list: 'NCTGraphiteList',
  imageWell: 'NCTGraphiteImageWell',
  separator: 'NCTGraphiteSeparator',
  progress: 'NCTGraphiteProgress',
  knob: 'NCTGraphiteKnob',
  fader: 'NCTGraphiteFader',
  dualRange: 'NCTGraphiteDualRange',
  meter: 'NCTGraphiteMeter',
  valueDisplay: 'NCTGraphiteValueDisplay',
  slider: 'NCTGraphiteSlider',
  toggle: 'NCTGraphiteToggle',
  segmented: 'NCTGraphiteSegmented',
  panel: 'NCTGraphitePanel',
  toolbar: 'NCTGraphiteToolbar',
  window: 'NCTGraphiteWindow',
  iconButton: 'NCTGraphiteButton',
};

const TAG_TO_KIND: Record<string, LayoutKind> = {
  NCTGraphiteStack: 'stack',
  NCTGraphiteGrid: 'grid',
  NCTGraphiteOverlay: 'overlay',
  NCTGraphiteAccordion: 'accordion',
  NCTGraphiteColumns: 'columns',
  NCTGraphiteScene: 'scene',
  NCTGraphiteSceneItem: 'sceneItem',
  NCTGraphiteLayoutItem: 'layoutItem',
  NCTGraphiteText: 'text',
  NCTGraphiteButton: 'button',
  NCTGraphiteModuleInstance: 'module',
  NCTGraphiteField: 'field',
  NCTGraphiteTextArea: 'textArea',
  NCTGraphiteCheckbox: 'checkbox',
  NCTGraphiteTabs: 'tabs',
  NCTGraphiteList: 'list',
  NCTGraphiteImageWell: 'imageWell',
  NCTGraphiteSeparator: 'separator',
  NCTGraphiteProgress: 'progress',
  NCTGraphiteKnob: 'knob',
  NCTGraphiteFader: 'fader',
  NCTGraphiteDualRange: 'dualRange',
  NCTGraphiteMeter: 'meter',
  NCTGraphiteValueDisplay: 'valueDisplay',
  NCTGraphiteSlider: 'slider',
  NCTGraphiteToggle: 'toggle',
  NCTGraphiteSegmented: 'segmented',
  NCTGraphitePanel: 'panel',
  NCTGraphiteToolbar: 'toolbar',
  NCTGraphiteWindow: 'window',
};

export function layoutTagFor(node: LayoutNode): string {
  return KIND_TO_TAG[node.kind];
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function unescapeAttr(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}

function propToAttr(value: LayoutPropValue): string {
  return escapeAttr(String(value));
}

function coerceProp(raw: string): LayoutPropValue {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return unescapeAttr(raw);
}

function nodeToXml(node: LayoutNode, indent: string): string {
  const tag = layoutTagFor(node);
  let attrs = ` id="${escapeAttr(node.id)}" label="${escapeAttr(node.label)}"`;
  if (node.kind === 'row') attrs += ' direction="row"';
  if (node.kind === 'iconButton') attrs += ' iconButton="true"';
  if (node.kind === 'module' && node.moduleId) attrs += ` moduleId="${escapeAttr(node.moduleId)}"`;
  for (const [k, v] of Object.entries(node.props)) {
    if (node.kind === 'row' && k === 'direction') continue;
    attrs += ` ${k}="${propToAttr(v)}"`;
  }
  for (const [k, v] of Object.entries(node.wide ?? {})) attrs += ` wide-${k}="${propToAttr(v)}"`;
  if (node.children.length === 0) return `${indent}<${tag}${attrs}/>`;
  const kids = node.children.map((c) => nodeToXml(c, `${indent}  `)).join('\n');
  return `${indent}<${tag}${attrs}>\n${kids}\n${indent}</${tag}>`;
}

export function serializeLayoutDocument(doc: LayoutDocument): string {
  const mods = doc.modules
    .map((m) => `  <NCTGraphiteModuleDefinition id="${escapeAttr(m.id)}" name="${escapeAttr(m.name)}">\n${nodeToXml(m.root, '    ')}\n  </NCTGraphiteModuleDefinition>`)
    .join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<${LAYOUT_XML_ROOT} kind="${NCTGRAPHITE_LAYOUT_KIND}" version="${NCTGRAPHITE_LAYOUT_VERSION}" name="${escapeAttr(doc.name)}" density="${doc.density}" theme="${doc.theme ?? 'light'}">`,
    '  <Modules>',
    mods,
    '  </Modules>',
    '  <Root>',
    nodeToXml(doc.root, '    '),
    '  </Root>',
    `</${LAYOUT_XML_ROOT}>`,
    '',
  ].join('\n');
}

interface XmlElement {
  tag: string;
  attrs: Record<string, string>;
  children: XmlElement[];
}

function parseAttributes(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) attrs[m[1]] = m[2];
  return attrs;
}

function parseElements(xml: string): XmlElement {
  const root: XmlElement = { tag: '', attrs: {}, children: [] };
  const stack: XmlElement[] = [root];
  const re = /<(\/?)([A-Za-z][\w.]*)([^>]*?)(\/?)>|<\?[^?]*\?>|<!--[\s\S]*?-->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<?') || m[0].startsWith('<!--')) continue;
    const [full, close, tag, attrSource, selfClose] = m;
    void full;
    if (close) {
      if (stack.length <= 1 || stack[stack.length - 1].tag !== tag) throw new SyntaxError(`Mismatched closing tag: ${tag}`);
      stack.pop();
    } else {
      const el: XmlElement = { tag, attrs: parseAttributes(attrSource), children: [] };
      stack[stack.length - 1].children.push(el);
      if (!selfClose) stack.push(el);
    }
  }
  if (stack.length !== 1) throw new SyntaxError('Unclosed element in layout XML');
  if (root.children.length !== 1) throw new SyntaxError('Layout XML must contain exactly one root element');
  return root.children[0];
}

function elementToNode(el: XmlElement): LayoutNode {
  let kind = TAG_TO_KIND[el.tag];
  if (!kind) throw new TypeError(`Unknown layout tag: ${el.tag}`);
  const { id, label, moduleId, direction, iconButton, ...rest } = el.attrs;
  if (!id) throw new TypeError(`Layout node <${el.tag}> is missing id`);
  const props: Record<string, LayoutPropValue> = {};
  const wide: Record<string, LayoutPropValue> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k === 'version' || k === 'kind' || k === 'name' || k === 'density') continue;
    if (k.startsWith('wide-')) wide[k.slice(5)] = coerceProp(v);
    else props[k] = coerceProp(v);
  }
  if (kind === 'stack' && direction === 'row') {
    kind = 'row';
  } else if (direction !== undefined && kind !== 'stack') {
    throw new TypeError(`Unexpected direction on <${el.tag}>`);
  }
  if (kind === 'button' && iconButton === 'true') kind = 'iconButton';
  if (kind === 'row') delete props.direction;
  const node: LayoutNode = {
    id: unescapeAttr(id),
    kind,
    label: unescapeAttr(label ?? ''),
    props,
    children: el.children
      .filter((c) => c.tag !== 'Modules' && c.tag !== 'Root')
      .map((c) => {
        if (c.tag === 'NCTGraphiteModuleDefinition') throw new TypeError('Module definition nested inside a node');
        return elementToNode(c);
      }),
  };
  if (Object.keys(wide).length > 0) node.wide = wide;
  if (moduleId) node.moduleId = unescapeAttr(moduleId);
  return node;
}

export function parseLayoutDocument(xml: string): LayoutDocument {
  const root = parseElements(xml);
  if (root.tag !== LAYOUT_XML_ROOT) throw new TypeError(`Not a layout document: <${root.tag}>`);
  const version = Number(root.attrs.version ?? 'NaN');
  if (!Number.isFinite(version)) throw new TypeError('Layout document is missing version');
  if (version > NCTGRAPHITE_LAYOUT_VERSION) {
    throw new RangeError(`Layout version ${version} is newer than this library`);
  }
  const modulesEl = root.children.find((c) => c.tag === 'Modules');
  const rootEl = root.children.find((c) => c.tag === 'Root');
  if (!rootEl || rootEl.children.length !== 1) throw new TypeError('Layout document <Root> must contain exactly one node');
  const modules: SavedLayoutModule[] = (modulesEl?.children ?? []).map((def) => {
    if (def.tag !== 'NCTGraphiteModuleDefinition') throw new TypeError(`Unexpected element in <Modules>: <${def.tag}>`);
    if (!def.attrs.id || def.children.length !== 1) throw new TypeError('Module definition needs id and exactly one root node');
    return { id: unescapeAttr(def.attrs.id), name: unescapeAttr(def.attrs.name ?? ''), root: elementToNode(def.children[0]) };
  });
  const doc: LayoutDocument = {
    name: unescapeAttr(root.attrs.name ?? 'Untitled'),
    density: root.attrs.density === 'comfortable' ? 'comfortable' : 'compact',
    theme: root.attrs.theme === 'dark' || root.attrs.theme === 'lab' ? root.attrs.theme : 'light',
    root: elementToNode(rootEl.children[0]),
    modules,
  };
  if (!layoutContainers.includes(doc.root.kind)) throw new TypeError('Layout root must be a container');
  if (!validLayoutDocument(doc)) throw new TypeError('Invalid layout document');
  return doc;
}
