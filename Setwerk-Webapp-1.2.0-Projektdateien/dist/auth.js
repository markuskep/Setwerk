import { createAccountUI } from './account-ui.js';
import { signup, login, logout, getUser, subscribeAuth, resetPassword, updateUserProfile, changePassword, removeAccount } from './firebase-service.js';

const gate = document.getElementById('auth-gate');
const panel = document.getElementById('auth-panel');
const message = document.getElementById('auth-message');
gate.hidden = true;
let authReturnFocus = null;
let currentUser = window.SetwerkCloud?.user || null;
const text = (de, en) => document.documentElement.lang === 'en' ? en : de;
const accountUI=createAccountUI({logout,updateUserProfile,changePassword,removeAccount,activateUser,authError});

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
  document.getElementById('auth-reset').hidden = false;
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
  document.getElementById('auth-reset').hidden = true;
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
function updateAuthButton(user=currentUser){accountUI.refresh(user);}
function activateUser(user) {
  const unchanged=currentUser?.id===user?.id && window.SetwerkCloud?.user?.id===user?.id;
  currentUser = user;
  updateAuthButton();
  window.SetwerkAppearance?.connect(user);
  if (unchanged && user && ['loading','pending'].includes(window.SetwerkCloud?.mode)) window.SetwerkCloud.sync();
  if (!unchanged && !window.AndroidGym) window.SetwerkCloud?.connect(user).catch(() => updateAuthButton());
}
window.addEventListener('setwerk:render', () => updateAuthButton());
window.addEventListener('setwerk:cloud-status', () => updateAuthButton());
document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-auth-close]')) { closeAuth(); return; }
  const button = event.target.closest('[data-auth-open]');
  if (!button) return;
  if (button.dataset.authState === 'signed-in') {
    accountUI.toggleMenu(button);
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
  const controls = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled)')].filter(control => !control.hidden && !control.closest('[hidden]'));
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
      const user = await signup(email, password, name);
      closeAuth();
      activateUser(user);
    } else {
      const user = await login(email, password);
      closeAuth();
      activateUser(user);
    }
    formElement.reset();
  } catch (error) {
    setMessage(authError(error), true);
  } finally {
    submit.disabled = false;
  }
});
function authError(error) {
  const labels={
    'auth/invalid-credential':text('E-Mail oder Passwort stimmt nicht.','Email or password is incorrect.'),
    'auth/wrong-password':text('E-Mail oder Passwort stimmt nicht.','Email or password is incorrect.'),
    'auth/user-not-found':text('E-Mail oder Passwort stimmt nicht.','Email or password is incorrect.'),
    'auth/email-already-in-use':text('Diese E-Mail ist bereits registriert. Bitte melde dich an.','This email is already registered. Please sign in.'),
    'auth/invalid-email':text('Bitte gib eine gültige E-Mail-Adresse ein.','Please enter a valid email address.'),
    'auth/weak-password':text('Bitte verwende mindestens sechs Zeichen für dein Passwort.','Please use at least six characters for your password.'),
    'auth/password-does-not-meet-requirements':text('Das Passwort erfüllt die Anforderungen nicht. Bitte wähle ein stärkeres Passwort.','Please choose a stronger password that meets the requirements.'),
    'auth/operation-not-allowed':text('Die Anmeldung ist noch nicht eingerichtet. Bitte versuche es später erneut.','Sign-in is not configured yet. Please try again later.'),
    'auth/configuration-not-found':text('Die Anmeldung ist noch nicht eingerichtet. Bitte versuche es später erneut.','Sign-in is not configured yet. Please try again later.'),
    'auth/too-many-requests':text('Zu viele Versuche. Bitte warte kurz und versuche es erneut.','Too many attempts. Please wait and try again.'),
    'auth/network-request-failed':text('Keine Verbindung. Deine Trainings bleiben auf diesem Gerät gespeichert.','Connection unavailable. Your workouts remain saved on this device.'),
    'auth/user-disabled':text('Dieses Konto wurde deaktiviert.','This account has been disabled.'),
    'auth/requires-recent-login':text('Bitte erneut anmelden und die Änderung nochmals versuchen.','Please sign in again and retry the change.'),
    'firestore/permission-denied':text('Die Kontodaten konnten nicht gespeichert werden. Bitte erneut versuchen.','Account data could not be saved. Please try again.'),
    'permission-denied':text('Die Kontodaten konnten nicht gespeichert werden. Bitte erneut versuchen.','Account data could not be saved. Please try again.'),
    'setwerk/delete-partial':text('Die Online-Daten wurden gelöscht, das Konto konnte jedoch nicht gelöscht werden. Bitte die Kontolöschung erneut versuchen.','Online data was removed, but the account could not be deleted. Please retry account deletion.'),
    'setwerk/config':text('Die Anmeldung ist noch nicht eingerichtet. Bitte versuche es später erneut.','Sign-in is not configured yet. Please try again later.')
  };
  return labels[error?.code] || (error?.code ? text('Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuche es erneut.','Could not complete sign-in. Please try again.') : error?.message) || text('Keine Verbindung. Bitte versuche es erneut.','Connection unavailable. Please try again.');
}
document.getElementById('auth-reset').addEventListener('click',async()=>{
  const input=document.querySelector('#auth-form input[name="email"]');
  if(!input.value.trim()||!input.checkValidity()){input.reportValidity();input.focus();return;}
  const button=document.getElementById('auth-reset');button.disabled=true;
  try{
    await resetPassword(input.value.trim());
    setMessage(text('Falls ein Konto zu dieser E-Mail existiert, erhältst du einen Link zum Zurücksetzen deines Passworts.','If an account exists for this email, you will receive a password reset link.'));
  }catch(error){setMessage(authError(error),true);}finally{button.disabled=false;}
});
subscribeAuth(activateUser).catch(error=>{
  console.warn('Firebase unavailable; local workouts remain available.',error.code||'network');
  updateAuthButton();
});
window.addEventListener('online',async()=>{
  try{activateUser(await getUser());}catch{updateAuthButton();}
});
updateAuthButton();
window.addEventListener('setwerk:deleted-account',async event=>{if(currentUser?.id!==event.detail.id)return;try{await logout();}finally{activateUser(null);}});

