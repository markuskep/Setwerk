import { signup, login, logout, getUser, handleAuthCallback } from 'https://esm.sh/@netlify/identity';

const gate = document.getElementById('auth-gate');
const panel = document.getElementById('auth-panel');
const message = document.getElementById('auth-message');
gate.hidden = true;

function setMessage(text, error=false) {
  message.textContent = text || '';
  message.classList.toggle('error', error);
}
function showLogin() {
  panel.dataset.mode = 'login';
  document.getElementById('auth-title').textContent = 'Willkommen zurück.';
  document.getElementById('auth-submit').textContent = 'Anmelden';
  document.getElementById('auth-switch').textContent = 'Noch kein Konto? Registrieren';
  document.getElementById('auth-name-wrap').hidden = true;
  setMessage('');
}
function showSignup() {
  panel.dataset.mode = 'signup';
  document.getElementById('auth-title').textContent = 'Konto erstellen.';
  document.getElementById('auth-submit').textContent = 'Registrieren';
  document.getElementById('auth-switch').textContent = 'Bereits registriert? Anmelden';
  document.getElementById('auth-name-wrap').hidden = false;
  setMessage('');
}
function closeAuth() { gate.hidden = true; }
function openAuth() {
  showLogin();
  gate.hidden = false;
  document.querySelector('#auth-form input[name="email"]')?.focus();
}
async function updateAuthButton(user) {
  const button = document.querySelector('[data-auth-open]');
  if (!button) return;
  if (user) {
    button.textContent = (user.email || 'Angemeldet') + ' · Abmelden';
    button.dataset.authState = 'signed-in';
  } else {
    button.textContent = 'Login / Sign up';
    delete button.dataset.authState;
  }
}
document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-auth-close]')) { closeAuth(); return; }
  const button = event.target.closest('[data-auth-open]');
  if (!button) return;
  if (button.dataset.authState === 'signed-in') {
    try { await logout(); await updateAuthButton(null); }
    catch (error) { console.warn('Logout failed', error); }
    return;
  }
  openAuth();
});
document.getElementById('auth-switch').addEventListener('click', () => {
  panel.dataset.mode === 'signup' ? showLogin() : showSignup();
});
gate.addEventListener('click', event => { if (event.target === gate) closeAuth(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !gate.hidden) closeAuth(); });
document.getElementById('auth-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
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
      setMessage('Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.');
    } else {
      const user = await login(email, password);
      await updateAuthButton(user);
      closeAuth();
    }
    event.currentTarget.reset();
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
    await updateAuthButton(user);
    if (callback?.user) history.replaceState(null, '', location.pathname + location.search);
  } catch (error) {
    console.warn('Identity unavailable; Setwerk continues without login.', error);
    await updateAuthButton(null);
  }
})();
