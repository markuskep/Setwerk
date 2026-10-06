import { signup, login, logout, getUser, handleAuthCallback } from 'https://esm.sh/@netlify/identity@2.0.0';

const gate = document.getElementById('auth-gate');
const panel = document.getElementById('auth-panel');
const message = document.getElementById('auth-message');
gate.hidden = true;
let authReturnFocus = null;
let currentUser = window.SetwerkCloud?.user || null;
const text = (de, en) => document.documentElement.lang === 'en' ? en : de;

function setMessage(text, error=false) {
  message.textContent = text || '';
  message.classList.toggle('error', error);
}
function showLogin() {
  panel.dataset.mode = 'login';
  document.getElementById('auth-title').textContent = text('Willkommen zurück.', 'Welcome back.');
  document.getElementById('auth-submit').textContent = text('Anmelden', 'Sign in');
  document.getElementById('auth-switch').textContent = text('Noch kein Konto? Registrieren', 'New here? Sign up');
  document.getElementById('auth-name-wrap').hidden = true;
  document.querySelector('#auth-form input[name="name"]').disabled = true;
  document.querySelector('#auth-form input[name="password"]').autocomplete = 'current-password';
  setMessage('');
}
function showSignup() {
  panel.dataset.mode = 'signup';
  document.getElementById('auth-title').textContent = text('Konto erstellen.', 'Create an account.');
  document.getElementById('auth-submit').textContent = text('Registrieren', 'Sign up');
  document.getElementById('auth-switch').textContent = text('Bereits registriert? Anmelden', 'Already registered? Sign in');
  document.getElementById('auth-name-wrap').hidden = false;
  document.querySelector('#auth-form input[name="name"]').disabled = false;
  document.querySelector('#auth-form input[name="password"]').autocomplete = 'new-password';
  setMessage('');
}
function closeAuth() {
  gate.hidden = true;
  document.body.classList.remove('auth-open');
  document.getElementById('app').inert = false;
  document.querySelector('#auth-form input[name="password"]').value = '';
  if (authReturnFocus?.isConnected) authReturnFocus.focus();
  authReturnFocus = null;
}
function openAuth(trigger) {
  authReturnFocus = trigger || document.activeElement;
  showLogin();
  gate.hidden = false;
  document.body.classList.add('auth-open');
  document.getElementById('app').inert = true;
  document.querySelector('#auth-form input[name="email"]')?.focus();
}
function updateAuthButton(user = currentUser) {
  for (const button of document.querySelectorAll('[data-auth-open]')) {
  if (user) {
    button.textContent = button.hasAttribute('data-auth-compact') ? text('Konto', 'Account') : (user.email || text('Konto', 'Account'));
    button.title = window.SetwerkCloud?.description() || text('Konto', 'Account');
    button.dataset.authState = 'signed-in';
    button.dataset.syncState = window.SetwerkCloud?.mode || '';
  } else {
    button.textContent = text('Anmelden', 'Sign in');
    button.title = button.textContent;
    delete button.dataset.authState;
    delete button.dataset.syncState;
  }
  }
}
function activateUser(user) {
  currentUser = user;
  updateAuthButton();
  if (!window.AndroidGym) window.SetwerkCloud?.connect(user).catch(() => updateAuthButton());
}
window.addEventListener('setwerk:render', () => updateAuthButton());
window.addEventListener('setwerk:cloud-status', () => updateAuthButton());
document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-auth-close]')) { closeAuth(); return; }
  const button = event.target.closest('[data-auth-open]');
  if (!button) return;
  if (button.dataset.authState === 'signed-in') {
    const signOut = async () => { await logout(); activateUser(null); };
    if (window.SetwerkCloud && !window.AndroidGym) window.SetwerkCloud.openPanel(signOut);
    else try { await signOut(); } catch (error) { console.warn('Logout failed', error); }
    return;
  }
  openAuth(button);
});
document.getElementById('auth-switch').addEventListener('click', () => {
  panel.dataset.mode === 'signup' ? showLogin() : showSignup();
});
gate.addEventListener('click', event => { if (event.target === gate) closeAuth(); });
document.addEventListener('keydown', event => {
  if (gate.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeAuth(); return; }
  if (event.key !== 'Tab') return;
  const controls = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')];
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
    event.preventDefault(); last?.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
    event.preventDefault(); first?.focus();
  }
});
document.getElementById('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const form = new FormData(formElement);
  const email = String(form.get('email') || '').trim();
  const password = String(form.get('password') || '');
  const name = String(form.get('name') || '').trim();
  const submit = document.getElementById('auth-submit');
  submit.disabled = true;
  setMessage('');
  try {
    if (panel.dataset.mode === 'signup') {
      await signup(email, password, name ? { full_name: name } : {});
      showLogin();
      setMessage(text('Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.', 'Account created. Please confirm your email, then sign in.'));
    } else {
      const user = await login(email, password);
      closeAuth();
      activateUser(user);
    }
    formElement.reset();
  } catch (error) {
    setMessage(error?.message || 'Das hat nicht geklappt. Bitte versuche es erneut.', true);
  } finally {
    submit.disabled = false;
  }
});
(async () => {
  try {
    const callback = await handleAuthCallback();
    const user = callback?.user || await getUser();
    if (!user && navigator.onLine === false && currentUser) updateAuthButton();
    else activateUser(user);
    if (callback?.user) history.replaceState(null, '', location.pathname + location.search);
  } catch (error) {
    console.warn('Identity unavailable; Setwerk continues without login.', error);
    updateAuthButton();
  }
})();
window.addEventListener('online', async () => {
  try { activateUser(await getUser()); } catch { updateAuthButton(); }
});
updateAuthButton();
