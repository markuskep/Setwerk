import { signup, login, logout, getUser, handleAuthCallback } from 'https://esm.sh/@netlify/identity';

const gate = document.getElementById('auth-gate');
const panel = document.getElementById('auth-panel');
const message = document.getElementById('auth-message');
const account = document.getElementById('auth-account');

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
function openApp(user) {
  gate.hidden = true;
  document.body.classList.remove('auth-locked');
  account.hidden = false;
  document.getElementById('auth-email').textContent = user.email || '';
}
function lockApp() {
  gate.hidden = false;
  account.hidden = true;
  document.body.classList.add('auth-locked');
}
async function refreshUser() {
  const user = await getUser();
  if (user) openApp(user); else lockApp();
}
document.getElementById('auth-switch').addEventListener('click', () => {
  panel.dataset.mode === 'signup' ? showLogin() : showSignup();
});
document.getElementById('auth-form').addEventListener('submit', async (event) => {
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
      setMessage('Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.');
      showLogin();
      setMessage('Konto erstellt. Bitte bestätige deine E-Mail und melde dich danach an.');
    } else {
      const user = await login(email, password);
      openApp(user);
    }
    event.currentTarget.reset();
  } catch (error) {
    setMessage(error?.message || 'Das hat nicht geklappt. Bitte versuche es erneut.', true);
  } finally {
    submit.disabled = false;
  }
});
document.getElementById('auth-logout').addEventListener('click', async () => {
  await logout();
  showLogin();
  lockApp();
});
(async () => {
  lockApp();
  try {
    const callback = await handleAuthCallback();
    if (callback?.user) {
      openApp(callback.user);
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    await refreshUser();
  } catch (error) {
    setMessage(error?.message || 'Anmeldung konnte nicht geprüft werden.', true);
    lockApp();
  }
})();
