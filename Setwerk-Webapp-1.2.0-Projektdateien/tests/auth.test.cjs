const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const root = path.join(__dirname, '../dist');

async function setup(loginError) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://setwerk.test/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, calls = [];
  w.document.getElementById('app').innerHTML = '<button data-auth-open>Login / Sign up</button><button id="background">Training starten</button>';
  w.__firebase = {
    async login(email, password) { calls.push({ email, password }); if (loginError) throw Error(loginError); return { id:'alice', email }; },
    async signup(email, password, name) { calls.push({ email, password, name }); return {id:'alice',email}; },
    async logout() {}, async getUser() { return null; }, async subscribeAuth(listener) { listener(null); }, async resetPassword(email) {calls.push({reset:email});},
  };
  const source = fs.readFileSync(path.join(root, 'auth.js'), 'utf8').replace(/^import[^\n]+\n/, 'const { signup, login, logout, getUser, subscribeAuth, resetPassword } = window.__firebase;\n');
  w.eval(source);
  await new Promise(resolve => setImmediate(resolve));
  return { dom, w, calls, q: selector => w.document.querySelector(selector), settle: () => new Promise(resolve => setImmediate(resolve)) };
}

test('login floats over the page, exposes only email/password, and restores focus on close', async () => {
  const x = await setup(); const { q, w } = x;
  try {
    assert.equal(q('#auth-gate').hidden, true);
    q('[data-auth-open]').focus(); q('[data-auth-open]').click();
    assert.equal(q('#auth-gate').hidden, false);
    assert.equal(q('#auth-gate').getAttribute('aria-modal'), 'true');
    assert.equal(q('#app').inert, true);
    assert.equal(w.document.body.classList.contains('auth-open'), true);
    assert.equal(q('#auth-name-wrap').hidden, true);
    assert.equal(q('[name="name"]').disabled, true);
    assert.deepEqual([...q('#auth-form').elements].filter(e => e.tagName === 'INPUT' && !e.disabled).map(e => e.name), ['email', 'password']);
    assert.equal(w.document.activeElement, q('[name="email"]'));
    q('#auth-switch').focus();
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assert.equal(w.document.activeElement, q('[data-auth-close]'));
    q('[name="password"]').value = 'private-password';
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(q('#auth-gate').hidden, true);
    assert.equal(q('#app').inert, false);
    assert.equal(w.document.body.classList.contains('auth-open'), false);
    assert.equal(q('[name="password"]').value, '');
    assert.equal(w.document.activeElement, q('[data-auth-open]'));
  } finally { x.dom.window.close(); }
});

test('email/password login resets the form after asynchronous Firebase success', async () => {
  const x = await setup(); const { q, w } = x;
  try {
    q('[data-auth-open]').click();
    q('[name="email"]').value = 'markus@example.at';
    q('[name="password"]').value = 'test-password';
    q('#auth-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await x.settle();
    assert.deepEqual(x.calls, [{ email: 'markus@example.at', password: 'test-password' }]);
    assert.equal(q('#auth-gate').hidden, true);
    assert.equal(q('#auth-message').textContent, '');
    assert.equal(q('#auth-submit').disabled, false);
    assert.equal(q('[name="email"]').value, '');
    assert.equal(q('[data-auth-open]').dataset.authState, 'signed-in');
  } finally { x.dom.window.close(); }
});

test('failed login stays open; signup switches password autocomplete and name visibility', async () => {
  const x = await setup('Ungültige Anmeldedaten'); const { q, w } = x;
  try {
    q('[data-auth-open]').click();
    q('[name="email"]').value = 'markus@example.at';
    q('[name="password"]').value = 'test-password';
    q('#auth-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await x.settle();
    assert.equal(q('#auth-gate').hidden, false);
    assert.equal(q('#auth-message').textContent, 'Ungültige Anmeldedaten');
    assert.equal(q('#auth-submit').disabled, false);
    q('#auth-switch').click();
    assert.equal(q('#auth-name-wrap').hidden, false);
    assert.equal(q('[name="name"]').disabled, false);
    assert.equal(q('[name="password"]').autocomplete, 'new-password');
    q('#auth-switch').click();
    assert.equal(q('[name="password"]').autocomplete, 'current-password');
    q('#auth-gate').click();
    assert.equal(q('#auth-gate').hidden, true);
  } finally { x.dom.window.close(); }
});

test('Firebase signup signs in immediately and never asks for a Netlify confirmation', async () => {
  const x=await setup();try{
    x.q('[data-auth-open]').click();x.q('#auth-switch').click();
    x.q('[name="email"]').value='new@example.at';x.q('[name="password"]').value='new-password';x.q('[name="name"]').value='Markus';
    x.q('#auth-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));await x.settle();
    assert.deepEqual(x.calls,[{email:'new@example.at',password:'new-password',name:'Markus'}]);
    assert.equal(x.q('#auth-gate').hidden,true);
    assert.equal(x.q('[data-auth-open]').dataset.authState,'signed-in');
    assert.equal(x.q('[name="password"]').value,'');
  }finally{x.dom.window.close();}
});
test('password reset uses the entered email without requiring a password', async () => {
  const x=await setup();try{
    x.q('[data-auth-open]').click();x.q('[name="email"]').value='markus@example.at';
    x.q('#auth-reset').click();await x.settle();
    assert.deepEqual(x.calls,[{reset:'markus@example.at'}]);
    assert.match(x.q('#auth-message').textContent,/Falls ein Konto/);
    x.q('#auth-switch').click();assert.equal(x.q('#auth-reset').hidden,true);
  }finally{x.dom.window.close();}
});
test('Firebase auth state updates from another tab connect each account only once',async()=>{
 const x=await setup();try{
  const calls=[];x.w.SetwerkCloud={user:null,description:()=> 'Saved online',connect:async user=>{calls.push(user?.id||null);x.w.SetwerkCloud.user=user;}};
  x.w.activateUser({id:'alice',email:'alice@example.at'});x.w.activateUser({id:'alice',email:'alice@example.at'});
  x.w.activateUser(null);x.w.activateUser(null);
  assert.deepEqual(calls,['alice',null]);
 }finally{x.dom.window.close();}
});
