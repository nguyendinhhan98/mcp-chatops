/**
 * Content Script for ChatOps domain
 */

import { MESSAGE_TYPES, UI_CONFIG, SELECTORS, STORAGE_KEYS, ALARMS, DEFAULT_MEMES } from '../src/constants.js';
import { language, loadLanguage } from '../src/lang.js';
import { needsChatOpsConversion, convertForChatOps } from '../src/utils/imageConverter.js';
import { formatRichText, escapeHtml } from '../src/utils/formatter.js';

const DEFAULT_SETTINGS = {
  spamEnabled: true,
  memeEnabled: true,
  showTabs: { search: true, tasks: true, notes: true, missed: true, reactions: true },
  floatingButtons: { quickNote: true, quickTask: true, spamReactions: false, imagePicker: true, templatePicker: true, quickReply: true, quickCopy: true, groupReminder: true, quickMeet: true },
  spamEmojis: ['thumbsup', 'heart', 'fire', 'rocket', 'tada', 'laughing', 'smile', 'wink', 'heart_eyes', 'kissing_heart'],
  tabsCompactMode: false,
  snoozeMinutes: 5,
  notificationPosition: 'center',
  notificationAnimation: 'default',
  notificationSize: 'medium'
};

// Global UI elements shared between the message listeners and page DOM
let quickNotePopover = null;
let quickNoteBackdrop = null;
let imagePickerEl = null;
let templatePickerEl = null;
let observer = null;
let globalInsertImageToChat = null;
let activeChatTextarea = null;
let updateImagePickerTranslations = null;
let updateTemplatePickerTranslations = null;
let updateResizeModalTranslations = null;
let currentResizeImageObj = null;
let updateImageEditorTranslations = null;
let updateTaskCreateButtonTranslations = null;
let updateHeaderButtonsTranslations = null;
let updateGroupReminderButtonTranslations = null;
let updateMeetCreateButtonTranslations = null;
// Tracks the last right-clicked post element for context menu reply-quote feature
let lastRightClickedPostEl = null;
// Tracks active reaction group dropdown for spam button right-click
let activeReactionDropdown = null;


