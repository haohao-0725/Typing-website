// Run before CSS so a saved theme is applied before the first paint.
(() => {
  const key = 'zijian.theme.v1';
  const valid = value => value === 'light' || value === 'dark';
  let preference = null, media = null, button = null;
  try { const saved = localStorage.getItem(key); if (valid(saved)) preference = saved; } catch {}
  try { media = window.matchMedia('(prefers-color-scheme: dark)'); } catch {}
  function apply() {
    const dark = (preference || (media?.matches ? 'dark' : 'light')) === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    if (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.title = dark ? button.dataset.lightLabel : button.dataset.darkLabel;
    }
  }
  apply();
  media?.addEventListener('change', () => { if (!preference) apply(); });
  document.addEventListener('DOMContentLoaded', () => {
    button = document.getElementById('theme-toggle');
    if (!button) return;
    apply();
    button.addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(key, preference); } catch {}
      apply();
    });
  });
})();
