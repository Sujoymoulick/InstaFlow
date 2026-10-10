/**
 * Instaflow SEO Suite - UI Shared Components (Toasts, Modals, Skeletons, Icons)
 */

export function showToast(message, type = 'info', duration = 3500) {
  let container = document.querySelector('.seo-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'seo-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `seo-toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warn' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderEmptyState(title, description, actionButton = null) {
  return `
    <div class="seo-card" style="text-align: center; padding: 3rem 1.5rem;">
      <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔍</div>
      <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--seo-text);">${escapeHtml(title)}</h3>
      <p style="font-size: 0.875rem; color: var(--seo-muted); max-width: 460px; margin: 0.5rem auto 1.5rem auto;">${escapeHtml(description)}</p>
      ${actionButton ? actionButton : ''}
    </div>
  `;
}

export function renderSkeletonLoader() {
  return `
    <div class="seo-card" style="animation: pulse 1.5s infinite ease-in-out;">
      <div style="height: 24px; background: var(--seo-border); border-radius: 4px; width: 40%; margin-bottom: 1rem;"></div>
      <div style="height: 120px; background: var(--seo-bg); border-radius: 8px; margin-bottom: 1rem;"></div>
      <div style="height: 16px; background: var(--seo-border); border-radius: 4px; width: 80%;"></div>
    </div>
    <style>
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    </style>
  `;
}
