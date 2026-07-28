import { language } from '../lang.js';

/**
 * UI Helper Utilities — ChatOps Chrome Extension
 */

/**
 * Displays a toast notification
 * @param {string} message
 * @param {number} [duration=2500]
 */
export function showToast(message, duration = 2500) {
  // Prevent multiple toasts at once
  const existing = document.querySelector('.chatops-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'chatops-toast';
  toast.textContent = message;
  
  // Style properties (matched with current implementation)
  Object.assign(toast.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    bottom: 'auto',
    left: 'auto',
    transform: 'translateX(120%)',
    zIndex: '10001'
  });
  
  document.body.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => {
    toast.style.transform = 'translateX(0)';
    toast.classList.add('visible');
  }, 10);
  
  // Auto remove
  setTimeout(() => {
    toast.style.transform = 'translateX(120%)';
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Renders loading state into an element
 * @param {HTMLElement} el 
 * @param {string} message 
 */
export function showLoading(el, message = language.loading) {
  if (!el) return;
  el.innerHTML = `<div class="loading-state"><span class="spinner"></span> ${message}</div>`;
}

/**
 * Renders error state into an element
 * @param {HTMLElement} el 
 * @param {string} message 
 */
export function showError(el, message) {
  if (!el) return;
  el.innerHTML = `<div class="empty-state error" style="color:var(--error)">❌ ${message}</div>`;
}

/**
 * Renders empty state into an element
 * @param {HTMLElement} el 
 * @param {string} message 
 */
export function showEmpty(el, message) {
  if (!el) return;
  el.innerHTML = `<div class="empty-state">${message}</div>`;
}

/**
 * Common initializer for Flatpickr with standardized elegant options.
 * @param {HTMLElement|string} el 
 * @param {Object} options 
 */
export function initCommonFlatpickr(el, options = {}) {
  if (typeof flatpickr !== 'function') {
    console.warn('[ChatOps Ext] Flatpickr is not available globally.');
    return null;
  }
  const futureNow = new Date(Date.now() + 1 * 60 * 1000);
  const userOnOpen = options.onOpen;

  return flatpickr(el, {
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    time_24hr: true,
    minuteIncrement: 1,
    disableMobile: true,
    defaultHour: futureNow.getHours(),
    defaultMinute: futureNow.getMinutes(),
    ...options,
    onOpen: function(selectedDates, dateStr, inst) {
      if (!inst.selectedDates.length && !inst.input.value) {
        const freshFuture = new Date(Date.now() + 1 * 60 * 1000);
        inst.set('defaultHour', freshFuture.getHours());
        inst.set('defaultMinute', freshFuture.getMinutes());
        if (inst.hourElement) inst.hourElement.value = String(freshFuture.getHours()).padStart(2, '0');
        if (inst.minuteElement) inst.minuteElement.value = String(freshFuture.getMinutes()).padStart(2, '0');
      }
      if (typeof userOnOpen === 'function') {
        userOnOpen.call(this, selectedDates, dateStr, inst);
      }
    }
  });
}


