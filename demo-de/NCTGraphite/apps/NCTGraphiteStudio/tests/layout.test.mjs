import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { NCTGraphiteStack, NCTGraphiteGrid, NCTGraphiteOverlay, NCTGraphiteAccordion, NCTGraphiteToolbar, NCTGraphiteScene, NCTGraphiteSceneItem, NCTGraphiteLayoutItem, NCTGraphiteColumns, NCTGraphiteLayoutShell, NCTGraphiteBaseline, NCTGraphitePanel, NCTGraphiteSplitter, NCTGraphiteAppShell, shiftPaneSizes, NCTGraphiteColumnGuides } = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');
const render = (component, props, ...children) => renderToStaticMarkup(React.createElement(component, props, ...children));

test('stack composes a wrapping row with baseline alignment', () => {
  const html = render(NCTGraphiteStack, { direction: 'row', align: 'baseline', wrap: true, gap: 8 }, 'A', 'B');
  assert.match(html, /flex-direction:row/); assert.match(html, /align-items:baseline/); assert.match(html, /flex-wrap:wrap/); assert.match(html, /gap:8px/);
});
test('grid preserves explicit tracks and gap', () => {
  const html = render(NCTGraphiteGrid, { columns: '12rem minmax(0, 1fr)', gap: 'var(--gap)' }, 'A');
  assert.match(html, /grid-template-columns:12rem minmax\(0, 1fr\)/); assert.match(html, /gap:var\(--gap\)/);
});
test('stack supports inner spacing and wrapped-line distribution', () => {
  const html = render(NCTGraphiteStack, { direction: 'row', wrap: true, alignContent: 'between', padding: 12 }, 'A', 'B');
  assert.match(html, /flex-wrap:wrap/); assert.match(html, /align-content:space-between/); assert.match(html, /padding:12px/);
});
test('stack passes through CSS padding values', () => {
  const html = render(NCTGraphiteStack, { padding: 'var(--preview-gap)' }, 'A');
  assert.match(html, /padding:var\(--preview-gap\)/);
});
test('grid distributes tracks and pads its content box', () => {
  const html = render(NCTGraphiteGrid, { columns: 'repeat(2, 1fr)', alignContent: 'center', justifyContent: 'space-between', padding: 'var(--gap)' }, 'A');
  assert.match(html, /align-content:center/); assert.match(html, /justify-content:space-between/); assert.match(html, /padding:var\(--gap\)/);
});
test('grid sizes implicit tracks and honors template shorthand', () => {
  const implicit = render(NCTGraphiteGrid, { columns: '1fr', autoFlow: 'row dense', autoRows: 'minmax(2rem, auto)', autoColumns: '8rem' }, 'A');
  assert.match(implicit, /grid-auto-flow:row dense/); assert.match(implicit, /grid-auto-rows:minmax\(2rem, auto\)/); assert.match(implicit, /grid-auto-columns:8rem/);
  const shorthand = render(NCTGraphiteGrid, { template: 'auto 1fr / 12rem 1fr' }, 'A');
  assert.match(shorthand, /grid-template:auto 1fr \/ 12rem 1fr/);
});
test('overlay layers children in order without absolute positioning', () => {
  const html = render(NCTGraphiteOverlay, { align: 'center' }, React.createElement('span', { key: 'a' }, 'First'), React.createElement('span', { key: 'b' }, 'Second'));
  assert.equal((html.match(/grid-area:1 \/ 1/g) || []).length, 2); assert.ok(html.indexOf('First') < html.indexOf('Second')); assert.doesNotMatch(html, /position:absolute/);
});
test('accordion and toolbar expose native disclosure and orientation semantics', () => {
  assert.match(render(NCTGraphiteAccordion, { title: 'Section', defaultOpen: true }, 'Content'), /<details[^>]*open=""/);
  assert.match(render(NCTGraphiteToolbar, { orientation: 'vertical' }, 'Action'), /role="toolbar" aria-orientation="vertical"/);
});

