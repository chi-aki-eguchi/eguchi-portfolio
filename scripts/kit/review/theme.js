// Same preference and defaults as the public site's useDarkMode / theme-colors.
// Runs before CSS so the first paint uses the right theme. Localhost and the
// public domain have separate storage; this never changes the public site's state.
(() => {
  const key = 'theme-preference';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';
  const valid = value => value === 'light' || value === 'dark' ? value : 'system';
  try { preference = valid(localStorage.getItem(key)); } catch { /* Storage may be unavailable. */ }
  function apply() {
    const dark = preference === 'dark' || (preference === 'system' && system.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121212' : '#f7f7f7');
    document.querySelector('.theme-toggle')?.setAttribute('aria-label', dark ? '明るい表示にする' : '暗い表示にする');
  }
  apply();
  system.addEventListener('change', () => { if (preference === 'system') apply(); });
  addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = valid(event.newValue); apply(); }
  });
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.theme-toggle');
    button.hidden = false;
    apply();
    button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch { /* Switching still works in this tab. */ }
      apply();
    });
  });
})();
