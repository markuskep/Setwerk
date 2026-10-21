const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../dist/analytics.js'), 'utf8');
const key = 'setwerk.analytics-consent.v1';
const disable = 'ga-disable-G-LN5XDNS42W';

function visit(choice, setup = () => {}) {
  const dom = new JSDOM('<!doctype html><html lang="de"><head></head><body><div id="app"><main class="main"></main></div></body></html>', {
    url: 'https://app.example.test/?email=private@example.test#private-workout', runScripts: 'outside-only'
  });
  if (choice !== undefined) dom.window.localStorage.setItem(key, choice);
  setup(dom.window);
  dom.window.eval(source);
  return dom;
}
const click = (dom, choice) => dom.window.document.querySelector('[data-analytics-choice="' + choice + '"]').click();
const tagCount = dom => dom.window.document.querySelectorAll('script[src^="https://www.googletagmanager.com/"]').length;
const commands = dom => Array.from(dom.window.dataLayer || [], args => Array.from(args));

test('a new visitor can use the page without loading Google analytics', () => {
  const dom = visit();
  assert.equal(tagCount(dom), 0);
  assert.equal(dom.window.gtag, undefined);
  assert.equal(dom.window[disable], true);
  assert.equal(dom.window.document.querySelector('#analytics-consent').hidden, false);
  dom.window.close();
});

test('accepting loads the project tag once and keeps advertising consent denied', () => {
  const dom = visit();
  click(dom, 'granted');
  assert.equal(tagCount(dom), 1);
  assert.equal(dom.window.document.querySelector('#setwerk-google-tag').src, 'https://www.googletagmanager.com/gtag/js?id=G-LN5XDNS42W');
  assert.equal(dom.window.localStorage.getItem(key), 'granted');
  assert.equal(dom.window[disable], false);
  const consent = commands(dom).find(c => c[0] === 'consent' && c[1] === 'update')[2];
  assert.equal(consent.analytics_storage, 'granted');
  for (const name of ['ad_storage', 'ad_user_data', 'ad_personalization']) assert.equal(consent[name], 'denied');
  const config = commands(dom).find(c => c[0] === 'config');
  assert.equal(config[2].page_location, 'https://app.example.test/');
  assert.equal(config[2].page_title, 'Setwerk');
  assert.equal(config[2].page_referrer, '');
  assert.equal(config[2].allow_google_signals, false);
  dom.window.document.querySelector('[data-analytics-settings]').click();
  click(dom, 'granted');
  assert.equal(tagCount(dom), 1);
  assert.equal(commands(dom).filter(c => c[0] === 'config').length, 1);
  dom.window.close();
});

test('declining and returning after a decline never load the tag', () => {
  let dom = visit();
  click(dom, 'denied');
  assert.equal(tagCount(dom), 0);
  assert.equal(dom.window.localStorage.getItem(key), 'denied');
  assert.equal(dom.window.document.querySelector('#analytics-consent').hidden, true);
  dom.window.close();
  dom = visit('denied');
  assert.equal(tagCount(dom), 0);
  assert.equal(dom.window.document.querySelector('#analytics-consent').hidden, true);
  dom.window.close();
});

test('a remembered opt-in loads analytics without asking again', () => {
  const dom = visit('granted');
  assert.equal(tagCount(dom), 1);
  assert.equal(dom.window.document.querySelector('#analytics-consent').hidden, true);
  dom.window.close();
});

test('withdrawal disables analytics and removes GA cookies while preserving account data', () => {
  const dom = visit('granted');
  const {window} = dom;
  window.localStorage.setItem('setwerk.v1', 'existing-workouts');
  window.document.cookie = '_ga=123; Path=/; Domain=example.test';
  window.document.cookie = '_ga_LN5XDNS42W=456; Path=/';
  window.document.cookie = 'account=keep; Path=/';
  window.document.querySelector('[data-analytics-settings]').click();
  click(dom, 'denied');
  assert.equal(window[disable], true);
  assert.equal(commands(dom).at(-1)[2].analytics_storage, 'denied');
  assert.equal(window.document.cookie.includes('_ga'), false);
  assert.equal(window.document.cookie, 'account=keep');
  assert.equal(window.localStorage.getItem('setwerk.v1'), 'existing-workouts');
  dom.window.close();
});

test('another tab can withdraw consent and clearing storage restores the prompt', () => {
  const dom = visit('granted');
  const {window} = dom;
  window.localStorage.setItem(key, 'denied');
  window.dispatchEvent(new window.StorageEvent('storage', {key}));
  assert.equal(window[disable], true);
  window.localStorage.clear();
  window.dispatchEvent(new window.StorageEvent('storage', {key: null}));
  assert.equal(window.document.querySelector('#analytics-consent').hidden, false);
  assert.equal(window[disable], true);
  dom.window.close();
});

test('settings survive app renders, follow the chosen language, and can be closed', () => {
  const dom = visit('denied');
  const {window} = dom;
  window.document.querySelector('#app').innerHTML = '<main class="main"></main>';
  window.document.documentElement.lang = 'en';
  window.dispatchEvent(new window.Event('setwerk:render'));
  window.dispatchEvent(new window.Event('setwerk:render'));
  const buttons = window.document.querySelectorAll('[data-analytics-settings]');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, 'Statistics settings');
  buttons[0].click();
  assert.equal(window.document.activeElement.id, 'analytics-consent-title');
  assert.equal(window.document.querySelector('#analytics-consent').hidden, false);
  window.document.querySelector('[data-analytics-close]').click();
  assert.equal(window.document.activeElement, buttons[0]);
  assert.equal(tagCount(dom), 0);
  dom.window.close();
});

test('unavailable storage and invalid saved choices never imply consent', () => {
  for (const setup of [() => {}, window => Object.defineProperty(window, 'localStorage', {get() { throw Error('blocked'); }})]) {
    const dom = visit('unexpected-value', setup);
    assert.equal(tagCount(dom), 0);
    assert.equal(dom.window.document.querySelector('#analytics-consent').hidden, false);
    click(dom, 'granted');
    assert.equal(tagCount(dom), 1);
    dom.window.close();
  }
});

test('native Android does not initialize the website tag', () => {
  const dom = visit('granted', window => { window.AndroidGym = {}; });
  assert.equal(tagCount(dom), 0);
  assert.equal(dom.window.document.querySelector('#analytics-consent'), null);
  dom.window.close();
});
