export function initTheme() {
  const saved = localStorage.getItem('vtms_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  return saved;
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('vtms_theme', next);
  return next;
}
