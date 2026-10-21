/* Website analytics: load the Google tag only after an explicit opt-in. */
(() => {
  'use strict';
  if (window.AndroidGym) return;
  const TAG_ID = 'G-LN5XDNS42W';
  const CONSENT_KEY = 'setwerk.analytics-consent.v1';
  const DISABLE_KEY = 'ga-disable-' + TAG_ID;
  const denied = {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'};
  const labels = {
    de: {
      title: 'Nutzungsstatistik',
      text: 'Mit deiner Zustimmung nutzen wir Google Analytics, um die Nutzung von Setwerk auszuwerten. Dabei werden Cookies gespeichert. Du kannst deine Auswahl jederzeit unter „Statistik-Einstellungen“ ändern.',
      accept: 'Zustimmen', decline: 'Ablehnen', settings: 'Statistik-Einstellungen', close: 'Schließen'
    },
    en: {
      title: 'Usage statistics',
      text: 'With your consent, we use Google Analytics to understand how Setwerk is used. This stores cookies. You can change your choice at any time under “Statistics settings”.',
      accept: 'Accept', decline: 'Decline', settings: 'Statistics settings', close: 'Close'
    }
  };
  const validChoice = value => ['granted', 'denied'].includes(value) ? value : null;
  function readChoice() {
    try { return validChoice(localStorage.getItem(CONSENT_KEY)); } catch { return null; }
  }
  let choice = readChoice(), configured = false, returnFocus = null;
  window[DISABLE_KEY] = true;

  function clearAnalyticsCookies() {
    const hostname = location.hostname, domains = ['', hostname];
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) domains.push(parts.slice(i).join('.'));
    for (const entry of document.cookie.split(';')) {
      const name = entry.trim().split('=')[0];
      if (!/^(_ga(?:_|$)|_gid$|_gat(?:_|$))/.test(name)) continue;
      for (const domain of domains) document.cookie = name + '=; Max-Age=0; Path=/' + (domain ? '; Domain=' + domain : '');
    }
  }
  function applyChoice() {
    window[DISABLE_KEY] = choice !== 'granted';
    if (choice !== 'granted') {
      if (configured) window.gtag('consent', 'update', denied);
      clearAnalyticsCookies();
      return;
    }
    if (!configured) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', denied);
    }
    window.gtag('consent', 'update', {...denied, analytics_storage: 'granted'});
    if (configured) return;
    configured = true;
    window.gtag('js', new Date());
    // Exclude URL parameters/fragments, names and workout data from this integration.
    window.gtag('config', TAG_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: location.origin + location.pathname,
      page_referrer: '',
      page_title: 'Setwerk'
    });
    const script = document.createElement('script');
    script.id = 'setwerk-google-tag';
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + TAG_ID;
    document.head.append(script);
  }

  const banner = document.createElement('section');
  banner.id = 'analytics-consent';
  banner.setAttribute('aria-labelledby', 'analytics-consent-title');
  banner.innerHTML = '<div class="analytics-consent-heading"><h2 id="analytics-consent-title" tabindex="-1"></h2><button type="button" class="analytics-consent-close" data-analytics-close hidden>×</button></div><p data-analytics-text></p><div class="analytics-consent-actions"><button type="button" data-analytics-choice="denied"></button><button type="button" data-analytics-choice="granted"></button></div>';
  document.body.append(banner);

  function updateUI() {
    const text = labels[document.documentElement.lang === 'en' ? 'en' : 'de'];
    banner.querySelector('h2').textContent = text.title;
    banner.querySelector('[data-analytics-text]').textContent = text.text;
    banner.querySelector('[data-analytics-choice="granted"]').textContent = text.accept;
    banner.querySelector('[data-analytics-choice="denied"]').textContent = text.decline;
    const close = banner.querySelector('[data-analytics-close]');
    close.hidden = !choice;
    close.setAttribute('aria-label', text.close);
    const main = document.querySelector('#app .main');
    if (main && !main.querySelector('[data-analytics-settings]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'analytics-settings';
      button.dataset.analyticsSettings = '';
      button.addEventListener('click', () => {
        returnFocus = button;
        banner.hidden = false;
        banner.querySelector('h2').focus();
      });
      main.append(button);
    }
    document.querySelectorAll('[data-analytics-settings]').forEach(button => { button.textContent = text.settings; });
  }
  function closeBanner() {
    banner.hidden = true;
    if (returnFocus?.isConnected) returnFocus.focus();
    returnFocus = null;
  }
  banner.addEventListener('click', event => {
    const button = event.target.closest('[data-analytics-choice]');
    if (button) {
      choice = validChoice(button.dataset.analyticsChoice);
      try { localStorage.setItem(CONSENT_KEY, choice); } catch { /* Keep this visit's choice in memory. */ }
      applyChoice();
      updateUI();
      closeBanner();
    } else if (event.target.closest('[data-analytics-close]') && choice) closeBanner();
  });
  banner.addEventListener('keydown', event => { if (event.key === 'Escape' && choice) closeBanner(); });
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT_KEY && event.key !== null) return;
    choice = readChoice();
    applyChoice();
    updateUI();
    banner.hidden = !!choice;
  });
  window.addEventListener('setwerk:render', updateUI);
  banner.hidden = !!choice;
  updateUI();
  applyChoice();
})();