test('scene provides a coordinate space and pinned item with explicit size', () => {
  const item = React.createElement(NCTGraphiteSceneItem, { left: 12, top: 4, right: 12, height: 40 }, 'Positioned');
  const html = render(NCTGraphiteScene, { width: 400, height: 200, overflow: 'hidden' }, item);
  assert.match(html, /position:relative;width:400px;height:200px;overflow:hidden/);
  assert.match(html, /position:absolute;left:12px;top:4px;right:12px;height:40px/);
});
test('layout item supplies flex sizing and grid placement', () => {
  const html = render(NCTGraphiteLayoutItem, { grow: 1, basis: '12rem', column: '2 / span 2', row: '1' }, 'Content');
  assert.match(html, /flex-grow:1/); assert.match(html, /flex-basis:12rem/);
  assert.match(html, /grid-column:2 \/ span 2/); assert.match(html, /grid-row:1/);
});
test('columns flow content in reading order', () => {
  const html = render(NCTGraphiteColumns, { count: 3, width: '12rem', gap: 16 }, 'Text');
  assert.match(html, /column-count:3/); assert.match(html, /column-width:12rem/); assert.match(html, /column-gap:16px/);
});

test('layout shell composes header, body regions and footer in reading order', () => {
  const html = render(NCTGraphiteLayoutShell, { header: React.createElement('header', null, 'Header'), footer: React.createElement('footer', null, 'Footer'), columns: '1fr' }, React.createElement('main', null, 'Main'));
  assert.ok(html.indexOf('Header') < html.indexOf('Main')); assert.ok(html.indexOf('Main') < html.indexOf('Footer'));
  assert.match(html, /grid-template-columns:1fr/);
});
test('grid breakpoints render the base tracks on the server', () => {
  const html = render(NCTGraphiteGrid, { columns: '1fr', breakpoints: [{ minWidth: 800, columns: '1fr 1fr' }, { minWidth: 1200, columns: '1fr 1fr 1fr' }] }, 'A');
  assert.match(html, /grid-template-columns:1fr/);
});
test('baseline paints rules on the line rhythm', () => {
  const html = render(NCTGraphiteBaseline, { line: 8, color: 'red' });
  assert.match(html, /repeating-linear-gradient\(to bottom, red 0, red 1px, transparent 1px, transparent 8px\)/);
  assert.match(html, /aria-hidden="true"/);
});
test('baseline accepts CSS rhythm units and offsets', () => {
  const html = render(NCTGraphiteBaseline, { line: 'var(--rhythm)', offset: 2 });
  assert.match(html, /transparent var\(--rhythm\)/); assert.match(html, /background-position-y:2px/);
});
test('accordion honors controlled open state', () => {
  assert.match(render(NCTGraphiteAccordion, { title: 'C', open: true }, 'Body'), /<details[^>]*open=""/);
  assert.doesNotMatch(render(NCTGraphiteAccordion, { title: 'C', open: false }, 'Body'), /open=""/);
});
test('panel variants resolve through theme tokens', () => {
  const raised = render(NCTGraphitePanel, { title: 'T' }, 'Body');
  assert.match(raised, /var\(--nct-panel-bg/);
  const well = render(NCTGraphitePanel, { variant: 'well' }, 'Body');
  assert.match(well, /var\(--nct-well-bg/); assert.match(well, /inset 0 1px 3px/);
});
test('splitter sizes panes and exposes separator semantics', () => {
  const html = render(NCTGraphiteSplitter, { sizes: [0.25, 0.75] }, 'A', 'B');
  assert.match(html, /flex:0 0 25%/); assert.match(html, /flex:0 0 75%/);
  assert.equal((html.match(/role="separator"/g) || []).length, 1);
  assert.match(html, /aria-orientation="vertical"/); assert.match(html, /tabindex="0"/i);
});
test('splitter stacks vertically with a default even split', () => {
  const html = render(NCTGraphiteSplitter, { direction: 'column' }, 'A', 'B', 'C');
  assert.match(html, /flex-direction:column/);
  assert.equal((html.match(/flex:0 0 33\.333/g) || []).length, 3);
  assert.match(html, /aria-orientation="horizontal"/);
});
test('density sheet defines the compact/comfortable contract without colors or fonts', () => {
  const css = readFileSync(new URL('../../../packages/nctgraphite/src/theme/NCTGraphiteDensity.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-nct-density='comfortable'\]/);
  for (const token of ['--nct-content-gap', '--nct-content-padding', '--nct-panel-padding', '--nct-panel-radius']) {
    assert.ok(css.includes(token), `missing ${token}`);
  }
  assert.doesNotMatch(css, /#[0-9a-f]{3,6}/i); assert.doesNotMatch(css, /font-family/);
});
test('splitter resize conserves space and respects the minimum', () => {
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ~= ${expected}`);
  const grown = shiftPaneSizes([0.25, 0.75], 0, 0.1, 0.1);
  close(grown[0], 0.35); close(grown[1], 0.65);
  const floored = shiftPaneSizes([0.25, 0.75], 0, -0.2, 0.1);
  close(floored[0], 0.1); close(floored[1], 0.9);
  const capped = shiftPaneSizes([0.5, 0.5], 0, 0.9, 0.1);
  close(capped[0], 0.9); close(capped[1], 0.1);
  const total = shiftPaneSizes([0.2, 0.3, 0.5], 1, 0.05, 0.1).reduce((a, b) => a + b, 0);
  close(total, 1);
});
test('column guides mirror the content grid without affecting layout', () => {
  const html = render(NCTGraphiteColumnGuides, { columns: 'repeat(6, 1fr)', gap: 24, count: 6, columnColor: 'blue', gutterColor: 'red' });
  assert.match(html, /grid-template-columns:repeat\(6, 1fr\)/); assert.match(html, /gap:24px/);
  assert.match(html, /background:red/); assert.match(html, /aria-hidden="true"/);
  assert.equal((html.match(/background:blue/g) || []).length, 6);
  assert.doesNotMatch(html, /position:absolute/);
});
test('print recipe layers content, column guides, and baseline in order', () => {
  const html = render(NCTGraphiteOverlay, { align: 'stretch' },
    React.createElement(NCTGraphiteGrid, { key: 'c', columns: 'repeat(6, 1fr)', gap: 24 }, 'Text'),
    React.createElement(NCTGraphiteColumnGuides, { key: 'g', columns: 'repeat(6, 1fr)', gap: 24, count: 6 }),
    React.createElement(NCTGraphiteBaseline, { key: 'b', line: 16 }));
  assert.ok(html.indexOf('Text') < html.indexOf('repeating-linear-gradient'));
  assert.equal((html.match(/grid-area:1 \/ 1/g) || []).length, 3);
});
test('layout shell forwards breakpoints to its body grid', () => {
  const html = render(NCTGraphiteLayoutShell, { columns: '1fr', breakpoints: [{ minWidth: 900, columns: '200px 1fr' }] }, 'Body');
  assert.match(html, /grid-template-columns:1fr/);
});
test('app shell exposes its stacking breakpoint and region landmarks', () => {
  const html = render(NCTGraphiteAppShell, { sectionCount: 1, stackMinWidth: 700, header: React.createElement('div', null, 'H'), footer: React.createElement('div', null, 'F') }, 'Only');
  assert.equal((html.match(/<section/g) || []).length, 1);
  assert.match(html, /<header/); assert.match(html, /<footer/);
});
test('app shell wraps body regions with per-region styling', () => {
  const html = render(NCTGraphiteAppShell, { sectionCount: 2, sectionClassName: ['left', 'right'], sectionStyle: [{ order: 0 }, { order: 1 }] }, 'A', 'B');
  assert.equal((html.match(/<section/g) || []).length, 2);
  assert.match(html, /class="left"/); assert.match(html, /class="right"/);
});
