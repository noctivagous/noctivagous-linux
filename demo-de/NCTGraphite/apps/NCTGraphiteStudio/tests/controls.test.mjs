import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const lib = await server.ssrLoadModule('../../packages/nctgraphite/src/index.ts');
const render = (component, props, ...children) => renderToStaticMarkup(React.createElement(component, props, ...children));

test('density sheet defines control tokens with a comfortable variant', () => {
  const raw = readFileSync(new URL('../../../packages/nctgraphite/src/theme/NCTGraphiteDensity.css', import.meta.url), 'utf8');
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /--nct-control-height:\s*28px/);
  assert.match(css, /--nct-control-height:\s*36px/);
  assert.match(css, /--nct-control-font-size:\s*11px/);
  assert.match(css, /--nct-control-font-size:\s*13px/);
  assert.doesNotMatch(css, /--bg|--text|--accent/);
});

test('themeable controls resolve tokens with compact fallbacks', () => {
  const button = render(lib.NCTGraphiteButton, { label: 'Save', variant: 'primary' });
  assert.match(button, /var\(--nct-accent-bg/);
  assert.match(button, /#7c5cff/);
  const toggle = render(lib.NCTGraphiteToggle, { label: 'Opt', checked: true, onChange: () => {} });
  assert.match(toggle, /type="checkbox"/);
  assert.match(toggle, /var\(--nct-surface/);
  const switched = render(lib.NCTGraphiteToggle, { label: 'Opt', checked: true, controlStyle: 'switch', onChange: () => {} });
  assert.match(switched, /role="switch" aria-checked="true"/);
  const segmented = render(lib.NCTGraphiteSegmented, { options: [{ value: 'a', label: 'A' }], value: 'a', onChange: () => {} });
  assert.match(segmented, /aria-pressed="true"/);
  assert.match(segmented, /var\(--nct-control-font-size/);
});

test('proshade form controls render native semantics', () => {
  const field = render(lib.NCTGraphiteField, { label: 'NAME', placeholder: 'Enter text', onChange: () => {} });
  assert.match(field, /<input[^>]*type="text"/);
  assert.match(field, /placeholder="Enter text"/);
  const area = render(lib.NCTGraphiteTextArea, { label: 'NOTES', rows: 4, onChange: () => {} });
  assert.match(area, /<textarea[^>]*rows="4"/);
  const checkbox = render(lib.NCTGraphiteCheckbox, { label: 'Enable', checked: false, onChange: () => {} });
  assert.match(checkbox, /<input[^>]*type="checkbox"/);
  const progress = render(lib.NCTGraphiteProgress, { label: 'EXPORT', value: 68 });
  assert.match(progress, /role="progressbar" aria-valuenow="68" aria-valuemin="0" aria-valuemax="100"/);
  const separator = render(lib.NCTGraphiteSeparator, {});
  assert.match(separator, /role="separator"/);
  const well = render(lib.NCTGraphiteImageWell, { label: 'ART', onBrowse: () => {} });
  assert.match(well, /<button[^>]*aria-label="ART"/);
  assert.match(well, /Drop image/);
});

test('tabs and list expose selection semantics with defaults', () => {
  const tabs = render(lib.NCTGraphiteTabs, { options: [{ value: 'mix', label: 'Mix' }, { value: 'edit', label: 'Edit' }], value: 'mix', onChange: () => {} });
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /role="tab" aria-selected="true"[^>]*tabindex="0"/);
  assert.match(tabs, /role="tab" aria-selected="false"[^>]*tabindex="-1"/);
  const list = render(lib.NCTGraphiteList, { options: [{ value: 'kick', label: 'Kick' }, { value: 'snare', label: 'Snare' }], value: 'snare', onChange: () => {} });
  assert.match(list, /role="listbox"[^>]*tabindex="0"/);
  assert.match(list, /role="option" aria-selected="true"[^>]*>Snare</);
});

test('audio controls expose slider and meter semantics', () => {
  const knob = render(lib.NCTGraphiteKnob, { label: 'CUTOFF', value: 64, min: 0, max: 127, onChange: () => {} });
  assert.match(knob, /role="slider"[^>]*aria-label="CUTOFF"[^>]*aria-valuemin="0"[^>]*aria-valuemax="127"[^>]*aria-valuenow="64"/);
  const fader = render(lib.NCTGraphiteFader, { label: 'CH 1', value: -6, min: -60, max: 6, onChange: () => {} });
  assert.match(fader, /role="slider"[^>]*aria-label="CH 1"/);
  assert.match(fader, /aria-valuenow="-6"/);
  const dual = render(lib.NCTGraphiteDualRange, { label: 'LOOP', min: 0, max: 100, onChange: () => {} });
  assert.match(dual, /role="group" aria-label="LOOP"/);
  assert.equal((dual.match(/type="range"/g) || []).length, 2);
  const meter = render(lib.NCTGraphiteMeter, { label: 'MASTER', value: 72, peak: 91 });
  assert.match(meter, /role="meter"[^>]*aria-valuenow="72"/);
  const display = render(lib.NCTGraphiteValueDisplay, { label: 'TEMPO', value: 128, unit: 'BPM' });
  assert.match(display, /role="status"/);
  assert.match(display, /128 BPM/);
});

test('knob and fader are keyboard-focusable with step semantics', () => {
  const knob = render(lib.NCTGraphiteKnob, { label: 'PAN', value: 0, min: -50, max: 50, step: 1, variant: 'bipolar', onChange: () => {} });
  assert.match(knob, /tabindex="0"/);
  const fader = render(lib.NCTGraphiteFader, { label: 'CH 2', value: 0, min: 0, max: 100, step: 5, onChange: () => {} });
  assert.match(fader, /tabindex="0"/);
});

test('catalog exposes every new control with editable document props', () => {
  const catalog = lib.buildLayoutCatalog();
  for (const kind of ['field', 'textArea', 'checkbox', 'tabs', 'list', 'imageWell', 'separator', 'progress', 'knob', 'fader', 'dualRange', 'meter', 'valueDisplay']) {
    const entry = catalog.find((e) => e.kind === kind);
    assert.ok(entry, `catalog entry for ${kind}`);
  }
  assert.ok(lib.editablePropsFor('tabs').includes('options'));
  assert.ok(lib.editablePropsFor('knob').includes('value'));
  assert.ok(!lib.editablePropsFor('knob').includes('onChange'));
  assert.ok(!lib.editablePropsFor('tabs').includes('onChange'));
});

test('option list parsing supports plain and value:label items', () => {
  assert.deepEqual(lib.parseNCTOptionList('Mix, Edit, Browser'), [
    { value: 'Mix', label: 'Mix' }, { value: 'Edit', label: 'Edit' }, { value: 'Browser', label: 'Browser' },
  ]);
  assert.deepEqual(lib.parseNCTOptionList('mix:Mix, edit:Edit'), [
    { value: 'mix', label: 'Mix' }, { value: 'edit', label: 'Edit' },
  ]);
  assert.equal(lib.parseNCTOptionList(undefined), null);
  assert.equal(lib.parseNCTOptionList('  , '), null);
});

test('XML round-trips the new control kinds with props and options', () => {
  const doc = () => ({
    name: 'Controls app',
    density: 'comfortable',
    theme: 'light',
    modules: [],
    root: {
      id: 'root', kind: 'stack', label: 'App', props: {}, children: [
        { id: 'f', kind: 'field', label: 'Name', props: { placeholder: 'Enter text' }, children: [] },
        { id: 't', kind: 'tabs', label: 'Views', props: { options: 'Mix, Edit' }, children: [] },
        { id: 'k', kind: 'knob', label: 'Cutoff', props: { value: 64, min: 0, max: 127 }, children: [] },
        { id: 'm', kind: 'meter', label: 'Master', props: { value: 72 }, children: [] },
        { id: 'p', kind: 'progress', label: 'Export', props: { value: 68 }, children: [] },
        { id: 's', kind: 'separator', label: '', props: { orientation: 'vertical' }, children: [] },
      ],
    },
  });
  const xml = lib.serializeLayoutDocument(doc());
  assert.match(xml, /NCTGraphiteField/);
  assert.match(xml, /NCTGraphiteKnob/);
  assert.match(xml, /options="Mix, Edit"/);
  const back = lib.parseLayoutDocument(xml);
  assert.deepEqual(back, doc());
  assert.throws(() => lib.parseLayoutDocument(xml.replaceAll('NCTGraphiteKnob', 'NCTGraphiteNope')), /Unknown layout tag/);
});

test('layout view renders document control nodes', () => {
  const node = (kind, props = {}, label = 'L') => ({ id: kind, kind, label, props, children: [] });
  const view = (n) => render(lib.NCTGraphiteLayoutView, { node: n, modules: [] });
  assert.match(view(node('field', { placeholder: 'Hi' })), /<input[^>]*placeholder="Hi"/);
  assert.match(view(node('tabs', { options: 'A, B' })), /role="tablist"/);
  assert.match(view(node('list', { options: 'X' })), /role="listbox"/);
  assert.match(view(node('knob', { value: 10, min: 0, max: 100 })), /role="slider"[^>]*aria-valuenow="10"/);
  assert.match(view(node('fader', { value: 20, min: 0, max: 100 })), /role="slider"/);
  assert.match(view(node('dualRange', { min: 0, max: 100 })), /role="group"/);
  assert.match(view(node('meter', { value: 30 })), /role="meter"/);
  assert.match(view(node('valueDisplay', { value: 128 })), /128/);
  assert.match(view(node('progress', { value: 68 })), /aria-valuenow="68"/);
  assert.match(view(node('checkbox')), /type="checkbox"/);
  assert.match(view(node('imageWell')), /Drop image/);
  assert.match(view(node('separator', { orientation: 'vertical' })), /aria-orientation="vertical"/);
  assert.match(view(node('textArea')), /<textarea/);
});

test('widgets support shared appearance props with theme-aware token defaults', () => {
  const button = render(lib.NCTGraphiteButton, { label: 'Go', opacity: 0.5, cornerRadius: 12 });
  assert.match(button, /opacity:\s*0\.5/);
  assert.match(button, /border-radius:\s*12px/);
  const plain = render(lib.NCTGraphiteButton, { label: 'Go' });
  assert.doesNotMatch(plain, /opacity:/);
  const panel = render(lib.NCTGraphitePanel, { title: 'P', cornerRadius: '50%' }, 'x');
  assert.match(panel, /border-radius:\s*50%/);
  const win = render(lib.NCTGraphiteWindow, { title: 'W', opacity: 0.75 }, 'x');
  assert.match(win, /opacity:\s*0\.75/);
  for (const kind of ['button', 'panel', 'toolbar', 'window', 'slider', 'toggle', 'segmented', 'meter', 'progress', 'valueDisplay', 'checkbox', 'field', 'textArea', 'tabs', 'list', 'imageWell']) {
    assert.ok(lib.editablePropsFor(kind).includes('opacity'), `${kind} exposes opacity`);
    assert.ok(lib.editablePropsFor(kind).includes('cornerRadius'), `${kind} exposes cornerRadius`);
  }
  const doc = { name: 'A', density: 'compact', theme: 'light', modules: [], root: { id: 'r', kind: 'stack', label: 'R', props: {}, children: [{ id: 'b', kind: 'button', label: 'Go', props: { opacity: 0.5, cornerRadius: 12 }, children: [] }] } };
  assert.deepEqual(lib.parseLayoutDocument(lib.serializeLayoutDocument(doc)), doc);
});