function runWithObserverDisabled(fn) {
  if (observer) {
    observer.disconnect();
  }
  try {
    fn();
  } finally {
    if (observer) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }
}
function initCommonFlatpickr(el, options = {}) {
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


// --- Listen for reminder notifications from the background script ---

async function handleOpenPostThread(postId, rootId) {
  if (!postId) return;
  console.log(`[ChatOps Ext] Request to open thread for postId: ${postId}, rootId: ${rootId}`);
  
  let attempts = 0;
  const maxAttempts = 30; // 15 seconds max polling
  
  const interval = setInterval(() => {
    attempts++;
    // Look for post in the DOM
    const postEl = document.getElementById(`post_${postId}`) || 
                   document.getElementById(`rhsPost_${postId}`) || 
                   document.getElementById(`rhs_post_${postId}`) ||
                   document.querySelector(`[id$="_${postId}"]`) || // generic match
                   (rootId ? (document.getElementById(`post_${rootId}`) || document.getElementById(`rhsPost_${rootId}`)) : null);
                   
    if (postEl) {
      clearInterval(interval);
      console.log(`[ChatOps Ext] Found target post element:`, postEl);
      
      // Let's find the reply button in this post element
      // Mattermost reply buttons usually have class `.comment-icon__container`, `[aria-label*="reply" i]`, or `[aria-label*="phản hồi" i]`
      const replyBtn = postEl.querySelector(
        'button[aria-label*="reply" i], button[aria-label*="comment" i], button[aria-label*="phản hồi" i], .comment-icon__container, button[class*="reply" i], button[class*="comment" i], [class*="comment-icon" i]'
      );
      
      if (replyBtn) {
        console.log(`[ChatOps Ext] Clicking reply button:`, replyBtn);
        replyBtn.click();
      } else {
        // Fallback: If no reply button is found inside the post element, let's search in the hover menus or search the post's action menu
        const postActions = postEl.querySelector('.post-menu, .post__actions, .dot-menu__container, [class*="post-menu"], .post-action-menu');
        if (postActions) {
          const actionReplyBtn = postActions.querySelector('button[aria-label*="reply" i], button[aria-label*="comment" i], button[aria-label*="phản hồi" i]');
          if (actionReplyBtn) {
            console.log(`[ChatOps Ext] Clicking reply button in post menu:`, actionReplyBtn);
            actionReplyBtn.click();
            return;
          }
        }
        console.warn(`[ChatOps Ext] Reply button not found on post.`);
      }
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(interval);
      console.warn(`[ChatOps Ext] Target post ${postId} not found in DOM after 15s.`);
    }
  }, 500);
}

async function injectDynamicTheme() {
  // Inject Google Font Inter so the webpage popover modal has access to the exact same premium font as the sidepanel
  let fontLink = document.getElementById('chatops-google-font');
  if (!fontLink) {
    fontLink = document.createElement('link');
    fontLink.id = 'chatops-google-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  const res = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
  const settings = res[STORAGE_KEYS.SETTINGS] || {};
  
  const accentColor = (settings.accentColor && settings.accentColor !== 'undefined') ? settings.accentColor : '#1c58d9';
  const accentTextColor = (settings.accentTextColor && settings.accentTextColor !== 'undefined') ? settings.accentTextColor : '#ffffff';
  
  let styleEl = document.getElementById('chatops-dynamic-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'chatops-dynamic-theme';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root {
      --chatops-accent: ${accentColor};
      --chatops-header: ${accentColor};
    }
    .chatops-reminder-banner { border-top-color: var(--chatops-accent) !important; }
    .crb-title { color: var(--chatops-accent) !important; }
    .crb-progress { background: var(--chatops-accent) !important; }
    .chatops-btn-primary { background: var(--chatops-accent) !important; color: ${accentTextColor} !important; }
    .cqn-mode-btn.active { color: var(--chatops-accent) !important; border-color: var(--chatops-accent) !important; background: rgba(0,0,0,0.05) !important; }
    .cqn-preview { border-left-color: var(--chatops-accent) !important; }
    .chatops-toast { background: var(--chatops-accent) !important; color: ${accentTextColor} !important; border-left: none !important; }
  `;
}

/**
 * Handles side panel opening, switching to tasks tab, and redirecting to the thread
 */
async function handleNotificationJump(postId, taskTeamName) {
  try {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL }).catch(() => {});
    chrome.storage.local.set({ [STORAGE_KEYS.SIDEPANEL_TAB]: 'tasks' });
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tab: 'tasks' }).catch(() => {});
    }, 150);
  } catch (err) {
    console.warn('[ChatOps Ext] Failed to trigger side panel tasks tab:', err);
  }

  const currentTeamFromUrl = window.location.pathname.split('/')[1];
  const targetTeam = taskTeamName || currentTeamFromUrl || CHATOPS_CONFIG.DEFAULT_TEAM;
  if (postId) {
    const targetPath = `/${targetTeam}/pl/${postId}`;
    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
    handleOpenPostThread(postId);
  } else if (taskTeamName && currentTeamFromUrl !== taskTeamName) {
    const targetPath = `/${taskTeamName}`;
    window.history.pushState(null, '', targetPath);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

/**
 * Plays a premium dual-tone sound alert using Web Audio API
 */
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // First Beep: Tone D5 (587.33 Hz)
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.15);

    // Second Beep: Tone A5 (880.00 Hz) after 150ms delay
    setTimeout(() => {
      try {
        const audioCtx2 = new (window.AudioContext || window.webkitAudioContext)();
        const osc2 = audioCtx2.createOscillator();
        const gain2 = audioCtx2.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx2.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880.00, audioCtx2.currentTime);
        gain2.gain.setValueAtTime(0.15, audioCtx2.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx2.currentTime + 0.25);
        osc2.start(audioCtx2.currentTime);
        osc2.stop(audioCtx2.currentTime + 0.25);
      } catch (e2) {}
    }, 150);
  } catch (err) {
    console.warn('[ChatOps Ext] Sound synthesis failed:', err);
  }
}

/**
 * Checks if there are overdue pending tasks and displays a digest banner
 */
function checkAndShowOverdueDigest(memos) {
  if (!memos || !Array.isArray(memos)) return;
  const now = Date.now();
  const overdueTasks = memos.filter(t => {
    if (t.type !== 'task' || t.done) return false;
    if (!t.reminder) return false;
    const reminderMs = new Date(t.reminder).getTime();
    return reminderMs && reminderMs < now;
  });

  if (overdueTasks.length === 0) return;

  let dismissedKeys = [];
  try {
    const stored = localStorage.getItem('chatops_dismissed_overdue');
    if (stored) {
      dismissedKeys = JSON.parse(stored);
    }
  } catch (e) {
    console.error('[ChatOps Ext] Error parsing dismissed overdue tasks:', e);
  }

  const newOverdueTasks = overdueTasks.filter(t => {
    const key = t.id + '_' + new Date(t.reminder).getTime();
    return !dismissedKeys.includes(key);
  });
  if (newOverdueTasks.length === 0) return;

  // Show the page-level banner
  const overdueKeys = overdueTasks.map(t => t.id + '_' + new Date(t.reminder).getTime());
  showMissedRemindersDigestBanner(newOverdueTasks.length, overdueKeys);
}

/**
 * Displays a page-level banner summarizing missed reminders
 */
async function showMissedRemindersDigestBanner(count, overdueKeys) {
  await injectDynamicTheme();

  // If there's already a digest banner, do not display a new one
  const existingBanner = document.querySelector('.chatops-reminder-banner[data-digest="true"]');
  if (existingBanner) return;

  let settings = {};
  try {
    const resSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    const rawSettings = resSettings[STORAGE_KEYS.SETTINGS] || {};
    settings = { ...DEFAULT_SETTINGS, ...rawSettings };
  } catch (err) {
    console.warn('[ChatOps Ext] Failed to read settings:', err);
  }

  let container = document.getElementById('chatops-banner-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'chatops-banner-container';
    document.body.appendChild(container);
  }

  // Determine container position style & direction based on settings
  let positionCss = 'top: 24px; right: 20px;';
  let alignCss = 'align-items: flex-end;';
  const pos = settings.notificationPosition || 'center';
  if (pos === 'top-left') {
    positionCss = 'top: 24px; left: 20px;';
    alignCss = 'align-items: flex-start;';
  } else if (pos === 'bottom-right') {
    positionCss = 'bottom: 24px; right: 20px;';
    alignCss = 'align-items: flex-end;';
  } else if (pos === 'bottom-left') {
    positionCss = 'bottom: 24px; left: 20px;';
    alignCss = 'align-items: flex-start;';
  } else if (pos === 'top-center') {
    positionCss = 'top: 24px; left: 50%; transform: translateX(-50%);';
    alignCss = 'align-items: center;';
  } else if (pos === 'bottom-center') {
    positionCss = 'bottom: 24px; left: 50%; transform: translateX(-50%);';
    alignCss = 'align-items: center;';
  } else if (pos === 'center') {
    positionCss = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
    alignCss = 'align-items: center;';
  }

  let flexDir = 'flex-direction: column;';
  if (pos.startsWith('bottom')) {
    flexDir = 'flex-direction: column-reverse;';
  }

  let containerWidth = '310px';
  const size = settings.notificationSize || 'medium';
  if (size === 'small') {
    containerWidth = '250px';
  } else if (size === 'large') {
    containerWidth = '370px';
  }

  container.style.cssText = `position: fixed; ${positionCss} width: ${containerWidth}; display: flex; ${flexDir} ${alignCss} gap: 12px; z-index: 2147483647; pointer-events: none; transition: all 0.3s ease;`;

  const animStyle = settings.notificationAnimation || 'default';
  const animationClass = animStyle !== 'default' ? `animation-${animStyle}` : '';
  const sizeClass = `size-${size}`;

  const banner = document.createElement('div');
  banner.className = `chatops-reminder-banner ${sizeClass} ${animationClass}`;
  banner.setAttribute('data-digest', 'true');

  const title = language.missedRemindersTitle || 'Missed Reminders';
  const bodyText = (language.missedRemindersDigest || 'You missed {count} task reminders while you were away.').replace('{count}', count);
  const viewBtnText = language.missedRemindersView || 'View Missed Tasks';

  banner.innerHTML = `
    <div class="crb-inner" style="cursor: pointer;">
      <div class="crb-icon">⚠️</div>
      <div class="crb-content" style="display:flex; flex-direction:column; min-width:0; flex:1;">
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom: 3px;">
          <div class="crb-title" style="margin-bottom:0; color: var(--danger, #d0454c); font-weight:700;">${title}</div>
        </div>
        <div class="crb-text">${bodyText}</div>
      </div>
      <button class="crb-close" title="${language.memoDelete || 'Close'}">×</button>
    </div>
    <div class="crb-task-actions" style="display: flex; flex-direction: column; gap: 6px;">
      <button class="crb-view-missed-btn" style="background: var(--accent, #1c58d9); color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-weight: 600; cursor: pointer; text-align: center; width: 100%; transition: background 0.2s;">${viewBtnText}</button>
    </div>
  `;
  container.appendChild(banner);

  setTimeout(() => banner.classList.add('visible'), 10);

  const dismissBanner = () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 400);
    try {
      let currentDismissed = [];
      const stored = localStorage.getItem('chatops_dismissed_overdue');
      if (stored) {
        currentDismissed = JSON.parse(stored);
      }
      const merged = Array.from(new Set([...currentDismissed, ...overdueKeys]));
      localStorage.setItem('chatops_dismissed_overdue', JSON.stringify(merged));
    } catch (e) {}
  };

  banner.querySelector('.crb-close').addEventListener('click', (e) => {
    e.stopPropagation();
    dismissBanner();
  });

  banner.querySelector('.crb-inner').addEventListener('click', (e) => {
    if (e.target.closest('.crb-close')) return;
    dismissBanner();
    chrome.storage.local.set({ [STORAGE_KEYS.SIDEPANEL_TAB]: 'tasks' }, () => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL }).catch(() => {});
      chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tab: 'tasks' }).catch(() => {});
    });
  });

  const viewBtn = banner.querySelector('.crb-view-missed-btn');
  viewBtn.addEventListener('click', () => {
    dismissBanner();
    chrome.storage.local.set({ [STORAGE_KEYS.SIDEPANEL_TAB]: 'tasks' }, () => {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL }).catch(() => {});
      chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tab: 'tasks' }).catch(() => {});
    });
  });
}

/**
 * Displays a reminder banner at the top of the page
 */
async function showReminderBanner(text, taskId, isTask = false, postId = null, taskTeamName = null, isDaily = false) {
  await injectDynamicTheme();

  // If there's already a banner for this taskId, do not display a new one to prevent duplication/jumping
  if (taskId) {
    const existingBanner = document.querySelector(`.chatops-reminder-banner[data-task-id="${taskId}"]`);
    if (existingBanner) {
      console.log('[ChatOps Ext] Banner already visible for task:', taskId);
      return;
    }
  }

  let settings = {};
  // Play notification sound if enabled
  try {
    const resSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    const rawSettings = resSettings[STORAGE_KEYS.SETTINGS] || {};
    settings = { ...DEFAULT_SETTINGS, ...rawSettings };
    if (settings.soundNotification) {
      playNotificationSound();
    }
  } catch (err) {
    console.warn('[ChatOps Ext] Failed to read sound settings:', err);
  }

  let container = document.getElementById('chatops-banner-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'chatops-banner-container';
    document.body.appendChild(container);
  }

  // Determine container position style & direction based on settings
  let positionCss = 'top: 24px; right: 20px;';
  let alignCss = 'align-items: flex-end;';
  const pos = settings.notificationPosition || 'center';
  if (pos === 'top-left') {
    positionCss = 'top: 24px; left: 20px;';
    alignCss = 'align-items: flex-start;';
  } else if (pos === 'bottom-right') {
    positionCss = 'bottom: 24px; right: 20px;';
    alignCss = 'align-items: flex-end;';
  } else if (pos === 'bottom-left') {
    positionCss = 'bottom: 24px; left: 20px;';
    alignCss = 'align-items: flex-start;';
  } else if (pos === 'top-center') {
    positionCss = 'top: 24px; left: 50%; transform: translateX(-50%);';
    alignCss = 'align-items: center;';
  } else if (pos === 'bottom-center') {
    positionCss = 'bottom: 24px; left: 50%; transform: translateX(-50%);';
    alignCss = 'align-items: center;';
  } else if (pos === 'center') {
    positionCss = 'top: 50%; left: 50%; transform: translate(-50%, -50%);';
    alignCss = 'align-items: center;';
  }

  let flexDir = 'flex-direction: column;';
  if (pos.startsWith('bottom')) {
    flexDir = 'flex-direction: column-reverse;';
  }

  let containerWidth = '310px';
  const size = settings.notificationSize || 'medium';
  if (size === 'small') {
    containerWidth = '250px';
  } else if (size === 'large') {
    containerWidth = '370px';
  }

  container.style.cssText = `position: fixed; ${positionCss} width: ${containerWidth}; display: flex; ${flexDir} ${alignCss} gap: 12px; z-index: 2147483647; pointer-events: none; transition: all 0.3s ease;`;

  const isLongText = text.length > 80 || text.includes('\n');
  const escText = text.replace(/</g, '&lt;');

  const animStyle = settings.notificationAnimation || 'default';
  const animationClass = animStyle !== 'default' ? `animation-${animStyle}` : '';
  const sizeClass = `size-${size}`;

  const banner = document.createElement('div');
  banner.className = `chatops-reminder-banner ${sizeClass} ${animationClass}`;
  if (taskId) banner.dataset.taskId = taskId;
  banner.innerHTML = `
    <div class="crb-inner">
      <div class="crb-icon">${isTask ? '📋' : '⏰'}</div>
      <div class="crb-content" style="display:flex; flex-direction:column; min-width:0; flex:1;">
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; margin-bottom: 3px;">
          <div class="crb-title" style="margin-bottom:0;">${isTask ? language.reminderTaskTitle : language.reminderTitle}</div>
          ${isLongText ? `<button class="crb-collapse-btn collapse-btn" style="margin-left:8px;" title="${language.expandCollapseBtn || 'Expand/Collapse'}"></button>` : ''}
        </div>
        <div class="crb-text ${isLongText ? 'collapsed' : ''}">${formatRichText(text)}</div>
      </div>
      <button class="crb-close" title="${language.memoDelete}">×</button>
    </div>
    ${isTask ? `
      <div class="crb-task-actions" style="display: flex; flex-direction: column; gap: 6px;">
        <button class="crb-done-btn" data-task-id="${taskId}">${language.reminderDoneBtn}</button>
        ${isDaily ? `<button class="crb-skip-btn" data-task-id="${taskId}">${language.reminderSkipBtn || 'Bỏ qua hôm nay'}</button>` : ''}
        ${postId ? `<button class="crb-jump-btn" data-post-id="${postId}">${language.viewMessage}</button>` : ''}
      </div>
    ` : ''}
    <div class="crb-progress" style="display: none !important;"></div>
  `;
  container.appendChild(banner);

  const progressEl = banner.querySelector('.crb-progress');

  setTimeout(() => banner.classList.add('visible'), 10);

  let closeTimer = null; // Indefinite display

  banner.querySelector('.crb-close').addEventListener('click', () => {
    banner.classList.remove('visible');
    setTimeout(() => banner.remove(), 400);
  });

  const innerEl = banner.querySelector('.crb-inner');
  if (innerEl) {
    innerEl.addEventListener('click', async (e) => {
      if (e.target.closest('.crb-close') || e.target.closest('.crb-collapse-btn')) {
        return;
      }
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 400);
      await handleNotificationJump(postId, taskTeamName);
    });
  }

  if (isLongText) {
    const collBtn = banner.querySelector('.crb-collapse-btn');
    const textEl = banner.querySelector('.crb-text');
    if (collBtn && textEl) {
      setTimeout(() => {
        const isOverflowing = textEl.scrollHeight > textEl.clientHeight + 1;
        if (!isOverflowing) {
          collBtn.style.display = 'none';
          textEl.classList.remove('collapsed');
        }
      }, 20);

      collBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = textEl.classList.toggle('collapsed');
        collBtn.classList.toggle('expanded', !isCollapsed);
      });
    }
  }

  if (isTask && taskId) {
    banner.querySelector('.crb-done-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MARK_TASK_DONE, taskId });
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 400);
    });

    const skipBtn = banner.querySelector('.crb-skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SKIP_TASK_DAILY, taskId });
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 400);
      });
    }

    const jumpBtn = banner.querySelector('.crb-jump-btn');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        banner.classList.remove('visible');
        setTimeout(() => banner.remove(), 400);
        await handleNotificationJump(postId, taskTeamName);
      });
    }
  }
}


/**
 * Displays a toast notification
 */
function showToast(msg, duration = UI_CONFIG.TOAST_DURATION) {
  const existing = document.querySelector('.chatops-toast');
  if (existing) existing.remove();

  const t = document.createElement('div');
  t.className = 'chatops-toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    bottom: 'auto',
    left: 'auto',
    transform: 'translateX(120%)',
    zIndex: '10001'
  });
  document.body.appendChild(t);
  setTimeout(() => {
    t.style.transform = 'translateX(0)';
    t.classList.add('visible');
  }, 10);
  setTimeout(() => {
    t.style.transform = 'translateX(120%)';
    t.classList.remove('visible');
    setTimeout(() => t.remove(), 300);
  }, duration);
}


(async function () {
  // Inject bridge script to access React Fiber elements in page context
  function injectMainWorldScript() {
    const id = 'chatops-main-world-bridge';
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = chrome.runtime.getURL('content/inject.js');
    (document.head || document.documentElement).appendChild(script);
  }
  injectMainWorldScript();

  await loadLanguage();
  injectDynamicTheme();

  function openSidePanel() {
    try {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OPEN_SIDE_PANEL }).catch(() => {});
    } catch (err) {}
  }

  let isFloatingBtnClosed = false;

  // Clean up any legacy extension elements left over from previous script runs to avoid duplicates
  const oldBtn = document.getElementById('chatops-ext-floating-btn');
  if (oldBtn) oldBtn.remove();
  const oldBadge = document.getElementById('chatops-ext-floating-badge');
  if (oldBadge) oldBadge.remove();
  document.querySelectorAll('.chatops-ext-image-picker-btn, .chatops-image-picker, .chatops-action-group').forEach(el => el.remove());

  const btn = document.createElement('div');
  btn.id = 'chatops-ext-floating-btn';
  btn.title = language.floatingBtnTitle;
  btn.style.cursor = 'pointer';

  const BUBBLE_SVG = `
    <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" style="width:38px; height:38px; display:block;">
      <circle cx="256" cy="240" r="210" fill="#43a047"/>
      <path d="M160 400 L120 480 L260 420" fill="#43a047"/>
      <circle cx="165" cy="240" r="32" fill="white"/>
      <circle cx="256" cy="240" r="32" fill="white"/>
      <circle cx="347" cy="240" r="32" fill="white"/>
    </svg>
  `;

  btn.innerHTML = BUBBLE_SVG;

  // Tiny "X" button to hide the floating button
  const closeIconBtn = document.createElement('div');
  closeIconBtn.id = 'chatops-ext-close-btn';
  closeIconBtn.innerHTML = '×';
  closeIconBtn.title = language.floatingBtnHide;
  btn.appendChild(closeIconBtn);

  // Red badge for pending tasks count disabled per user request

  closeIconBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isFloatingBtnClosed = true;
    btn.remove();
  });
  closeIconBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  closeIconBtn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  // Function to align the floating button under the last team icon
  function alignButtonToSidebar() {
    if (isFloatingBtnClosed) return;
    // Find Mattermost team sidebar scroller or wrapper first, falling back to outer team sidebar
    let teamSidebar = document.querySelector(
      '.team-sidebar .team-wrapper, [class*="team-sidebar-items"], [class*="team-sidebar__scroller"], .team-wrapper, .team-sidebar, #teamSidebar, [class*="team-sidebar"]'
    );
    if (teamSidebar) {
      // Ensure the team sidebar is actually on the left side of the screen (to avoid matching elements inside posts/chatbox)
      const rect = teamSidebar.getBoundingClientRect();
      if (rect.left > 200) {
        teamSidebar = null; // Ignore if not on the left
      }
    }
    if (teamSidebar) {
      const teamItems = teamSidebar.querySelectorAll('a, .team-btn, [class*="team-container"], [class*="team-btn"]');
      if (teamItems && teamItems.length > 0) {
        const lastTeam = teamItems[teamItems.length - 1];
        if (btn.parentNode !== lastTeam.parentNode) {
          lastTeam.parentNode.insertBefore(btn, lastTeam.nextSibling);
        }
      } else {
        if (btn.parentNode !== teamSidebar) {
          teamSidebar.appendChild(btn);
        }
      }
      btn.classList.add('in-sidebar');
      btn.style.left = '';
      btn.style.top = '';
      btn.style.bottom = '';
      btn.style.right = '';
      btn.style.transform = '';
    } else {
      if (btn.parentNode !== document.body) {
        document.body.appendChild(btn);
      }
      btn.classList.remove('in-sidebar');
      btn.style.left = '';
      btn.style.top = '';
      btn.style.bottom = '160px';
      btn.style.right = '20px';
      btn.style.transform = '';
    }
  }

  async function updateFloatingBadgeCount() {
    // Disabled per user request
  }

  alignButtonToSidebar();
  updateFloatingBadgeCount();
  // Recalculate once DOM/React page has fully loaded
  window.addEventListener('load', () => {
    alignButtonToSidebar();
    updateFloatingBadgeCount();
  });
  setTimeout(() => {
    alignButtonToSidebar();
    updateFloatingBadgeCount();
  }, 1500); // 1.5s robust fallback

  // Periodically align button to vertical sidebar to survive Mattermost React updates/re-renders
  setInterval(alignButtonToSidebar, 2000);

  const handleFloatingBtnClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.TOGGLE_SIDE_PANEL });
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        showToast(language.extensionUpdated);
      }
    }
  };

  btn.addEventListener('click', handleFloatingBtnClick);
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  btn.addEventListener('mouseup', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  console.log('[ChatOps Ext] Floating button injected.');

  // --- Image Integration into Main & RHS Chat UI ---
  function injectImageButton() {
    const floatingButtons = cachedSettings.floatingButtons || { quickNote: true, quickTask: true, spamReactions: true, imagePicker: true, quickReply: false, quickCopy: false };
    const memeEnabled = (cachedSettings.memeEnabled !== false) && (floatingButtons.imagePicker !== false);
    
    const targets = [
      { id: 'emojiPickerButton', textboxId: 'post_textbox', btnId: 'chatops-ext-image-btn' },
      { id: 'rhsEmojiPickerButton', textboxId: 'reply_textbox', btnId: 'chatops-ext-image-btn-rhs' }
    ];

    targets.forEach(target => {
      // Prioritize scoped search inside the specific textbox container to avoid duplicate ID issues
      const textbox = document.getElementById(target.textboxId) || 
        (target.textboxId === 'reply_textbox' 
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));

      let emojiBtn = null;
      if (textbox) {
        const container = textbox.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
        if (container) {
          // Find the emoji button belonging exclusively to this chatbox container
          emojiBtn = container.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i], button[aria-label*="Emoji"], button[class*="emoji" i], .emoji-picker__container button, button[id*="Emoji"]');
        }
      }

      // Fallback to global ID if scoped lookup is not found
      if (!emojiBtn) {
        emojiBtn = document.getElementById(target.id);
      }

      if (!emojiBtn) {
        return;
      }

      const parent = emojiBtn.parentNode;
      if (!parent) return;

      const existingBtn = parent.querySelector('.chatops-ext-image-picker-btn');

      if (!memeEnabled) {
        if (existingBtn) existingBtn.remove();
        delete emojiBtn.dataset.chatopsImageInjected;
        return;
      }

      if (existingBtn) {
        emojiBtn.dataset.chatopsImageInjected = 'true';
        if (!existingBtn.id) {
          existingBtn.id = target.btnId;
        }
        return;
      }

      const imageBtn = document.createElement('button');
      imageBtn.id = target.btnId;
      imageBtn.type = 'button';
      imageBtn.className = 'chatops-ext-image-picker-btn';
      imageBtn.innerHTML = '🖼️';
      imageBtn.title = 'Quick Image Picker';
      imageBtn.dataset.targetTextbox = target.textboxId;
      parent.insertBefore(imageBtn, emojiBtn.nextSibling);

      emojiBtn.dataset.chatopsImageInjected = 'true';

      imageBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleImagePickerUI(imageBtn, target.textboxId);
      });
    });
  }

  // --- Template Integration into Main & RHS Chat UI ---
  function injectTemplateButton() {
    const floatingButtons = cachedSettings.floatingButtons || { quickNote: true, quickTask: true, spamReactions: true, imagePicker: true, templatePicker: true, quickReply: false, quickCopy: false };
    const templateEnabled = floatingButtons.templatePicker !== false;
    
    const targets = [
      { id: 'emojiPickerButton', textboxId: 'post_textbox', btnId: 'chatops-ext-template-btn' },
      { id: 'rhsEmojiPickerButton', textboxId: 'reply_textbox', btnId: 'chatops-ext-template-btn-rhs' }
    ];

    targets.forEach(target => {
      const textbox = document.getElementById(target.textboxId) || 
        (target.textboxId === 'reply_textbox' 
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));

      let emojiBtn = null;
      if (textbox) {
        const container = textbox.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
        if (container) {
          emojiBtn = container.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i], button[aria-label*="Emoji"], button[class*="emoji" i], .emoji-picker__container button, button[id*="Emoji"]');
        }
      }

      if (!emojiBtn) {
        emojiBtn = document.getElementById(target.id);
      }

      if (!emojiBtn) {
        return;
      }

      const parent = emojiBtn.parentNode;
      if (!parent) return;

      const existingBtn = parent.querySelector('.chatops-ext-template-picker-btn');

      if (!templateEnabled) {
        if (existingBtn) existingBtn.remove();
        delete emojiBtn.dataset.chatopsTemplateInjected;
        return;
      }

      if (existingBtn) {
        emojiBtn.dataset.chatopsTemplateInjected = 'true';
        if (!existingBtn.id) {
          existingBtn.id = target.btnId;
        }
        return;
      }

      const templateBtn = document.createElement('button');
      templateBtn.id = target.btnId;
      templateBtn.type = 'button';
      templateBtn.className = 'chatops-ext-template-picker-btn';
      templateBtn.innerHTML = '📒';
      templateBtn.title = language.quickTemplateTooltip || 'Quick Template Picker';
      templateBtn.dataset.targetTextbox = target.textboxId;

      const imageBtn = parent.querySelector('.chatops-ext-image-picker-btn');
      if (imageBtn) {
        parent.insertBefore(templateBtn, imageBtn.nextSibling);
      } else {
        parent.insertBefore(templateBtn, emojiBtn.nextSibling);
      }

      emojiBtn.dataset.chatopsTemplateInjected = 'true';

      templateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTemplatePickerUI(templateBtn, target.textboxId);
      });
    });
  }

  updateTemplatePickerTranslations = function() {
    if (templatePickerEl) {
      const headerTitleEl = templatePickerEl.querySelector('.chatops-template-picker-header span');
      if (headerTitleEl) headerTitleEl.textContent = language.templatePickerTitle || 'Mẫu tin nhắn';
      const searchInput = templatePickerEl.querySelector('.chatops-template-search-input');
      if (searchInput) searchInput.placeholder = language.searchTemplatePlaceholder || 'Tìm kiếm mẫu...';
      renderTemplatesList(searchInput ? searchInput.value : '');
    }
    document.querySelectorAll('.chatops-ext-template-picker-btn').forEach(btn => {
      btn.title = language.quickTemplateTooltip || 'Insert Template (📒)';
    });
  };

  // --- Task Creation Button Integration into Chat UI ---
  function injectTaskCreateButton() {
    const floatingButtons = cachedSettings.floatingButtons || { quickNote: true, quickTask: true, spamReactions: true, imagePicker: true, templatePicker: true, quickReply: false, quickCopy: false };
    const taskEnabled = floatingButtons.quickTask !== false;
    
    const targets = [
      { id: 'emojiPickerButton', textboxId: 'post_textbox', btnId: 'chatops-ext-task-create-btn' },
      { id: 'rhsEmojiPickerButton', textboxId: 'reply_textbox', btnId: 'chatops-ext-task-create-btn-rhs' }
    ];

    targets.forEach(target => {
      const textbox = document.getElementById(target.textboxId) || 
        (target.textboxId === 'reply_textbox' 
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));

      let emojiBtn = null;
      if (textbox) {
        const container = textbox.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
        if (container) {
          emojiBtn = container.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i], button[aria-label*="Emoji"], button[class*="emoji" i], .emoji-picker__container button, button[id*="Emoji"]');
        }
      }

      if (!emojiBtn) {
        emojiBtn = document.getElementById(target.id);
      }

      if (!emojiBtn) {
        return;
      }

      const parent = emojiBtn.parentNode;
      if (!parent) return;

      const existingBtn = parent.querySelector('.chatops-ext-task-create-btn');

      if (!taskEnabled) {
        if (existingBtn) existingBtn.remove();
        delete emojiBtn.dataset.chatopsTaskCreateInjected;
        return;
      }

      if (existingBtn) {
        emojiBtn.dataset.chatopsTaskCreateInjected = 'true';
        if (!existingBtn.id) {
          existingBtn.id = target.btnId;
        }
        return;
      }

      const taskBtn = document.createElement('button');
      taskBtn.id = target.btnId;
      taskBtn.type = 'button';
      taskBtn.className = 'chatops-ext-task-create-btn';
      taskBtn.innerHTML = '🎯';
      taskBtn.title = language.quickTaskTooltip || 'Tạo công việc (🎯)';
      taskBtn.dataset.targetTextbox = target.textboxId;

      const templateBtn = parent.querySelector('.chatops-ext-template-picker-btn');
      if (templateBtn) {
        parent.insertBefore(taskBtn, templateBtn.nextSibling);
      } else {
        const imageBtn = parent.querySelector('.chatops-ext-image-picker-btn');
        if (imageBtn) {
          parent.insertBefore(taskBtn, imageBtn.nextSibling);
        } else {
          parent.insertBefore(taskBtn, emojiBtn.nextSibling);
        }
      }

      emojiBtn.dataset.chatopsTaskCreateInjected = 'true';

      taskBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openQuickNote(null, taskBtn, 'task', '');
      });
    });
  }

  updateTaskCreateButtonTranslations = function() {
    document.querySelectorAll('.chatops-ext-task-create-btn').forEach(btn => {
      btn.title = language.quickTaskTooltip || 'Tạo công việc (🎯)';
    });
  };

  // --- Group Reminder Button Integration into Chat UI ---
  function injectGroupReminderButton() {
    const floatingButtons = cachedSettings.floatingButtons || {};
    const groupReminderEnabled = floatingButtons.groupReminder !== false;
    
    const targets = [
      { id: 'emojiPickerButton', textboxId: 'post_textbox', btnId: 'chatops-ext-group-reminder-btn' },
      { id: 'rhsEmojiPickerButton', textboxId: 'reply_textbox', btnId: 'chatops-ext-group-reminder-btn-rhs' }
    ];

    targets.forEach(target => {
      const textbox = document.getElementById(target.textboxId) || 
        (target.textboxId === 'reply_textbox' 
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));

      let emojiBtn = null;
      if (textbox) {
        const container = textbox.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
        if (container) {
          emojiBtn = container.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i], button[aria-label*="Emoji"], button[class*="emoji" i], .emoji-picker__container button, button[id*="Emoji"]');
        }
      }

      if (!emojiBtn) {
        emojiBtn = document.getElementById(target.id);
      }

      if (!emojiBtn) {
        return;
      }

      const parent = emojiBtn.parentNode;
      if (!parent) return;

      const existingBtn = parent.querySelector('.chatops-ext-group-reminder-btn');

      if (!groupReminderEnabled) {
        if (existingBtn) existingBtn.remove();
        delete emojiBtn.dataset.chatopsGroupReminderInjected;
        return;
      }

      if (existingBtn) {
        emojiBtn.dataset.chatopsGroupReminderInjected = 'true';
        if (!existingBtn.id) {
          existingBtn.id = target.btnId;
        }
        return;
      }

      const grBtn = document.createElement('button');
      grBtn.id = target.btnId;
      grBtn.type = 'button';
      grBtn.className = 'chatops-ext-group-reminder-btn';
      grBtn.innerHTML = '📢';
      grBtn.title = language.quickGroupReminderTooltip || 'Tạo nhắc nhở nhóm (📢)';
      grBtn.dataset.targetTextbox = target.textboxId;

      // Insert it right after the task button or template button
      const taskBtn = parent.querySelector('.chatops-ext-task-create-btn');
      if (taskBtn) {
        parent.insertBefore(grBtn, taskBtn.nextSibling);
      } else {
        const templateBtn = parent.querySelector('.chatops-ext-template-picker-btn');
        if (templateBtn) {
          parent.insertBefore(grBtn, templateBtn.nextSibling);
        } else {
          const imageBtn = parent.querySelector('.chatops-ext-image-picker-btn');
          if (imageBtn) {
            parent.insertBefore(grBtn, imageBtn.nextSibling);
          } else {
            parent.insertBefore(grBtn, emojiBtn.nextSibling);
          }
        }
      }

      emojiBtn.dataset.chatopsGroupReminderInjected = 'true';

      grBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openQuickNote(null, grBtn, 'group_reminder', '');
      });
    });
  }

  updateGroupReminderButtonTranslations = function() {
    document.querySelectorAll('.chatops-ext-group-reminder-btn').forEach(btn => {
      btn.title = language.quickGroupReminderTooltip || 'Tạo nhắc nhở nhóm (📢)';
    });
  };

  // --- Google Meet Button Integration into Chat UI ---
  function injectMeetCreateButton() {
    const floatingButtons = cachedSettings.floatingButtons || {};
    const meetEnabled = floatingButtons.quickMeet !== false;
    
    const targets = [
      { id: 'emojiPickerButton', textboxId: 'post_textbox', btnId: 'chatops-ext-meet-create-btn' },
      { id: 'rhsEmojiPickerButton', textboxId: 'reply_textbox', btnId: 'chatops-ext-meet-create-btn-rhs' }
    ];

    targets.forEach(target => {
      const textbox = document.getElementById(target.textboxId) || 
        (target.textboxId === 'reply_textbox' 
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));

      let emojiBtn = null;
      if (textbox) {
        const container = textbox.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
        if (container) {
          emojiBtn = container.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i], button[aria-label*="Emoji"], button[class*="emoji" i], .emoji-picker__container button, button[id*="Emoji"]');
        }
      }

      if (!emojiBtn) {
        emojiBtn = document.getElementById(target.id);
      }

      if (!emojiBtn) {
        return;
      }

      const parent = emojiBtn.parentNode;
      if (!parent) return;

      const existingBtn = parent.querySelector('.chatops-ext-meet-create-btn');

      if (!meetEnabled) {
        if (existingBtn) existingBtn.remove();
        delete emojiBtn.dataset.chatopsMeetCreateInjected;
        return;
      }

      if (existingBtn) {
        emojiBtn.dataset.chatopsMeetCreateInjected = 'true';
        if (!existingBtn.id) {
          existingBtn.id = target.btnId;
        }
        return;
      }

      const meetBtn = document.createElement('button');
      meetBtn.id = target.btnId;
      meetBtn.type = 'button';
      meetBtn.className = 'chatops-ext-meet-create-btn';
      meetBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" style="vertical-align: middle; display: inline-block;">
        <defs>
          <linearGradient id="meetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#FFD54F;" />
            <stop offset="100%" style="stop-color:#FFB300;" />
          </linearGradient>
        </defs>
        <rect x="1" y="3" width="14" height="18" rx="4" fill="url(#meetGrad)" />
        <circle cx="5" cy="15" r="1.8" fill="#FFFFFF" />
        <path d="M16 9l6-4.5v15l-6-4.5v-6z" fill="#FF8F00" />
      </svg>`;
      meetBtn.title = language.quickMeetTooltip || 'Tạo phòng họp Google Meet';
      meetBtn.dataset.targetTextbox = target.textboxId;

      // Insert it right after the group reminder button, task button, template button, or image button
      const grBtn = parent.querySelector('.chatops-ext-group-reminder-btn');
      if (grBtn) {
        parent.insertBefore(meetBtn, grBtn.nextSibling);
      } else {
        const taskBtn = parent.querySelector('.chatops-ext-task-create-btn');
        if (taskBtn) {
          parent.insertBefore(meetBtn, taskBtn.nextSibling);
        } else {
          const templateBtn = parent.querySelector('.chatops-ext-template-picker-btn');
          if (templateBtn) {
            parent.insertBefore(meetBtn, templateBtn.nextSibling);
          } else {
            const imageBtn = parent.querySelector('.chatops-ext-image-picker-btn');
            if (imageBtn) {
              parent.insertBefore(meetBtn, imageBtn.nextSibling);
            } else {
              parent.insertBefore(meetBtn, emojiBtn.nextSibling);
            }
          }
        }
      }

      emojiBtn.dataset.chatopsMeetCreateInjected = 'true';

      meetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CREATE_GOOGLE_MEET,
          payload: { textboxId: target.textboxId }
        });
      });
    });
  }

  updateMeetCreateButtonTranslations = function() {
    document.querySelectorAll('.chatops-ext-meet-create-btn').forEach(btn => {
      btn.title = language.quickMeetTooltip || 'Tạo phòng họp Google Meet (📹)';
    });
  };

  // --- Header Integration (Advanced Search & Missed Mentions Modals) ---
  let headerModalBackdrop = null;

  function injectHeaderButtons() {
    // 1. Find the main channel header / top bar container, filtering out sidebars and modals
    const allHeaders = Array.from(document.querySelectorAll('#channel-header, .channel-header, .top-bar, [class*="channel-header"], .topbar'));
    const mainHeaders = allHeaders.filter(el => !el.closest('#sidebar-right, .sidebar--right, .rhs-thread, .modal-dialog, #chatops-sidepanel, .chatops-sidepanel'));
    const headerContainer = mainHeaders[0];

    if (!headerContainer) return;

    // 2. Find a reference button in the header (prioritizing Help/Question, Pin, or Mention buttons)
    const helpBtn = headerContainer.querySelector('.userGuideHelp') || headerContainer.querySelector('[class*="userGuideHelp"]');
    let standardHelpBtn = helpBtn || 
                          headerContainer.querySelector('#channelHeaderPinButton') || 
                          headerContainer.querySelector('#channelHeaderMentionButton') ||
                          headerContainer.querySelector('#channelHeaderFlaggedButton') ||
                          headerContainer.querySelector('[id*="HelpButton" i]') ||
                          headerContainer.querySelector('[aria-label*="help" i]') ||
                          headerContainer.querySelector('[aria-label*="trợ giúp" i]') ||
                          headerContainer.querySelector('[id*="MentionButton" i]') ||
                          headerContainer.querySelector('[aria-label*="mention" i]') ||
                          headerContainer.querySelector('[aria-label*="saved" i]') ||
                          headerContainer.querySelector('[aria-label*="flagged" i]') ||
                          headerContainer.querySelector('[aria-label*="pin" i]') ||
                          headerContainer.querySelector('[id*="FlagButton" i]') ||
                          headerContainer.querySelector('[id*="PinButton" i]');

    // 3. Find the correct flex container by traversing up from standardHelpBtn
    let container = null;
    if (standardHelpBtn) {
      let current = standardHelpBtn.parentNode;
      while (current && current !== headerContainer.parentNode) {
        if (current.classList && (
            current.classList.contains('flex-parent') || 
            current.classList.contains('top-bar__right') || 
            current.className?.includes?.('top-bar__right') ||
            current.classList.contains('topbar-right') ||
            current.className?.includes?.('topbar-right') ||
            current.className?.includes?.('channel-header') ||
            current.id === 'channel-header' ||
            current.classList.contains('channel-header') ||
            current.id === 'searchFormContainer' ||
            current.querySelector?.('#searchFormContainer')
        )) {
          container = current;
          break;
        }
        current = current.parentNode;
      }
    }

    if (!container) {
      container = headerContainer.querySelector('.flex-parent') ||
                  headerContainer.querySelector('.top-bar__right') ||
                  headerContainer.querySelector('[class*="top-bar__right"]') ||
                  headerContainer.querySelector('.topbar-right') ||
                  headerContainer.querySelector('[class*="topbar-right"]') ||
                  headerContainer.querySelector('#searchFormContainer')?.parentElement ||
                  headerContainer;
    }

    // 4. Self-correcting check: clean up all existing wrappers to ensure no duplicates exist
    const existingWrappers = Array.from(document.querySelectorAll('.chatops-header-buttons-wrapper'));
    let activeWrapper = null;
    for (const wrap of existingWrappers) {
      if (container && container.contains(wrap)) {
        activeWrapper = wrap;
      } else {
        runWithObserverDisabled(() => {
          wrap.remove();
        });
      }
    }

    if (activeWrapper) {
      return; // Already in the correct place!
    }

    // 5. Create wrapper and buttons
    const newWrapper = document.createElement('div');
    newWrapper.id = 'chatops-header-buttons-wrapper';
    newWrapper.className = 'chatops-header-buttons-wrapper';

    const kanbanBtn = document.createElement('button');
    kanbanBtn.id = 'chatops-header-kanban-btn';
    kanbanBtn.className = 'chatops-header-icon-btn';
    kanbanBtn.title = language.headerKanbanTooltip || 'Mở Kanban Board (Ctrl+Shift+K)';
    kanbanBtn.innerHTML = `
      <span class="chatops-header-emoji" style="color: inherit; opacity: 0.85;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16" style="display:block; width:16px; height:16px;">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      </span>
    `;
    kanbanBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!chrome.runtime || !chrome.runtime.id) {
        alert("ChatOps++ đã được cập nhật/nâng cấp mới. Vui lòng tải lại trang Mattermost (F5) để bắt đầu sử dụng!");
        return;
      }

      try {
        chrome.runtime.sendMessage({
          type: 'OPEN_KANBAN',
          payload: {}
        });
      } catch (err) {
        if (err.message && err.message.includes('Extension context invalidated')) {
          alert("ChatOps++ đã được cập nhật/nâng cấp mới. Vui lòng tải lại trang Mattermost (F5) để bắt đầu sử dụng!");
        } else {
          console.error('[ChatOps++] Failed to send message to open Kanban:', err);
        }
      }
    });

    const searchBtn = document.createElement('button');
    searchBtn.id = 'chatops-header-search-btn';
    searchBtn.className = 'chatops-header-icon-btn';
    searchBtn.title = language.headerSearchTooltip || 'Advanced Search';
    searchBtn.innerHTML = `<span class="chatops-header-emoji">🔍</span>`;
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHeaderModal('search');
    });

    const mentionsBtn = document.createElement('button');
    mentionsBtn.id = 'chatops-header-mentions-btn';
    mentionsBtn.className = 'chatops-header-icon-btn';
    mentionsBtn.title = language.headerMentionsTooltip || 'Missed Mentions';
    mentionsBtn.innerHTML = `<span class="chatops-header-emoji">🔔</span>`;
    mentionsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openHeaderModal('mentions');
    });

    newWrapper.appendChild(kanbanBtn);
    newWrapper.appendChild(searchBtn);
    newWrapper.appendChild(mentionsBtn);

    // 6. Find the direct child of the container to insert after, to avoid nesting inside button wrappers
    let insertTarget = standardHelpBtn;
    if (standardHelpBtn && standardHelpBtn.parentNode && standardHelpBtn.parentNode !== container) {
      let curr = standardHelpBtn;
      while (curr.parentNode && curr.parentNode !== container) {
        curr = curr.parentNode;
      }
      insertTarget = curr;
    }

    runWithObserverDisabled(() => {
      if (insertTarget && insertTarget.parentNode === container) {
        const nextSibling = insertTarget.nextSibling;
        container.insertBefore(newWrapper, nextSibling);
      } else {
        container.appendChild(newWrapper);
      }
    });
  }

  updateHeaderButtonsTranslations = function() {
    const kanbanBtn = document.getElementById('chatops-header-kanban-btn');
    if (kanbanBtn) kanbanBtn.title = language.headerKanbanTooltip || 'Mở Kanban Board (Ctrl+Shift+K)';

    const searchBtn = document.getElementById('chatops-header-search-btn');
    if (searchBtn) searchBtn.title = language.headerSearchTooltip || 'Advanced Search';

    const mentionsBtn = document.getElementById('chatops-header-mentions-btn');
    if (mentionsBtn) mentionsBtn.title = language.headerMentionsTooltip || 'Missed Mentions';
  };

  function openHeaderModal(tabName) {
    if (headerModalBackdrop) {
      headerModalBackdrop.remove();
    }

    headerModalBackdrop = document.createElement('div');
    headerModalBackdrop.className = 'chatops-iframe-modal-backdrop';

    const modalBox = document.createElement('div');
    modalBox.className = 'chatops-iframe-modal-box';

    const header = document.createElement('div');
    header.className = 'chatops-iframe-modal-header';

    const titleText = tabName === 'search' 
      ? (language.headerSearchTooltip || 'Advanced Search') 
      : (language.headerMentionsTooltip || 'Missed Mentions');

    header.innerHTML = `
      <span class="chatops-iframe-modal-title">${titleText}</span>
      <button class="chatops-iframe-modal-close-btn">&times;</button>
    `;

    const closeBtn = header.querySelector('.chatops-iframe-modal-close-btn');
    const closeModal = () => {
      headerModalBackdrop.classList.remove('visible');
      setTimeout(() => {
        if (headerModalBackdrop) {
          headerModalBackdrop.remove();
          headerModalBackdrop = null;
        }
      }, 250);
    };

    closeBtn.addEventListener('click', closeModal);
    headerModalBackdrop.addEventListener('click', (e) => {
      if (e.target === headerModalBackdrop) {
        closeModal();
      }
    });

    const iframe = document.createElement('iframe');
    iframe.className = 'chatops-iframe-modal-iframe';
    iframe.src = chrome.runtime.getURL(`sidepanel/sidepanel.html?view=modal&tab=${tabName}`);

    const messageListener = (event) => {
      if (event.data) {
        if (event.data.type === 'CLOSE_CHATOPS_MODAL') {
          closeModal();
          window.removeEventListener('message', messageListener);
        } else if (event.data.type === 'NAVIGATE_CHATOPS_PATH') {
          closeModal();
          window.removeEventListener('message', messageListener);
          
          const { url, postId, rootId } = event.data;
          let path = url;
          try {
            const urlObj = new URL(url, window.location.origin);
            if (urlObj.origin === window.location.origin) {
              path = urlObj.pathname + urlObj.search + urlObj.hash;
            }
          } catch (e) {
            // fallback
          }
          if (path) {
            console.log(`[ChatOps Ext] Navigating internally to: ${path}`);
            window.history.pushState(null, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
            
            if (postId) {
              handleOpenPostThread(postId, rootId);
            }
          }
        }
      }
    };
    window.addEventListener('message', messageListener);

    modalBox.appendChild(header);
    modalBox.appendChild(iframe);
    headerModalBackdrop.appendChild(modalBox);
    document.body.appendChild(headerModalBackdrop);

    headerModalBackdrop.getBoundingClientRect();
    headerModalBackdrop.classList.add('visible');
  }

  function toggleTemplatePickerUI(anchorBtn, targetTextboxId) {
    if (!templatePickerEl) {
      templatePickerEl = document.createElement('div');
      templatePickerEl.className = 'chatops-template-picker hidden';
      templatePickerEl.innerHTML = `
        <div class="chatops-template-picker-header">
          <span style="font-weight: 700; font-size: 13px; color: #1c58d9;">${language.templatePickerTitle || 'Mẫu tin nhắn'}</span>
          <button type="button" id="chatops-template-close" class="chatops-template-close-btn">✕</button>
        </div>
        <div class="chatops-template-search-area">
          <input type="text" class="chatops-template-search-input" placeholder="${language.searchTemplatePlaceholder || 'Tìm kiếm mẫu...'}">
        </div>
        <div class="chatops-template-list">
        </div>
      `;
      document.body.appendChild(templatePickerEl);

      document.getElementById('chatops-template-close').addEventListener('click', () => {
        templatePickerEl.classList.add('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!templatePickerEl) return;
        const isClickInside = templatePickerEl.contains(e.target);
        const isClickAnchor = e.target.closest('.chatops-ext-template-picker-btn');
        if (!isClickInside && !isClickAnchor) {
          templatePickerEl.classList.add('hidden');
        }
      });

      const searchInput = templatePickerEl.querySelector('.chatops-template-search-input');
      searchInput.addEventListener('input', (e) => {
        renderTemplatesList(e.target.value);
      });
    }

    const container = anchorBtn.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
    if (container) {
      activeChatTextarea = container.querySelector('textarea');
    } else {
      activeChatTextarea = document.getElementById(targetTextboxId) || 
        (targetTextboxId === 'reply_textbox'
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));
    }

    templatePickerEl.dataset.activeTextbox = targetTextboxId || 'post_textbox';

    const isHidden = templatePickerEl.classList.contains('hidden');
    if (isHidden) {
      const searchInput = templatePickerEl.querySelector('.chatops-template-search-input');
      if (searchInput) searchInput.value = '';
      
      renderTemplatesList('');

      const rect = anchorBtn.getBoundingClientRect();
      const pickerHeight = 380;
      let bottomValue = window.innerHeight - rect.top + 10;
      const maxBottom = window.innerHeight - pickerHeight - 10;
      if (bottomValue > maxBottom) {
        bottomValue = Math.max(10, maxBottom);
      }

      templatePickerEl.style.position = 'fixed';
      templatePickerEl.style.bottom = `${bottomValue}px`;
      templatePickerEl.style.left = `${Math.max(10, rect.left - 260)}px`;
      templatePickerEl.classList.remove('hidden');

      setTimeout(() => {
        const searchInput = templatePickerEl.querySelector('.chatops-template-search-input');
        if (searchInput) searchInput.focus();
      }, 50);
    } else {
      templatePickerEl.classList.add('hidden');
    }
  }

  function renderTemplatesList(query = '') {
    if (!templatePickerEl) return;
    const listContainer = templatePickerEl.querySelector('.chatops-template-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const templates = cachedMemos.filter(m => m.type === 'memo');

    const lowerQuery = query.toLowerCase().trim();
    const filteredTemplates = templates.filter(t => {
      const titleMatch = (t.title || '').toLowerCase().includes(lowerQuery);
      const categoryMatch = (t.category || '').toLowerCase().includes(lowerQuery);
      const noteMatch = (t.note || '').toLowerCase().includes(lowerQuery);
      return titleMatch || categoryMatch || noteMatch;
    });

    if (filteredTemplates.length === 0) {
      const emptyHint = document.createElement('div');
      emptyHint.className = 'chatops-template-empty';
      emptyHint.textContent = language.noTemplatesHint || 'Không tìm thấy mẫu nào.';
      listContainer.appendChild(emptyHint);
      return;
    }

    filteredTemplates.forEach(t => {
      const item = document.createElement('div');
      item.className = 'chatops-template-item';
      
      const displayTitle = t.title ? t.title.trim() : (t.note ? t.note.trim().substring(0, 30) + '...' : 'Ghi chú');
      const snippet = t.note ? t.note.trim().replace(/\n/g, ' ') : '';
      const category = t.category || 'General';

      item.innerHTML = `
        <div class="chatops-template-item-header">
          <span class="chatops-template-item-title">${escapeHtml(displayTitle)}</span>
          <span class="chatops-template-item-category">${escapeHtml(category)}</span>
        </div>
        <div class="chatops-template-item-snippet">${escapeHtml(snippet)}</div>
      `;

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeChatTextarea && t.note) {
          insertTextIntoTextarea(activeChatTextarea, t.note);
        }
        templatePickerEl.classList.add('hidden');
      });

      listContainer.appendChild(item);
    });
  }

  imagePickerEl = null;
  let pickerAutoSend = false;
  if (chrome && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['chatops_picker_autosend'], (res) => {
      pickerAutoSend = !!res.chatops_picker_autosend;
    });
  }

  function getBase64Size(dataURL) {
    if (!dataURL) return 0;
    const base64Part = dataURL.split(',')[1];
    if (!base64Part) return dataURL.length;
    const padding = base64Part.endsWith('==') ? 2 : (base64Part.endsWith('=') ? 1 : 0);
    return (base64Part.length * 3 / 4) - padding;
  }

  function formatSize(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  updateImagePickerTranslations = function() {
    if (!imagePickerEl) return;
    
    // Header title
    const headerTitleEl = imagePickerEl.querySelector('.chatops-image-picker-header span');
    if (headerTitleEl) headerTitleEl.textContent = language.imageLibrary || 'My Library';
    
    // Sub tabs
    const tabLibraryEl = imagePickerEl.querySelector('.chatops-picker-sub-tab[data-tab="library"]');
    if (tabLibraryEl) tabLibraryEl.textContent = language.imageLibraryTab || 'My Library';
    
    const tabGifsEl = imagePickerEl.querySelector('.chatops-picker-sub-tab[data-tab="gifs"]');
    if (tabGifsEl) tabGifsEl.textContent = language.gifLibraryTab || 'GIFs';
    
    // Your images header
    const yourImagesHeaderEl = imagePickerEl.querySelector('#chatops-your-images-header');
    if (yourImagesHeaderEl) yourImagesHeaderEl.textContent = language.yourImages || 'YOUR IMAGES';
    
    // Draw button, Draw upload button, and upload image button
    const drawBtnEl = imagePickerEl.querySelector('#chatops-draw-btn');
    if (drawBtnEl) {
      drawBtnEl.innerHTML = `🎨 ${language.drawBtn || 'Tự vẽ'}`;
    }
    const uploadLabelEl = imagePickerEl.querySelector('#chatops-upload-label');
    if (uploadLabelEl) {
      uploadLabelEl.textContent = language.uploadImageBtn || '+ Upload Image';
    }
    
    // No images hint
    const emptyHintEl = imagePickerEl.querySelector('.chatops-image-empty');
    if (emptyHintEl) emptyHintEl.textContent = language.noImagesHint || 'No images found';
    
    // GIF search input placeholder
    const gifSearchInput = imagePickerEl.querySelector('#chatops-picker-gif-search');
    if (gifSearchInput) gifSearchInput.placeholder = language.searchGifPlaceholder || 'Search GIFs...';
    
    // GIF hint notice
    const gifHintNoticeEl = imagePickerEl.querySelector('.chatops-gif-hint-notice [data-i18n="gifDefaultHint"]');
    if (gifHintNoticeEl) gifHintNoticeEl.textContent = language.gifDefaultHint || '';
    
    // Refresh images grid to update tooltips/titles in the new language
    loadCustomImages();
    
    // Refresh Giphy panel to display translated API status if any
    const apiStatusNotice = imagePickerEl.querySelector('#chatops-picker-gifs-grid');
    if (apiStatusNotice && gifSearchInput) {
      loadPickerGifs(gifSearchInput.value);
    }
  };

  updateResizeModalTranslations = function() {
    const overlay = document.getElementById('chatops-image-resize-overlay');
    if (!overlay) return;
    
    const titleEl = overlay.querySelector('.chatops-image-resize-title');
    if (titleEl) titleEl.textContent = language.resizeImageTitle || 'Resize Image';
    
    const scaleLabelEl = overlay.querySelector('.chatops-image-resize-slider-label span');
    if (scaleLabelEl) scaleLabelEl.textContent = language.resizeScaleLabel || 'Scale';
    
    const cancelBtn = overlay.querySelector('.chatops-image-resize-btn-cancel');
    if (cancelBtn) cancelBtn.textContent = language.cancel;
    
    const saveBtn = overlay.querySelector('.chatops-image-resize-btn-save');
    if (saveBtn) saveBtn.textContent = language.saveCopy || 'Save';
    
    const insertBtn = overlay.querySelector('.chatops-image-resize-btn-insert');
    if (insertBtn) insertBtn.textContent = language.insertToChat || 'Insert to Chat';

    const editBtn = overlay.querySelector('.chatops-image-resize-btn-edit');
    if (editBtn) {
      if (editBtn.disabled) {
        editBtn.title = language.gifNotSupported || 'GIF (Không hỗ trợ resize & edit)';
      } else {
        editBtn.title = language.editImageBtn || 'Sửa ảnh';
      }
    }

    const newSizeEl = overlay.querySelector('.chatops-image-resize-new-size');
    if (newSizeEl && currentResizeImageObj && currentResizeImageObj.mimeType === 'image/gif') {
      const newBytes = getBase64Size(currentResizeImageObj.src);
      newSizeEl.innerHTML = `<span style="color:#eab308;font-weight:600;font-size:11px;">${language.gifNotSupported || 'GIF (Không hỗ trợ resize & edit)'}:</span> ${currentResizeImageObj.origWidth}x${currentResizeImageObj.origHeight} (${formatSize(newBytes)})`;
    }
  };

  async function loadCustomImages() {
    const res = await chrome.storage.local.get(['custom_memes']);
    let customMemes = res.custom_memes;
    if (customMemes === undefined) {
      customMemes = DEFAULT_MEMES;
      await chrome.storage.local.set({ custom_memes: customMemes });
    }
    const container = document.getElementById('chatops-custom-images-grid');
    if (!container) return;

    // Calculate total size
    let totalBytes = 0;
    customMemes.forEach(url => {
      totalBytes += getBase64Size(url);
    });
    const formattedSize = formatSize(totalBytes);

    // Update dynamic header size subtitle
    const sizeEl = document.getElementById('chatops-your-images-size');
    if (sizeEl) {
      sizeEl.textContent = `(${formattedSize} / 10 MB)`;
    }

    if (customMemes.length === 0) {
      container.innerHTML = `<span style="font-size:11.5px; color:#999; text-align:center; width:100%; display:block; padding: 24px 0; grid-column: 1 / -1;">${language.noCustomImages}</span>`;
      return;
    }

    let col1Html = '';
    let col2Html = '';
    
    customMemes.forEach((url, idx) => {
      const isAnimated = url.startsWith('data:image/gif') || url.startsWith('data:image/webp');
      const cellHtml = `
        <div class="chatops-custom-image-cell">
          <img src="${url}" class="chatops-custom-image-item" loading="lazy" title="${language.clickToSend}" />
          <button class="chatops-custom-image-preview" data-idx="${idx}" title="${language.previewImage || 'Preview full image'}">&#x1F50D;</button>
          ${!isAnimated ? `
          <button class="chatops-custom-image-edit" data-idx="${idx}" title="${language.editImageBtn || 'Sửa ảnh'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none; display:block;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          ` : ''}
          <button class="chatops-custom-image-resize" data-idx="${idx}" title="${language.resizeImage || 'Resize image'}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none; display:block;"><path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M10 14l-7 7"></path></svg>
          </button>
          <button class="chatops-custom-image-delete" data-idx="${idx}" title="${language.deleteImage}">&times;</button>
        </div>
      `;
      if (idx % 2 === 0) {
        col1Html += cellHtml;
      } else {
        col2Html += cellHtml;
      }
    });

    container.innerHTML = `
      <div class="chatops-custom-images-column" style="display: flex; flex-direction: column; gap: 16px; flex: 1; min-width: 0;">${col1Html}</div>
      <div class="chatops-custom-images-column" style="display: flex; flex-direction: column; gap: 16px; flex: 1; min-width: 0;">${col2Html}</div>
    `;
  }

  // ─── Image Preview (hover/click) ───
  function openImagePreview(src) {
    let overlay = document.getElementById('chatops-image-preview-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'chatops-image-preview-overlay';
      overlay.className = 'chatops-image-preview-overlay';
      overlay.innerHTML = `
        <button id="chatops-image-preview-close" class="chatops-image-preview-close-btn">&times;</button>
        <div class="chatops-image-preview-wrapper" style="position: relative; display: inline-block;">
          <img id="chatops-image-preview-img" src="" alt="preview" />
        </div>
      `;
      overlay.addEventListener('click', (e) => {
        if (e.target.id === 'chatops-image-preview-img') {
          e.stopPropagation();
          return;
        }
        overlay.classList.add('hidden');
      });
      document.body.appendChild(overlay);
    }
    overlay.querySelector('#chatops-image-preview-img').src = src;
    overlay.classList.remove('hidden');
  }


  let editorUndoHistory = [];
  function openImageEditor(activeImgObj, onSaveCallback) {
    const handleGlobalPaste = async (e) => {
      const overlay = document.getElementById('chatops-image-editor-overlay');
      if (!overlay || !overlay.classList.contains('visible')) return;
      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            await handleBgImageFile(file);
            break;
          }
        }
      }
    };

    const handleKeydownPaste = async (e) => {
      const overlay = document.getElementById('chatops-image-editor-overlay');
      if (!overlay || !overlay.classList.contains('visible')) return;

      const isPasteCombo = (e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V');
      if (!isPasteCombo) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.contentEditable === 'true')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              const file = new File([blob], `pasted_image_${Date.now()}.${type.split('/')[1] || 'png'}`, { type });
              await handleBgImageFile(file);
              return;
            }
          }
        }
        showToast(language.noImageInClipboard || 'Không tìm thấy ảnh trong clipboard.');
      } catch (err) {
        console.error('[ChatOps] Keydown paste failed:', err);
        showToast(language.clipboardPermissionDenied || 'Quyền truy cập clipboard bị từ chối. Vui lòng dùng Ctrl+V để dán.');
      }
    };

    document.addEventListener('paste', handleGlobalPaste, true);
    document.addEventListener('keydown', handleKeydownPaste, true);

    updateImageEditorTranslations = function() {
      const overlay = document.getElementById('chatops-image-editor-overlay');
      if (!overlay) return;

      const titleEl = overlay.querySelector('.chatops-image-editor-title');
      if (titleEl) {
        titleEl.textContent = (activeImgObj && activeImgObj.isDrawing) 
          ? (language.drawTitle || 'Tự vẽ') 
          : (language.editImageTitle || 'Chỉnh sửa ảnh');
      }

      const brushBtn = overlay.querySelector('.chatops-image-editor-tool-btn[data-tool="brush"]');
      if (brushBtn) {
        brushBtn.title = language.drawToolBrush || 'Brush';
        const span = brushBtn.querySelector('span');
        if (span) span.textContent = language.drawToolBrush || 'Brush';
      }

      const shapesToggle = overlay.querySelector('.dropdown-toggle');
      if (shapesToggle) {
        const span = shapesToggle.querySelector('span:not([style*="font-size"])');
        if (span) span.textContent = language.drawToolShapes || 'Hình dạng';
      }

      const rectItem = overlay.querySelector('.chatops-image-editor-dropdown-item[data-shape="rect"]');
      if (rectItem) {
        const span = rectItem.querySelector('span');
        if (span) span.textContent = language.drawToolRect || 'Hình hộp';
      }
      const circleItem = overlay.querySelector('.chatops-image-editor-dropdown-item[data-shape="circle"]');
      if (circleItem) {
        const span = circleItem.querySelector('span');
        if (span) span.textContent = language.drawToolCircle || 'Hình tròn';
      }
      const triangleItem = overlay.querySelector('.chatops-image-editor-dropdown-item[data-shape="triangle"]');
      if (triangleItem) {
        const span = triangleItem.querySelector('span');
        if (span) span.textContent = language.drawToolTriangle || 'Tam giác';
      }
      const lineItem = overlay.querySelector('.chatops-image-editor-dropdown-item[data-shape="line"]');
      if (lineItem) {
        const span = lineItem.querySelector('span');
        if (span) span.textContent = language.drawToolLine || 'Đường thẳng';
      }

      const arrowBtn = overlay.querySelector('.chatops-image-editor-tool-btn[data-tool="arrow"]');
      if (arrowBtn) {
        arrowBtn.title = language.drawToolArrow || 'Arrow';
        const span = arrowBtn.querySelector('span');
        if (span) span.textContent = language.drawToolArrow || 'Arrow';
      }

      const textBtn = overlay.querySelector('.chatops-image-editor-tool-btn[data-tool="text"]');
      if (textBtn) {
        textBtn.title = language.drawToolText || 'Text';
        const span = textBtn.querySelector('span');
        if (span) span.textContent = language.drawToolText || 'Text';
      }

      const eraserBtn = overlay.querySelector('.chatops-image-editor-tool-btn[data-tool="eraser"]');
      if (eraserBtn) {
        eraserBtn.title = language.drawToolEraser || 'Eraser';
        const span = eraserBtn.querySelector('span');
        if (span) span.textContent = language.drawToolEraser || 'Eraser';
      }

      const colorLabel = overlay.querySelector('.chatops-image-editor-colors > span');
      if (colorLabel) colorLabel.textContent = language.drawColorLabel || 'Màu:';

      const customColorBtn = overlay.querySelector('#chatops-image-editor-custom-color-btn');
      if (customColorBtn) customColorBtn.title = language.customColorTitle || 'Chọn màu';

      const sizeLabel = overlay.querySelector('.chatops-image-editor-slider-wrapper > span');
      if (sizeLabel) sizeLabel.textContent = language.drawSizeLabel || 'Cỡ:';

      const undoBtn = overlay.querySelector('#chatops-image-editor-undo');
      if (undoBtn) {
        const span = undoBtn.querySelector('span');
        if (span) span.textContent = language.drawUndoBtn || 'Hoàn tác';
      }
      const resetBtn = overlay.querySelector('#chatops-image-editor-reset');
      if (resetBtn) {
        const span = resetBtn.querySelector('span');
        if (span) span.textContent = language.drawResetBtn || 'Xóa hết';
      }

      const uploadBgBtn = overlay.querySelector('#chatops-image-editor-upload-bg');
      if (uploadBgBtn) {
        const span = uploadBgBtn.querySelector('span');
        if (span) span.textContent = language.editorUploadBgBtn || 'Tải ảnh nền';
      }



      const cancelBtn = overlay.querySelector('.chatops-image-editor-btn-cancel');
      if (cancelBtn) cancelBtn.textContent = language.cancel;

      const applyBtn = overlay.querySelector('.chatops-image-editor-btn-apply');
      if (applyBtn) applyBtn.textContent = language.drawApplyBtn || 'Áp dụng';
    };

    let editorOverlay = document.getElementById('chatops-image-editor-overlay');
    if (!editorOverlay) {
      editorOverlay = document.createElement('div');
      editorOverlay.id = 'chatops-image-editor-overlay';
      editorOverlay.className = 'chatops-image-editor-overlay';
      editorOverlay.innerHTML = `
        <div class="chatops-image-editor-container">
          <div class="chatops-image-editor-header">
            <h3 class="chatops-image-editor-title">${(activeImgObj && activeImgObj.isDrawing) ? (language.drawTitle || 'Tự vẽ') : (language.editImageTitle || 'Chỉnh sửa ảnh')}</h3>
            <button class="chatops-image-editor-close-btn">&times;</button>
          </div>
          <div class="chatops-image-editor-toolbar">
            <div class="chatops-image-editor-tool-group">
              <button class="chatops-image-editor-tool-btn active" data-tool="brush" title="${language.drawToolBrush || 'Brush'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M7.5 10.5c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z"/><path d="M11.5 7.5c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z"/><path d="M16.5 9.5c.828 0 1.5-.672 1.5-1.5s-.672-1.5-1.5-1.5-1.5.672-1.5 1.5.672 1.5 1.5 1.5z"/><path d="M6 14c0-2 2-3 2-3s.5 2.5 2 2.5 3-1.5 3-1.5.5 2 2 2 2.5-1 2.5-1 0 4-5 4-6.5-3-6.5-3z"/></svg>
                <span>${language.drawToolBrush || 'Brush'}</span>
              </button>
              
              <!-- Shapes Dropdown -->
              <div class="chatops-image-editor-dropdown" id="chatops-image-editor-shapes-dropdown">
                <button class="chatops-image-editor-tool-btn dropdown-toggle" data-tool="shape" style="gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  <span>${language.drawToolShapes || 'Hình dạng'}</span>
                  <span style="font-size: 8px; margin-left: 2px;">▼</span>
                </button>
                <div class="chatops-image-editor-dropdown-menu">
                  <button class="chatops-image-editor-dropdown-item" data-shape="rect">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                    <span>${language.drawToolRect || 'Hình hộp'}</span>
                  </button>
                  <button class="chatops-image-editor-dropdown-item" data-shape="circle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><circle cx="12" cy="12" r="10"/></svg>
                    <span>${language.drawToolCircle || 'Hình tròn'}</span>
                  </button>
                  <button class="chatops-image-editor-dropdown-item" data-shape="triangle">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M12 2L2 22h20L12 2z"/></svg>
                    <span>${language.drawToolTriangle || 'Tam giác'}</span>
                  </button>
                  <button class="chatops-image-editor-dropdown-item" data-shape="line">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="5" y1="19" x2="19" y2="5"/></svg>
                    <span>${language.drawToolLine || 'Đường thẳng'}</span>
                  </button>
                </div>
              </div>

              <button class="chatops-image-editor-tool-btn" data-tool="arrow" title="${language.drawToolArrow || 'Arrow'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                <span>${language.drawToolArrow || 'Arrow'}</span>
              </button>
              <button class="chatops-image-editor-tool-btn" data-tool="text" title="${language.drawToolText || 'Text'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <span>${language.drawToolText || 'Text'}</span>
              </button>
              <button class="chatops-image-editor-tool-btn" data-tool="eraser" title="${language.drawToolEraser || 'Eraser'}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.5l12-12c1.1-1 2.5-1 3.5 0l4.3 4.3c1 1 1 2.5 0 3.5L10.5 21z"/><path d="M6 14h11"/></svg>
                <span>${language.drawToolEraser || 'Eraser'}</span>
              </button>
            </div>

            <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>

            <div class="chatops-image-editor-colors">
              <span style="font-size: 13px; color: #475569; font-weight: 500; margin-right: 4px;">${language.drawColorLabel || 'Màu:'}</span>
              <div class="chatops-image-editor-color-dot active" data-color="#ff0000" style="background: #ff0000;"></div>
              <div class="chatops-image-editor-color-dot" data-color="#0000ff" style="background: #0000ff;"></div>
              <div class="chatops-image-editor-color-dot" data-color="#00ff00" style="background: #00ff00;"></div>
              <div class="chatops-image-editor-color-dot" data-color="#ffff00" style="background: #ffff00;"></div>
              <div class="chatops-image-editor-color-dot" data-color="#000000" style="background: #000000;"></div>
              <div class="chatops-image-editor-color-dot" data-color="#ffffff" style="background: #ffffff; border: 1px solid #cbd5e1;"></div>
              
              <!-- Custom Color Wheel Dot -->
              <div class="chatops-image-editor-color-dot custom-color-dot" id="chatops-image-editor-custom-color-btn" title="${language.customColorTitle || 'Chọn màu'}" style="background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); border: 1px solid #cbd5e1; display: inline-flex; align-items: center; justify-content: center; position: relative;">
                <input type="color" id="chatops-image-editor-custom-color-input" style="opacity: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer;" />
              </div>
            </div>

            <div style="height: 20px; width: 1px; background: #cbd5e1;"></div>

            <div class="chatops-image-editor-slider-wrapper">
              <span>${language.drawSizeLabel || 'Cỡ:'}</span>
              <input type="range" class="chatops-image-editor-slider" min="2" max="50" value="8" />
              <span class="chatops-image-editor-slider-val" style="width: 32px; font-weight: 600;">8px</span>
            </div>

            <div style="flex: 1; min-width: 10px;"></div>

            <button class="chatops-image-editor-action-btn" id="chatops-image-editor-upload-bg" title="Upload Background">
              <span>${language.editorUploadBgBtn || 'Tải ảnh nền'}</span>
            </button>
            <input type="file" id="chatops-image-editor-bg-file" accept="image/*" style="display: none;" />

            <button class="chatops-image-editor-action-btn" id="chatops-image-editor-undo" title="Undo">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
              <span>${language.drawUndoBtn || 'Hoàn tác'}</span>
            </button>
            <button class="chatops-image-editor-action-btn" id="chatops-image-editor-reset">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>${language.drawResetBtn || 'Xóa hết'}</span>
            </button>
          </div>
          <div class="chatops-image-editor-body">
            <div class="chatops-image-editor-canvas-container">
              <img class="chatops-image-editor-bg-img" src="" alt="edit background" />
              <canvas class="chatops-image-editor-canvas"></canvas>
            </div>
          </div>
          <div class="chatops-image-editor-footer">
            <button class="chatops-image-editor-btn chatops-image-editor-btn-cancel">${language.cancel}</button>
            <button class="chatops-image-editor-btn chatops-image-editor-btn-apply">${language.drawApplyBtn || 'Áp dụng'}</button>
          </div>
        </div>
      `;
      document.body.appendChild(editorOverlay);
    }

    const handleClose = () => {
      const textInput = editorOverlay.querySelector('.chatops-image-editor-text-input');
      if (textInput) textInput.remove();
      updateImageEditorTranslations = null;
      editorOverlay.classList.remove('visible');
      document.removeEventListener('paste', handleGlobalPaste, true);
      document.removeEventListener('keydown', handleKeydownPaste, true);
    };

    editorOverlay.querySelector('.chatops-image-editor-close-btn').onclick = handleClose;
    editorOverlay.querySelector('.chatops-image-editor-btn-cancel').onclick = handleClose;

    updateImageEditorTranslations();

    const bgImg = editorOverlay.querySelector('.chatops-image-editor-bg-img');
    const canvas = editorOverlay.querySelector('.chatops-image-editor-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const slider = editorOverlay.querySelector('.chatops-image-editor-slider');
    const sliderVal = editorOverlay.querySelector('.chatops-image-editor-slider-val');

    let currentTool = 'brush';
    let currentColor = '#ff0000';
    let currentSize = 8;
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let tempState = null;

    // Set up toolbar controls
    const toolBtns = editorOverlay.querySelectorAll('.chatops-image-editor-tool-btn:not(.dropdown-toggle)');
    const dropdownToggle = editorOverlay.querySelector('.dropdown-toggle');
    const shapesDropdown = editorOverlay.querySelector('#chatops-image-editor-shapes-dropdown');
    const dropdownItems = editorOverlay.querySelectorAll('.chatops-image-editor-dropdown-item');

    // Toggle dropdown on click
    if (dropdownToggle) {
      dropdownToggle.onclick = (e) => {
        e.stopPropagation();
        shapesDropdown.classList.toggle('open');
      };
    }

    // Close dropdown on click outside
    document.addEventListener('click', () => {
      if (shapesDropdown) shapesDropdown.classList.remove('open');
    });

    // Handle shapes item click
    dropdownItems.forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        const selectedShape = item.dataset.shape;
        currentTool = selectedShape;
        
        // Remove active class from other tools
        toolBtns.forEach(b => b.classList.remove('active'));
        if (dropdownToggle) dropdownToggle.classList.add('active');
        
        // Mark active item in dropdown
        dropdownItems.forEach(di => di.classList.remove('active'));
        item.classList.add('active');
        
        // Close dropdown
        if (shapesDropdown) shapesDropdown.classList.remove('open');
        
        const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
        if (activeText) activeText.blur();
      };
    });

    toolBtns.forEach(btn => {
      btn.onclick = () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        if (dropdownToggle) dropdownToggle.classList.remove('active');
        dropdownItems.forEach(di => di.classList.remove('active'));
        
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
        if (activeText) activeText.blur();
      };
    });

    const colorDots = editorOverlay.querySelectorAll('.chatops-image-editor-color-dot:not(.custom-color-dot)');
    const customColorBtn = editorOverlay.querySelector('#chatops-image-editor-custom-color-btn');
    const customColorInput = editorOverlay.querySelector('#chatops-image-editor-custom-color-input');

    colorDots.forEach(dot => {
      dot.onclick = () => {
        colorDots.forEach(d => d.classList.remove('active'));
        if (customColorBtn) customColorBtn.classList.remove('active');
        dot.classList.add('active');
        currentColor = dot.dataset.color;
        
        const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
        if (activeText) activeText.style.color = currentColor;
      };
    });

    if (customColorInput) {
      customColorInput.oninput = (e) => {
        currentColor = e.target.value;
        customColorBtn.style.background = currentColor; // display chosen color in the wheel
        colorDots.forEach(d => d.classList.remove('active'));
        customColorBtn.classList.add('active');
        
        const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
        if (activeText) activeText.style.color = currentColor;
      };
    }

    slider.oninput = () => {
      currentSize = parseInt(slider.value, 10);
      sliderVal.textContent = `${currentSize}px`;

      const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
      if (activeText) {
        const containerRect = canvas.parentElement.getBoundingClientRect();
        const displayScale = containerRect.width / canvas.width;
        activeText.style.fontSize = Math.max(12, currentSize * 2 * displayScale) + 'px';
      }
    };

    // Load active image into editor
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      bgImg.src = img.src;
      let displayWidth = img.naturalWidth;
      let displayHeight = img.naturalHeight;
      
      const maxW = Math.max(500, window.innerWidth - 120);
      const maxH = Math.max(400, window.innerHeight - 240);
      
      let scale = 1;
      // If the image is too large, scale it down to fit viewport nicely
      if (displayWidth > maxW || displayHeight > maxH) {
        scale = Math.min(maxW / displayWidth, maxH / displayHeight);
      }
      
      displayWidth = Math.round(displayWidth * scale);
      displayHeight = Math.round(displayHeight * scale);
      const container = editorOverlay.querySelector('.chatops-image-editor-canvas-container');
      if (container) {
        container.style.width = displayWidth + 'px';
        container.style.height = displayHeight + 'px';
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      editorUndoHistory = [];
      saveState();

      editorOverlay.classList.add('visible');
    };
    img.src = activeImgObj.src;

    function saveState() {
      if (editorUndoHistory.length > 20) {
        editorUndoHistory.shift();
      }
      editorUndoHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    }

    editorOverlay.querySelector('#chatops-image-editor-undo').onclick = () => {
      if (editorUndoHistory.length > 1) {
        editorUndoHistory.pop();
        const prevState = editorUndoHistory[editorUndoHistory.length - 1];
        ctx.putImageData(prevState, 0, 0);
      } else if (editorUndoHistory.length === 1) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    editorOverlay.querySelector('#chatops-image-editor-reset').onclick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveState();
    };

    async function handleBgImageFile(file) {
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast(language.uploadOnlyImages || 'Please upload image files only.');
        return;
      }

      showToast(language.webpConvertingToast || 'Converting image... Please wait.');

      let fileDataUrl = '';
      let fileType = file.type;

      if (needsChatOpsConversion(file.type, file.name)) {
        try {
          const converted = await convertForChatOps(file);
          fileDataUrl = converted.dataUrl;
          fileType = converted.type;
        } catch (err) {
          console.error('[ChatOps] Background image conversion failed:', err);
        }
      }

      if (!fileDataUrl) {
        fileDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      }

      const newImg = new Image();
      newImg.onload = () => {
        activeImgObj.src = fileDataUrl;
        activeImgObj.mimeType = fileType || 'image/png';
        activeImgObj.origWidth = newImg.naturalWidth;
        activeImgObj.origHeight = newImg.naturalHeight;
        activeImgObj.aspect = newImg.naturalWidth / newImg.naturalHeight;

        img.onload = null;
        img.src = fileDataUrl;

        canvas.width = newImg.naturalWidth;
        canvas.height = newImg.naturalHeight;
        bgImg.src = newImg.src;

        let displayWidth = newImg.naturalWidth;
        let displayHeight = newImg.naturalHeight;
        
        const maxW = Math.max(500, window.innerWidth - 120);
        const maxH = Math.max(400, window.innerHeight - 240);
        
        let scale = 1;
        if (displayWidth > maxW || displayHeight > maxH) {
          scale = Math.min(maxW / displayWidth, maxH / displayHeight);
        }
        
        displayWidth = Math.round(displayWidth * scale);
        displayHeight = Math.round(displayHeight * scale);
        const container = editorOverlay.querySelector('.chatops-image-editor-canvas-container');
        if (container) {
          container.style.width = displayWidth + 'px';
          container.style.height = displayHeight + 'px';
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        editorUndoHistory = [];
        saveState();
      };
      newImg.src = fileDataUrl;
    }

    const uploadBgBtn = editorOverlay.querySelector('#chatops-image-editor-upload-bg');
    const bgFileInput = editorOverlay.querySelector('#chatops-image-editor-bg-file');
    if (uploadBgBtn && bgFileInput) {
      uploadBgBtn.onclick = (e) => {
        e.preventDefault();
        bgFileInput.click();
      };

      bgFileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          await handleBgImageFile(file);
        }
        bgFileInput.value = '';
      };
    }



    function getMousePos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      let clientX, clientY;
      if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    }

    function drawArrow(fromX, fromY, toX, toY, color, thickness) {
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.stroke();

      const angle = Math.atan2(toY - fromY, toX - fromX);
      const headLength = Math.max(thickness * 3, 12);

      ctx.beginPath();
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    canvas.onmousedown = (e) => {
      const pos = getMousePos(e);
      startX = pos.x;
      startY = pos.y;
      isDrawing = true;

      if (currentTool === 'brush' || currentTool === 'eraser') {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.globalCompositeOperation = currentTool === 'eraser' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = currentTool === 'eraser' ? 'rgba(0,0,0,1)' : currentColor;
        ctx.lineWidth = currentSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.lineTo(startX, startY);
        ctx.stroke();
      } else if (currentTool === 'text') {
        isDrawing = false;
        
        let activeTextInput = editorOverlay.querySelector('.chatops-image-editor-text-input');
        if (activeTextInput) {
          activeTextInput.blur();
        }

        const input = document.createElement('textarea');
        input.className = 'chatops-image-editor-text-input';

        const containerRect = canvas.parentElement.getBoundingClientRect();
        const clickX = e.clientX - containerRect.left;
        const clickY = e.clientY - containerRect.top;

        input.style.left = clickX + 'px';
        input.style.top = clickY + 'px';
        input.style.color = currentColor;

        const displayScale = containerRect.width / canvas.width;
        input.style.fontSize = Math.max(12, currentSize * 2 * displayScale) + 'px';

        input.dataset.canvasX = startX;
        input.dataset.canvasY = startY;

        canvas.parentElement.appendChild(input);
        setTimeout(() => input.focus(), 50);

        input.onblur = () => {
          const val = input.value.trim();
          if (val) {
            ctx.font = `bold ${currentSize * 2}px Inter, sans-serif`;
            ctx.fillStyle = currentColor;
            ctx.textBaseline = 'top';

            const lines = val.split('\n');
            const lineHeight = currentSize * 2.4;
            lines.forEach((line, idx) => {
              ctx.fillText(line, parseFloat(input.dataset.canvasX), parseFloat(input.dataset.canvasY) + (idx * lineHeight));
            });
            saveState();
          }
          input.remove();
        };

        input.onkeydown = (ev) => {
          if (ev.key === 'Enter' && !ev.shiftKey) {
            ev.preventDefault();
            input.blur();
          } else if (ev.key === 'Escape') {
            input.value = '';
            input.blur();
          }
        };
      } else {
        ctx.globalCompositeOperation = 'source-over';
        tempState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
    };

    canvas.onmousemove = (e) => {
      if (!isDrawing) return;
      const pos = getMousePos(e);

      if (currentTool === 'brush' || currentTool === 'eraser') {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      } else if (currentTool === 'rect') {
        ctx.putImageData(tempState, 0, 0);
        ctx.beginPath();
        ctx.rect(startX, startY, pos.x - startX, pos.y - startY);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
      } else if (currentTool === 'circle') {
        ctx.putImageData(tempState, 0, 0);
        ctx.beginPath();
        const radius = Math.sqrt(Math.pow(pos.x - startX, 2) + Math.pow(pos.y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
      } else if (currentTool === 'triangle') {
        ctx.putImageData(tempState, 0, 0);
        ctx.beginPath();
        ctx.moveTo(startX + (pos.x - startX) / 2, startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.lineTo(startX, pos.y);
        ctx.closePath();
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
      } else if (currentTool === 'line') {
        ctx.putImageData(tempState, 0, 0);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = currentSize;
        ctx.stroke();
      } else if (currentTool === 'arrow') {
        ctx.putImageData(tempState, 0, 0);
        drawArrow(startX, startY, pos.x, pos.y, currentColor, currentSize);
      }
    };

    const endDrawing = () => {
      if (!isDrawing) return;
      isDrawing = false;
      saveState();
    };

    canvas.onmouseup = endDrawing;
    canvas.onmouseleave = endDrawing;

    editorOverlay.querySelector('.chatops-image-editor-btn-apply').onclick = () => {
      const activeText = editorOverlay.querySelector('.chatops-image-editor-text-input');
      if (activeText) activeText.blur();

      const mergedCanvas = document.createElement('canvas');
      mergedCanvas.width = canvas.width;
      mergedCanvas.height = canvas.height;
      const mergedCtx = mergedCanvas.getContext('2d');

      mergedCtx.drawImage(img, 0, 0);
      mergedCtx.drawImage(canvas, 0, 0);

      const finalDataUrl = mergedCanvas.toDataURL(activeImgObj.mimeType || 'image/png', 0.9);
      onSaveCallback(finalDataUrl);
      updateImageEditorTranslations = null;
      editorOverlay.classList.remove('visible');
      document.removeEventListener('paste', handleGlobalPaste);
    };
  }

  function openImageResizeModal(srcList, isLibraryEditIndex) {
    let overlay = document.getElementById('chatops-image-resize-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'chatops-image-resize-overlay';
      overlay.className = 'chatops-image-resize-overlay';
      overlay.innerHTML = `
        <div class="chatops-image-resize-container">
          <div class="chatops-image-resize-header">
            <h3 class="chatops-image-resize-title">${language.resizeImageTitle || 'Resize Image'}</h3>
            <button class="chatops-image-resize-close">&times;</button>
          </div>
          <div class="chatops-image-resize-body">
            <div class="chatops-image-resize-preview-box">
              <img class="chatops-image-resize-preview-img" src="" alt="preview" />
            </div>
            
            <!-- Slide Navigation -->
            <div class="chatops-image-resize-navigator">
              <button type="button" class="chatops-image-resize-nav-btn prev-btn">&lt;</button>
              <div class="chatops-image-resize-nav-dots"></div>
              <button type="button" class="chatops-image-resize-nav-btn next-btn">&gt;</button>
            </div>

            <div class="chatops-image-resize-controls">
              <div class="chatops-image-resize-info-row">
                <span class="chatops-image-resize-orig-size">Original: --</span>
                <span class="chatops-image-resize-new-size">Estimated: --</span>
              </div>
              <div class="chatops-image-resize-slider-group">
                <div class="chatops-image-resize-slider-label">
                  <span>${language.resizeScaleLabel || 'Scale'}</span>
                  <span class="chatops-image-resize-slider-val">100%</span>
                </div>
                <input type="range" class="chatops-image-resize-slider" min="10" max="100" step="5" value="100" />
              </div>
            </div>
          </div>
          <div class="chatops-image-resize-footer">
            <button class="chatops-image-resize-btn chatops-image-resize-btn-edit" title="${language.editImageBtn || 'Sửa ảnh'}" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; margin-right: auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
            </button>
            <button class="chatops-image-resize-btn chatops-image-resize-btn-cancel">${language.cancel}</button>
            <button class="chatops-image-resize-btn chatops-image-resize-btn-insert">${language.submitSaveBtn || 'Gửi & Lưu'}</button>
            <button class="chatops-image-resize-btn chatops-image-resize-btn-send">${language.sendOnlyBtn || 'Gửi'}</button>
            <button class="chatops-image-resize-btn chatops-image-resize-btn-save">${language.saveCopy || 'Lưu thư viện'}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      
      overlay.querySelector('.chatops-image-resize-close').onclick = () => {
        currentResizeImageObj = null;
        overlay.classList.remove('visible');
      };
      overlay.querySelector('.chatops-image-resize-btn-cancel').onclick = () => {
        currentResizeImageObj = null;
        overlay.classList.remove('visible');
      };
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          currentResizeImageObj = null;
          overlay.classList.remove('visible');
        }
      });
    }

    const previewImg = overlay.querySelector('.chatops-image-resize-preview-img');
    const origSizeEl = overlay.querySelector('.chatops-image-resize-orig-size');
    const newSizeEl = overlay.querySelector('.chatops-image-resize-new-size');
    const slider = overlay.querySelector('.chatops-image-resize-slider');
    const sliderVal = overlay.querySelector('.chatops-image-resize-slider-val');
    const saveBtn = overlay.querySelector('.chatops-image-resize-btn-save');
    const insertBtn = overlay.querySelector('.chatops-image-resize-btn-insert');
    const sendBtn = overlay.querySelector('.chatops-image-resize-btn-send');
    const editBtn = overlay.querySelector('.chatops-image-resize-btn-edit');
    
    const navigatorRow = overlay.querySelector('.chatops-image-resize-navigator');
    const prevBtn = overlay.querySelector('.prev-btn');
    const nextBtn = overlay.querySelector('.next-btn');
    const dotsContainer = overlay.querySelector('.chatops-image-resize-nav-dots');

    const rawSources = Array.isArray(srcList) ? srcList : [srcList];
    const sources = rawSources.map(item => {
      if (typeof item === 'string') {
        let mimeType = item.split(';')[0].split(':')[1] || 'image/png';
        return { src: item, name: 'image', type: mimeType };
      }
      return item;
    });

    let imagesArray = sources.map(item => {
      let mimeType = item.type || 'image/png';
      if (item.name && item.name.toLowerCase().endsWith('.gif')) {
        mimeType = 'image/gif';
      } else if (item.name && item.name.toLowerCase().endsWith('.webp')) {
        mimeType = 'image/webp';
      }
      
      if (item.src && item.src.startsWith('data:image/gif;base64,')) {
        mimeType = 'image/gif';
      } else if (item.src && item.src.startsWith('data:image/webp;base64,')) {
        mimeType = 'image/webp';
      }
      
      if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mimeType)) {
        mimeType = 'image/png';
      }

      let srcStr = item.src;
      if (mimeType === 'image/gif' && srcStr.startsWith('data:') && !srcStr.startsWith('data:image/gif;')) {
        srcStr = srcStr.replace(/^data:[^;]+;/, 'data:image/gif;');
      } else if (mimeType === 'image/webp' && srcStr.startsWith('data:') && !srcStr.startsWith('data:image/webp;')) {
        srcStr = srcStr.replace(/^data:[^;]+;/, 'data:image/webp;');
      }

      return {
        src: srcStr,
        width: 0,
        height: 0,
        origWidth: 0,
        origHeight: 0,
        aspect: 1,
        sliderValue: 100,
        isAspectRatioLocked: true,
        testDataUrl: srcStr,
        mimeType: mimeType
      };
    });

    let currentIndex = 0;
    
    function loadActiveImage() {
      const activeImgObj = imagesArray[currentIndex];
      if (!activeImgObj) return;
      currentResizeImageObj = activeImgObj;

      if (editBtn) {
        const isAnimated = activeImgObj.mimeType === 'image/gif' || activeImgObj.mimeType === 'image/webp';
        editBtn.style.display = isAnimated ? 'none' : 'inline-flex';
        editBtn.onclick = (e) => {
          e.preventDefault(); e.stopPropagation();
          openImageEditor(activeImgObj, (editedDataUrl) => {
            activeImgObj.src = editedDataUrl;
            activeImgObj.testDataUrl = editedDataUrl;
            
            const tempImg = new Image();
            tempImg.onload = () => {
              activeImgObj.origWidth = tempImg.width;
              activeImgObj.origHeight = tempImg.height;
              activeImgObj.aspect = tempImg.width / tempImg.height;
              activeImgObj.width = Math.round(tempImg.width * (activeImgObj.sliderValue / 100));
              activeImgObj.height = Math.round(tempImg.height * (activeImgObj.sliderValue / 100));
              
              loadActiveImage();
            };
            tempImg.src = editedDataUrl;
          });
        };
      }

      const img = new Image();
      img.onload = () => {
        if (activeImgObj.origWidth === 0) {
          activeImgObj.origWidth = img.width;
          activeImgObj.origHeight = img.height;
          activeImgObj.aspect = img.width / img.height;
          activeImgObj.width = img.width;
          activeImgObj.height = img.height;
        }

        const isAnimated = activeImgObj.mimeType === 'image/gif' || activeImgObj.mimeType === 'image/webp';
        slider.disabled = isAnimated;
        
        const editBtn = overlay.querySelector('.chatops-image-resize-btn-edit');
        if (isAnimated) {
          slider.style.opacity = '0.5';
          slider.style.cursor = 'not-allowed';
          if (editBtn) {
            editBtn.disabled = true;
            editBtn.style.opacity = '0.5';
            editBtn.style.cursor = 'not-allowed';
            const labelText = activeImgObj.mimeType === 'image/gif' ? 'GIF' : 'WebP';
            editBtn.title = `${labelText} (Không hỗ trợ resize & edit)`;
          }
        } else {
          slider.style.opacity = '1';
          slider.style.cursor = 'pointer';
          if (editBtn) {
            editBtn.disabled = false;
            editBtn.style.opacity = '1';
            editBtn.style.cursor = 'pointer';
            editBtn.title = language.editImageBtn || 'Sửa ảnh';
          }
        }

        origSizeEl.textContent = `Original: ${activeImgObj.origWidth}x${activeImgObj.origHeight} (${formatSize(getBase64Size(activeImgObj.src))})`;
        slider.value = activeImgObj.sliderValue;
        sliderVal.textContent = `${activeImgObj.sliderValue}%`;

        function updateCalculatedSize() {
          const pct = activeImgObj.sliderValue / 100;
          const w = Math.round(activeImgObj.origWidth * pct) || 10;
          const h = Math.round(activeImgObj.origHeight * pct) || 10;
          
          activeImgObj.width = w;
          activeImgObj.height = h;

          if (isAnimated) {
            activeImgObj.testDataUrl = activeImgObj.src;
            const newBytes = getBase64Size(activeImgObj.src);
            const labelText = activeImgObj.mimeType === 'image/gif' ? 'GIF' : 'WebP';
            newSizeEl.innerHTML = `<span style="color:#eab308;font-weight:600;font-size:11px;">${labelText} (Không hỗ trợ resize & edit):</span> ${activeImgObj.origWidth}x${activeImgObj.origHeight} (${formatSize(newBytes)})`;
            
            previewImg.src = activeImgObj.src;
            previewImg.style.width = '';
            previewImg.style.height = '';
            previewImg.style.maxWidth = '100%';
            previewImg.style.maxHeight = '100%';
            return;
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          if (activeImgObj.mimeType !== 'image/png') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, w, h);
          }
          ctx.drawImage(img, 0, 0, w, h);
          
          const testDataUrl = canvas.toDataURL(activeImgObj.mimeType, 0.9);
          activeImgObj.testDataUrl = testDataUrl;
          
          const newBytes = getBase64Size(testDataUrl);
          newSizeEl.textContent = `Estimated: ${w}x${h} (${formatSize(newBytes)})`;
          
          previewImg.src = testDataUrl;
          previewImg.style.width = w + 'px';
          previewImg.style.height = h + 'px';
        }

        slider.oninput = () => {
          activeImgObj.sliderValue = parseInt(slider.value, 10);
          sliderVal.textContent = `${slider.value}%`;
          updateCalculatedSize();
        };

        // Initialize display
        updateCalculatedSize();
      };
      
      previewImg.src = activeImgObj.src;
      img.src = activeImgObj.src;
      
      renderSlideNavigator();
    }

    function renderSlideNavigator() {
      if (imagesArray.length <= 1) {
        navigatorRow.style.setProperty('display', 'none', 'important');
        return;
      }
      navigatorRow.style.removeProperty('display');
      
      // Update prev/next button disabled states
      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === imagesArray.length - 1;
      
      // Render navigation dots
      dotsContainer.innerHTML = imagesArray.map((_, i) => {
        const isActive = i === currentIndex;
        return `
          <span class="chatops-image-resize-nav-dot ${isActive ? 'active' : ''}" data-index="${i}"></span>
        `;
      }).join('');
    }

    // Set up navigation clicks
    prevBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (currentIndex > 0) {
        currentIndex--;
        loadActiveImage();
      }
    };

    nextBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (currentIndex < imagesArray.length - 1) {
        currentIndex++;
        loadActiveImage();
      }
    };

    dotsContainer.onclick = (e) => {
      const dot = e.target.closest('.chatops-image-resize-nav-dot');
      if (dot) {
        const idx = parseInt(dot.dataset.index, 10);
        if (!isNaN(idx) && idx !== currentIndex) {
          currentIndex = idx;
          loadActiveImage();
        }
      }
    };

    // "Gửi & Lưu" (Submit & Save) handler - Processes active image only, slides to next or closes when done
    insertBtn.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const activeImgObj = imagesArray[currentIndex];
      if (!activeImgObj) return;

      // 1. Submit to Chat
      insertAndMaybeSend(activeImgObj.testDataUrl);

      // 2. Save to Image Library
      const res = await chrome.storage.local.get(['custom_memes']);
      const customMemes = res.custom_memes || [];
      
      let totalBytes = 0;
      customMemes.forEach((url, i) => {
        if (isLibraryEditIndex !== i) {
          totalBytes += getBase64Size(url);
        }
      });
      const newBytes = getBase64Size(activeImgObj.testDataUrl);

      if (totalBytes + newBytes > 10 * 1024 * 1024) {
        showToast(language.storageLimitExceeded || 'Storage limit exceeded (10MB maximum)! Please delete some old images.');
        return;
      }

      if (isLibraryEditIndex !== undefined && isLibraryEditIndex >= 0 && isLibraryEditIndex < customMemes.length) {
        customMemes[isLibraryEditIndex] = activeImgObj.testDataUrl;
      } else {
        customMemes.unshift(activeImgObj.testDataUrl);
      }
      
      await chrome.storage.local.set({ custom_memes: customMemes });
      loadCustomImages();
      
      // 3. Remove image from slide deck
      imagesArray.splice(currentIndex, 1);

      if (imagesArray.length > 0) {
        // Switch to the next available image
        if (currentIndex >= imagesArray.length) {
          currentIndex = imagesArray.length - 1;
        }
        loadActiveImage();
        showToast(language.toastSentAndSavedNext || 'Đã gửi & lưu ảnh! Đang chuyển sang ảnh tiếp theo...');
      } else {
        // Complete! Close modal
        currentResizeImageObj = null;
        overlay.classList.remove('visible');
        showToast(language.toastSentAndSavedAll || 'Đã gửi & lưu toàn bộ ảnh thành công! 🎉');
      }
    };

    // "Gửi" (Send only) handler - Sends active image to chat directly without saving to custom library
    sendBtn.onclick = (e) => {
      e.preventDefault(); e.stopPropagation();
      const activeImgObj = imagesArray[currentIndex];
      if (!activeImgObj) return;

      // 1. Submit to Chat
      insertAndMaybeSend(activeImgObj.testDataUrl);

      // 2. Remove image from slide deck
      imagesArray.splice(currentIndex, 1);

      if (imagesArray.length > 0) {
        // Switch to the next available image
        if (currentIndex >= imagesArray.length) {
          currentIndex = imagesArray.length - 1;
        }
        loadActiveImage();
        showToast(language.toastSentOnlyNext || 'Đã gửi ảnh! Đang chuyển sang ảnh tiếp theo...');
      } else {
        // Complete! Close modal
        currentResizeImageObj = null;
        overlay.classList.remove('visible');
        showToast(language.toastSentAll || 'Đã gửi toàn bộ ảnh thành công! 🎉');
      }
    };

    // Save only button (Lưu thư viện) - Processes active image only, slides to next or closes when done
    saveBtn.onclick = async (e) => {
      e.preventDefault(); e.stopPropagation();
      const activeImgObj = imagesArray[currentIndex];
      if (!activeImgObj) return;

      const res = await chrome.storage.local.get(['custom_memes']);
      const customMemes = res.custom_memes || [];
      
      let totalBytes = 0;
      customMemes.forEach((url, i) => {
        if (isLibraryEditIndex !== i) {
          totalBytes += getBase64Size(url);
        }
      });
      const newBytes = getBase64Size(activeImgObj.testDataUrl);

      if (totalBytes + newBytes > 10 * 1024 * 1024) {
        showToast(language.storageLimitExceeded || 'Storage limit exceeded (10MB maximum)! Please delete some old images.');
        return;
      }

      if (isLibraryEditIndex !== undefined && isLibraryEditIndex >= 0 && isLibraryEditIndex < customMemes.length) {
        customMemes[isLibraryEditIndex] = activeImgObj.testDataUrl;
      } else {
        customMemes.unshift(activeImgObj.testDataUrl);
      }
      
      await chrome.storage.local.set({ custom_memes: customMemes });
      loadCustomImages();

      // Remove image from slide deck
      imagesArray.splice(currentIndex, 1);

      if (imagesArray.length > 0) {
        if (currentIndex >= imagesArray.length) {
          currentIndex = imagesArray.length - 1;
        }
        loadActiveImage();
        showToast(language.toastSavedToLibraryNext || 'Đã lưu ảnh vào thư viện! Đang chuyển sang ảnh tiếp theo...');
      } else {
        currentResizeImageObj = null;
        overlay.classList.remove('visible');
        showToast(language.toastSavedToLibraryAll || 'Đã lưu toàn bộ ảnh vào thư viện! 🎉');
      }
    };

    // Initial load
    loadActiveImage();
    overlay.classList.add('visible');
  }


  function compressImage(file, maxWidth, maxHeight, quality, callback) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw white background if converting to JPEG to avoid black transparent areas
        const isPNG = file.type === 'image/png';
        if (!isPNG) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = isPNG ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function createBlankWhiteImage(width = 800, height = 600) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    return canvas.toDataURL('image/png');
  }

  function registerCustomImageEvents() {
    const drawBtn = document.getElementById('chatops-draw-btn');
    if (drawBtn) {
      drawBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const blankSrc = createBlankWhiteImage(800, 600);
        const activeImgObj = {
          src: blankSrc,
          testDataUrl: blankSrc,
          mimeType: 'image/png',
          origWidth: 800,
          origHeight: 600,
          aspect: 800 / 600,
          width: 800,
          height: 600,
          sliderValue: 100,
          isAspectRatioLocked: true,
          isDrawing: true
        };
        if (imagePickerEl) imagePickerEl.classList.add('hidden');
        openImageEditor(activeImgObj, (editedDataUrl) => {
          openImageResizeModal(editedDataUrl);
        });
      });
    }



    // Handle global paste event when Image Picker is visible/open
    document.addEventListener('paste', async (e) => {
      if (!imagePickerEl || imagePickerEl.classList.contains('hidden')) return;

      // If user is focusing on an input or textarea that is not part of our image picker, do not intercept
      const activeEl = document.activeElement;
      if (activeEl) {
        const isTextareaOrInput = activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT';
        const isInsidePicker = imagePickerEl.contains(activeEl);
        if (isTextareaOrInput && !isInsidePicker) {
          return;
        }
      }

      const items = (e.clipboardData || e.originalEvent?.clipboardData)?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            let fileDataUrl = '';
            let fileType = file.type;
            if (needsChatOpsConversion(file.type, file.name)) {
              try {
                const converted = await convertForChatOps(file);
                fileDataUrl = converted.dataUrl;
                fileType = converted.type;
              } catch (err) {
                console.error('[ChatOps] Paste image conversion failed:', err);
              }
            }
            if (!fileDataUrl) {
              fileDataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.readAsDataURL(file);
              });
            }

            const newImg = new Image();
            newImg.onload = () => {
              const activeImgObj = {
                src: fileDataUrl,
                testDataUrl: fileDataUrl,
                mimeType: fileType || 'image/png',
                origWidth: newImg.naturalWidth,
                origHeight: newImg.naturalHeight,
                aspect: newImg.naturalWidth / newImg.naturalHeight,
                width: newImg.naturalWidth,
                height: newImg.naturalHeight,
                sliderValue: 100,
                isAspectRatioLocked: true,
                isDrawing: true
              };
              if (imagePickerEl) imagePickerEl.classList.add('hidden');
              openImageEditor(activeImgObj, (editedDataUrl) => {
                openImageResizeModal(editedDataUrl);
              });
            };
            newImg.src = fileDataUrl;
            break;
          }
        }
      }
    });


    const fileInput = document.getElementById('chatops-image-upload-input');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        if (files.length > 5) {
          showToast(language.maxUploadLimitError || 'Bạn chỉ có thể tải lên tối đa 5 ảnh cùng lúc.');
          fileInput.value = '';
          return;
        }

        const hasNonImage = files.some(f => !f.type.startsWith('image/') && !f.name.toLowerCase().endsWith('.gif') && !f.name.toLowerCase().endsWith('.webp'));
        if (hasNonImage) {
          showToast(language.uploadOnlyImages || 'Please upload image files only.');
          fileInput.value = '';
          return;
        }

        // Convert any non-ChatOps-compatible format before opening resize modal
        const hasUnsupported = files.some(f => needsChatOpsConversion(f.type, f.name));
        if (hasUnsupported) showToast(language.webpConvertingToast || 'Converting image... Please wait.');

        const readers = files.map(async (file) => {
          if (needsChatOpsConversion(file.type, file.name)) {
            try {
              const converted = await convertForChatOps(file);
              return { src: converted.dataUrl, name: converted.name, type: converted.type };
            } catch (err) {
              console.error('[ChatOps] Image conversion failed:', err);
              // Fallback: read as-is
            }
          }
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve({ src: ev.target.result, name: file.name, type: file.type });
            reader.readAsDataURL(file);
          });
        });

        const sources = await Promise.all(readers);
        openImageResizeModal(sources);
        fileInput.value = '';
      });
    }

    const container = document.getElementById('chatops-custom-images-grid');
    if (container) {
      container.addEventListener('click', async (e) => {
        const img = e.target.closest('.chatops-custom-image-item');
        if (img) {
          insertAndMaybeSend(img.src);
          if (imagePickerEl) imagePickerEl.classList.add('hidden');
          return;
        }

        const previewBtn = e.target.closest('.chatops-custom-image-preview');
        if (previewBtn) {
          e.stopPropagation();
          const idx = parseInt(previewBtn.dataset.idx, 10);
          const res = await chrome.storage.local.get(['custom_memes']);
          const customMemes = res.custom_memes || [];
          if (customMemes[idx]) {
            openImagePreview(customMemes[idx]);
          }
          return;
        }

        const resizeBtn = e.target.closest('.chatops-custom-image-resize');
        if (resizeBtn) {
          e.stopPropagation();
          const idx = parseInt(resizeBtn.dataset.idx, 10);
          const res = await chrome.storage.local.get(['custom_memes']);
          const customMemes = res.custom_memes || [];
          if (customMemes[idx]) {
            openImageResizeModal(customMemes[idx], idx);
          }
          return;
        }

        const inlineEditBtn = e.target.closest('.chatops-custom-image-edit');
        if (inlineEditBtn) {
          e.stopPropagation();
          const idx = parseInt(inlineEditBtn.dataset.idx, 10);
          const res = await chrome.storage.local.get(['custom_memes']);
          const customMemes = res.custom_memes || [];
          if (customMemes[idx]) {
            const activeImgObj = {
              src: customMemes[idx],
              testDataUrl: customMemes[idx],
              mimeType: 'image/png',
              origWidth: 0,
              origHeight: 0,
              aspect: 1,
              width: 0,
              height: 0,
              sliderValue: 100,
              isAspectRatioLocked: true
            };
            openImageEditor(activeImgObj, async (editedDataUrl) => {
              customMemes[idx] = editedDataUrl;
              await chrome.storage.local.set({ custom_memes: customMemes });
              loadCustomImages();
            });
          }
          return;
        }

        const delBtn = e.target.closest('.chatops-custom-image-delete');
        if (delBtn) {
          e.stopPropagation();
          const idx = parseInt(delBtn.dataset.idx, 10);
          const res = await chrome.storage.local.get(['custom_memes']);
          const customMemes = res.custom_memes || [];
          customMemes.splice(idx, 1);
          await chrome.storage.local.set({ custom_memes: customMemes });
          loadCustomImages();
        }
      });

      // Double-click to preview custom images
      container.addEventListener('dblclick', (e) => {
        const img = e.target.closest('.chatops-custom-image-item');
        if (img) {
          e.stopPropagation();
          openImagePreview(img.src);
        }
      });
    }
  }

  function toggleImagePickerUI(anchorBtn, targetTextboxId) {
    if (!imagePickerEl) {
      imagePickerEl = document.createElement('div');
      imagePickerEl.className = 'chatops-image-picker hidden';
      imagePickerEl.innerHTML = `
        <div class="chatops-image-picker-header" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; border-bottom: 1px solid #e0e0e5; padding: 10px 12px 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-weight: 700; font-size: 13px; color: #1c58d9;">${language.imageLibrary}</span>
            <button type="button" id="chatops-image-close" class="chatops-image-close-btn">✕</button>
          </div>
          <div class="chatops-picker-sub-tabs">
            <button type="button" class="chatops-picker-sub-tab active" data-tab="library">${language.imageLibraryTab}</button>
            <button type="button" class="chatops-picker-sub-tab" data-tab="gifs">${language.gifLibraryTab}</button>
          </div>
        </div>
        
        <!-- Panel 1: Library -->
        <div id="chatops-picker-panel-library" class="chatops-picker-panel active">
          <div class="chatops-image-upload-area">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 6px; gap: 8px; flex-wrap: wrap;">
              <div style="display:flex; flex-direction:column; line-height: 1.2; flex-shrink: 0;">
                <span id="chatops-your-images-header" style="font-size:11px; font-weight:700; color:#555; text-transform:uppercase; letter-spacing:0.5px;">${language.yourImages}</span>
                <span id="chatops-your-images-size" style="font-size:10px; color:#888; margin-top:2px;">(0 KB / 10 MB)</span>
              </div>
              <div style="display:flex; gap: 6px; align-items: center; flex-wrap: wrap;">
                <button type="button" id="chatops-draw-btn" class="chatops-image-upload-btn" style="outline: none; font-family: inherit; box-sizing: border-box;">
                  🎨 ${language.drawBtn || 'Tự vẽ'}
                </button>
                <label id="chatops-upload-label" for="chatops-image-upload-input" class="chatops-image-upload-btn" style="margin: 0; cursor: pointer;">
                  ${language.uploadImageBtn}
                </label>
              </div>
              <input type="file" id="chatops-image-upload-input" accept="image/*" style="display:none;" multiple />
            </div>
            <div id="chatops-custom-images-grid" class="chatops-custom-images-grid-container">
              <span class="chatops-image-empty">${language.noImagesHint}</span>
            </div>
          </div>
        </div>

        <!-- Panel 2: GIFs -->
        <div id="chatops-picker-panel-gifs" class="chatops-picker-panel">
          <div style="padding: 6px 12px 10px; display: flex; flex-direction: column; gap: 6px; flex: 1; overflow: hidden; height: 100%; box-sizing: border-box;">
            <div id="chatops-picker-gif-search-area" class="chatops-gif-search-area" style="position: relative; display: flex; align-items: center; width: 100%;">
              <input type="text" id="chatops-picker-gif-search" placeholder="${language.searchGifPlaceholder}"
                style="width: 100%; padding: 6px 28px 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 11px; outline: none; font-family: inherit; background:#fff; box-sizing:border-box;">
              <span style="position: absolute; right: 8px; font-size: 11px; color: #888; pointer-events: none;">🔍</span>
            </div>
            <div class="chatops-gif-hint-notice" style="font-size: 11.5px; color: #555; background: #f5f5f7; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; line-height: 1.4; box-sizing: border-box; display: flex; align-items: flex-start; gap: 4px; margin-top: 1px;">
              <span data-i18n="gifDefaultHint">${language.gifDefaultHint}</span>
            </div>
            <div id="chatops-picker-gifs-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; flex: 1; overflow-y: auto; padding: 2px 2px;">
              <!-- GIFs rendered here dynamically -->
            </div>
          </div>
        </div>



        <!-- Picker Footer with Auto-send toggle -->
        <div class="chatops-image-picker-footer" style="padding: 8px 12px; border-top: 1px solid #e0e0e5; background: #f5f5f7; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;">
          <label id="chatops-auto-send-toggle" title="${language.autoSendLabel || 'Gửi trực tiếp'}" style="display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:600; color:#555; cursor:pointer; user-select:none; margin:0; line-height:1; height:16px;">
            <input type="checkbox" id="chatops-auto-send-check" style="width:13px; height:13px; margin:0; padding:0; cursor:pointer; accent-color:#1c58d9; vertical-align:middle;">
            <span style="display:inline-block; line-height:1; vertical-align:middle;">${language.autoSendLabel || 'Gửi trực tiếp'}</span>
          </label>
          <span style="font-size: 10px; color: #888; font-weight: 500;">ChatOps++</span>
        </div>
      `;
      document.body.appendChild(imagePickerEl);

      // Auto-send toggle handler
      const autoSendCheck = document.getElementById('chatops-auto-send-check');
      if (autoSendCheck) {
        autoSendCheck.checked = pickerAutoSend;
        autoSendCheck.addEventListener('change', () => {
          pickerAutoSend = autoSendCheck.checked;
          chrome.storage.local.set({ chatops_picker_autosend: pickerAutoSend });
        });
      }

      document.getElementById('chatops-image-close').addEventListener('click', () => {
        imagePickerEl.classList.add('hidden');
      });
      document.addEventListener('click', (e) => {
        if (!imagePickerEl) return;
        const isClickInside = imagePickerEl.contains(e.target);
        const isClickAnchor = e.target.closest('.chatops-ext-image-picker-btn');
        const isClickPreview = e.target.closest('#chatops-image-preview-overlay') || e.target.closest('.chatops-image-preview-overlay');
        const isClickResize = e.target.closest('#chatops-image-resize-overlay') || e.target.closest('.chatops-image-resize-overlay');
        if (!isClickInside && !isClickAnchor && !isClickPreview && !isClickResize) {
          imagePickerEl.classList.add('hidden');
        }
      });

      // Tab switching listeners
      imagePickerEl.querySelectorAll('.chatops-picker-sub-tab').forEach(tabBtn => {
        tabBtn.addEventListener('click', async (e) => {
          imagePickerEl.querySelectorAll('.chatops-picker-sub-tab').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');

          const tabName = e.target.dataset.tab;
          imagePickerEl.querySelectorAll('.chatops-picker-panel').forEach(p => p.classList.remove('active'));
          
          const targetPanel = imagePickerEl.querySelector(`#chatops-picker-panel-${tabName}`);
          if (targetPanel) {
            targetPanel.classList.add('active');
          }

          if (tabName === 'gifs') {
            const pickerGifSearchInput = document.getElementById('chatops-picker-gif-search');
            const currentQuery = pickerGifSearchInput ? pickerGifSearchInput.value : '';
            if (currentQuery.trim() === '') {
              loadPickerGifs('');
            }
          }
        });
      });

      // GIF search input keyup/input listener
      const pickerGifSearchInput = document.getElementById('chatops-picker-gif-search');
      if (pickerGifSearchInput) {
        let pickerGifTimeout = null;
        pickerGifSearchInput.addEventListener('input', (e) => {
          clearTimeout(pickerGifTimeout);
          pickerGifTimeout = setTimeout(() => {
            loadPickerGifs(e.target.value);
          }, 300);
        });
      }

      // GIF Grid interactions
      const pickerGifsGrid = document.getElementById('chatops-picker-gifs-grid');
      if (pickerGifsGrid) {
        pickerGifsGrid.addEventListener('click', (e) => {
          const clickedImg = e.target.closest('img');
          const clickedItem = e.target.closest('.chatops-picker-meme-item');
          if (clickedImg && clickedItem) {
            const url = clickedItem.dataset.url;
            insertAndMaybeSend(url);
            imagePickerEl.classList.add('hidden');
          }
        });

        // Double-click to preview in full
        pickerGifsGrid.addEventListener('dblclick', (e) => {
          const clickedImg = e.target.closest('img');
          const clickedItem = e.target.closest('.chatops-picker-meme-item');
          if (clickedImg && clickedItem) {
            e.stopPropagation();
            const url = clickedItem.dataset.url;
            openImagePreview(url);
          }
        });
      }



      loadCustomImages();
      registerCustomImageEvents();
    }

    // Set the tracking variables
    const container = anchorBtn.closest('.post-create-body, .input-container, .post-body__cell, .post-create, form, [class*="post-create"]');
    if (container) {
      activeChatTextarea = container.querySelector('textarea');
    } else {
      activeChatTextarea = document.getElementById(targetTextboxId) || 
        (targetTextboxId === 'reply_textbox'
          ? document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]')
          : document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]'));
    }

    imagePickerEl.dataset.activeTextbox = targetTextboxId || 'post_textbox';

    const isHidden = imagePickerEl.classList.contains('hidden');
    if (isHidden) {
      // Revert to active tab (library) when opening
      imagePickerEl.querySelectorAll('.chatops-picker-sub-tab').forEach(b => {
        if (b.dataset.tab === 'library') b.classList.add('active');
        else b.classList.remove('active');
      });
      imagePickerEl.querySelectorAll('.chatops-picker-panel').forEach(p => {
        if (p.id === 'chatops-picker-panel-library') p.classList.add('active');
        else p.classList.remove('active');
      });

      loadCustomImages();
      const rect = anchorBtn.getBoundingClientRect();
      
      // Calculate normal bottom position (so it is 10px above the button)
      const pickerHeight = 480; // Height of the picker in CSS
      let bottomValue = window.innerHeight - rect.top + 10;
      
      // Prevent picker from going above the top of the viewport
      // Top position of picker = window.innerHeight - bottomValue - pickerHeight
      // We want: Top position of picker >= 10px
      // So: window.innerHeight - bottomValue - pickerHeight >= 10
      // => bottomValue <= window.innerHeight - pickerHeight - 10
      const maxBottom = window.innerHeight - pickerHeight - 10;
      if (bottomValue > maxBottom) {
        bottomValue = Math.max(10, maxBottom);
      }
      
      imagePickerEl.style.position = 'fixed'; // Ensure fixed viewport-relative positioning
      imagePickerEl.style.bottom = `${bottomValue}px`;
      imagePickerEl.style.left = `${Math.max(10, rect.left - 320)}px`;
      imagePickerEl.classList.remove('hidden');
    } else {
      imagePickerEl.classList.add('hidden');
    }
  }



  let cachedPickerTrendingGifs = [];
  let cachedPickerTrendingApiKey = '';

  async function loadPickerGifs(query = '') {
    const grid = document.getElementById('chatops-picker-gifs-grid');
    if (!grid) return;

    const searchArea = document.getElementById('chatops-picker-gif-search-area');

    try {
      const resSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
      const settings = resSettings[STORAGE_KEYS.SETTINGS] || {};
      const apiKey = settings.giphyApiKey || '';
      const hintNotice = document.querySelector('.chatops-gif-hint-notice');

      // No API key configured — show setup hint and hide search box
      if (!apiKey) {
        if (searchArea) searchArea.style.display = 'none';
        if (hintNotice) hintNotice.style.display = 'none';
        grid.innerHTML = `
          <div style="grid-column: span 3; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height: 180px; padding: 12px; text-align:center; box-sizing:border-box;">
            <span style="color:var(--text-3); font-size:12px; display:block; margin:0; padding:0;">${language.giphyNoApiKey}</span>
            <a href="#" id="chatops-gif-setup-link" style="font-size:12px; color:#1c58d9; font-weight:600; text-decoration:none; margin-top:2px;">${language.giphySetupLink} ↗</a>
          </div>
        `;
        // Open sidepanel and navigate to Settings → GIFs
        const setupLink = grid.querySelector('#chatops-gif-setup-link');
        if (setupLink) {
          setupLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.storage.local.set({
              [STORAGE_KEYS.SIDEPANEL_TAB]: 'settings',
              sidePanelSubTab: 'features-gif'
            });
            openSidePanel();
          });
        }
        return;
      }

      // If key is present, show search box and toggle hint based on search query
      if (searchArea) searchArea.style.display = 'flex';
      if (hintNotice) {
        hintNotice.style.display = query.trim() === '' ? 'flex' : 'none';
      }

      // Reuse trending cache for same API key
      if (query.trim() === '' && cachedPickerTrendingGifs.length > 0 && cachedPickerTrendingApiKey === apiKey) {
        grid.innerHTML = cachedPickerTrendingGifs.map(gif => {
          const previewUrl = gif.images.fixed_height_small.url;
          const insertUrl = settings.giphySize === '100' ? gif.images.fixed_height_small.url : gif.images.fixed_height.url;
          return `<div class="chatops-picker-meme-item" data-url="${insertUrl}" title="${gif.title}"><img src="${previewUrl}" alt="${gif.title}" loading="lazy"></div>`;
        }).join('');
        return;
      }

      grid.innerHTML = '<div style="grid-column: span 3; display:flex; align-items:center; justify-content:center; min-height: 100px;"><span class="chatops-image-empty">Loading GIFs...</span></div>';

      let url;
      if (query.trim() === '') {
        url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=21&rating=g`;
      } else {
        url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=21&offset=0&rating=g&lang=en`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.length > 0) {
          if (query.trim() === '') {
            cachedPickerTrendingGifs = result.data;
            cachedPickerTrendingApiKey = apiKey;
          }
          grid.innerHTML = result.data.map(gif => {
            const previewUrl = gif.images.fixed_height_small.url;
            const insertUrl = settings.giphySize === '100' ? gif.images.fixed_height_small.url : gif.images.fixed_height.url;
            return `<div class="chatops-picker-meme-item" data-url="${insertUrl}" title="${gif.title}"><img src="${previewUrl}" alt="${gif.title}" loading="lazy"></div>`;
          }).join('');
          return;
        }
      }
      
      // If API query fails (invalid key or rate limit) on initial load, hide search bar and show setup link
      if (query.trim() === '') {
        if (searchArea) searchArea.style.display = 'none';
        if (hintNotice) hintNotice.style.display = 'none';
        grid.innerHTML = `
          <div style="grid-column: span 3; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height: 180px; padding: 12px; text-align:center; box-sizing:border-box;">
            <span style="color:#ef4444; font-size:12px; display:block; margin:0; padding:0;">${language.giphyInvalidKey}</span>
            <a href="#" id="chatops-gif-setup-link" style="font-size:12px; color:#1c58d9; font-weight:600; text-decoration:none; margin-top:2px;">${language.giphySetupLink} ↗</a>
          </div>
        `;
        const setupLink = grid.querySelector('#chatops-gif-setup-link');
        if (setupLink) {
          setupLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.storage.local.set({
              [STORAGE_KEYS.SIDEPANEL_TAB]: 'settings',
              sidePanelSubTab: 'features-gif'
            });
            openSidePanel();
          });
        }
        return;
      }

      grid.innerHTML = '<div style="grid-column: span 3; display:flex; align-items:center; justify-content:center; min-height: 100px;"><span class="chatops-image-empty">No GIFs found</span></div>';
    } catch (err) {
      console.error('Failed to load GIFs in picker:', err);
      const hintNotice = document.querySelector('.chatops-gif-hint-notice');
      // Hide search bar if it is initial load error
      if (query.trim() === '') {
        if (searchArea) searchArea.style.display = 'none';
        if (hintNotice) hintNotice.style.display = 'none';
        grid.innerHTML = `
          <div style="grid-column: span 3; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; min-height: 180px; padding: 12px; text-align:center; box-sizing:border-box;">
            <span style="color:#ef4444; font-size:12px; display:block; margin:0; padding:0;">${language.giphyConnectionError}</span>
            <a href="#" id="chatops-gif-setup-link" style="font-size:12px; color:#1c58d9; font-weight:600; text-decoration:none; margin-top:2px;">${language.giphySetupLink} ↗</a>
          </div>
        `;
        const setupLink = grid.querySelector('#chatops-gif-setup-link');
        if (setupLink) {
          setupLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.storage.local.set({
              [STORAGE_KEYS.SIDEPANEL_TAB]: 'settings',
              sidePanelSubTab: 'features-gif'
            });
            openSidePanel();
          });
        }
        return;
      }
      grid.innerHTML = '<div style="grid-column: span 3; display:flex; align-items:center; justify-content:center; min-height: 100px;"><span class="chatops-image-empty">Failed to load GIFs</span></div>';
    }
  }

  function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  }

  function insertImageToChat(url) {
    let textarea = activeChatTextarea;
    if (!textarea) {
      const targetId = imagePickerEl?.dataset.activeTextbox || 'post_textbox';
      textarea = document.getElementById(targetId);
      if (!textarea) {
        if (targetId === 'reply_textbox') {
          textarea = document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]');
        } else {
          textarea = document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]');
        }
      }
    }
    if (!textarea) return;

    if (url.startsWith('data:')) {
      (async () => {
        try {
          let finalUrl = url;
          const mimeMatch = url.match(/^data:([^;]+);/);
          const mimeType = mimeMatch ? mimeMatch[1] : '';
          if (needsChatOpsConversion(mimeType)) {
            const converted = await convertForChatOps(url);
            finalUrl = converted.dataUrl;
          }

          const blob = dataURLtoBlob(finalUrl);
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], `image.${ext}`, { type: blob.type });

          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
          });

          textarea.focus();
          textarea.dispatchEvent(pasteEvent);
        } catch (err) {
          console.error('Failed to paste custom image:', err);
        }
      })();
      return;
    }

    const markdown = `![image](${url})`;
    insertTextIntoTextarea(textarea, markdown);
  }

  globalInsertImageToChat = insertImageToChat;

  function insertAndMaybeSend(url, forceSend = false) {
    insertImageToChat(url);
    const shouldSend = forceSend || pickerAutoSend;
    if (shouldSend) {
      let attempts = 0;
      const checkAndSend = () => {
        attempts++;
        let textarea = activeChatTextarea;
        if (!textarea) {
          const targetId = imagePickerEl?.dataset.activeTextbox || 'post_textbox';
          textarea = document.getElementById(targetId);
          if (!textarea) {
            if (targetId === 'reply_textbox') {
              textarea = document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]');
            } else {
              textarea = document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]');
            }
          }
        }
        if (!textarea) return;

        const parentForm = textarea.closest('form');
        let isUploading = false;
        if (parentForm) {
          // Check for progress bars, loading spinners, uploading elements, etc.
          const progressEl = parentForm.querySelector('[class*="progress" i], [class*="loading" i], [class*="spinner" i], [class*="uploading" i]');
          if (progressEl) {
            isUploading = true;
          }
          // Check if send button is disabled
          const sendBtn = parentForm.querySelector('button[type="submit"], button.send-button, .send-button button, button[aria-label*="send" i], button[title*="send" i], button[aria-label*="gửi" i], button[title*="gửi" i]');
          if (sendBtn && (sendBtn.disabled || sendBtn.classList.contains('disabled'))) {
            isUploading = true;
          }
        }

        // If uploading and we haven't hit the 5-second limit, try again in 100ms
        if (isUploading && attempts < 50) {
          setTimeout(checkAndSend, 100);
          return;
        }

        // Try form requestSubmit first
        if (parentForm && typeof parentForm.requestSubmit === 'function') {
          try {
            parentForm.requestSubmit();
            return;
          } catch (err) {
            console.error('[ChatOps++] requestSubmit failed, falling back:', err);
          }
        }

        // Fallback: Try to click the native send button (English & Vietnamese selectors)
        let sendBtn = null;
        if (parentForm) {
          sendBtn = parentForm.querySelector('button[type="submit"], button.send-button, .send-button button, button[aria-label*="send" i], button[title*="send" i], button[aria-label*="gửi" i], button[title*="gửi" i]');
        }
        if (!sendBtn) {
          sendBtn = document.querySelector('button.send-button, .send-button button, button[aria-label*="send" i], button[title*="send" i], button[aria-label*="gửi" i], button[title*="gửi" i]');
        }

        if (sendBtn) {
          sendBtn.click();
        } else {
          // Fallback: Dispatch Enter key event
          const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true,
            cancelable: true
          });
          textarea.dispatchEvent(enterEvent);
        }
      };

      // Start check/send cycle after 150ms to allow file upload to initialize in DOM
      setTimeout(checkAndSend, 150);
    }
  }

  // --- Quick Task on Messages ---
  quickNotePopover = null;
  quickNoteBackdrop = null;

  function convertToCustomDropdown(nativeSelect, width = null) {
    if (!nativeSelect) return;
    if (nativeSelect.nextElementSibling?.classList.contains('custom-dropdown-container')) {
      nativeSelect.nextElementSibling.remove();
    }

    nativeSelect.style.display = 'none';

    const computedStyle = window.getComputedStyle(nativeSelect);
    const selectWidth = width || computedStyle.width || '100%';

    const container = document.createElement('div');
    container.className = 'custom-dropdown-container';
    container.style.width = selectWidth;
    container.style.flexShrink = '0';
    container.style.boxSizing = 'border-box';
    container.style.display = 'inline-block';
    container.style.verticalAlign = 'middle';
    container.style.setProperty('overflow', 'visible', 'important');

    const options = Array.from(nativeSelect.options);
    const selectedIndex = nativeSelect.selectedIndex >= 0 ? nativeSelect.selectedIndex : 0;
    const initialText = options[selectedIndex]?.textContent || 'Select...';

    container.innerHTML = `
      <div class="custom-dropdown" style="position: relative; width: 100%; box-sizing: border-box; font-family: var(--font); overflow: visible !important;">
        <button type="button" class="custom-dropdown-toggle"
          style="width: 100%; height: 34px; font-size: 11.5px; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1a1a1c; cursor: pointer; outline: none; display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0 10px !important; margin: 0 !important; font-weight: 400; transition: all 0.2s ease; box-sizing: border-box; line-height: 1 !important;">
          <span class="custom-dropdown-selected-text" style="font-weight: 400; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; text-align: left; justify-content: flex-start; line-height: 1; display: inline-flex; align-items: center; height: 100%; margin: 0; padding: 0;">${initialText}</span>
          <span class="custom-dropdown-arrow" style="font-size: 9px; opacity: 0.6; transition: transform 0.2s ease; margin-left: 2px; flex-shrink: 0; line-height: 1; display: inline-flex; align-items: center; height: 100%;">▼</span>
        </button>
        <ul class="custom-dropdown-menu"
          style="position: absolute; top: 100%; right: 0; margin-top: 6px; width: 100%; min-width: 120px; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); padding: 4px 0; list-style: none; display: none; z-index: 1000000; max-height: 220px; overflow-y: auto; box-sizing: border-box;">
          ${options.map(opt => `
            <li class="custom-dropdown-item" data-value="${opt.value}" style="padding: 4px 10px; font-size: 11.5px; color: #1a1a1c; cursor: pointer; transition: all 0.2s ease; text-align: left; list-style: none; margin: 0; font-weight: 400;">${opt.textContent}</li>
          `).join('')}
        </ul>
      </div>
    `;

    nativeSelect.parentNode.insertBefore(container, nativeSelect.nextSibling);

    const toggleBtn = container.querySelector('.custom-dropdown-toggle');
    const menuList = container.querySelector('.custom-dropdown-menu');
    const selectedSpan = container.querySelector('.custom-dropdown-selected-text');
    const arrowSpan = container.querySelector('.custom-dropdown-arrow');

    if (!toggleBtn || !menuList || !selectedSpan || !arrowSpan) return;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      
      document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
        if (m !== menuList) {
          m.style.display = 'none';
          const otherArrow = m.previousElementSibling?.querySelector('.custom-dropdown-arrow');
          if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
        }
      });

      const isVisible = menuList.style.display === 'block';

      if (!isVisible) {
        // Auto-direction layout logic (open upwards if close to viewport bottom edge)
        const rect = toggleBtn.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 220; // Maximum allowed dropdown menu height (from CSS/inline style)
        if (spaceBelow < menuHeight) {
          menuList.style.top = 'auto';
          menuList.style.bottom = '100%';
          menuList.style.marginTop = '0px';
          menuList.style.marginBottom = '6px';
        } else {
          menuList.style.top = '100%';
          menuList.style.bottom = 'auto';
          menuList.style.marginTop = '6px';
          menuList.style.marginBottom = '0px';
        }
      }

      menuList.style.display = isVisible ? 'none' : 'block';
      arrowSpan.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    menuList.querySelectorAll('.custom-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = item.getAttribute('data-value');
        const text = item.textContent;

        selectedSpan.textContent = text;
        nativeSelect.value = val;
        nativeSelect.dispatchEvent(new Event('change'));

        menuList.style.display = 'none';
        arrowSpan.style.transform = 'rotate(0deg)';
      });
    });

    nativeSelect.addEventListener('change', () => {
      const activeOption = nativeSelect.options[nativeSelect.selectedIndex];
      if (activeOption) {
        selectedSpan.textContent = activeOption.textContent;
      }
    });
  }

  // Globally hide dropdown menus on body click
  document.addEventListener('click', () => {
    document.querySelectorAll('.custom-dropdown-menu').forEach(m => {
      m.style.display = 'none';
      const otherArrow = m.previousElementSibling?.querySelector('.custom-dropdown-arrow');
      if (otherArrow) otherArrow.style.transform = 'rotate(0deg)';
    });
  });

  function getCategoryDisplayName(cat) {
    if (!cat) return '';
    if (cat.toLowerCase() === 'all') return language.categoryAll;
    return cat;
  }

  function getOrCreatePopover() {
    if (quickNotePopover) return quickNotePopover;

    quickNoteBackdrop = document.createElement('div');
    quickNoteBackdrop.id = 'chatops-quick-note-backdrop';
    document.body.appendChild(quickNoteBackdrop);

    quickNotePopover = document.createElement('div');
    quickNotePopover.id = 'chatops-quick-note-popover';
    quickNotePopover.innerHTML = `
      <div class="sp-modal-header" style="border-top-left-radius: 11px; border-top-right-radius: 11px; border-bottom: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: space-between; width: 100%;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <h3 class="sp-modal-title cqn-title" style="margin: 0; font-size: 13px; font-weight: 700; text-transform: uppercase;">${language.modalAddTaskTitle.toUpperCase()}</h3>
        </div>
        <button id="cqn-close" class="sp-modal-close-btn" title="${language.cancel}">&times;</button>
      </div>
      
      <div class="sp-modal-body" style="padding: 14px 16px; box-sizing: border-box; background: #ffffff; border-bottom-left-radius: 11px; border-bottom-right-radius: 11px; overflow: visible !important;">
        <div class="cqn-title-row" style="margin-bottom: 8px; width: 100%;">
          <input type="text" id="cqn-note-title" placeholder="${language.titleOptional}" style="width: 50%; height: 28px; font-size: 12px; font-weight: 600; padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; outline: none; box-sizing: border-box; font-family: inherit;" autocomplete="off">
        </div>
        <div class="task-quick-input-row" style="margin-bottom: 12px; width: 100%; position: relative;">
          <textarea id="cqn-note-text" placeholder="${language.taskTextareaPlaceholder}" class="quick-note-textarea" style="width: 100%; min-height: 110px; resize: vertical; box-sizing: border-box; padding-right: 36px;"></textarea>
          <div id="cqn-preview-box" class="markdown-preview cqn-hidden" style="display: none; width: 100%; min-height: 110px; max-height: 250px; overflow-y: auto; padding: 8px 36px 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; box-sizing: border-box; font-family: inherit; font-size: 13.5px; line-height: 1.5; color: #1e293b; text-align: left; word-break: break-word;"></div>
          <button type="button" id="cqn-preview-btn" title="Xem trước tin nhắn" style="position: absolute; top: 8px; right: 8px; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 4px; color: #64748b; transition: all 0.15s ease; z-index: 10;" onmouseover="if(!this.classList.contains('active')){this.style.background='#e2e8f0'; this.style.color='#1e293b';}" onmouseout="if(!this.classList.contains('active')){this.style.background='transparent'; this.style.color='#64748b';}">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>

        <!-- Format toolbar: shown only in group_reminder mode -->
        <div id="cqn-format-toolbar" style="display:none; flex-direction:row; align-items:center; flex-wrap:wrap; margin-bottom:12px; padding:4px 6px; background:#f8fafc; border:1px solid #cbd5e1; border-top:none; border-bottom-left-radius:6px; border-bottom-right-radius:6px; width:100%; box-sizing:border-box; gap:2px; overflow:visible; margin-top: -12px;">
          <button type="button" class="cqn-fmt-btn" data-action="wrap" data-value="**" title="In đậm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
          </button>
          <button type="button" class="cqn-fmt-btn" data-action="wrap" data-value="*" title="In nghiêng">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
          </button>
          <span style="width:1px; height:16px; background:#cbd5e1; margin:0 4px; display:inline-block; vertical-align:middle;"></span>
          <button type="button" class="cqn-fmt-btn" data-action="link" title="Đường dẫn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <button type="button" class="cqn-fmt-btn" data-action="linePrefix" data-value="- " title="Danh sách">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          </button>
          <button type="button" class="cqn-fmt-btn" data-action="wrap" data-value="\`" title="Code block">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button type="button" class="cqn-fmt-btn" data-action="linePrefix" data-value="&gt; " title="Trích dẫn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </button>
          <span style="width:1px; height:16px; background:#cbd5e1; margin:0 4px; display:inline-block; vertical-align:middle;"></span>
          <div style="position:relative; overflow:visible; display:inline-flex;">
            <button type="button" class="cqn-fmt-btn" id="cqn-emoji-btn" title="Emoji">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <div id="cqn-emoji-picker" style="display:none; position:absolute; bottom:30px; left:0; background:#ffffff; border:1px solid #cbd5e1; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:8px; width:200px; grid-template-columns:repeat(6, 1fr); gap:6px; z-index:999999; box-sizing:border-box;"></div>
          </div>
        </div>

        <!-- Group Channel Info Box -->
        <div id="cqn-group-channel-info" style="display:none; margin-bottom:10px; padding:10px 12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; align-items:center; gap:8px; font-size:12px; color:#1e40af; width:100%; box-sizing:border-box;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
          <span class="cqn-channel-text" style="font-weight: 500;"></span>
        </div>
        <!-- @mention autocomplete dropdown (injected into body dynamically) -->

        <div id="cqn-note-section" style="margin-bottom: 12px; width: 100%; display: none; overflow: visible !important;">
          <div style="font-size:11px; font-weight:600; color:#64748b; text-transform:uppercase; margin-bottom:4px;">${language.categoryLabel}</div>
          <select id="cqn-category" class="custom-select" style="width:100%; height: 34px; font-size: 12.5px; border-radius: 6px; border:1px solid #cbd5e1; background:#fff; outline:none; cursor:pointer; box-sizing: border-box;">
            <option value="general">${language.categoryGeneral}</option>
            <option value="work">${language.categoryWork}</option>
            <option value="personal">${language.categoryPersonal}</option>
            <option value="ideas">${language.categoryIdeas}</option>
          </select>
        </div>

        <div id="cqn-task-section" style="margin-bottom: 12px; width: 100%; overflow: visible !important;">
          <div class="task-category-row" style="margin-bottom: 12px; display:flex; align-items:center; gap:8px; width:100%;">
            <span style="font-size:12.5px; color:#475569; font-weight:600; white-space:nowrap;">Category:</span>
            <select id="cqn-task-category" class="custom-select" style="width: 140px; height: 32px; font-size: 12.5px; border-radius: 6px; cursor: pointer; outline: none; box-sizing: border-box; padding: 2px 24px 2px 8px; margin: 0; line-height: 1;">
              <option value="normal" selected>${language.categoryNormal || 'Normal'}</option>
              <option value="checklist">${language.categoryChecklist || 'Checklist'}</option>
            </select>
          </div>
          <div class="task-reminder-wrapper" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; width:100%; box-sizing: border-box; overflow: visible !important;">
            <div class="task-reminder-row" id="cqnReminderRow"
               style="flex:1 1 220px; min-width:220px; background:#fff; padding:0 10px; border-radius:6px; border:1px solid #cbd5e1; cursor:pointer; display:flex; align-items:center; height:34px; box-sizing:border-box; transition: opacity 0.2s ease;">
              <label class="task-reminder-label" for="cqn-reminder-time"
                 style="margin-right:6px; cursor:pointer; display:inline-flex; align-items:center; white-space:nowrap; font-size:12.5px; line-height:1; height:100%; margin-bottom:0;">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"
                   style="margin-right:4px; opacity:0.7; flex-shrink:0; display:inline-block; vertical-align:middle; position:relative; top:-0.5px;">
                  <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
                </svg>
                ${language.taskReminderLabel}
              </label>
              <input type="text" id="cqn-reminder-time" class="quick-task-datetime" placeholder="${language.chooseDatePlaceholder}"
                 style="flex:1; cursor:pointer; background:transparent; border:none; outline:none; font-size:12.5px; width:100%; min-width:0; padding:0; margin:0; display:inline-flex; align-items:center; line-height:1; height:100%; box-shadow:none;">
            </div>

            <span id="cqnOrLabel" style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin: 0 4px; flex-shrink: 0; user-select: none; background: #f1f5f9; padding: 4px 6px; border-radius: 4px; border: 1px solid #e2e8f0; line-height: 1;">${language.orLabel}</span>

            <select id="cqnReminderSelect" class="custom-select"
               style="width: 115px; height: 34px; font-size: 12.5px; border-radius: 6px; cursor: pointer; outline: none; box-sizing: border-box; flex-shrink: 0; line-height: 1; padding: 0 24px 0 10px;">
              <option value="">${language.remindInPreset}</option>
              <option value="5">+5m</option>
              <option value="15">+15m</option>
              <option value="30">+30m</option>
              <option value="60">+1h</option>
              <option value="120">+2h</option>
              <option value="240">+4h</option>
              <option value="360">+6h</option>
              <option value="480">+8h</option>
            </select>
          </div>
          <div class="task-reminder-repeat-row" style="margin-top: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <input type="checkbox" id="cqnTaskRemindDaily" style="cursor: pointer; width: 14px; height: 14px; margin: 0;">
            <label for="cqnTaskRemindDaily" style="font-size: 12px; color: #475569; cursor: pointer; user-select: none; font-weight: 500; margin-bottom: 0">${language.taskRemindDailyLabel}</label>
          </div>
          <div class="input-helper" id="cqnSnoozeHintText" style="margin-top: 6px; margin-bottom: 12px;"></div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px; justify-content: flex-end; width: 100%; border-top: 1px solid #cbd5e1; padding-top: 12px; box-sizing: border-box;">
          <button type="button" id="cqn-cancel" class="chatops-btn chatops-btn-secondary" style="padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid #cbd5e1; background: transparent; height: 36px; color: #475569; display: inline-flex; align-items: center; justify-content: center; margin: 0; box-sizing: border-box;">${language.cancel}</button>
          <button type="button" id="cqn-save-note" class="chatops-btn chatops-btn-primary" style="padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; background: #1c58d9; color: #fff; border: none; height: 36px; min-width: 90px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(28, 88, 217, 0.2); margin: 0; box-sizing: border-box;">🎯 Add Task</button>
        </div>
      </div>
    `;
    quickNotePopover.style.setProperty('overflow', 'visible', 'important');
    document.body.appendChild(quickNotePopover);
    
    const closePopover = () => {
      quickNotePopover.classList.remove('visible');
      quickNoteBackdrop.classList.remove('visible');
    };

    document.getElementById('cqn-close').addEventListener('click', closePopover);
    document.getElementById('cqn-cancel').addEventListener('click', closePopover);
    quickNoteBackdrop.addEventListener('mousedown', closePopover);

    const timeInput = document.getElementById('cqn-reminder-time');
    const reminderRow = document.getElementById('cqnReminderRow');
    const cqnCategorySelect = document.getElementById('cqn-category');
    const cqnReminderSelect = document.getElementById('cqnReminderSelect');

    function syncReminderDimming() {
      const customSelect = cqnReminderSelect?.nextElementSibling;
      if (reminderRow) {
        reminderRow.style.opacity = '1';
      }
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        customSelect.style.opacity = '1';
      }
    }

    function clearCqnReminderErrorHighlight() {
      if (reminderRow) {
        reminderRow.style.removeProperty('border-color');
        reminderRow.style.removeProperty('box-shadow');
      }
      const customSelect = cqnReminderSelect?.nextElementSibling;
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        const toggleBtn = customSelect.querySelector('.custom-dropdown-toggle');
        if (toggleBtn) {
          toggleBtn.style.removeProperty('border-color');
          toggleBtn.style.removeProperty('box-shadow');
        }
      }
      if (cqnReminderSelect) {
        cqnReminderSelect.style.removeProperty('border-color');
        cqnReminderSelect.style.removeProperty('box-shadow');
      }
    }

    let fpCqn = null;
    function initCqnFlatpickr(noCalendarMode = false) {
      if (fpCqn) {
        try {
          fpCqn.destroy();
        } catch (e) {}
      }
      if (!timeInput) return;
      fpCqn = initCommonFlatpickr(timeInput, {
        noCalendar: noCalendarMode,
        enableTime: true,
        dateFormat: noCalendarMode ? "H:i" : "Y-m-d H:i",
        appendTo: reminderRow,
        minDate: "today",
        onChange: function(selectedDates) {
          if (selectedDates.length > 0) {
            clearCqnReminderErrorHighlight();
            if (cqnReminderSelect) {
              cqnReminderSelect.value = '';
              const customSelect = cqnReminderSelect.nextElementSibling;
              if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
                const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
                if (selectedText) selectedText.textContent = language.remindInPreset;
              }
            }
          }
          syncReminderDimming();
        },
        onOpen: function(selectedDates, dateStr, instance) {
          if (instance && instance.calendarContainer) {
            instance.calendarContainer.classList.add('cqn-centered-calendar');
          }
          if (cqnReminderSelect) {
            cqnReminderSelect.value = '';
            const customSelect = cqnReminderSelect.nextElementSibling;
            if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
              const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
              if (selectedText) selectedText.textContent = language.remindInPreset;
            }
          }
          syncReminderDimming();
        }
      });
      timeInput._flatpickr = fpCqn;
      timeInput._initCqnFlatpickr = initCqnFlatpickr;
    }

    function toggleCqnPresetReminderVisibility(isDaily) {
      const orLabel = document.getElementById('cqnOrLabel');
      const customSelect = cqnReminderSelect?.nextElementSibling;
      const isGroupReminder = quickNotePopover?.dataset?.mode === 'group_reminder';

      if (isDaily || isGroupReminder) {
        if (orLabel) orLabel.style.display = 'none';
        if (cqnReminderSelect) cqnReminderSelect.style.display = 'none';
        if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
          customSelect.style.display = 'none';
        }
        if (cqnReminderSelect) {
          cqnReminderSelect.value = '';
          if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
            const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
            if (selectedText) selectedText.textContent = language.remindInPreset;
          }
        }
      } else {
        if (orLabel) orLabel.style.display = 'inline-flex';
        if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
          customSelect.style.display = 'block';
          if (cqnReminderSelect) cqnReminderSelect.style.display = 'none';
        } else {
          if (cqnReminderSelect) cqnReminderSelect.style.display = 'block';
        }
      }
    }


    const repeatDailyCheckbox = document.getElementById('cqnTaskRemindDaily');
    if (repeatDailyCheckbox && timeInput) {
      repeatDailyCheckbox.addEventListener('change', () => {
        const isChecked = repeatDailyCheckbox.checked;
        const currentVal = timeInput.value;
        
        initCqnFlatpickr(isChecked);
        toggleCqnPresetReminderVisibility(isChecked);
        
        if (currentVal) {
          if (isChecked) {
            const match = currentVal.match(/\d{2}:\d{2}/);
            if (fpCqn) {
              if (match) {
                fpCqn.setDate(match[0], false);
              } else {
                fpCqn.clear();
              }
            }
          } else {
            const match = currentVal.match(/^(\d{2}):(\d{2})$/);
            if (fpCqn) {
              if (match) {
                const today = new Date();
                today.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
                fpCqn.setDate(today, false);
              } else {
                fpCqn.clear();
              }
            }
          }
        }
        syncReminderDimming();
      });
    }

    initCqnFlatpickr(repeatDailyCheckbox ? repeatDailyCheckbox.checked : false);

    if (reminderRow) {
      reminderRow.addEventListener('click', (e) => {
        e.stopPropagation();
        clearCqnReminderErrorHighlight();
        if (cqnReminderSelect) {
          cqnReminderSelect.value = '';
          const customSelect = cqnReminderSelect.nextElementSibling;
          if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
            const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
            if (selectedText) selectedText.textContent = language.remindInPreset;
          }
        }
        syncReminderDimming();
        if (e.target !== timeInput && fpCqn) {
          const calendarContainer = fpCqn.calendarContainer;
          if (calendarContainer && calendarContainer.contains(e.target)) {
            return;
          }
          fpCqn.open();
        }
      });
    }

    // Convert selects to premium custom dropdowns
    convertToCustomDropdown(cqnCategorySelect);
    convertToCustomDropdown(cqnReminderSelect, '115px');
    const cqnTaskCategorySelect = document.getElementById('cqn-task-category');
    if (cqnTaskCategorySelect) {
      convertToCustomDropdown(cqnTaskCategorySelect, '140px');
    }

    // Initialize toggle state after custom dropdown is built
    toggleCqnPresetReminderVisibility(repeatDailyCheckbox ? repeatDailyCheckbox.checked : false);

    const customSelect = cqnReminderSelect?.nextElementSibling;
    if (customSelect) {
      customSelect.addEventListener('click', () => {
        clearCqnReminderErrorHighlight();
        if (fpCqn) fpCqn.clear();
        syncReminderDimming();
      });
    }

    if (cqnReminderSelect && timeInput) {
      cqnReminderSelect.addEventListener('change', () => {
        clearCqnReminderErrorHighlight();
        const val = cqnReminderSelect.value;
        if (!val) {
          syncReminderDimming();
          return;
        }
        if (fpCqn) fpCqn.clear();
        syncReminderDimming();
      });
    }


    // Aa formatting toolbar toggle logic has been removed as it is now integrated into a single toolbar.

    const emojiBtn = document.getElementById('cqn-emoji-btn');
    const emojiPicker = document.getElementById('cqn-emoji-picker');
    const emojis = ['😀', '😂', '🥰', '👍', '🎉', '🔥', '👏', '🚀', '👀', '💯', '❤️', '✔️'];
    if (emojiPicker) {
      emojiPicker.innerHTML = emojis.map(em => `
        <button type="button" class="cqn-emoji-item" style="border:none; background:transparent; font-size:18px; cursor:pointer; padding:4px; display:inline-flex; align-items:center; justify-content:center; border-radius:4px; transition: background 0.1s; outline:none; width:26px; height:26px;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">${em}</button>
      `).join('');
      
      emojiPicker.addEventListener('click', (e) => {
        const item = e.target.closest('.cqn-emoji-item');
        if (!item) return;
        const em = item.textContent.trim();
        const ta = document.getElementById('cqn-note-text');
        if (ta && ta.style.display !== 'none') {
          const ss = ta.selectionStart, se = ta.selectionEnd, tv = ta.value;
          ta.value = tv.substring(0, ss) + em + tv.substring(se);
          const np = ss + em.length;
          ta.setSelectionRange(np, np);
          ta.focus();
        }
        emojiPicker.style.display = 'none';
        emojiBtn?.classList.remove('active');
      });
    }

    if (emojiBtn && emojiPicker) {
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (emojiBtn.classList.contains('disabled')) return;
        const isHidden = emojiPicker.style.display === 'none';
        emojiPicker.style.display = isHidden ? 'grid' : 'none';
        if (isHidden) {
          emojiBtn.classList.add('active');
        } else {
          emojiBtn.classList.remove('active');
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (emojiPicker && emojiPicker.style.display !== 'none') {
        if (!emojiPicker.contains(e.target) && e.target !== emojiBtn && !emojiBtn?.contains(e.target)) {
          emojiPicker.style.display = 'none';
          emojiBtn?.classList.remove('active');
        }
      }
    });

    const previewBtn = document.getElementById('cqn-preview-btn');
    const previewBox = document.getElementById('cqn-preview-box');
    const taText = document.getElementById('cqn-note-text');
    if (previewBtn && previewBox && taText) {
      previewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isPreviewing = !previewBox.classList.contains('cqn-hidden');
        if (isPreviewing) {
          previewBox.classList.add('cqn-hidden');
          taText.classList.remove('cqn-hidden');
          previewBox.style.display = 'none';
          taText.style.display = 'block';
          previewBtn.classList.remove('active');
          document.querySelectorAll('#cqn-format-toolbar .cqn-fmt-btn:not(#cqn-preview-btn)').forEach(btn => {
            btn.classList.remove('disabled');
            btn.removeAttribute('disabled');
          });
          taText.focus();
        } else {
          // Sync height to prevent layout shifting
          const height = taText.offsetHeight;
          previewBox.style.height = height + 'px';
          const html = formatRichText(taText.value || `*${language.msgPreviewNoText || 'Không có nội dung'}*`);
          previewBox.innerHTML = html;
          previewBox.classList.remove('cqn-hidden');
          taText.classList.add('cqn-hidden');
          previewBox.style.display = 'block';
          taText.style.display = 'none';
          previewBtn.classList.add('active');
          if (emojiPicker) {
            emojiPicker.style.display = 'none';
            emojiBtn?.classList.remove('active');
          }
          document.querySelectorAll('#cqn-format-toolbar .cqn-fmt-btn:not(#cqn-preview-btn)').forEach(btn => {
            btn.classList.add('disabled');
            btn.setAttribute('disabled', 'true');
          });
        }
      });
    }

    const fmtToolbar = document.getElementById('cqn-format-toolbar');
    if (fmtToolbar) {
      fmtToolbar.addEventListener('click', (e) => {
        const btn = e.target.closest('.cqn-fmt-btn');
        if (!btn) return;
        if (btn.classList.contains('disabled') || btn.id === 'cqn-preview-btn' || btn.id === 'cqn-fmt-toggle' || btn.id === 'cqn-emoji-btn') {
          return;
        }
        const ta = document.getElementById('cqn-note-text');
        if (!ta || ta.style.display === 'none') return;

        const action = btn.dataset.action;
        const rawVal = btn.dataset.value;
        const val = rawVal === '`' ? '`' : rawVal;
        const ss = ta.selectionStart, se = ta.selectionEnd, tv = ta.value;

        if (action === 'wrap') {
          const sel = tv.substring(ss, se);
          ta.value = tv.substring(0, ss) + val + sel + val + tv.substring(se);
          ta.setSelectionRange(ss + val.length, ss + val.length + sel.length);
        } else if (action === 'linePrefix') {
          const lineStart = tv.lastIndexOf('\n', ss - 1) + 1;
          ta.value = tv.substring(0, lineStart) + val + tv.substring(lineStart);
          ta.setSelectionRange(ss + val.length, se + val.length);
        } else if (action === 'link') {
          const url = prompt('Nhập địa chỉ liên kết (URL):', 'https://');
          if (url !== null) {
            const sel = tv.substring(ss, se);
            const linkText = `[${sel}](${url})`;
            ta.value = tv.substring(0, ss) + linkText + tv.substring(se);
            ta.setSelectionRange(ss, ss + linkText.length);
          }
        } else if (action === 'priority') {
          const pfx = '**[QUAN TRỌNG]** ';
          const sel = tv.substring(ss, se);
          if (sel) {
            ta.value = tv.substring(0, ss) + pfx + sel + tv.substring(se);
            ta.setSelectionRange(ss + pfx.length, ss + pfx.length + sel.length);
          } else {
            ta.value = tv.substring(0, ss) + pfx + tv.substring(ss);
            ta.setSelectionRange(ss + pfx.length, ss + pfx.length);
          }
        } else if (action === 'attachment') {
          const url = prompt('Nhập đường dẫn tệp tin hoặc hình ảnh (URL):', 'https://');
          if (url !== null) {
            const isImage = confirm('Đây có phải là hình ảnh không?');
            const desc = prompt('Nhập mô tả cho tệp đính kèm:', 'tệp đính kèm');
            if (desc !== null) {
              const prefix = isImage ? '!' : '';
              const linkText = `${prefix}[${desc}](${url})`;
              ta.value = tv.substring(0, ss) + linkText + tv.substring(se);
              ta.setSelectionRange(ss, ss + linkText.length);
            }
          }
        }
        ta.focus();
      });
    }

    return quickNotePopover;
  }

  // Resolve current channel info from URL + API (used for group_reminder)
  async function getCurrentChannelInfo() {
    try {
      // Step 1: Get channelId from Redux via inject bridge (most reliable, works for DMs too)
      let channelId = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve(null), 1500);
        const handler = (e) => {
          clearTimeout(timeout);
          window.removeEventListener('chatops-current-channel-response', handler);
          resolve(e.detail?.channelId || null);
        };
        window.addEventListener('chatops-current-channel-response', handler);
        window.dispatchEvent(new CustomEvent('chatops-current-channel-request'));
      });

      // Step 2: Fallback – parse from URL if bridge didn't respond
      if (!channelId) {
        const pathParts = window.location.pathname.split('/');
        const teamName = pathParts[1] || '';
        const slug = pathParts[2] === 'channels' ? (pathParts[3] || '') : (pathParts[2] || '');
        if (slug && slug !== 'messages') {
          // Try to find channel by name in the channels list
          const teamsResponse = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_MY_TEAMS }, resolve);
          });
          if (teamsResponse?.ok && teamsResponse.teams?.length) {
            const team = teamsResponse.teams.find(t => t.name === teamName) || teamsResponse.teams[0];
            if (team) {
              const channelsResponse = await new Promise(resolve => {
                chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_MY_CHANNELS, teamId: team.id }, resolve);
              });
              if (channelsResponse?.ok && channelsResponse.channels) {
                const ch = channelsResponse.channels.find(c => c.name === slug);
                if (ch) channelId = ch.id;
              }
            }
          }
        }
      }

      if (!channelId) return null;

      // Step 3: Fetch full channel details by ID
      const channelRes = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_CHANNEL_BY_ID, channelId }, resolve);
      });
      if (!channelRes?.ok || !channelRes.channel) return null;

      const channel = channelRes.channel;

      // Step 4: For DM channels, resolve the other user's display name
      const isDMChannel = channel.type === 'D' || (channel.name && channel.name.includes('__'));
      if (isDMChannel && (!channel.display_name || channel.display_name === 'Direct Message' || channel.display_name === channel.name)) {
        const parts = channel.name.split('__');
        const currentUserId = myUserId || '';
        // If myUserId not loaded yet, try to get it first
        let resolvedCurrentId = currentUserId;
        if (!resolvedCurrentId) {
          const profileRes = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_MY_PROFILE }, resolve);
          });
          if (profileRes?.ok && profileRes.profile?.id) {
            resolvedCurrentId = profileRes.profile.id;
          }
        }
        const otherUserId = parts.find(id => id && id !== resolvedCurrentId) || parts.find(id => !!id) || '';
        if (otherUserId) {
          try {
            const userRes = await new Promise(resolve => {
              chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESOLVE_USER_ID, userId: otherUserId }, resolve);
            });
            if (userRes?.ok && userRes.username) {
              const fullName = [userRes.first_name, userRes.last_name].filter(Boolean).join(' ').trim();
              channel.display_name = fullName || userRes.username;
            }
          } catch (dmErr) {
            console.warn('[ChatOps Ext] Could not resolve DM username:', dmErr);
          }
        }
      }

      // Get teamId from URL
      const pathParts2 = window.location.pathname.split('/');
      const teamName2 = pathParts2[1] || '';
      let teamId = null;
      try {
        const teamsRes2 = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_MY_TEAMS }, resolve);
        });
        if (teamsRes2?.ok && teamsRes2.teams?.length) {
          const t = teamsRes2.teams.find(t => t.name === teamName2) || teamsRes2.teams[0];
          teamId = t?.id || null;
        }
      } catch (_) {}

      return { channel, teamId };
    } catch (e) {
      console.error('[ChatOps Ext] Failed to resolve current channel:', e);
      return null;
    }
  }

  // @mention autocomplete for group reminder textarea
  function setupMentionAutocomplete(textarea, getTeamId) {
    let dropdown = null;
    let atStart = -1;
    let debounce = null;
    let activeIndex = 0;
    
    // Pagination & Loading state
    let currentPage = 0;
    let isQuerying = false;
    let hasMore = true;
    let currentQuery = '';
    let allItems = []; // Contains all list items (special + users)
    const perPage = 30;

    function destroyDropdown() {
      if (dropdown) { dropdown.remove(); dropdown = null; }
    }

    function insertUser(username) {
      const val = textarea.value;
      const cursor = textarea.selectionStart;
      const newVal = val.substring(0, atStart) + '@' + username + ' ' + val.substring(cursor);
      textarea.value = newVal;
      const np = atStart + username.length + 2;
      textarea.setSelectionRange(np, np);
      destroyDropdown();
      textarea.focus();
    }

    function showSpinner() {
      if (!dropdown) return;
      let spinnerBox = dropdown.querySelector('.cqn-spinner-container');
      if (!spinnerBox) {
        spinnerBox = document.createElement('div');
        spinnerBox.className = 'cqn-spinner-container';
        spinnerBox.style.cssText = 'display:flex;align-items:center;justify-content:center;padding:8px;gap:8px;color:#64748b;font-size:12px;';
        spinnerBox.innerHTML = `<span class="cqn-spinner"></span><span>${language.loading || 'Đang tải...'}</span>`;
        dropdown.appendChild(spinnerBox);
      }
    }
    
    function hideSpinner() {
      if (!dropdown) return;
      const spinnerBox = dropdown.querySelector('.cqn-spinner-container');
      if (spinnerBox) {
        spinnerBox.remove();
      }
    }

    async function loadNextPage() {
      if (isQuerying || !hasMore || currentQuery) return;
      isQuerying = true;
      showSpinner();
      
      const teamId = getTeamId();
      const nextPage = currentPage + 1;
      
      try {
        const resp = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SEARCH_USERS_AUTOCOMPLETE,
            query: '',
            teamId: teamId || '',
            page: nextPage,
            perPage: perPage
          }, resolve);
        });
        
        if (resp?.ok && Array.isArray(resp.users)) {
          const newUsers = resp.users;
          if (newUsers.length < perPage) {
            hasMore = false;
          }
          currentPage = nextPage;
          
          const startIdx = allItems.length;
          let addedCount = 0;
          newUsers.forEach(u => {
            if (!allItems.some(item => item.username === u.username)) {
              allItems.push(u);
              appendRow(u, startIdx + addedCount);
              addedCount++;
            }
          });
          
          if (!hasMore) {
            hideSpinner();
          }
        } else {
          hasMore = false;
          hideSpinner();
        }
      } catch (err) {
        console.error('[ChatOps Ext] Failed to load more users:', err);
        hasMore = false;
        hideSpinner();
      } finally {
        isQuerying = false;
      }
    }

    function handleScroll() {
      if (!dropdown || isQuerying || !hasMore || currentQuery) return;
      const threshold = 20;
      if (dropdown.scrollTop + dropdown.clientHeight >= dropdown.scrollHeight - threshold) {
        loadNextPage();
      }
    }

    function appendRow(u, idx) {
      if (!dropdown) return;
      
      const initials = u.initials || ((u.first_name?.[0] || '') + (u.last_name?.[0] || '') || u.username?.[0] || '?').toUpperCase();
      const displayName = u.isSpecial ? u.displayName : ([u.first_name, u.last_name].filter(Boolean).join(' ') || u.username);
      const desc = u.isSpecial ? u.email : `@${u.username}`;
      
      const row = document.createElement('div');
      row.className = 'mention-item-row';
      row.dataset.index = idx;
      row.dataset.username = u.username;
      row.style.cssText = 'padding:8px 12px;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.1s;';
      
      let avatarHtml = '';
      if (u.isSpecial) {
        avatarHtml = `<div style="width:32px;height:32px;border-radius:50%;background:#e2e8f0;color:#1e293b;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0;">${initials}</div>`;
      } else {
        avatarHtml = `<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#5865f2,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">${escapeHtml(initials)}</div>`;
      }
      
      row.innerHTML = `${avatarHtml}<div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:13px;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(displayName)}</div><div style="font-size:11px;color:#64748b;">${escapeHtml(desc)}</div></div>`;
      
      row.addEventListener('mouseenter', () => updateActiveIndex(idx));
      row.addEventListener('mousedown', e => { e.preventDefault(); insertUser(u.username); });
      
      const spinnerBox = dropdown.querySelector('.cqn-spinner-container');
      if (spinnerBox) {
        dropdown.insertBefore(row, spinnerBox);
      } else {
        dropdown.appendChild(row);
      }
    }

    function showDropdown(users, query) {
      destroyDropdown();
      
      currentQuery = query;
      allItems = [];
      const qLower = (query || '').toLowerCase();
      if ('all'.startsWith(qLower)) {
        allItems.push({
          username: 'all',
          isSpecial: true,
          displayName: 'all',
          email: language.mentionAllDesc || 'Nhắc toàn bộ kênh (@all)',
          initials: '📢'
        });
      }
      if ('here'.startsWith(qLower)) {
        allItems.push({
          username: 'here',
          isSpecial: true,
          displayName: 'here',
          email: language.mentionHereDesc || 'Nhắc người trực tuyến (@here)',
          initials: '🔔'
        });
      }
      
      if (users) {
        users.forEach(u => {
          if (!allItems.some(item => item.username === u.username)) {
            allItems.push(u);
          }
        });
      }
      
      if (!allItems.length) return;
      
      activeIndex = 0;
      dropdown = document.createElement('div');
      dropdown.id = 'chatops-mention-dropdown';
      dropdown.style.cssText = 'position:fixed;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:2147483647;min-width:220px;max-width:300px;max-height:200px;overflow-y:auto;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
      
      const rect = textarea.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 200 && rect.top > 200) {
        dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
      } else {
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.left = rect.left + 'px';
      }
      
      allItems.forEach((u, idx) => {
        appendRow(u, idx);
      });
      
      dropdown.addEventListener('scroll', handleScroll);
      
      if (hasMore && !query) {
        showSpinner();
      }
      
      document.body.appendChild(dropdown);
      renderActiveItem();
    }
    
    function updateActiveIndex(idx) {
      activeIndex = idx;
      renderActiveItem();
    }
    
    function renderActiveItem() {
      if (!dropdown) return;
      const rows = dropdown.querySelectorAll('.mention-item-row');
      rows.forEach((row, idx) => {
        if (idx === activeIndex) {
          row.style.background = '#f1f5f9';
          row.scrollIntoView({ block: 'nearest' });
        } else {
          row.style.background = '';
        }
      });
    }

    textarea.addEventListener('keyup', async e => {
      if (e.key === 'Escape' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
        return;
      }
      const val = textarea.value;
      const cursor = textarea.selectionStart;
      const match = val.substring(0, cursor).match(/(?:^|\s)@(\w*)$/);
      if (!match) { destroyDropdown(); return; }
      const atIndex = match[0].indexOf('@');
      atStart = cursor - match[0].length + atIndex;
      const query = match[1];
      
      clearTimeout(debounce);
      debounce = setTimeout(async () => {
        const teamId = getTeamId();
        
        currentPage = 0;
        hasMore = true;
        isQuerying = false;

        const resp = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.SEARCH_USERS_AUTOCOMPLETE,
            query,
            teamId: teamId || '',
            page: 0,
            perPage: query ? 100 : perPage
          }, resolve);
        });
        const users = resp?.ok && Array.isArray(resp.users) ? resp.users : [];
        
        if (!query && users.length < perPage) {
          hasMore = false;
        }

        showDropdown(users, query);
      }, 150);
    });

    textarea.addEventListener('keydown', e => {
      if (dropdown) {
        const rows = dropdown.querySelectorAll('.mention-item-row');
        if (!rows.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % rows.length;
          renderActiveItem();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + rows.length) % rows.length;
          renderActiveItem();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const activeRow = rows[activeIndex];
          if (activeRow) {
            insertUser(activeRow.dataset.username);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          destroyDropdown();
        }
      }
    });
    textarea.addEventListener('blur', () => setTimeout(destroyDropdown, 200));
    return destroyDropdown;
  }

  async function openQuickNote(postEl, anchorBtn, mode = 'task', overrideText = null) {
    const popover = getOrCreatePopover();
    popover.dataset.mode = mode;

    // Reset preview state to edit mode
    const previewBox = document.getElementById('cqn-preview-box');
    const taText = document.getElementById('cqn-note-text');
    const previewBtn = document.getElementById('cqn-preview-btn');
    if (previewBox && taText && previewBtn) {
      previewBox.classList.add('cqn-hidden');
      taText.classList.remove('cqn-hidden');
      previewBox.style.display = 'none';
      taText.style.display = 'block';
      previewBtn.classList.remove('active');
      document.querySelectorAll('#cqn-format-toolbar .cqn-fmt-btn:not(#cqn-preview-btn)').forEach(btn => {
        btn.classList.remove('disabled');
        btn.removeAttribute('disabled');
      });
    }
    const emojiPicker = document.getElementById('cqn-emoji-picker');
    const emojiBtn = document.getElementById('cqn-emoji-btn');
    if (emojiPicker) {
      emojiPicker.style.display = 'none';
      emojiBtn?.classList.remove('active');
    }
    const fmtAdvanced = document.getElementById('cqn-fmt-advanced');
    const fmtToggleBtn = document.getElementById('cqn-fmt-toggle');
    if (fmtAdvanced) {
      fmtAdvanced.style.display = 'none';
      fmtToggleBtn?.classList.remove('active');
    }

    try {
      const resSettings = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS, 'activeMemoCategory']);
      const categories = resSettings[STORAGE_KEYS.SETTINGS]?.memoCategories || ['General', 'Work'];
      const activeFilter = resSettings['activeMemoCategory'] || 'all';
      const cqnCategorySelect = document.getElementById('cqn-category');
      if (cqnCategorySelect) {
        cqnCategorySelect.innerHTML = categories.map(c => `
          <option value="${c}">${getCategoryDisplayName(c)}</option>
        `).join('');
        
        if (activeFilter !== 'all' && categories.includes(activeFilter)) {
          cqnCategorySelect.value = activeFilter;
        } else if (categories.length > 0) {
          cqnCategorySelect.value = categories[0];
        }
        
        convertToCustomDropdown(cqnCategorySelect);
      }
    } catch (err) {
      console.warn('[ChatOps Ext] Failed to load dynamic categories:', err);
    }

    let msgTextFull = '';

    if (overrideText !== null && overrideText !== undefined) {
      msgTextFull = overrideText.trim();
    } else {
      // Highlighted text detection logic
      const selection = window.getSelection();
      let hasSelection = false;
      if (selection && selection.rangeCount > 0) {
        const selectedStr = selection.toString().trim();
        if (selectedStr && postEl) {
          // Ensure the selection is inside the post container
          const range = selection.getRangeAt(0);
          if (postEl.contains(range.commonAncestorContainer)) {
            msgTextFull = selectedStr;
            hasSelection = true;
          }
        }
      }

      if (!hasSelection) {
        const postId = cleanPostId(postEl);
        if (postId) {
          msgTextFull = await getPostRawMessage(postId);
        }
        if (!msgTextFull) {
          const msgBodyEl = postEl ? postEl.querySelector('.post-message__text, .post__body p, [class*="post-message"]') : null;
          msgTextFull = msgBodyEl ? msgBodyEl.innerText.trim() : '';
        }
        
        if (postEl) {
          // Find all images in the post — use broad selector, then filter out avatars and custom emojis
          const imgEls = Array.from(postEl.querySelectorAll('img'))
            .filter(img => {
              // Skip avatars (have .Avatar class or are inside .status-wrapper)
              if (img.classList.contains('Avatar') || img.closest('.status-wrapper, .post__img')) return false;
              // Skip custom emoji spans and reaction elements
              if (img.closest('.emoticon, .emoji-picker, .emoji, .Reaction, .post-reaction, .post-reactions')) return false;
              // Skip standard emojis by URL pattern
              if (img.src && (img.src.includes('/static/emoji') || img.src.includes('emoji'))) return false;
              // Skip small images that are likely icons/emojis (under 20x20)
              if (img.naturalWidth && img.naturalWidth < 20 && img.naturalHeight && img.naturalHeight < 20) return false;
              // Ensure the image belongs directly to this post, not a nested reply post
              const closestPost = img.closest('.post, [id^="post_"], [id^="rhsPost_"]');
              return closestPost === postEl;
            });
          if (imgEls.length > 0) {
            const imgUrls = imgEls.map(img => img.src).filter(Boolean);
            if (imgUrls.length > 0) {
              const missingImageMarkdown = imgUrls
                .filter(url => !msgTextFull.includes(url))
                .map(url => `![Image](${url})`)
                .join('\n');
              if (missingImageMarkdown) {
                if (msgTextFull) {
                  msgTextFull += '\n\n' + missingImageMarkdown;
                } else {
                  msgTextFull = missingImageMarkdown;
                }
              }
            }
          }
        }
      }
    }

    if (!msgTextFull && postEl) {
      msgTextFull = language.msgPreviewNoText;
    }
    const postId = cleanPostId(postEl);
    
    // Pre-fill the textarea directly
    const titleInput = document.getElementById('cqn-note-title');
    if (titleInput) titleInput.value = '';
    document.getElementById('cqn-note-text').value = msgTextFull;
    const reminderInput = document.getElementById('cqn-reminder-time');
    const repeatDailyCheckbox = document.getElementById('cqnTaskRemindDaily');
    if (repeatDailyCheckbox) {
      repeatDailyCheckbox.checked = false;
    }
    const taskCatSelect = document.getElementById('cqn-task-category');
    if (taskCatSelect) {
      taskCatSelect.value = 'normal';
      const customSelect = taskCatSelect.nextElementSibling;
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        const toggleBtnText = customSelect.querySelector('.custom-dropdown-selected-text');
        if (toggleBtnText) {
          toggleBtnText.textContent = language.categoryNormal || 'Normal';
        }
      }
    }
    if (reminderInput?._flatpickr) {
      if (typeof reminderInput._initCqnFlatpickr === 'function') {
        reminderInput._initCqnFlatpickr(false);
      }
      reminderInput._flatpickr.clear();
    } else if (reminderInput) {
      reminderInput.value = '';
    }
    
    const presetSelect = document.getElementById('cqnReminderSelect');
    if (presetSelect) {
      presetSelect.value = '';
      presetSelect.dispatchEvent(new Event('change'));
    }

    popover.dataset.postId = postId;
    popover.dataset.postText = msgTextFull;
    
    quickNoteBackdrop.classList.add('visible');
    popover.classList.add('visible');

    const taskSection = popover.querySelector('#cqn-task-section');
    const noteSection = popover.querySelector('#cqn-note-section');
    const groupReminderSection = popover.querySelector('#cqn-group-reminder-section');
    const taskCatRow = popover.querySelector('.task-category-row');
    const hintEl = popover.querySelector('#cqnSnoozeHintText');
    const saveBtn = document.getElementById('cqn-save-note');
    
    if (saveBtn) {
      if (popover.dataset.mode === 'note') {
        if (taskSection) taskSection.style.display = 'none';
        if (noteSection) noteSection.style.display = 'block';
        if (groupReminderSection) groupReminderSection.style.display = 'none';
        if (taskCatRow) taskCatRow.style.display = 'none';
        const channelInfoBox = document.getElementById('cqn-group-channel-info');
        if (channelInfoBox) channelInfoBox.style.display = 'none';
        popover.querySelector('.cqn-title').textContent = language.quickNoteTitle;
        saveBtn.innerHTML = language.memoAddBtn;
      } else if (popover.dataset.mode === 'group_reminder') {
        if (taskSection) taskSection.style.display = 'block';
        if (noteSection) noteSection.style.display = 'none';
        if (taskCatRow) taskCatRow.style.display = 'none';
        if (hintEl) hintEl.innerHTML = '';
        
        // Update label to "Gửi lúc:" for group_reminder
        const labelTextEl = popover.querySelector('.cqn-reminder-label-text');
        if (labelTextEl) labelTextEl.textContent = language.scheduleSendLabel || 'Gửi lúc:';

        // Hide OR label and preset select dropdown for group_reminder
        const cqnOrLabel = popover.querySelector('#cqnOrLabel');
        if (cqnOrLabel) cqnOrLabel.style.display = 'none';
        const cqnReminderSelect = popover.querySelector('#cqnReminderSelect');
        if (cqnReminderSelect) {
          cqnReminderSelect.style.display = 'none';
          const customDropdown = cqnReminderSelect.nextElementSibling;
          if (customDropdown && customDropdown.classList.contains('custom-dropdown-container')) {
            customDropdown.style.display = 'none';
          }
        }

        // Show title row — optional for group reminder
        const titleRow = popover.querySelector('.cqn-title-row');
        if (titleRow) titleRow.style.display = 'block';
        // Show format toolbar
        const fmtBar = document.getElementById('cqn-format-toolbar');
        if (fmtBar) fmtBar.style.display = 'flex';
        
        // Show channel info box and set default text
        const channelInfoBox = document.getElementById('cqn-group-channel-info');
        if (channelInfoBox) {
          channelInfoBox.style.display = 'flex';
          const txtSpan = channelInfoBox.querySelector('.cqn-channel-text');
          if (txtSpan) {
            txtSpan.textContent = language.targetChannelInfo.replace('{channel}', '...');
          }
        }

        // Update textarea placeholder
        const grTextarea = document.getElementById('cqn-note-text');
        if (grTextarea) grTextarea.placeholder = language.groupReminderTextareaPlaceholder || 'Nhập nội dung... (gõ @ để tag người)';
        // Prepend automatic message prefix if not already present
        if (grTextarea) {
          const autoPrefix = language.autoMessagePrefix || '##### --- Đây là tin nhắn tự động --- #####';
          if (!grTextarea.value.startsWith(autoPrefix)) {
            const existingContent = grTextarea.value.trim();
            grTextarea.value = autoPrefix + '\n' + (existingContent ? existingContent : '');
          }
        }
        popover.querySelector('.cqn-title').textContent = language.modalAddGroupReminderTitle || 'Lên lịch gửi tin vào kênh';
        saveBtn.innerHTML = '📢 ' + (language.save || 'Lưu');
        // Setup @mention autocomplete
        if (grTextarea) {
          if (popover._mentionCleanup) popover._mentionCleanup();
          popover._mentionCleanup = setupMentionAutocomplete(grTextarea, () => popover.dataset.teamId || '');
        }

        // Resolve current channel info + teamId asynchronously
        popover.dataset.targetChannelId = '';
        popover.dataset.targetChannelName = '';
        popover.dataset.teamId = '';
        getCurrentChannelInfo().then(result => {
          if (result?.channel) {
            popover.dataset.targetChannelId = result.channel.id;
            const channelName = result.channel.display_name || result.channel.name;
            popover.dataset.targetChannelName = channelName;
            if (channelInfoBox) {
              const txtSpan = channelInfoBox.querySelector('.cqn-channel-text');
              if (txtSpan) {
                txtSpan.textContent = language.targetChannelInfo.replace('{channel}', '#' + channelName);
              }
            }
          }
          if (result?.teamId) popover.dataset.teamId = result.teamId;
        });
      } else {
        if (taskSection) taskSection.style.display = 'block';
        if (noteSection) noteSection.style.display = 'none';
        if (taskCatRow) taskCatRow.style.display = 'flex';

        // Restore label to "Nhắc:" for task mode
        const labelTextEl = popover.querySelector('.cqn-reminder-label-text');
        if (labelTextEl) labelTextEl.textContent = language.taskReminderLabel || 'Nhắc:';

        // Show OR label and preset select dropdown for task mode
        const cqnOrLabel = popover.querySelector('#cqnOrLabel');
        if (cqnOrLabel) cqnOrLabel.style.display = 'inline-block';
        const cqnReminderSelect = popover.querySelector('#cqnReminderSelect');
        if (cqnReminderSelect) {
          cqnReminderSelect.style.display = 'inline-block';
          const customDropdown = cqnReminderSelect.nextElementSibling;
          if (customDropdown && customDropdown.classList.contains('custom-dropdown-container')) {
            customDropdown.style.display = 'inline-block';
          }
        }

        // Restore title row and placeholder for task mode
        const titleRow = popover.querySelector('.cqn-title-row');
        if (titleRow) titleRow.style.display = 'block';
        // Hide format toolbar & cleanup autocomplete
        const fmtBar = document.getElementById('cqn-format-toolbar');
        if (fmtBar) fmtBar.style.display = 'none';
        const channelInfoBox = document.getElementById('cqn-group-channel-info');
        if (channelInfoBox) channelInfoBox.style.display = 'none';
        if (popover._mentionCleanup) { popover._mentionCleanup(); popover._mentionCleanup = null; }
        const grTextarea = document.getElementById('cqn-note-text');
        if (grTextarea) grTextarea.placeholder = language.taskTextareaPlaceholder;
        popover.querySelector('.cqn-title').textContent = language.quickTaskTitle;
        saveBtn.innerHTML = '🎯 ' + language.taskAddBtn;
        if (hintEl) {
          const res = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
          const settings = res[STORAGE_KEYS.SETTINGS] || { snoozeMinutes: 30 };
          hintEl.innerHTML = language.taskReminderHint.replace('{minutes}', settings.snoozeMinutes);
        }
      }


      const newSaveBtn = saveBtn.cloneNode(true);
      saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
      newSaveBtn.addEventListener('click', () => saveTask(popover));
    }
    
    // Focus the textarea and put cursor at the end
    const textarea = document.getElementById('cqn-note-text');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  function formatDateTimeLocal(date) {
    const pad = num => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  async function saveTask(popover) {
    const { postId, postText, mode } = popover.dataset;
    const titleText = document.getElementById('cqn-note-title') ? document.getElementById('cqn-note-title').value.trim() : '';
    const noteText = document.getElementById('cqn-note-text').value.trim();
    const reminderTime = document.getElementById('cqn-reminder-time') ? document.getElementById('cqn-reminder-time').value : '';
    const category = document.getElementById('cqn-category') ? document.getElementById('cqn-category').value : 'General';
    const id = `${mode === 'note' ? 'memo_' : ALARMS.TASK_PREFIX}${Date.now()}`;
    const teamName = window.location.pathname.split('/')[1] || '';
    
    const repeatDailyCheckbox = document.getElementById('cqnTaskRemindDaily');
    const isRepeatDaily = (mode === 'note') ? false : (repeatDailyCheckbox ? repeatDailyCheckbox.checked : false);

    let reminderVal = (mode === 'note') ? null : (reminderTime || null);
    const presetVal = document.getElementById('cqnReminderSelect')?.value;
    if (mode === 'task' && !reminderVal && presetVal) {
      const mins = parseInt(presetVal, 10);
      if (!isNaN(mins)) {
        reminderVal = formatDateTimeLocal(new Date(Date.now() + mins * 60 * 1000));
      }
    }

    // Validation: Require reminder time when creating a task or group reminder
    if ((mode === 'task' || mode === 'group_reminder') && !reminderVal) {
      const reminderRow = document.getElementById('cqnReminderRow');
      const presetSelect = document.getElementById('cqnReminderSelect');

      if (reminderRow) {
        reminderRow.style.setProperty('border-color', '#dc2626', 'important');
        reminderRow.style.setProperty('box-shadow', '0 0 0 2px rgba(220, 38, 38, 0.2)', 'important');
        reminderRow.style.borderRadius = '6px';
        reminderRow.style.transition = 'all 0.2s';
      }
      const customSelect = presetSelect?.nextElementSibling;
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        const toggleBtn = customSelect.querySelector('.custom-dropdown-toggle');
        if (toggleBtn) {
          toggleBtn.style.setProperty('border-color', '#dc2626', 'important');
          toggleBtn.style.setProperty('box-shadow', '0 0 0 2px rgba(220, 38, 38, 0.2)', 'important');
          toggleBtn.style.transition = 'all 0.2s';
        }
      } else if (presetSelect) {
        presetSelect.style.setProperty('border-color', '#dc2626', 'important');
        presetSelect.style.setProperty('box-shadow', '0 0 0 2px rgba(220, 38, 38, 0.2)', 'important');
        presetSelect.style.transition = 'all 0.2s';
      }
      return;
    }

    // Chặn không cho chọn thời gian ở quá khứ
    if ((mode === 'task' || mode === 'group_reminder') && reminderVal && !isRepeatDaily) {
      const selectedTime = new Date(reminderVal).getTime();
      if (!isNaN(selectedTime) && selectedTime < Date.now()) {
        showToast(language.pastDateError);
        const reminderRow = document.getElementById('cqnReminderRow');
        if (reminderRow) {
          reminderRow.style.setProperty('border-color', '#dc2626', 'important');
          reminderRow.style.setProperty('box-shadow', '0 0 0 2px rgba(220, 38, 38, 0.2)', 'important');
          reminderRow.style.borderRadius = '6px';
          reminderRow.style.transition = 'all 0.2s';
        }
        return;
      }
    }

    if ((mode === 'task' || mode === 'group_reminder') && reminderVal && isRepeatDaily && reminderVal.length === 5 && reminderVal.includes(':')) {
      const today = new Date();
      const parts = reminderVal.split(':');
      today.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      if (today.getTime() <= Date.now()) {
        today.setDate(today.getDate() + 1);
      }
      reminderVal = formatDateTimeLocal(today);
    }

    const taskCatSelect = document.getElementById('cqn-task-category');
    const taskCat = taskCatSelect ? taskCatSelect.value : 'normal';

    const item = { 
      id, 
      type: mode === 'note' ? 'memo' : mode, 
      postId, 
      postText, 
      title: titleText || '',
      note: noteText || postText, 
      category: mode === 'note' ? category : 'General',
      taskCategory: mode === 'task' ? taskCat : (mode === 'group_reminder' ? 'group_reminder' : undefined),
      checklist: (mode === 'task' && taskCat === 'checklist')
        ? (noteText || postText || '')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .map((lineText, idx) => {
              const cleanText = lineText.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
              return {
                id: `${id}_line_${idx}`,
                text: cleanText,
                done: false
              };
            })
        : [],
      targetChannelId: mode === 'group_reminder' ? (popover.dataset.targetChannelId || '') : null,
      targetChannelName: mode === 'group_reminder' ? (popover.dataset.targetChannelName || '') : null,
      createdAt: Date.now(), 
      done: false, 
      reminder: reminderVal,
      repeatDaily: isRepeatDaily,
      status: 'pending', 
      teamName 
    };

    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS, STORAGE_KEYS.SETTINGS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const settings = res[STORAGE_KEYS.SETTINGS] || { snoozeMinutes: 30 };
    memos.unshift(item);
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.MEMO_UPDATED });
    
    if ((mode === 'task' || mode === 'group_reminder') && reminderVal) {
      const startTime = new Date(reminderVal).getTime();
      if (!isNaN(startTime)) {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId: id, time: startTime });
      }
    }
    
    popover.classList.remove('visible');
    quickNoteBackdrop.classList.remove('visible');
    
    // Display localized success toast message
    let successMsg = language.quickTaskSaveSuccess || 'Đã lưu công việc';
    if (mode === 'note') successMsg = language.quickNoteSaveSuccess || 'Đã lưu ghi chú';
    else if (mode === 'group_reminder') successMsg = language.quickGroupReminderSaveSuccess || 'Đã lưu nhắc nhở nhóm';
    showToast(successMsg);
  }

  let cachedSettings = { ...DEFAULT_SETTINGS };
  let cachedMemos = [];
  let myUserId = '';

  // Fetch initial settings and memos
  chrome.storage.local.get([STORAGE_KEYS.SETTINGS, STORAGE_KEYS.MEMOS], (res) => {
    if (res[STORAGE_KEYS.SETTINGS]) {
      const raw = res[STORAGE_KEYS.SETTINGS];
      cachedSettings = {
        ...DEFAULT_SETTINGS,
        ...raw,
        showTabs: { ...DEFAULT_SETTINGS.showTabs, ...raw.showTabs },
        floatingButtons: { ...DEFAULT_SETTINGS.floatingButtons, ...raw.floatingButtons }
      };
      if (!cachedSettings.aiCustomPrompt || !cachedSettings.aiCustomPrompt.trim()) {
        cachedSettings.aiCustomPrompt = DEFAULT_SETTINGS.aiCustomPrompt;
      }
    }
    if (res[STORAGE_KEYS.MEMOS]) {
      cachedMemos = res[STORAGE_KEYS.MEMOS];
      checkAndShowOverdueDigest(cachedMemos);
    }
    injectDynamicTheme();
    loadCustomImages();
    
    // Fetch my profile ID to identify our own messages
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_MY_PROFILE }, (profileRes) => {
      if (profileRes && profileRes.ok && profileRes.profile) {
        myUserId = profileRes.profile.id;
      }
    });

  });

  // Listen to settings and custom image changes reactively
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes[STORAGE_KEYS.SETTINGS]) {
        const raw = changes[STORAGE_KEYS.SETTINGS].newValue || {};
        const old = changes[STORAGE_KEYS.SETTINGS].oldValue || {};
        cachedSettings = {
          ...DEFAULT_SETTINGS,
          ...raw,
          showTabs: { ...DEFAULT_SETTINGS.showTabs, ...raw.showTabs },
          floatingButtons: { ...DEFAULT_SETTINGS.floatingButtons, ...raw.floatingButtons }
        };
        runWithObserverDisabled(() => {
          handleQuickActionButtonsVisibility();
          injectDynamicTheme();
        });

        // Real-time update of GIF picker in ChatOps on API key save
        if (raw.giphyApiKey !== old.giphyApiKey) {
          cachedPickerTrendingGifs = [];
          cachedPickerTrendingApiKey = '';
          const pickerEl = document.querySelector('.chatops-image-picker');
          if (pickerEl && !pickerEl.classList.contains('hidden')) {
            const activeSubTab = pickerEl.querySelector('.chatops-picker-sub-tab.active');
            if (activeSubTab && activeSubTab.dataset.tab === 'gifs') {
              loadPickerGifs('');
            }
          }
        }
      }
      if (changes.custom_memes) {
        loadCustomImages();
      }
      if (changes[STORAGE_KEYS.MEMOS]) {
        cachedMemos = changes[STORAGE_KEYS.MEMOS].newValue || [];
        updateFloatingBadgeCount();
        if (templatePickerEl && !templatePickerEl.classList.contains('hidden')) {
          const searchInput = templatePickerEl.querySelector('.chatops-template-search-input');
          renderTemplatesList(searchInput ? searchInput.value : '');
        }
      }
    }
  });

  function handleQuickActionButtonsVisibility() {
    // Clear post processing cache so buttons are properly re-evaluated
    document.querySelectorAll('[data-chatops-injected]').forEach(el => {
      el.removeAttribute('data-chatops-injected');
    });
    document.querySelectorAll('[data-chatops-image-injected]').forEach(el => {
      el.removeAttribute('data-chatops-image-injected');
    });
    document.querySelectorAll('[data-chatops-template-injected]').forEach(el => {
      el.removeAttribute('data-chatops-template-injected');
    });
    document.querySelectorAll('[data-chatops-task-create-injected]').forEach(el => {
      el.removeAttribute('data-chatops-task-create-injected');
    });
    document.querySelectorAll('[data-chatops-group-reminder-injected]').forEach(el => {
      el.removeAttribute('data-chatops-group-reminder-injected');
    });

    const showTabs = cachedSettings.showTabs || { search: true, tasks: true, notes: true, missed: true, reactions: true };
    const floatingButtons = cachedSettings.floatingButtons || { quickNote: true, quickTask: true, spamReactions: true, reactAlong: false, imagePicker: true, quickReply: false, quickCopy: false, aiSummarize: true, groupReminder: true };
    const tasksEnabled = floatingButtons.quickTask !== false;
    const notesEnabled = floatingButtons.quickNote !== false;
    const spamEnabled = floatingButtons.spamReactions !== false;
    const reactAlongEnabled = floatingButtons.reactAlong !== false;
    const replyEnabled = floatingButtons.quickReply !== false;
    const copyEnabled = floatingButtons.quickCopy !== false;
    const aiSummarizeEnabled = floatingButtons.aiSummarize !== false;
    const groupReminderEnabled = floatingButtons.groupReminder !== false;

    if (!tasksEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.task-btn').forEach(el => el.remove());
    }
    if (!notesEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.note-btn').forEach(el => el.remove());
    }
    if (!replyEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.quick-reply-btn').forEach(el => el.remove());
    }
    if (!copyEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.quick-copy-btn').forEach(el => el.remove());
    }
    if (!aiSummarizeEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.ai-summarize-btn').forEach(el => el.remove());
    }
    if (!spamEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.spam-btn, .chatops-action-group .chatops-quick-note-btn.retract-btn').forEach(el => el.remove());
    }
    if (!reactAlongEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.clone-btn').forEach(el => el.remove());
    }

    if (!groupReminderEnabled) {
      document.querySelectorAll('.chatops-ext-group-reminder-btn, .chatops-ext-group-reminder-btn-rhs').forEach(el => el.remove());
    }

    const meetEnabled = floatingButtons.quickMeet !== false;
    if (!meetEnabled) {
      document.querySelectorAll('.chatops-ext-meet-create-btn, .chatops-ext-meet-create-btn-rhs').forEach(el => el.remove());
    }
    
    const isQuickDeleteEnabled = cachedSettings.quickDelete === true;
    if (!isQuickDeleteEnabled) {
      document.querySelectorAll('.chatops-action-group .chatops-quick-note-btn.msg-delete-btn').forEach(el => el.remove());
    }
    
    injectQuickNoteButtons();
    injectImageButton();
    injectTemplateButton();
    injectTaskCreateButton();
    injectGroupReminderButton();
    injectMeetCreateButton();
    injectHeaderButtons();
  }

  async function getPostRawMessage(postId) {
    return new Promise((resolve) => {
      let timeoutId;
      const handler = (e) => {
        if (e.detail.postId === postId) {
          window.removeEventListener('chatops-post-message-response', handler);
          clearTimeout(timeoutId);
          resolve(e.detail.message);
        }
      };
      window.addEventListener('chatops-post-message-response', handler);

      window.dispatchEvent(new CustomEvent('chatops-post-message-request', {
        detail: { postId }
      }));

      timeoutId = setTimeout(() => {
        window.removeEventListener('chatops-post-message-response', handler);
        resolve(null);
      }, 200);
    });
  }

  async function getPostUsername(postEl) {
    if (!postEl) return null;

    async function getPostUsernameFromReact(postId) {
      const bridgeResult = await new Promise((resolve) => {
        let timeoutId;
        const handler = (e) => {
          if (e.detail.postId === postId) {
            window.removeEventListener('chatops-username-response', handler);
            clearTimeout(timeoutId);
            resolve({ username: e.detail.username, userId: e.detail.userId });
          }
        };
        window.addEventListener('chatops-username-response', handler);

        window.dispatchEvent(new CustomEvent('chatops-username-request', {
          detail: { postId }
        }));

        // Short timeout: 200ms
        timeoutId = setTimeout(() => {
          window.removeEventListener('chatops-username-response', handler);
          resolve({ username: null, userId: null });
        }, 200);
      });

      // Fast path: bridge resolved the username via Redux store
      if (bridgeResult.username) return bridgeResult.username;

      // Slow path: bridge found userId but not username → resolve via background API
      if (bridgeResult.userId) {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.RESOLVE_USER_ID,
            userId: bridgeResult.userId
          }, (response) => {
            resolve(response && response.ok ? response.username : null);
          });
        });
      }

      return null;
    }

    const postId = cleanPostId(postEl);
    if (postId) {
      const reactUsername = await getPostUsernameFromReact(postId);
      if (reactUsername) return reactUsername;
    }

    // Helper to extract login username from a post element
    function extractUsernameFromEl(el) {
      if (!el) return null;

      // 1. Check data-username attribute (most direct)
      const withDataUsername = el.querySelector('[data-username]') || (el.hasAttribute && el.hasAttribute('data-username') ? el : null);
      if (withDataUsername) {
        const val = withDataUsername.getAttribute('data-username');
        if (val && val.trim()) return val.trim();
      }

      // 2. Check user-popover buttons/links and their IDs
      const popovers = el.querySelectorAll('.user-popover, [id*="user-popover"], [class*="user-popover"], .post-header__username, .post-profile, [class*="username"]');
      for (const p of popovers) {
        const id = p.getAttribute('id') || '';
        const match = id.match(/user-popover_(.+)$/i) || id.match(/user-popover-(.+)$/i);
        if (match && match[1]) {
          const u = match[1].trim();
          const isUserId = /^[a-z0-9]{26}$/.test(u);
          if (u && !u.includes('undefined') && !isUserId) return u;
        }
        
        // Sometimes the popover button itself has data-username
        if (p.hasAttribute('data-username')) {
          const u = p.getAttribute('data-username');
          if (u && u.trim()) return u.trim();
        }
      }

      // 3. Check profile image alt text (English, Vietnamese, and generic)
      const imgs = el.querySelectorAll('img.Avatar, img[class*="avatar"], .post__img img, .status-wrapper img, [class*="avatar"] img');
      for (const img of imgs) {
        const alt = (img.getAttribute('alt') || '').trim();
        if (!alt) continue;
        
        // 3a. English: "username profile image"
        let match = alt.match(/^(.+?)\s+profile\s+image$/i);
        if (match && match[1]) {
          const u = match[1].trim();
          if (u !== 'user') return u;
        }

        // 3b. Vietnamese: "Ảnh hồ sơ của username" or "Ảnh đại diện của username"
        match = alt.match(/^(Ảnh hồ sơ của|Ảnh đại diện của|Ảnh hồ sơ|Ảnh đại diện)\s+(.+)$/i);
        if (match && match[2]) {
          const u = match[2].trim();
          if (u && u !== 'user') return u;
        }
        
        // 3c. Generic fallback: if alt has no spaces and is not a generic word, it might be the username
        if (alt && !alt.includes(' ') && !['avatar', 'profile', 'image', 'picture', 'user'].includes(alt.toLowerCase())) {
          return alt;
        }
      }

      return null;
    }

    // Helper to extract display name from a post element
    function extractDisplayNameFromEl(el) {
      if (!el) return null;
      const popover = el.querySelector('.user-popover, .post-header__username, [class*="username"]');
      if (popover) {
        const text = popover.textContent.trim();
        if (text) return text;
      }
      return null;
    }

    // Helper to resolve display name using background search API
    async function resolveDisplayName(displayName) {
      const cleaned = displayName
        .replace(/\[[^\]]+\]/g, '') // Remove [DN.DU2.DEV] etc.
        .replace(/\([^)]+\)/g, '')   // Remove (WFH) etc.
        .trim();
        
      if (!cleaned) return null;
      
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.RESOLVE_DISPLAY_NAME,
          displayName: cleaned
        }, (response) => {
          if (response && response.ok && response.username) {
            resolve(response.username);
          } else {
            resolve(null);
          }
        });
      });
    }

    // Helper to find the previous post element in the DOM regardless of wrappers
    function getPreviousPostElement(el) {
      const container = el.closest('.sidebar-right, .rhs-thread, .sidebar--right, .post-list__content, .post-list-holder-by-time, #post-list, [class*="post-list"]');
      const scope = container || document;
      const allPosts = Array.from(scope.querySelectorAll('.post, [id^="post_"], [id^="rhsPost_"]'));
      const idx = allPosts.indexOf(el);
      if (idx > 0) {
        return allPosts[idx - 1];
      }
      return null;
    }

    // Walk backwards through actual post elements until we find a username or display name
    let current = postEl;
    let lookback = 0;
    while (current && lookback < 30) {
      // 1. Try to extract username directly (no API call needed)
      const username = extractUsernameFromEl(current);
      if (username) return username;
      
      // 2. Try to extract display name and resolve it via API
      const displayName = extractDisplayNameFromEl(current);
      if (displayName) {
        const resolved = await resolveDisplayName(displayName);
        if (resolved) return resolved;
      }
      
      current = getPreviousPostElement(current);
      lookback++;
    }

    return null;
  }

  function findReplyButton(el) {
    if (!el) return null;

    // IMPORTANT: Exclude ChatOps extension's own buttons to prevent infinite click loops
    const EXCLUDE = ':not(.chatops-quick-note-btn):not(.chatops-action-group *)';
    
    // Native Mattermost reply button selectors (excluding our own extension buttons)
    const NATIVE_SELECTORS = [
      `button[aria-label*="reply" i]${EXCLUDE}`,
      `button[aria-label*="Reply" i]${EXCLUDE}`,
      `button[aria-label*="Trả lời" i]${EXCLUDE}`,
      `button[aria-label*="comment" i]${EXCLUDE}`,
      `button[aria-label*="phản hồi" i]${EXCLUDE}`,
      `.comment-icon__container${EXCLUDE}`,
      `button[data-testid="reply-btn"]${EXCLUDE}`,
    ].join(', ');

    // 1. Search in hover actions menu first (most reliable)
    const postMenu = el.querySelector('.post-menu, .post__actions, .dot-menu__container, [class*="post-menu"], .post-action-menu');
    if (postMenu) {
      const btn = postMenu.querySelector(NATIVE_SELECTORS);
      if (btn) return btn;
    }

    // 2. Direct search inside post element
    let btn = el.querySelector(NATIVE_SELECTORS);
    if (btn) return btn;

    // 3. Fallback: If it's a child reply, find the parent/root post in the DOM and click its reply button
    const parentId = el.getAttribute('data-parent-id') || el.getAttribute('data-root-id');
    if (parentId) {
      const rootEl = document.getElementById(`post_${parentId}`) || document.getElementById(`rhsPost_${parentId}`);
      if (rootEl) {
        btn = rootEl.querySelector(NATIVE_SELECTORS);
        if (btn) return btn;
      }
    }

    // 4. Broader parent container search if it's a reply message grouped under a parent
    const centerPostEl = el.closest('.post');
    if (centerPostEl && centerPostEl !== el) {
      btn = centerPostEl.querySelector(NATIVE_SELECTORS);
      if (btn) return btn;
    }

    return null;
  }

  function insertTextIntoTextarea(textarea, text) {
    if (!textarea) return;
    textarea.focus();

    // For React-controlled textareas (like Mattermost), we MUST use the native
    // HTMLTextAreaElement value setter to bypass React's controlled component.
    // Then dispatch an 'input' event so React picks up the change in its state.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;

    if (nativeSetter) {
      const currentVal = textarea.value;
      const start = textarea.selectionStart || currentVal.length;
      const end = textarea.selectionEnd || currentVal.length;
      const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);

      // Use native setter to bypass React's interception
      nativeSetter.call(textarea, newVal);

      // Place cursor after inserted text
      textarea.selectionStart = textarea.selectionEnd = start + text.length;

      // Dispatch input event that React's synthetic event system listens to
      const inputEvent = new Event('input', { bubbles: true });
      textarea.dispatchEvent(inputEvent);

      // Also dispatch change event for good measure
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    // Ultimate fallback: direct assignment + event dispatch
    const val = textarea.value;
    textarea.value = val + text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function tagUserInChat(username, isRhs) {
    let textarea = null;
    if (isRhs) {
      textarea = document.getElementById('reply_textbox') || document.querySelector('.sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]');
    }
    if (!textarea) {
      textarea = document.getElementById('post_textbox') || document.querySelector('textarea#post_textbox, .post-create-body textarea, [placeholder*="write" i]');
    }
    if (!textarea) {
      textarea = document.querySelector('textarea');
    }

    if (!textarea) {
      console.warn('[ChatOps Ext] No chat textbox found to tag user.');
      return;
    }

    const tag = `@${username} `;
    insertTextIntoTextarea(textarea, tag);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        showToast(language.copiedToClipboard || 'Đã sao chép tin nhắn vào clipboard!');
      }).catch(err => {
        console.error('Failed to copy text using navigator.clipboard: ', err);
        fallbackCopyToClipboard(text);
      });
    } else {
      fallbackCopyToClipboard(text);
    }
  }

  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showToast(language.copiedToClipboard || 'Đã sao chép tin nhắn vào clipboard!');
    } catch (err) {
      console.error('Fallback copy failed: ', err);
    }
    document.body.removeChild(textArea);
  }

  function cleanPostId(postEl) {
    const rawId = postEl?.id || '';
    return rawId.replace('post_', '').replace('rhsPost_', '').replace('rhs_post_', '');
  }

  function injectQuickNoteButtons(target = document) {
    const postsSelector =
      `.post:not([data-chatops-injected]), ` +
      `[id^="post_"]:not([data-chatops-injected]), ` +
      `[id^="rhsPost_"]:not([data-chatops-injected]), ` +
      `.post[data-chatops-injected="true"]:not(:has(.chatops-action-group)), ` +
      `[id^="post_"][data-chatops-injected="true"]:not(:has(.chatops-action-group)), ` +
      `[id^="rhsPost_"][data-chatops-injected="true"]:not(:has(.chatops-action-group))`;

    const postSelectorPattern = '.post, [id^="post_"], [id^="rhsPost_"]';

    let posts = [];
    if (target && target !== document) {
      if (target.matches && target.matches(postSelectorPattern)) {
        if (!target.dataset.chatopsInjected || (target.dataset.chatopsInjected === 'true' && !target.querySelector('.chatops-action-group'))) {
          posts.push(target);
        }
      }
      if (target.querySelectorAll) {
        posts = posts.concat(Array.from(target.querySelectorAll(postsSelector)));
      }
    } else {
      posts = Array.from(document.querySelectorAll(postsSelector));
    }
    
    const showTabs = cachedSettings.showTabs || { search: true, tasks: true, notes: true, missed: true, reactions: true };
    const floatingButtons = cachedSettings.floatingButtons || { quickNote: true, quickTask: true, spamReactions: true, reactAlong: false, imagePicker: true, quickReply: false, quickCopy: false };
    
    const isDemo = posts.some(p => p && p.classList && p.classList.contains('chatops-hover-active'));
    const tasksEnabled = isDemo || floatingButtons.quickTask !== false;
    const notesEnabled = isDemo || floatingButtons.quickNote !== false;
    const spamEnabled = isDemo || floatingButtons.spamReactions !== false;
    const reactAlongEnabled = isDemo || floatingButtons.reactAlong !== false;
    const replyEnabled = isDemo || floatingButtons.quickReply !== false;
    const copyEnabled = isDemo || floatingButtons.quickCopy !== false;

    posts.forEach(postEl => {
      const postId = cleanPostId(postEl);
      if (!postId && !postEl.classList.contains('chatops-hover-active')) {
        postEl.dataset.chatopsInjected = 'skipped';
        return;
      }

      const isPostDeleted = postEl.classList.contains('post--deleted') || 
                            postEl.querySelector('.post--deleted') ||
                            postEl.textContent.includes('(message deleted)') || 
                            postEl.textContent.includes('(tin nhắn đã bị xóa)');
      if (isPostDeleted) {
        postEl.querySelectorAll('.chatops-quick-note-btn').forEach(el => el.remove());
        postEl.dataset.chatopsInjected = 'skipped';
        return;
      }

      // Guard: skip if post no longer in DOM (fixes bug after quick add from outside ChatOps)
      if (!postEl.isConnected) return;

      // Find the action bar within this post
      let actionArea = postEl.querySelector('.post-menu, .post__actions, .dot-menu__container, [class*="post-menu"], .post-action-menu');
      let isFallback = false;
      if (!actionArea) {
        if (postEl.classList.contains('chatops-hover-active')) {
          actionArea = postEl;
          isFallback = true;
        } else {
          return;
        }
      }

      // Get or create a dedicated container for ChatOps buttons
      let chatopsGroup = actionArea.querySelector('.chatops-action-group');
      if (postEl.dataset.chatopsInjected === 'true' && chatopsGroup) {
        return;
      }
      postEl.dataset.chatopsInjected = 'true';
      const position = cachedSettings.customButtonsPosition || 'before';

      if (!chatopsGroup) {
        chatopsGroup = document.createElement('span');
        chatopsGroup.className = 'chatops-action-group';
        
        // Apply position-based CSS styling
        let cssText = '';
        if (isFallback) {
          cssText = 'position: absolute; top: -12px; right: 20px; display: inline-flex; align-items: center; gap: 0; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); z-index: 99999;';
        } else if (position === 'above') {
          cssText = 'position: absolute; bottom: 100%; right: 0; display: inline-flex; align-items: center; gap: 0; margin-bottom: 2px; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #e5e5e5); border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); z-index: 10;';
        } else if (position === 'below') {
          cssText = 'position: absolute; top: 100%; right: 0; display: inline-flex; align-items: center; gap: 0; margin-top: 2px; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #e5e5e5); border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); z-index: 10;';
        } else {
          cssText = 'display: inline-flex; align-items: center; gap: 0;';
        }

        if (postEl.classList.contains('chatops-hover-active')) {
          cssText = cssText.replace('display: inline-flex;', 'display: inline-flex !important;');
        }
        chatopsGroup.style.cssText = cssText;

        // Insert at the configured position relative to native action menu
        if (isFallback || position === 'after') {
          actionArea.appendChild(chatopsGroup);
        } else {
          actionArea.insertBefore(chatopsGroup, actionArea.firstChild);
        }
      } else {
        // Update styling and layout order in case setting changed dynamically
        let cssText = '';
        if (isFallback) {
          cssText = 'position: absolute; top: -12px; right: 20px; display: inline-flex; align-items: center; gap: 0; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #cbd5e1); border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1); z-index: 99999;';
        } else if (position === 'above') {
          cssText = 'position: absolute; bottom: 100%; right: 0; display: inline-flex; align-items: center; gap: 0; margin-bottom: 2px; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #e5e5e5); border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); z-index: 10;';
        } else if (position === 'below') {
          cssText = 'position: absolute; top: 100%; right: 0; display: inline-flex; align-items: center; gap: 0; margin-top: 2px; padding: 2px 4px; background: var(--bg-1, #ffffff); border: 1px solid var(--border, #e5e5e5); border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); z-index: 10;';
        } else {
          cssText = 'display: inline-flex; align-items: center; gap: 0;';
        }

        if (postEl.classList.contains('chatops-hover-active')) {
          cssText = cssText.replace('display: inline-flex;', 'display: inline-flex !important;');
        }
        chatopsGroup.style.cssText = cssText;

        if (isFallback || position === 'after') {
          actionArea.appendChild(chatopsGroup);
        } else {
          actionArea.insertBefore(chatopsGroup, actionArea.firstChild);
        }
      }

      // Inject/Update Task button (🎯) if enabled
      if (tasksEnabled) {
        let taskBtn = chatopsGroup.querySelector('.chatops-quick-note-btn.task-btn');
        if (!taskBtn) {
          taskBtn = document.createElement('button');
          taskBtn.className = 'chatops-quick-note-btn task-btn';
          taskBtn.innerHTML = '🎯';
          taskBtn.title = language.quickTaskCreate;
          taskBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            openQuickNote(postEl, taskBtn, 'task');
          });
          chatopsGroup.appendChild(taskBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.task-btn')?.remove();
      }

      // Inject/Update Note button (📒) if enabled
      if (notesEnabled) {
        let noteBtn = chatopsGroup.querySelector('.chatops-quick-note-btn.note-btn');
        if (!noteBtn) {
          noteBtn = document.createElement('button');
          noteBtn.className = 'chatops-quick-note-btn note-btn';
          noteBtn.innerHTML = '📒';
          noteBtn.title = language.quickNoteCreate;
          noteBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            openQuickNote(postEl, noteBtn, 'note');
          });
          chatopsGroup.appendChild(noteBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.note-btn')?.remove();
      }

      // Inject/Update Quick Reply button (💬) if enabled
      if (replyEnabled) {
        let replyBtn = chatopsGroup.querySelector('.chatops-quick-note-btn.quick-reply-btn');
        if (!replyBtn) {
          replyBtn = document.createElement('button');
          replyBtn.className = 'chatops-quick-note-btn quick-reply-btn';
          replyBtn.innerHTML = '💬';
          replyBtn.title = language.quickReplyBtnTooltip || 'Phản hồi nhanh (@)';
          replyBtn.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();

            // Re-entrancy guard: prevent infinite loop if this handler fires again
            if (replyBtn.dataset.busy === 'true') return;
            replyBtn.dataset.busy = 'true';
            const clearBusy = () => { replyBtn.dataset.busy = 'false'; };
            // Auto-clear after 3s safety net
            setTimeout(clearBusy, 3000);

            const username = await getPostUsername(postEl);
            if (!username) {
              showToast(language.usernameNotFoundError || 'Không tìm thấy tên người dùng để tag!');
              clearBusy();
              return;
            }
            
            const isInsideRhs = !!postEl.closest('.sidebar-right, .rhs-thread, .sidebar--right') || postEl.id.startsWith('rhsPost_');
            
            if (isInsideRhs) {
              // Already in RHS thread, just tag in the reply textbox
              tagUserInChat(username, true);
              clearBusy();
            } else {
              // Step 1: Trigger hover events to force Mattermost to render its action menu
              postEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
              postEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
              
              // Step 2: After hover menu renders, find and click the native Mattermost reply button
              setTimeout(() => {
                const nativeReplyBtn = findReplyButton(postEl);
                if (nativeReplyBtn) {
                  nativeReplyBtn.click();
                  
                  // Step 3: Poll until RHS reply textbox is available, then insert @tag
                  let attempts = 0;
                  const pollInterval = setInterval(() => {
                    attempts++;
                    const textarea = document.getElementById('reply_textbox') || document.querySelector('.sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea');
                    if (textarea) {
                      clearInterval(pollInterval);
                      // Small extra delay to let React fully hydrate the textarea
                      setTimeout(() => {
                        tagUserInChat(username, true);
                        clearBusy();
                      }, 100);
                    } else if (attempts > 30) {
                      // Timeout after ~3s - fall back to main chat
                      clearInterval(pollInterval);
                      tagUserInChat(username, false);
                      clearBusy();
                    }
                  }, 100);
                } else {
                  // No native reply button found, tag in the main chat input
                  tagUserInChat(username, false);
                  clearBusy();
                }
              }, 150);
            }
          });
          chatopsGroup.appendChild(replyBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.quick-reply-btn')?.remove();
      }

      // Inject/Update Quick Copy button (📋) if enabled
      if (copyEnabled) {
        let copyBtn = chatopsGroup.querySelector('.chatops-quick-note-btn.quick-copy-btn');
        if (!copyBtn) {
          copyBtn = document.createElement('button');
          copyBtn.className = 'chatops-quick-note-btn quick-copy-btn';
          copyBtn.innerHTML = '📋';
          copyBtn.title = language.quickCopyBtnTooltip || 'Sao chép nhanh tin nhắn';
          copyBtn.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            const postId = cleanPostId(postEl);
            let msgTextFull = null;
            if (postId) {
              msgTextFull = await getPostRawMessage(postId);
            }
            if (!msgTextFull) {
              const msgBodyEl = postEl.querySelector('.post-message__text, .post__body p, [class*="post-message"]');
              msgTextFull = msgBodyEl ? msgBodyEl.innerText.trim() : '';
            }
            if (!msgTextFull) {
              showToast(language.quickCopyTextOnlyError || 'Sao chép nhanh chỉ hỗ trợ tin nhắn dạng văn bản.');
              return;
            }
            copyToClipboard(msgTextFull);
          });
          chatopsGroup.appendChild(copyBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.quick-copy-btn')?.remove();
      }

      chatopsGroup.querySelector('.chatops-quick-note-btn.ai-summarize-btn')?.remove();

          // Remove delete association button (🗑️) as it is no longer needed on ChatOps
      chatopsGroup.querySelector('.chatops-quick-note-btn.delete-btn')?.remove();

      // Handle Spam and Retract buttons conditionally!
      if (spamEnabled) {
        // Inject Spam button (🔥) if not present
        if (!chatopsGroup.querySelector('.chatops-quick-note-btn.spam-btn')) {
          const spamBtn = document.createElement('button');
          spamBtn.className = 'chatops-quick-note-btn spam-btn';
          spamBtn.innerHTML = '🔥';
          spamBtn.title = language.spamReactionsTitle;
          spamBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const postId = cleanPostId(postEl);
            if (!postId) return;

            const origHtml = spamBtn.innerHTML;
            spamBtn.innerHTML = '⏳';
            spamBtn.style.opacity = '0.5';
            spamBtn.disabled = true;

            chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.SPAM_POST_REACTIONS,
              postId
            }, (res) => {
              spamBtn.innerHTML = origHtml;
              spamBtn.style.opacity = '1';
              spamBtn.disabled = false;

              if (!res || !res.ok) {
                let errMsg = res?.error || language.unknown;
                if (errMsg.toLowerCase().includes('unable to save reaction') || errMsg.toLowerCase().includes('already spammed') || errMsg.toLowerCase().includes('already reacted')) {
                  errMsg = language.reactionAlreadyExists;
                }
                showToast(language.spamErrorPrefix + errMsg);
              }
            });
          });

          // Right-click: show reaction group picker
          spamBtn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showReactionGroupsDropdown(spamBtn, postEl);
          });

          chatopsGroup.appendChild(spamBtn);
        }

        // Inject Retract button (↩️) if not present
        if (!chatopsGroup.querySelector('.chatops-quick-note-btn.retract-btn')) {
          const retractBtn = document.createElement('button');
          retractBtn.className = 'chatops-quick-note-btn retract-btn';
          retractBtn.innerHTML = '↩️';
          retractBtn.title = language.undoSpamTitle;
          retractBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const postId = cleanPostId(postEl);
            if (!postId) return;

            const origHtml = retractBtn.innerHTML;
            retractBtn.innerHTML = '⏳';
            retractBtn.style.opacity = '0.5';
            retractBtn.disabled = true;

            chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.RETRACT_POST_REACTIONS,
              postId
            }, (res) => {
              retractBtn.innerHTML = origHtml;
              retractBtn.style.opacity = '1';
              retractBtn.disabled = false;

              if (!res || !res.ok) {
                let errMsg = res?.error || language.unknown;
                if (errMsg.toLowerCase().includes('reaction not found') || errMsg.toLowerCase().includes('no reaction') || errMsg.toLowerCase().includes('unable to')) {
                  errMsg = language.reactionNotFound;
                }
                showToast(language.undoSpamErrorPrefix + errMsg);
              }
            });
          });
          chatopsGroup.appendChild(retractBtn);
        }
      } else {
        // If not enabled, clean up any existing spam and retract buttons from this post
        chatopsGroup.querySelectorAll('.chatops-quick-note-btn.spam-btn, .chatops-quick-note-btn.retract-btn').forEach(el => el.remove());
      }

      // Handle React-Along button (🎭) conditionally!
      if (reactAlongEnabled) {
        if (!chatopsGroup.querySelector('.chatops-quick-note-btn.clone-btn')) {
          const cloneBtn = document.createElement('button');
          cloneBtn.className = 'chatops-quick-note-btn clone-btn';
          cloneBtn.innerHTML = '🎭';
          cloneBtn.title = language.reactAlongTooltip || 'Reaction theo bài viết';
          cloneBtn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const postId = cleanPostId(postEl);
            if (!postId) return;

            const origHtml = cloneBtn.innerHTML;
            cloneBtn.innerHTML = '⏳';
            cloneBtn.style.opacity = '0.5';
            cloneBtn.disabled = true;

            chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.CLONE_POST_REACTIONS,
              postId
            }, (res) => {
              cloneBtn.innerHTML = origHtml;
              cloneBtn.style.opacity = '1';
              cloneBtn.disabled = false;

              if (res && res.ok) {
                showToast(language.reactAlongSuccess || 'Sao chép các biểu tượng cảm xúc thành công! 🎭');
              } else {
                let errMsg = res?.error || language.unknown;
                if (errMsg.toLowerCase().includes('no reactions on this post to clone')) {
                  errMsg = language.noReactionsToClone || errMsg;
                } else if (errMsg.toLowerCase().includes('already reacted to all') || errMsg.toLowerCase().includes('already reacted')) {
                  errMsg = language.alreadyClonedAllReactions || errMsg;
                }
                showToast(language.reactAlongErrorPrefix + errMsg);
              }
            });
          });
          chatopsGroup.appendChild(cloneBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.clone-btn')?.remove();
      }

      // Inject Delete Message button (🗑️ with red color) if it's our post and quickDelete is enabled
      const isOurPost = postEl.classList.contains('current--user') || (myUserId && postEl.getAttribute('data-user-id') === myUserId);
      const isQuickDeleteEnabled = cachedSettings.quickDelete === true;
      if (isOurPost && isQuickDeleteEnabled) {
        if (!chatopsGroup.querySelector('.chatops-quick-note-btn.msg-delete-btn')) {
          const msgDeleteBtn = document.createElement('button');
          msgDeleteBtn.className = 'chatops-quick-note-btn msg-delete-btn';
          msgDeleteBtn.innerHTML = '🗑️';
          msgDeleteBtn.title = language.deletePostTooltip || 'Xóa tin nhắn (ChatOps)';
          msgDeleteBtn.style.color = '#d0454c';
          msgDeleteBtn.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.DELETE_POST,
              postId
            }, (res) => {
              if (res && res.ok) {
                // Fade out and remove post element
                postEl.style.transition = 'opacity 0.3s ease';
                postEl.style.opacity = '0';
                setTimeout(() => {
                   postEl.remove();
                }, 300);
              } else {
                console.error('[ChatOps Ext] Failed to delete message:', res?.error);
                showToast(res?.error || 'Failed to delete message');
              }
            });
          });
          chatopsGroup.appendChild(msgDeleteBtn);
        }
      } else {
        chatopsGroup.querySelector('.chatops-quick-note-btn.msg-delete-btn')?.remove();
      }

      // Sort ChatOps action buttons dynamically to ensure consistent layout
      const orderClasses = [
        'task-btn',
        'note-btn',
        'quick-reply-btn',
        'quick-copy-btn',
        'spam-btn',
        'clone-btn',
        'retract-btn',
        'msg-delete-btn'
      ];
      const buttons = Array.from(chatopsGroup.querySelectorAll('.chatops-quick-note-btn'));
      buttons.sort((a, b) => {
        const classA = orderClasses.find(cls => a.classList.contains(cls));
        const classB = orderClasses.find(cls => b.classList.contains(cls));
        const idxA = classA ? orderClasses.indexOf(classA) : 999;
        const idxB = classB ? orderClasses.indexOf(classB) : 999;
        return idxA - idxB;
      });
      buttons.forEach(btn => chatopsGroup.appendChild(btn));
    });
  }

  // Handle click on settings links inside the Mattermost content script page (e.g. from Quick Task Popover)
  document.addEventListener('click', async (e) => {
    const link = e.target.closest('.settings-subtab-link');
    if (link) {
      e.preventDefault();
      const subtabName = link.dataset.subtab;
      if (subtabName) {
        // Save target tab & sub-tab to local storage so the sidepanel opens directly to it
        await chrome.storage.local.set({ 
          [STORAGE_KEYS.SIDEPANEL_TAB]: 'settings',
          'sidePanelSubTab': subtabName 
        });
        
        // Open the sidepanel programmatically!
        openSidePanel();
      }
    }
  });

  // Track last right-clicked post element for the QUICK_REPLY_QUOTE context menu feature
  document.addEventListener('contextmenu', (e) => {
    const postEl = e.target.closest('.post, [id^="post_"], [id^="rhsPost_"]');
    lastRightClickedPostEl = postEl || null;
  }, true);

  /**
   * Shows a custom reaction group picker dropdown when user right-clicks the spam (🔥) button.
   * Reads groups from cachedSettings.reactionGroups and sends SPAM_POST_REACTIONS with
   * the chosen group's emojis array as override.
   */
  function showReactionGroupsDropdown(spamBtn, postEl) {
    // Close any existing dropdown
    if (activeReactionDropdown) {
      activeReactionDropdown.remove();
      activeReactionDropdown = null;
    }

    const groups = cachedSettings?.reactionGroups;
    const postId = cleanPostId(postEl);
    if (!postId) return;

    if (!groups || groups.length === 0) {
      showToast('⚠️ Chưa cấu hình nhóm reaction. Vào Settings → Reactions để thiết lập.');
      return;
    }

    // Build dropdown element
    const dropdown = document.createElement('div');
    dropdown.className = 'chatops-reaction-dropdown';
    dropdown.setAttribute('role', 'menu');

    // Style the dropdown
    Object.assign(dropdown.style, {
      position: 'fixed',
      zIndex: '99999',
      background: 'linear-gradient(135deg, #1e1f26 0%, #2b2d38 100%)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: '12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
      padding: '6px',
      minWidth: '200px',
      maxWidth: '280px',
      backdropFilter: 'blur(12px)',
      fontFamily: 'inherit',
    });

    // Header
    const header = document.createElement('div');
    header.textContent = '🔥 Chọn nhóm reaction';
    Object.assign(header.style, {
      color: 'rgba(255,255,255,0.5)',
      fontSize: '11px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      padding: '4px 8px 6px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '4px',
    });
    dropdown.appendChild(header);

    groups.forEach(group => {
      if (!group || !group.name) return;

      const item = document.createElement('button');
      item.setAttribute('role', 'menuitem');

      const emojis = Array.isArray(group.emojis) ? group.emojis : [];
      // Show first 6 emojis as preview (using emoji names as text with colons)
      const preview = emojis.slice(0, 6).map(e => `:${e}:`).join(' ');

      item.innerHTML = `
        <span class="chatops-rg-name">${escapeHtml(group.name)}</span>
        <span class="chatops-rg-preview">${escapeHtml(preview)}</span>
      `;

      Object.assign(item.style, {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        background: 'transparent',
        border: 'none',
        borderRadius: '8px',
        padding: '7px 10px',
        cursor: 'pointer',
        color: '#fff',
        textAlign: 'left',
        transition: 'background 0.15s ease',
        gap: '2px',
      });

      item.querySelector('.chatops-rg-name').style.cssText = 'font-size:13px;font-weight:600;color:#fff;';
      item.querySelector('.chatops-rg-preview').style.cssText = 'font-size:11px;color:rgba(255,255,255,0.45);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';

      item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.08)'; });
      item.addEventListener('mouseleave', () => { item.style.background = 'transparent'; });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropdown.remove();
        activeReactionDropdown = null;

        if (emojis.length === 0) {
          showToast('⚠️ Nhóm này chưa có emoji nào.');
          return;
        }

        const origHtml = spamBtn.innerHTML;
        spamBtn.innerHTML = '⏳';
        spamBtn.style.opacity = '0.5';
        spamBtn.disabled = true;

        chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.SPAM_POST_REACTIONS,
          postId,
          emojis  // Override: use this group's emojis
        }, (res) => {
          spamBtn.innerHTML = origHtml;
          spamBtn.style.opacity = '1';
          spamBtn.disabled = false;

          if (!res || !res.ok) {
            let errMsg = res?.error || language.unknown;
            if (errMsg.toLowerCase().includes('unable to save reaction') || errMsg.toLowerCase().includes('already reacted')) {
              errMsg = language.reactionAlreadyExists;
            }
            showToast(language.spamErrorPrefix + errMsg);
          } else {
            showToast(`✅ Đã spam ${emojis.length} reaction từ nhóm "${group.name}"!`);
          }
        });
      });

      dropdown.appendChild(item);
    });

    // Position dropdown near the button
    document.body.appendChild(dropdown);
    activeReactionDropdown = dropdown;

    const btnRect = spamBtn.getBoundingClientRect();
    const ddRect = dropdown.getBoundingClientRect();
    let top = btnRect.bottom + 6;
    let left = btnRect.left;

    // Keep within viewport
    if (left + ddRect.width > window.innerWidth - 8) {
      left = window.innerWidth - ddRect.width - 8;
    }
    if (top + ddRect.height > window.innerHeight - 8) {
      top = btnRect.top - ddRect.height - 6;
    }

    dropdown.style.top = `${top}px`;
    dropdown.style.left = `${left}px`;

    // Close on outside click or Escape
    const closeDropdown = (e) => {
      if (!dropdown.contains(e.target)) {
        dropdown.remove();
        activeReactionDropdown = null;
        document.removeEventListener('mousedown', closeDropdown, true);
        document.removeEventListener('keydown', closeOnEsc, true);
      }
    };
    const closeOnEsc = (e) => {
      if (e.key === 'Escape') {
        dropdown.remove();
        activeReactionDropdown = null;
        document.removeEventListener('mousedown', closeDropdown, true);
        document.removeEventListener('keydown', closeOnEsc, true);
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', closeDropdown, true);
      document.addEventListener('keydown', closeOnEsc, true);
    }, 0);
  }

  let lastPathname = window.location.pathname;

  function handleChannelChange() {
    document.querySelectorAll('[data-chatops-injected]').forEach(el => {
      el.removeAttribute('data-chatops-injected');
    });
    document.querySelectorAll('.chatops-action-group').forEach(el => {
      el.remove();
    });
    document.querySelectorAll('.chatops-ext-image-picker-btn, .chatops-ext-template-picker-btn, .chatops-ext-task-create-btn').forEach(el => {
      el.remove();
    });
    document.querySelectorAll('[data-chatops-image-injected], [data-chatops-template-injected], [data-chatops-task-create-injected]').forEach(el => {
      el.removeAttribute('data-chatops-image-injected');
      el.removeAttribute('data-chatops-template-injected');
      el.removeAttribute('data-chatops-task-create-injected');
    });
  }

  let observerTimeout = null;
  let mutatedSubtrees = new Set();
  let emojiButtonMutations = false;

  observer = new MutationObserver((mutations) => {
    // Prevent orphaned scripts from continuing to run after extension update/reload
    try {
      if (!chrome.runtime || !chrome.runtime.id) {
        observer.disconnect();
        return;
      }
    } catch (err) {
      try { observer.disconnect(); } catch (e) {}
      return;
    }

    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      runWithObserverDisabled(() => {
        handleChannelChange();
        injectImageButton();
        injectTemplateButton();
        injectTaskCreateButton();
        injectGroupReminderButton();
        injectMeetCreateButton();
        injectQuickNoteButtons();
        injectHeaderButtons();
      });
      mutatedSubtrees.clear();
      emojiButtonMutations = false;
      return;
    }

    const postSelectorPattern = '.post, [id^="post_"], [id^="rhsPost_"]';

    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a post or inside a post
            const postParent = node.closest ? node.closest(postSelectorPattern) : null;
            if (postParent) {
              mutatedSubtrees.add(postParent);
            } else if (node.querySelectorAll) {
              // It could be a container (e.g. post list) containing posts
              const matches = node.querySelectorAll(postSelectorPattern);
              matches.forEach(match => mutatedSubtrees.add(match));
            }

            // Check if emoji button is added
            if (
              node.id === 'emojiPickerButton' || 
              node.id === 'rhsEmojiPickerButton' ||
              node.matches?.('button[aria-label*="emoji" i], button[class*="emoji" i], .emoji-picker__container button') ||
              (node.querySelector && node.querySelector('#emojiPickerButton, #rhsEmojiPickerButton, button[aria-label*="emoji" i]'))
            ) {
              emojiButtonMutations = true;
            }
          }
        }
      }
    }

    if (mutatedSubtrees.size > 0 || emojiButtonMutations) {
      clearTimeout(observerTimeout);
      observerTimeout = setTimeout(() => {
        const subtreesToProcess = Array.from(mutatedSubtrees);
        const shouldInjectImages = emojiButtonMutations;
        
        // Reset state for next batch
        mutatedSubtrees.clear();
        emojiButtonMutations = false;

        runWithObserverDisabled(() => {
          injectHeaderButtons();
          if (shouldInjectImages) {
            injectImageButton();
            injectTemplateButton();
            injectTaskCreateButton();
            injectGroupReminderButton();
            injectMeetCreateButton();
          }
          if (subtreesToProcess.length > 0) {
            subtreesToProcess.forEach(subtree => {
              if (subtree.isConnected) {
                injectQuickNoteButtons(subtree);
              }
            });
          }
        });
      }, 100);
    }
  });
  
  // --- Listen for reminder notifications from the background script ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MESSAGE_TYPES.SHOW_REMINDER) {
      showReminderBanner(message.message, message.taskId, message.isTask, message.postId, message.teamName, message.isDaily);
    } else if (message.type === 'DISMISS_REMINDER') {
      if (message.taskId) {
        const banner = document.querySelector(`.chatops-reminder-banner[data-task-id="${message.taskId}"]`);
        if (banner) {
          banner.classList.remove('visible');
          banner.remove();
        }
      }
    } else if (message.type === 'APP_LANG_CHANGED') {
      (async () => {
        await loadLanguage();
        const btn = document.getElementById('chatops-ext-floating-btn');
        if (btn) {
          btn.title = language.floatingBtnTitle;
          const closeBtn = document.getElementById('chatops-ext-close-btn');
          if (closeBtn) closeBtn.title = language.floatingBtnHide;
        }
        // Clear cached popover elements so they are rebuilt in the new language
        if (quickNotePopover) {
          quickNotePopover.remove();
          quickNotePopover = null;
        }
        if (quickNoteBackdrop) {
          quickNoteBackdrop.remove();
          quickNoteBackdrop = null;
        }
        if (updateImagePickerTranslations) updateImagePickerTranslations();
        if (updateTemplatePickerTranslations) updateTemplatePickerTranslations();
        if (updateTaskCreateButtonTranslations) updateTaskCreateButtonTranslations();
        if (updateHeaderButtonsTranslations) updateHeaderButtonsTranslations();
        if (updateGroupReminderButtonTranslations) updateGroupReminderButtonTranslations();
        if (updateMeetCreateButtonTranslations) updateMeetCreateButtonTranslations();
        if (updateResizeModalTranslations) updateResizeModalTranslations();
        if (updateImageEditorTranslations) updateImageEditorTranslations();
      })();
    } else if (message.type === 'INSERT_IMAGE_TO_CHAT') {
      insertAndMaybeSend(message.url, true);
    } else if (message.type === 'INSERT_TEXT_TO_CHAT') {
      let textarea = activeChatTextarea;
      if (!textarea) {
        const targetId = imagePickerEl?.dataset.activeTextbox || 'post_textbox';
        textarea = document.getElementById(targetId);
        if (!textarea) {
          if (targetId === 'reply_textbox') {
            textarea = document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]');
          } else {
            textarea = document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]');
          }
        }
      }
      if (textarea) {
        const textToInsert = message.text || '';
        insertTextIntoTextarea(textarea, textToInsert);
      }
    } else if (message.type === MESSAGE_TYPES.GOOGLE_MEET_CREATED) {
      const textboxId = message.payload?.textboxId || 'post_textbox';
      let textarea = document.getElementById(textboxId);
      if (!textarea) {
        if (textboxId === 'reply_textbox') {
          textarea = document.querySelector('#reply_textbox, .sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea, [placeholder*="reply" i]');
        } else {
          textarea = document.querySelector('#post_textbox, .post-create-body textarea, [placeholder*="write" i]');
        }
      }
      if (textarea && message.payload?.meetLink) {
        insertTextIntoTextarea(textarea, message.payload.meetLink);
        showToast(language.meetRoomCreatedToast || 'Đã tạo và chèn link Google Meet! 📹');
      }
    } else if (message.type === 'NAVIGATE_INTERNALLY') {
      if (message.url) {
        let path = message.url;
        if (path.startsWith('http://') || path.startsWith('https://')) {
          try {
            const u = new URL(path);
            path = u.pathname + u.search + u.hash;
          } catch (e) {
            console.error('[ChatOps Ext] Failed to parse internal nav URL:', e);
          }
        }
        window.history.pushState(null, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
        if (message.postId) {
          handleOpenPostThread(message.postId, message.rootId);
        }
      }
      sendResponse({ success: true });
    } else if (message.action === 'open_post_thread') {
      handleOpenPostThread(message.postId, message.rootId);
    } else if (message.type === 'OPEN_QUICK_NOTE_FROM_CONTEXT_MENU') {
      console.log('[ChatOps Ext] Received context menu message with text:', message.text, 'mode:', message.mode);
      const selection = window.getSelection();
      let postEl = null;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        postEl = container.nodeType === Node.ELEMENT_NODE 
          ? container.closest('.post, [id^="post_"], [id^="rhsPost_"]')
          : container.parentElement?.closest('.post, [id^="post_"], [id^="rhsPost_"]');
      }
      console.log('[ChatOps Ext] Resolved postEl:', postEl);
      openQuickNote(postEl, null, message.mode, message.text);
    } else if (message.type === 'SHOW_HOVER_DEMO') {
      showHoverDemo(message.active);
    } else if (message.type === 'TOGGLE_PWA_SIDE_PANEL') {
      togglePwaSidePanel(message.forceState);
    } else if (message.type === 'SHOW_TOAST') {
      showToast(message.message, message.duration);
    } else if (message.type === 'QUICK_REPLY_QUOTE') {
      // Handle reply-and-quote from context menu
      const selectedText = message.text;
      if (!selectedText) return;

      // Format selected text as markdown blockquote
      const quotedText = selectedText
        .split('\n')
        .map(line => `> ${line}`)
        .join('\n') + '\n\n';

      // Check if thread/RHS panel is open and visible
      const replyTextarea = document.getElementById('reply_textbox')
        || document.querySelector('.sidebar-right textarea, .rhs-thread textarea, .sidebar--right textarea');
      const isRhsOpen = !!replyTextarea && replyTextarea.offsetParent !== null;

      if (isRhsOpen) {
        // RHS/thread panel is open -> insert quoted text into RHS reply textbox
        insertTextIntoTextarea(replyTextarea, quotedText);
      } else {
        // RHS/thread panel is not open -> insert quoted text into main chat textbox (outside)
        const mainTextarea = document.getElementById('post_textbox')
          || document.querySelector('.post-create-body textarea, [placeholder*="write" i]');
        if (mainTextarea) {
          insertTextIntoTextarea(mainTextarea, quotedText);
        } else {
          showToast('⚠️ Không tìm thấy khung chat để trả lời.');
        }
      }
    }
  });

  function showHoverDemo(active) {
    document.querySelectorAll('.chatops-hover-active').forEach(el => {
      el.classList.remove('chatops-hover-active');
      el.style.outline = '';
      el.style.outlineOffset = '';
      el.style.borderRadius = '';
      const directAg = el.querySelector(':scope > .chatops-action-group');
      if (directAg) {
        directAg.remove();
      }
      const ag = el.querySelector('.chatops-action-group');
      if (ag) {
        ag.style.display = '';
        ag.style.animation = '';
      }
      delete el.dataset.chatopsInjected;
    });

    if (!active) return;

    const posts = Array.from(document.querySelectorAll('.post, [id^="post_"], [id^="rhsPost_"]'));
    if (posts.length === 0) {
      console.log('[ChatOps Ext] No posts found for hover demo.');
      return;
    }

    const reversedPosts = [...posts].reverse();
    const visiblePost = reversedPosts.find(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      return rect.height > 20 && rect.top < window.innerHeight && rect.bottom > 0;
    }) || posts[posts.length - 1];

    if (!visiblePost) return;

    console.log('[ChatOps Ext] showHoverDemo target post:', visiblePost);

    visiblePost.classList.add('chatops-hover-active');
    delete visiblePost.dataset.chatopsInjected;

    injectQuickNoteButtons(visiblePost);

    visiblePost.style.outline = '3px dashed #1c58d9';
    visiblePost.style.outlineOffset = '-3px';
    visiblePost.style.borderRadius = '8px';

    const ag = visiblePost.querySelector('.chatops-action-group');
    if (ag) {
      ag.style.setProperty('display', 'inline-flex', 'important');
      ag.style.animation = 'chatops-action-pulse 1.5s infinite';
    }

    try {
      visiblePost.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      // Ignore
    }
  }



  observer.observe(document.body, { childList: true, subtree: true });
  
  runWithObserverDisabled(() => {
    injectImageButton();
    injectTemplateButton();
    injectQuickNoteButtons();
    showKanbanIconGuideTooltip();
  });

  async function showKanbanIconGuideTooltip() {
    try {
      const storage = await chrome.storage.local.get(['kanban_icon_guide_shown']);
      if (storage.kanban_icon_guide_shown) return;

      const btn = document.getElementById('chatops-header-kanban-btn');
      if (!btn) {
        // If the header button is not injected yet, retry in 1 second
        setTimeout(showKanbanIconGuideTooltip, 1000);
        return;
      }

      // Add pulse highlight animation to the button
      btn.classList.add('chatops-pulse-highlight');

      // Create guide tooltip
      const tooltip = document.createElement('div');
      tooltip.id = 'chatops-kanban-guide-tooltip';
      tooltip.style.cssText = `
        position: absolute !important;
        background: var(--chatops-accent, #1c58d9) !important;
        color: #ffffff !important;
        padding: 14px 18px !important;
        border-radius: 8px !important;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2) !important;
        width: 290px !important;
        z-index: 1000001 !important;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        animation: chatops-fade-in 0.25s ease-out !important;
        box-sizing: border-box !important;
      `;

      // Setup position
      const updatePosition = () => {
        const currentBtn = document.getElementById('chatops-header-kanban-btn');
        if (currentBtn) {
          const rect = currentBtn.getBoundingClientRect();
          tooltip.style.top = (rect.bottom + window.scrollY + 10) + 'px';
          tooltip.style.left = (rect.left + window.scrollX + rect.width / 2 - 145) + 'px';
          
          // Ensure button continues pulsing even after channel switches and button re-injections
          if (!currentBtn.classList.contains('chatops-pulse-highlight')) {
            currentBtn.classList.add('chatops-pulse-highlight');
          }
        }
      };
      updatePosition();
      window.addEventListener('resize', updatePosition);

      // Periodically update position (e.g. on channel changes or routing layout shifts)
      const positionInterval = setInterval(updatePosition, 1000);

      const isVi = language.app_lang !== 'en';

      tooltip.innerHTML = `
        <div style="position:absolute; top:-6px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-bottom:6px solid var(--chatops-accent, #1c58d9);"></div>
        <div style="font-size:14px; font-weight:700; margin-bottom:6px; text-align:left;">${isVi ? "✨ Bảng Kanban Cá Nhân" : "✨ Personal Kanban Board"}</div>
        <div style="font-size:13px; opacity:0.95; line-height:1.45; text-align:left; word-break:break-word;">
          ${isVi 
            ? "Click vào biểu tượng này hoặc nhấn tổ hợp phím <strong>Ctrl+Shift+K</strong> để mở bảng Kanban bất kỳ lúc nào!"
            : "Click this icon or press <strong>Ctrl+Shift+K</strong> to open your Kanban board at any time!"}
        </div>
        <button class="chatops-guide-close-btn" style="position:absolute; top:8px; right:8px; background:transparent; border:none; color:white; cursor:pointer; font-size:16px; opacity:0.8; font-weight:bold; padding:0; line-height:1; outline:none;">×</button>
      `;

      const dismissGuide = async (permanent = false) => {
        if (permanent) {
          await chrome.storage.local.set({ 
            kanban_welcome_modal_shown: true, // Mark welcome modal as shown too so it never tries to show
            kanban_icon_guide_shown: true 
          });
        }
        clearInterval(positionInterval);
        const currentBtn = document.getElementById('chatops-header-kanban-btn');
        if (currentBtn) {
          currentBtn.classList.remove('chatops-pulse-highlight');
        }
        window.removeEventListener('resize', updatePosition);
        document.removeEventListener('click', headerBtnClickListener);
        tooltip.remove();
      };

      // Dismiss permanently only when click close (x) button
      tooltip.querySelector('.chatops-guide-close-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        dismissGuide(true);
      });

      // Event delegation to catch Kanban button click and temporarily dismiss
      const headerBtnClickListener = (e) => {
        if (e.target.closest('#chatops-header-kanban-btn')) {
          dismissGuide(false);
        }
      };
      document.addEventListener('click', headerBtnClickListener);

      document.body.appendChild(tooltip);

      // Inject custom keyframes for the pulsing highlight
      let pulseStyle = document.getElementById('chatops-pulse-style');
      if (!pulseStyle) {
        pulseStyle = document.createElement('style');
        pulseStyle.id = 'chatops-pulse-style';
        pulseStyle.textContent = `
          @keyframes chatops-pulse-highlight-ani {
            0% { box-shadow: 0 0 0 0 rgba(28, 88, 217, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(28, 88, 217, 0); }
            100% { box-shadow: 0 0 0 0 rgba(28, 88, 217, 0); }
          }
          .chatops-pulse-highlight {
            animation: chatops-pulse-highlight-ani 1.8s infinite !important;
            outline: none !important;
            border-radius: 4px !important;
          }
        `;
        document.head.appendChild(pulseStyle);
      }

    } catch (err) {
      console.error('[ChatOps Ext] Error showing guide tooltip:', err);
    }
  }

  // --- ChatOps PWA Custom Side Panel Fallback (iframe drawer) ---
  let pwaSidePanelContainer = null;
  let pwaSidePanelOpen = false;

  function togglePwaSidePanel(forceState) {
    const shouldOpen = (forceState === undefined) ? !pwaSidePanelOpen : (forceState === 'OPEN');
    if (shouldOpen) {
      openPwaSidePanel();
    } else {
      closePwaSidePanel();
    }
  }

  function openPwaSidePanel() {
    if (pwaSidePanelOpen) return;

    if (!pwaSidePanelContainer) {
      pwaSidePanelContainer = document.createElement('div');
      pwaSidePanelContainer.id = 'chatops-ext-pwa-sidepanel-container';
      
      // Styling the container as a right-hand sliding panel drawer
      pwaSidePanelContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        width: 360px !important;
        height: 100vh !important;
        z-index: 999999 !important;
        box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15) !important;
        border-left: 1px solid var(--border, #e5e7eb) !important;
        background: var(--bg-1, #ffffff) !important;
        transform: translateX(100%) !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        display: block !important;
      `;

      const iframe = document.createElement('iframe');
      iframe.src = chrome.runtime.getURL('sidepanel/sidepanel.html?mode=pwa');
      iframe.style.cssText = `
        width: 100% !important;
        height: 100% !important;
        border: none !important;
        display: block !important;
        background: transparent !important;
      `;

      // Drag resizer bar on the left edge of the sidepanel container
      const resizer = document.createElement('div');
      resizer.id = 'chatops-ext-pwa-resizer';
      resizer.style.cssText = `
        position: absolute !important;
        top: 0 !important;
        left: -3px !important; /* Center active drag zone along left edge */
        width: 8px !important;
        height: 100% !important;
        cursor: ew-resize !important;
        z-index: 1000000 !important;
        background: transparent !important;
      `;

      // Floating resize indicator handle centered vertically on the left edge
      const handle = document.createElement('div');
      handle.id = 'chatops-ext-pwa-resizer-handle';
      handle.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; display: block; color: var(--accent, #1c58d9);">
          <path d="M5 12h14M5 12l4-4m-4 4l4 4m10-8l4 4-4 4"/>
        </svg>
      `;
      handle.style.cssText = `
        position: absolute !important;
        top: 50% !important;
        left: -8px !important; /* Float exactly on the edge */
        transform: translateY(-50%) !important;
        width: 20px !important;
        height: 36px !important;
        background: var(--bg-1, #ffffff) !important;
        border: 1px solid var(--border, #e5e7eb) !important;
        border-radius: 6px 0 0 6px !important;
        box-shadow: -3px 0 10px rgba(0, 0, 0, 0.12) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: ew-resize !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important; /* Mouse events pass to resizer bar */
      `;

      let isResizing = false;

      resizer.addEventListener('mouseenter', () => {
        handle.style.opacity = '1';
        handle.style.visibility = 'visible';
        handle.style.boxShadow = '-3px 0 14px rgba(28, 88, 217, 0.2)';
      });
      resizer.addEventListener('mouseleave', () => {
        if (!isResizing) {
          handle.style.opacity = '0';
          handle.style.visibility = 'hidden';
          handle.style.boxShadow = '-3px 0 10px rgba(0, 0, 0, 0.12)';
        }
      });

      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        handle.style.opacity = '1';
        handle.style.visibility = 'visible';
        handle.style.background = 'var(--accent-dim, rgba(28, 88, 217, 0.08))';
        document.body.style.cursor = 'ew-resize';
        iframe.style.pointerEvents = 'none'; // Prevent iframe from swallowing events during resize
      });

      window.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const newWidth = window.innerWidth - e.clientX;
        const minWidth = 320; // Set a minimum width of 320px
        if (newWidth >= minWidth && newWidth <= window.innerWidth * 0.75) {
          pwaSidePanelContainer.style.width = `${newWidth}px`;
          chrome.storage.local.set({ pwa_sidepanel_width: newWidth });

          const rootEl = document.getElementById('root') || document.body;
          rootEl.style.transition = 'none';
          rootEl.style.marginRight = `${newWidth}px`;
          rootEl.style.width = `calc(100% - ${newWidth}px)`;
        }
      });

      window.addEventListener('mouseup', () => {
        if (isResizing) {
          isResizing = false;
          handle.style.opacity = '0';
          handle.style.visibility = 'hidden';
          handle.style.background = 'var(--bg-1, #ffffff)';
          document.body.style.cursor = '';
          iframe.style.pointerEvents = 'auto';

          const rootEl = document.getElementById('root') || document.body;
          rootEl.style.transition = 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
        }
      });

      resizer.appendChild(handle);
      pwaSidePanelContainer.appendChild(resizer);
      pwaSidePanelContainer.appendChild(iframe);
      document.body.appendChild(pwaSidePanelContainer);
    }

    // Load saved width from local storage and apply shifting
    chrome.storage.local.get(['pwa_sidepanel_width'], (res) => {
      const savedWidth = res.pwa_sidepanel_width || 360;
      if (pwaSidePanelContainer) {
        pwaSidePanelContainer.style.width = `${savedWidth}px`;
      }
      
      const rootEl = document.getElementById('root') || document.body;
      rootEl.style.transition = 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      rootEl.style.marginRight = `${savedWidth}px`;
      rootEl.style.width = `calc(100% - ${savedWidth}px)`;
    });

    // Trigger reflow to ensure the transform transition plays
    pwaSidePanelContainer.getBoundingClientRect();
    pwaSidePanelContainer.style.transform = 'translateX(0)';
    pwaSidePanelOpen = true;
  }

  function closePwaSidePanel() {
    if (!pwaSidePanelOpen || !pwaSidePanelContainer) return;
    pwaSidePanelContainer.style.transform = 'translateX(100%)';
    pwaSidePanelOpen = false;

    // Reset layout squeeze/shift on main page content
    const rootEl = document.getElementById('root') || document.body;
    rootEl.style.transition = 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    rootEl.style.marginRight = '0px';
    rootEl.style.width = '';
  }

  // Listen for close message from the iframe side panel page
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'CLOSE_PWA_SIDE_PANEL') {
      closePwaSidePanel();
    }
  });


  /*
  // Safety net: periodic injection check every 3 seconds to handle React DOM recycling and page state changes
  setInterval(() => {
    if (document.hidden) return;
    if (window.location.pathname !== lastPathname) {
      lastPathname = window.location.pathname;
      runWithObserverDisabled(() => {
        handleChannelChange();
      });
    }
    runWithObserverDisabled(() => {
      injectImageButton();
      injectQuickNoteButtons();
    });
  }, 3000);
  */
})();
