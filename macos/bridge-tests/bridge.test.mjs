import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('../Resources/DesktopBridge.js', import.meta.url), 'utf8');
function run({ origin = 'https://bsk2014.se', topFrame = true, signedIn = true, dark = false, planSaved = false } = {}) {
  const messages = [];
  const styles = [];
  const listeners = {};
  const mutations = [];
  const root = { dataset: { theme: dark ? 'dark' : 'light' }, append: el => styles.push(el) };
  const document = {
    documentElement: root,
    head: root,
    getElementById: id => styles.find(s => s.id === id),
    createElement: () => ({}),
    querySelector: selector => {
      if (selector.includes('Logga ut')) return signedIn ? {} : null;
      if (selector === '.match-plan-summary') return planSaved ? {} : null;
      if (selector === '.bsk-coach-name') return { textContent: 'Testkonto' };
      if (selector.includes('h1')) return { textContent: 'Spelare' };
      return null;
    },
    querySelectorAll: () => [
      { href: '/idag' }, { href: '/spelare' }, { href: '/spelare' },
      { href: '/installningar#profil' }, { href: 'https://example.invalid/external' },
    ],
    addEventListener: (name, fn) => { listeners[name] = fn; },
  };
  const window = {
    __bskDesktopCSS: 'body { color: green }',
    webkit: { messageHandlers: { bskDesktop: { postMessage: m => messages.push(JSON.parse(JSON.stringify(m))) } } },
    addEventListener() {},
  };
  window.top = topFrame ? window : {};
  runInNewContext(source, {
    window, document, location: { origin, pathname: '/spelare', href: origin + '/spelare' },
    URL, JSON, Set,
    requestAnimationFrame: fn => fn(),
    MutationObserver: class { constructor(fn) { mutations.push(fn); } observe() {} },
  });
  return { messages, styles, root, mutations, listeners };
}

test('läser bara navigation och skalmetadata, aldrig formulär eller cookies', () => {
  const { messages } = run();
  assert.deepEqual(Object.keys(messages[0]).sort(), ['dark', 'path', 'paths', 'planSaved', 'signedIn', 'title', 'user']);
  assert.deepEqual(messages[0].paths, ['/idag', '/spelare', '/installningar']);
  assert.equal(messages[0].signedIn, true);
});
test('installerar inte något på annan domän eller i iframe', () => {
  for (const context of [{ origin: 'https://example.invalid' }, { topFrame: false }]) {
    const result = run(context);
    assert.equal(result.messages.length, 0);
    assert.equal(result.styles.length, 0);
  }
});
test('visar inga personalvägar utan befintlig inloggning', () => {
  const { messages } = run({ signedIn: false });
  assert.equal(messages[0].signedIn, false);
  assert.deepEqual(messages[0].paths, []);
});
test('upprepade React-uppdateringar duplicerar inte tema eller meddelanden', () => {
  const result = run();
  result.mutations[0]();
  result.mutations[0]();
  assert.equal(result.styles.length, 1);
  assert.equal(result.messages.length, 1);
});
test('byter skalets utseende när befintlig temainställning ändras', () => {
  const result = run();
  result.listeners.DOMContentLoaded();
  result.root.dataset.theme = 'dark';
  result.mutations.at(-1)();
  assert.equal(result.messages.at(-1).dark, true);
  assert.equal(result.styles.length, 1);
});

test('signalerar sparad sammanfattning utan att läsa matchplanens innehåll', () => {
  assert.equal(run({ planSaved: false }).messages[0].planSaved, false);
  assert.equal(run({ planSaved: true }).messages[0].planSaved, true);
});
