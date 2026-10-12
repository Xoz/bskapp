(() => {
  'use strict';
  if (location.origin !== 'https://bsk2014.se' || window.top !== window) return;
  let last = '';
  let pending = false;
  const refresh = () => {
    pending = false;
    const root = document.documentElement;
    if (!root) return;
    if (!document.getElementById('bsk-desktop-theme')) {
      const style = document.createElement('style');
      style.id = 'bsk-desktop-theme';
      style.textContent = window.__bskDesktopCSS;
      (document.head || root).append(style);
    }
    root.dataset.bskMac = 'true';
    root.dataset.bskPage = location.pathname.split('/')[1] || 'welcome';
    const signedIn = !!document.querySelector('.bsk-header-actions form button[aria-label="Logga ut"]');
    const paths = signedIn ? Array.from(document.querySelectorAll('.bsk-header-nav a, .bsk-header-inner > a, .bsk-tools-dialog a'))
      .map(a => new URL(a.href, location.href))
      .filter(url => url.origin === location.origin)
      .map(url => url.pathname) : [];
    const message = {
      path: location.pathname,
      title: document.querySelector('main h1')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim() || 'Välkommen',
      user: document.querySelector('.bsk-coach-name')?.textContent?.trim() || '',
      signedIn,
      paths: Array.from(new Set(paths)),
      dark: root.dataset.theme === 'dark',
      planSaved: !!document.querySelector('.match-plan-summary')
    };
    const serialized = JSON.stringify(message);
    if (serialized !== last) {
      window.webkit.messageHandlers.bskDesktop.postMessage(message);
      last = serialized;
    }
  };
  const schedule = () => {
    if (!pending) { pending = true; requestAnimationFrame(refresh); }
  };
  new MutationObserver(schedule).observe(document, { childList: true, subtree: true });
  const observeTheme = () => {
    if (document.documentElement) new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
  document.addEventListener('DOMContentLoaded', () => { observeTheme(); refresh(); });
  window.addEventListener('pageshow', schedule);
  window.addEventListener('popstate', schedule);
  refresh();
})();
