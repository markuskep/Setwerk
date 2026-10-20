'use strict';
// Android-only adapter: music data never enters workout storage or cloud sync.
window.SetwerkMusic = (() => {
  let snapshot = null, receivedAt = 0, reading = false, busy = false, removing = null, problem = '', expanded = false, gesture = null, suppressClickUntil = 0;
  const $ = selector => document.querySelector(selector);
  const en = () => document.documentElement.lang === 'en';
  const t = (de, english) => en() ? english : de;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const time = ms => {const sec = Math.floor(Math.max(0, Number(ms) || 0) / 1000);return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;};
  const shapes = {music:'M9 18V5l12-2v13M9 9l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Zm12-2a3 3 0 1 1-3-3c1.7 0 3 1.3 3 3Z',previous:'M5 5v14m14-14-10 7 10 7V5Z',next:'M19 5v14M5 5l10 7-10 7V5Z',play:'m8 5 11 7-11 7V5Z',pause:'M8 5v14M16 5v14',close:'m7 7 10 10M17 7 7 17'};
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${shapes[name]}"/></svg>`;
  const button = (action, glyph, label, disabled = false, extra = '') => `<button type="button" class="music-button ${extra}" data-music-action="${action}" aria-label="${escape(label)}" title="${escape(label)}" ${disabled ? 'disabled' : ''}>${icon(glyph)}</button>`;
  const focused = () => !!$('.focus-shell:not(.focus-navigation-snapshot)') && !$('.focus-shell:not(.focus-navigation-snapshot) .focus-workout-list') && !!window.AndroidGym && !!window.SetwerkNative;
  const visible = () => focused() && !document.hidden;
  function position() {
    if (!snapshot) return 0;
    let value = Math.max(0, Number(snapshot.position) || 0);
    if (snapshot.playing) value += Math.max(0, Date.now() - receivedAt) * Math.max(0, Number(snapshot.speed ?? 1) || 0);
    return snapshot.duration > 0 ? Math.min(value, snapshot.duration) : value;
  }
  function markup() {
    const s = snapshot;
    const sourceIcon = typeof s?.appIcon === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s.appIcon) && s.appIcon.length <= 65536 ? `<img class="music-source-icon" src="${escape(s.appIcon)}" alt="" width="18" height="18">` : icon('music');
    const heading = `<div class="music-heading"><span>${icon('music')}${t('Deine Musik', 'Your music')}</span>${s?.active ? `<span class="music-source" aria-label="${t('Musikquelle', 'Music source')}" title="${escape(s.appName || t('Musik-App', 'Music app'))}">${sourceIcon}<small>${escape(s.appName || t('Musik-App', 'Music app'))}</small></span>` : ''}</div>`;
    if (!s) return `${heading}<p class="music-hint">${t('Musiksteuerung wird geladen …', 'Loading music controls …')}</p>`;
    if (!s.granted) return `${heading}<p class="music-hint">${t('Steuere deine Musik direkt im Training. Android benötigt dafür Benachrichtigungszugriff. Setwerk nutzt ihn nur für Musikinformationen und die Wiedergabesteuerung.', 'Control your music during training. Android requires notification access. Setwerk uses it only for music information and playback controls.')}</p><button type="button" class="music-connect" data-music-action="connect" ${busy ? 'disabled' : ''}>${t('Musiksteuerung einrichten', 'Set up music controls')}</button>`;
    if (!s.active) return `${heading}<p class="music-hint">${t('Starte ein Lied in deiner Musik-App. Die Steuerung erscheint hier automatisch.', 'Start a song in your music app. The controls will appear here automatically.')}</p>`;
    const label = s.playing ? t('Pausieren', 'Pause') : t('Wiedergabe fortsetzen', 'Resume playback');
    const canToggle = s.playing ? s.canPause : s.canPlay;
    const p = position(), duration = Math.max(0, Number(s.duration) || 0);
    return `${heading}<div class="music-current"><div class="music-art" aria-hidden="true">${icon('music')}</div><div class="music-track"><strong title="${escape(s.title)}">${escape(s.title || t('Unbekannter Titel', 'Unknown track'))}</strong><span title="${escape(s.artist)}">${escape(s.artist || t('Interpret unbekannt', 'Unknown artist'))}</span></div><div class="music-controls">${button('previous', 'previous', t('Vorheriges Lied', 'Previous track'), busy || !s.canPrevious)}${button(s.playing ? 'pause' : 'play', s.playing ? 'pause' : 'play', label, busy || !canToggle, 'music-toggle')}${button('next', 'next', t('Nächstes Lied', 'Next track'), busy || !s.canNext)}</div></div><div class="music-timeline"><input type="range" data-music-seek aria-label="${t('Position im Lied', 'Track position')}" min="0" max="${duration || 1}" step="1000" value="${p}" ${busy || !s.canSeek || !duration ? 'disabled' : ''} style="--music-progress:${duration ? p / duration * 100 : 0}%"><div class="music-times"><span data-music-position>${time(p)}</span><span>${duration ? time(duration) : '–:–'}</span></div></div>${s.next ? `<div class="music-next"><span class="music-next-label">${t('ALS NÄCHSTES', 'UP NEXT')}</span><div class="music-next-track"><strong title="${escape(s.next.title)}">${escape(s.next.title || t('Unbekannter Titel', 'Unknown track'))}</strong>${s.next.artist ? `<small>${escape(s.next.artist)}</small>` : ''}</div>${s.canRemoveNext ? button('remove-next', 'close', t('Nächstes Lied aus der Warteschlange entfernen', 'Remove next track from queue'), busy || !!removing, 'music-remove') : ''}</div>` : `<p class="music-queue-hint">${t('Kein nächstes Lied verfügbar.', 'No next track available.')}</p>`}`;
  }
  function paint() {
    const shell = $('.focus-shell:not(.focus-navigation-snapshot)');
    if (!focused()) {expanded = false;$('#setwerk-music')?.remove();return;}
    let player = $('#setwerk-music');
    if (!player) {player = document.createElement('section');player.id = 'setwerk-music';player.className = 'music-player';player.setAttribute('aria-label', t('Musiksteuerung', 'Music controls'));}
    const before = shell.querySelector('.focus-footer');
    if (player.parentNode !== shell || player.nextElementSibling !== before) shell.insertBefore(player, before);
    player.classList.toggle('is-expanded', expanded);
    // Position updates keep existing controls intact. Metadata/capability changes
    // repaint and preserve keyboard focus instead of showing an old track.
    const signature = JSON.stringify({snapshot:snapshot ? {...snapshot,position:0} : null,problem,busy,removing,expanded,language:en()});
    if (player.dataset.signature === signature) {updatePosition();return;}
    const focus = player.contains(document.activeElement) ? document.activeElement : null;
    const seekFocused = focus?.matches('[data-music-seek]');
    const focusedAction = focus?.dataset.musicAction;
    if (seekFocused && !busy && !removing && snapshot?.active) {updatePosition();return;}
    player.dataset.signature = signature;
    const s = snapshot, title = s?.active ? s.title || t('Unbekannter Titel', 'Unknown track') : t('Deine Musik', 'Your music');
    const toggle = s?.playing ? 'pause' : 'play', canToggle = s?.playing ? s?.canPause : s?.canPlay;
    const mini = `<div class="music-mini"><button type="button" class="music-mini-title" data-music-expand aria-expanded="${expanded}" aria-controls="music-full" aria-label="${t(expanded?'Musikansicht verkleinern':'Musikansicht öffnen. Nach unten wischen', expanded?'Collapse music controls':'Open music controls. Swipe down')}"><strong title="${escape(title)}">${escape(title)}</strong></button>${!expanded && s?.active ? `<div class="music-controls">${button(toggle, toggle, s.playing?t('Pausieren','Pause'):t('Wiedergabe fortsetzen','Resume playback'),busy||!canToggle,'music-toggle')}${button('next','next',t('Nächstes Lied','Next track'),busy||!s.canNext)}</div>` : ''}</div>`;
    player.innerHTML = mini + (expanded ? `<div class="music-full" id="music-full">${markup()}</div>` : '') + `<p class="music-status" role="status" ${problem || removing ? '' : 'hidden'}>${escape(problem || (removing ? t('Lied wird entfernt …', 'Removing track …') : ''))}</p>`;
    if (focusedAction) player.querySelector(`[data-music-action="${focusedAction}"]`)?.focus({preventScroll:true});
  }
  function updatePosition() {
    const slider = $('[data-music-seek]');
    if (!slider || !snapshot?.active || slider === document.activeElement) return;
    const p = position();slider.value = String(p);slider.style.setProperty('--music-progress', `${snapshot.duration > 0 ? p / snapshot.duration * 100 : 0}%`);
    const value = $('[data-music-position]');if (value) value.textContent = time(p);
  }
  function message(error) {
    if (error?.code === 'music/session-changed' || error?.code === 'music/queue-changed') return t('Die Wiedergabe hat sich geändert. Bitte erneut versuchen.', 'Playback changed. Please try again.');
    if (error?.code === 'music/unsupported') return t('Deine Musik-App unterstützt diese Funktion nicht.', 'Your music app does not support this action.');
    return t('Musiksteuerung gerade nicht verfügbar. Bitte erneut versuchen.', 'Music controls are currently unavailable. Please try again.');
  }
  async function refresh() {
    if (!visible() || reading) return;
    reading = true;
    try {
      const data = await SetwerkNative.call('music-state');
      if (!data?.supported) {problem = t('Musiksteuerung benötigt die aktualisierte Android-App.', 'Music controls require the updated Android app.');snapshot = null;}
      else {snapshot = data;receivedAt = Date.now();}
      if (removing && (snapshot?.sessionKey !== removing.sessionKey || snapshot?.next?.id !== removing.id)) removing = null;
      else if (removing && Date.now() > removing.until) {removing = null;problem = t('Deine Musik-App hat das Lied nicht entfernt. Bitte bearbeite die Warteschlange dort.', 'Your music app did not remove the track. Please edit the queue there.');}
      if (snapshot && !snapshot.granted) {removing = null;busy = false;}
      paint();
    } catch (error) {problem = message(error);snapshot = null;removing = null;paint();}
    finally {reading = false;}
  }
  async function command(action, value) {
    if (busy || (action === 'remove-next' && removing)) return;
    const s = snapshot;
    if (action !== 'connect' && !s?.active) return;
    const body = action === 'connect' ? {} : {sessionKey:s.sessionKey};
    if (action === 'seek') body.position = Math.max(0, Math.min(Number(value), Number(s.duration)));
    if (action === 'remove-next') body.nextId = s.next?.id;
    problem = '';busy = true;paint();
    try {
      await SetwerkNative.call('music-' + action, body);
      if (action === 'remove-next') removing = {id:body.nextId,sessionKey:body.sessionKey,until:Date.now() + 4000};
    } catch (error) {problem = message(error);expanded = true;}
    finally {busy = false;paint();await refresh();}
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false || !event.target.closest?.('.music-mini-title')) return;
    gesture = {id:event.pointerId,x:event.clientX,y:event.clientY};
    try {event.target.closest('.music-mini-title').setPointerCapture?.(event.pointerId);} catch (_) {}
  });
  document.addEventListener('pointerup', event => {
    const start = gesture;gesture = null;
    if (!start || start.id !== event.pointerId) return;
    const dy = event.clientY - start.y, dx = event.clientX - start.x;
    if (Math.abs(dy) < 40 || Math.abs(dy) < Math.abs(dx)*1.3) return;
    expanded = dy > 0;suppressClickUntil = Date.now()+400;paint();event.preventDefault();
  });
  document.addEventListener('pointercancel', () => {gesture = null;});
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-music-expand]')) {if(Date.now()>=suppressClickUntil){expanded=!expanded;paint();}return;}
    const b = event.target.closest?.('[data-music-action]');if (b && !b.disabled) command(b.dataset.musicAction);});
  document.addEventListener('input', event => {if (!event.target.matches?.('[data-music-seek]')) return;const input = event.target;input.style.setProperty('--music-progress', `${Number(input.value) / Number(input.max) * 100}%`);const label = $('[data-music-position]');if (label) label.textContent = time(input.value);});
  document.addEventListener('change', event => {if (event.target.matches?.('[data-music-seek]')) command('seek', event.target.value);});
  document.addEventListener('focusout', event => {if (event.target.closest?.('#setwerk-music')) setTimeout(paint, 0);});
  window.addEventListener('setwerk:render', () => {paint();refresh();});
  window.addEventListener('setwerk:resume', refresh);
  document.addEventListener('visibilitychange', () => {if (document.hidden) {snapshot = null;removing = null;}else refresh();});
  setInterval(() => {if (visible()) refresh();}, 1000);
  setInterval(() => {if (visible()) updatePosition();}, 250);
  paint();refresh();
  return {refresh};
})();
