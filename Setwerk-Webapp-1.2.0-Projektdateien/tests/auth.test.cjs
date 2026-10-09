const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const root = path.join(__dirname, '../dist');

async function setup(loginError, cloud=null, resetHandler=async()=>{}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://setwerk.test/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, calls = [];
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.document.getElementById('app').innerHTML = '<button data-auth-open>Login / Sign up</button><button id="background">Training starten</button>';
  if(cloud)w.SetwerkCloud=cloud;
  w.__firebase = {
    async login(email, password) { calls.push({ email, password }); if (loginError) throw Error(loginError); return { id:'alice', email }; },
    async signup(email, password, name) { calls.push({ email, password, name }); return {id:'alice',email}; },
    async logout() {}, async getUser() { return cloud?.user||null; }, async subscribeAuth(listener) { listener(cloud?.user||null); }, async resetPassword(email) {calls.push({reset:email});await resetHandler(email);},
  };
  w.eval(fs.readFileSync(path.join(root,'account-ui.js'),'utf8').replace('export function createAccountUI','window.createAccountUI = function createAccountUI'));
  const source = fs.readFileSync(path.join(root, 'auth.js'), 'utf8').replace(/^import[^\n]+\n/gm,'');
  w.eval('const { signup, login, logout, getUser, subscribeAuth, resetPassword, updateUserProfile, changePassword, removeAccount } = window.__firebase;\n'+source);
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
test('forgot password opens an email-only form and sends only after submitting', async () => {
  const x=await setup();try{
    x.q('[data-auth-open]').click();x.q('[name="password"]').value='private-password';
    x.q('#auth-reset').click();await x.settle();
    assert.deepEqual(x.calls,[]);
    assert.equal(x.q('#auth-panel').dataset.mode,'reset');
    assert.equal(x.q('#auth-title').textContent,'Passwort zurücksetzen.');
    assert.equal(x.q('#auth-submit').textContent,'Absenden');
    assert.equal(x.w.document.activeElement,x.q('[name="email"]'));
    assert.equal(x.q('[name="password"]').value,'');
    assert.equal(x.q('[name="password"]').closest('label').hidden,true);
    assert.deepEqual([...x.q('#auth-form').elements].filter(e=>e.tagName==='INPUT'&&!e.disabled).map(e=>e.name),['email']);
    x.q('[name="email"]').value=' markus@example.at ';
    x.q('#auth-submit').click();await x.settle();
    assert.deepEqual(x.calls,[{reset:'markus@example.at'}]);
    assert.equal(x.q('#auth-gate').hidden,false);
    assert.match(x.q('#auth-message').textContent,/Falls ein Konto/);
    assert.equal(x.q('#auth-submit').disabled,false);
    x.q('#auth-switch').click();
    assert.equal(x.q('#auth-panel').dataset.mode,'login');
    assert.equal(x.q('[name="password"]').closest('label').hidden,false);
    assert.equal(x.q('[name="password"]').disabled,false);
    assert.equal(x.q('#auth-form').checkValidity(),false);
    assert.match(x.q('#auth-description').textContent,/Melde dich/);
    x.q('#auth-switch').click();assert.equal(x.q('#auth-reset').hidden,true);
  }finally{x.dom.window.close();}
});
test('password reset rejects empty or invalid emails without contacting Firebase',async()=>{
  const x=await setup();try{
    x.q('[data-auth-open]').click();x.q('#auth-reset').click();
    for(const email of ['', 'keine-email']){
      x.q('[name="email"]').value=email;x.q('#auth-submit').click();
      x.q('#auth-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
      await x.settle();assert.deepEqual(x.calls,[]);assert.equal(x.q('#auth-submit').disabled,false);
    }
  }finally{x.dom.window.close();}
});
test('password reset shows errors and allows retry while blocking duplicate pending submissions',async()=>{
  let finish;
  const x=await setup(undefined,null,()=>new Promise((resolve,reject)=>{finish={resolve,reject};}));try{
    x.q('[data-auth-open]').click();x.q('#auth-reset').click();x.q('[name="email"]').value='markus@example.at';
    x.q('#auth-submit').click();assert.equal(x.q('#auth-submit').disabled,true);
    x.q('#auth-form').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
    assert.equal(x.calls.length,1);
    finish.reject(Object.assign(Error('offline'),{code:'auth/network-request-failed'}));await x.settle();
    assert.equal(x.q('#auth-gate').hidden,false);assert.equal(x.q('#auth-submit').disabled,false);
    assert.match(x.q('#auth-message').textContent,/Keine Verbindung/);assert.equal(x.q('#auth-message').classList.contains('error'),true);
    assert.equal(x.q('[name="email"]').value,'markus@example.at');
    x.q('#auth-submit').click();finish.resolve();await x.settle();
    assert.equal(x.calls.length,2);assert.match(x.q('#auth-message').textContent,/Falls ein Konto/);
    assert.equal(x.q('#auth-message').classList.contains('error'),false);
  }finally{x.dom.window.close();}
});
test('reset form supports English and closing restores the regular login form',async()=>{
  const x=await setup();try{
    x.w.document.documentElement.lang='en';x.q('[data-auth-open]').click();x.q('#auth-reset').click();
    assert.equal(x.q('#auth-title').textContent,'Reset your password.');assert.equal(x.q('#auth-submit').textContent,'Send');
    assert.match(x.q('#auth-description').textContent,/Enter your email address/);
    x.q('[data-auth-close]').click();x.q('[data-auth-open]').click();
    assert.equal(x.q('#auth-panel').dataset.mode,'login');assert.equal(x.q('[name="password"]').disabled,false);
    assert.equal(x.q('[name="password"]').closest('label').hidden,false);assert.equal(x.q('#auth-submit').textContent,'Sign in');
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



test('account menu uses requested order, username and default avatar; closes outside and via Escape',async()=>{
 const x=await setup();try{
  x.w.activateUser({id:'alice',email:'private@example.at',name:'Markus'});
  const button=x.q('[data-auth-open]');assert.match(button.textContent,/Markus/);assert.doesNotMatch(button.textContent,/@/);assert.match(button.querySelector('img').src,/avatar-default.svg$/);
  button.click();assert.deepEqual([...x.q('#account-menu').children].map(n=>n.textContent),['Kontodaten','Farben','Abmelden','Konto löschen']);assert.equal(x.q('#account-menu').lastElementChild.className,'account-danger');
  x.w.document.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'End',bubbles:true}));assert.equal(x.w.document.activeElement,x.q('#account-menu').lastElementChild);
  x.w.document.dispatchEvent(new x.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(x.q('#account-menu'),null);assert.equal(x.w.document.activeElement,button);
  button.click();x.q('#background').click();assert.equal(x.q('#account-menu'),null);
 }finally{x.dom.window.close();}
});
test('account details display email safely and require confirmation before deletion',async()=>{
 const x=await setup();try{
  let removed=0;x.w.__firebase.removeAccount=async()=>{removed++;};
  x.w.activateUser({id:'alice',email:'private@example.at',name:'<img src=x onerror=alert(1)>'});x.q('[data-auth-open]').click();x.q('#account-menu button').click();
  assert.equal(x.q('#account-details').open,true);assert.equal(x.q('#account-details input[type=email]').value,'private@example.at');assert.equal(x.q('[name=profileName]').value,'<img src=x onerror=alert(1)>');assert.equal(x.q('#account-details img').getAttribute('onerror'),null);
  assert.equal(x.q('#account-delete-section').hidden,true);x.q('[data-account-action=delete]').click();assert.equal(x.q('#account-delete-section').hidden,false);
  assert.equal(x.q('#delete-account-form').checkValidity(),false);assert.equal(removed,0);
  x.q('#delete-password').value='do-not-store';x.q('[data-account-action=close]').click();assert.equal(x.q('#delete-password').value,'');
 }finally{x.dom.window.close();}
});

test('restored signed-in accounts synchronize during initial authentication without reconnecting',async()=>{
 let reads=0,reconnections=0;const cloud={user:{id:'alice',email:'alice@example.test',name:'Alice'},mode:'loading',description:()=>'',sync:async()=>{reads++;cloud.mode='synced'},connect:async()=>{reconnections++}};
 const x=await setup(undefined,cloud);try{assert.equal(reads,1);assert.equal(reconnections,0);assert.equal(cloud.mode,'synced');x.w.activateUser(cloud.user);assert.equal(reads,1)}finally{x.dom.window.close()}
});
