/**
 * Group Reminders Tab Module — ChatOps Chrome Extension
 * Manages scheduled group messages / reminders.
 */

import { escapeHtml, makePermalinkSync, initCommonFlatpickr, formatRichText, formatDateTime, showToast } from '../../src/utils/index.js';
import { CHATOPS_CONFIG, MESSAGE_TYPES, STORAGE_KEYS } from '../../src/constants.js';
import { language } from '../../src/lang.js';

let _state = null;
let currentFilter = 'pending';
let searchQuery = '';
let activeListFlatpickrs = [];
let isLocalUpdate = false;

/**
 * Initializes the Group Reminders Tab
 * @param {Object} state - Centralized state module
 */
export function setup(state) {
  _state = state;

  // Sub-tabs (Pending / Completed)
  const subTabsContainer = document.getElementById('reminderSubTabs');
  if (subTabsContainer) {
    subTabsContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.memo-sub-tab');
      if (!btn) return;
      subTabsContainer.querySelectorAll('.memo-sub-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'pending';
      loadGroupReminders();
    });
  }

  // Search input
  const searchInput = document.getElementById('remindersSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      loadGroupReminders();
    });
  }

  // Clear all completed reminders
  const clearDoneBtn = document.getElementById('btnClearAllReminders');
  if (clearDoneBtn) {
    clearDoneBtn.addEventListener('click', async () => {
      const confirmClear = confirm(language.reminderConfirmClear || 'Bạn có chắc chắn muốn xoá tất cả lịch gửi tin đã hoàn thành?');
      if (confirmClear) {
        const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
        const memos = (res[STORAGE_KEYS.MEMOS] || []).filter(m => !(m.type === 'group_reminder' && m.done));
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
        loadGroupReminders();
      }
    });
  }

  // Event delegation on reminders container
  const container = document.getElementById('groupRemindersList');
  if (container) {
    container.addEventListener('click', (e) => handleReminderClick(e));
  }

  // Auto reload when storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.MEMOS]) {
      if (isLocalUpdate) return;
      loadGroupReminders();
    }
  });
}

/**
 * Loads and renders group reminders
 */
export async function loadGroupReminders() {
  const container = document.getElementById('groupRemindersList');
  if (!container) return;

  // Destroy previous flatpickr instances to prevent memory leaks
  activeListFlatpickrs.forEach(fp => {
    try {
      if (fp && typeof fp.destroy === 'function') fp.destroy();
    } catch (err) {}
  });
  activeListFlatpickrs = [];

  container.querySelectorAll('.flatpickr-input').forEach(el => {
    if (el._flatpickr) {
      try { el._flatpickr.destroy(); } catch (err) {}
    }
  });

  const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
  const allItems = res[STORAGE_KEYS.MEMOS] || [];
  const groupReminders = allItems.filter(m => m.type === 'group_reminder' || m.taskCategory === 'group_reminder');

  const pendingReminders = groupReminders.filter(t => !t.done);
  const doneReminders = groupReminders.filter(t => t.done);

  // Update badge count
  const badgeCount = pendingReminders.length;
  ['reminderTabBadge', 'navReminderTabBadge'].forEach(badgeId => {
    const badgeEl = document.getElementById(badgeId);
    if (badgeEl) badgeEl.textContent = badgeCount > 0 ? badgeCount : '';
  });

  // Filter based on active tab (pending vs done)
  let displayList = currentFilter === 'pending' ? pendingReminders : doneReminders;

  // Apply search query filter
  if (searchQuery) {
    displayList = displayList.filter(item => {
      const title = (item.title || '').toLowerCase();
      const note = (item.note || '').toLowerCase();
      const channel = (item.targetChannelName || '').toLowerCase();
      return title.includes(searchQuery) || note.includes(searchQuery) || channel.includes(searchQuery);
    });
  }

  // Update Clear All button visibility
  const btnClearAllReminders = document.getElementById('btnClearAllReminders');
  if (btnClearAllReminders) {
    btnClearAllReminders.style.display = (currentFilter === 'done' && doneReminders.length > 0) ? 'inline-flex' : 'none';
  }

  const now = Date.now();
  let html = '';

  if (displayList.length === 0) {
    const emptyMsg = currentFilter === 'pending'
      ? (language.noScheduledReminders || 'Không có lịch gửi tin nào đang chờ')
      : (language.noCompletedReminders || 'Chưa có lịch gửi tin nào hoàn thành');
    html = `<div class="empty-state">${escapeHtml(emptyMsg)}</div>`;
  } else {
    html = displayList.map(item => renderReminderCard(item, now)).join('');
  }

  container.innerHTML = html;

  // Handle collapsible note text overflow
  container.querySelectorAll('.memo-item').forEach(card => {
    const textEl = card.querySelector('.memo-note-text');
    const collapseBtn = card.querySelector('.collapse-btn');
    if (textEl && collapseBtn) {
      const isOverflowing = textEl.scrollHeight > textEl.clientHeight + 1;
      if (!isOverflowing) {
        collapseBtn.style.display = 'none';
        const bottomBar = card.querySelector('.collapse-bottom-bar');
        if (bottomBar) bottomBar.style.display = 'none';
      }
    }
  });

  // Re-initialize Flatpickr date pickers for list items
  initFlatpickrOnList(container, allItems);
}

/**
 * Renders a single group reminder card component
 */
function renderReminderCard(task, now) {
  const reminderMs = task.reminder ? new Date(task.reminder).getTime() : null;
  const isOverdue = !task.done && reminderMs && reminderMs < now;

  let reminderDisplayVal = task.reminder || '';
  if (task.repeatDaily && task.reminder) {
    const match = task.reminder.match(/\d{2}:\d{2}/);
    if (match) reminderDisplayVal = match[0];
  }

  const cachedConfig = _state ? _state.getConfig() : null;
  const currentTeam = _state ? _state.getTeam() : null;
  const permalink = task.postId && cachedConfig
    ? makePermalinkSync(task.postId, cachedConfig.chatopsUrl, task.teamName || currentTeam?.name || CHATOPS_CONFIG.DEFAULT_TEAM)
    : null;

  let mentionStr = '';
  if (task.mentionTarget === 'all') mentionStr = '@all';
  else if (task.mentionTarget === 'here') mentionStr = '@here';
  else if (task.mentionTarget === 'users') mentionStr = task.mentionUsers || '';

  const channelName = task.targetChannelName || 'Group';
  const cardTitle = task.title
    ? escapeHtml(task.title)
    : `📢 #${escapeHtml(channelName)}`;

  const taskBodyHtml = formatRichText(task.note || language.taskNoContent);

  return `
    <div class="memo-item task-item ${task.done ? 'memo-done' : ''} ${isOverdue ? 'memo-overdue' : ''}" id="item_${task.id}" style="border-left:3px solid #f59e0b;">
      <div class="memo-item-header" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom: 4px;">
        <div class="memo-content-title-area" style="flex:1; min-width:0;">
          <div class="memo-item-title" style="font-weight:700; font-size:13.5px; color:var(--text-1); letter-spacing:-0.1px; margin:0;">${cardTitle}</div>
        </div>
        <button class="collapse-btn" data-id="${task.id}" style="margin:0; flex-shrink:0;" title="${language.expandCollapseBtn}">▶</button>
      </div>
      <div class="reminder-meta-badges" style="display:flex; flex-wrap:wrap; align-items:center; gap:5px; margin-top:2px; margin-bottom:6px;">
        ${task.title ? `
          <span style="font-size:11px; font-weight:600; color:#d97706; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.22); padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">
            📢 #${escapeHtml(channelName)}
          </span>
        ` : ''}
        ${mentionStr ? `
          <span style="font-size:11px; font-weight:600; color:var(--accent); background:var(--accent-dim); padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:3px;">
            🏷️ ${escapeHtml(mentionStr)}
          </span>
        ` : ''}
        ${task.repeatDaily ? `
          <span class="repeat-daily-badge" style="font-size:10.5px; font-weight:700; color:var(--accent); background:rgba(28,88,217,0.08); padding:1px 6px; border-radius:4px; display:inline-flex; align-items:center; gap:2px; flex-shrink:0; white-space:nowrap;" title="${language.taskRemindDailyLabel}">
            🔄 ${language.repeatDailyBadgeText || 'Hàng ngày'}
          </span>
        ` : ''}
      </div>
      <div class="task-content-row" style="width:100%;">
        <div class="memo-content" style="width:100%; display:flex; flex-direction:column; gap:4px;">
          <div class="memo-note-text task-text collapsible-body collapsed" style="margin-top:0; width:100%;">${taskBodyHtml}</div>
          <div class="collapse-bottom-bar" style="display:none; justify-content:center; padding: 4px 0; margin-top: 6px; border-top: 1px dashed var(--border); width:100%;">
            <button class="btn-collapse-bottom" data-id="${task.id}" style="background:none; border:none; color:var(--accent); font-size:11.5px; cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:700; outline:none; margin:0;" title="${language.collapseBtnBottom}">
              <span>${language.collapseBtnBottom}</span> ▲
            </button>
          </div>
        </div>
      </div>
      <div class="memo-footer" style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
        <div class="memo-meta" style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
          <label class="task-done-badge ${task.done ? 'is-done' : ''}" title="${task.done ? (language.taskMarkIncomplete || 'Đánh dấu chưa xong') : (language.taskMarkDone || 'Đánh dấu hoàn thành')}">
            <div class="memo-checkbox-container footer-checkbox" style="margin: 0; position: relative;">
              <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''}>
              <span class="memo-checkmark-custom"></span>
            </div>
            <span class="task-done-text">
              ${task.done ? (language.reminderSent || 'Đã gửi') : (language.taskMarkDoneShort || 'Hoàn thành')}
            </span>
          </label>
          ${!task.done ? `
            <div class="task-update-reminder-wrapper ${task.reminder ? 'has-reminder' : ''} ${isOverdue ? 'overdue' : ''}" style="margin:0; flex-shrink:0; width:110px;">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" class="reminder-clock-icon"><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/></svg>
              <input type="text" class="task-update-reminder" data-id="${task.id}" value="${reminderDisplayVal}" placeholder="${task.repeatDaily ? 'hh:mm' : 'yyyy-mm-dd hh:mm'}" title="${language.changeReminderTime}" />
            </div>
          ` : ''}
        </div>
        <div class="memo-actions">
          ${permalink ? `<a href="${permalink}" class="post-jump-link" data-post-id="${task.postId || ''}" title="${language.memoViewOriginal}">↗</a>` : ''}
          <button class="btn-edit-memo btn-edit-task" data-id="${task.id}" title="${language.editTask}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none; opacity:0.85;">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="btn-delete-memo btn-delete-task" data-id="${task.id}" title="${language.memoDelete}">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" style="pointer-events:none;">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
              <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Initializes Flatpickr on datetime inputs inside reminder cards
 */
function initFlatpickrOnList(container, allItems) {
  container.querySelectorAll('.task-update-reminder').forEach(el => {
    const id = el.dataset.id;

    const fpInstance = initCommonFlatpickr(el, {
      noCalendar: false,
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      minDate: "today",
      onClose: async (selectedDates, dateStr) => {
        if (selectedDates.length > 0) {
          const selectedTime = selectedDates[0].getTime();
          if (selectedTime < Date.now()) {
            showToast(language.pastDateError);
            loadGroupReminders();
            return;
          }
        }

        const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
        const memos = res[STORAGE_KEYS.MEMOS] || [];
        const taskIndex = memos.findIndex(m => m.id === id);

        if (taskIndex !== -1) {
          const oldReminder = memos[taskIndex].reminder;
          const finalReminder = dateStr || null;

          if (oldReminder === finalReminder) return;

          memos[taskIndex].reminder = finalReminder;
          memos[taskIndex].updatedAt = Date.now();
          isLocalUpdate = true;
          await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
          setTimeout(() => { isLocalUpdate = false; }, 100);

          if (finalReminder) {
            chrome.runtime.sendMessage({
              type: MESSAGE_TYPES.SET_TASK_ALARM,
              taskId: id,
              time: new Date(finalReminder).getTime()
            });
          } else {
            chrome.alarms.clear(id);
          }
        }
        loadGroupReminders();
      }
    });

    if (fpInstance) {
      activeListFlatpickrs.push(fpInstance);
    }
  });
}

/**
 * Handles click interactions on reminder items
 */
async function handleReminderClick(e) {
  // Delete item
  if (e.target.classList.contains('btn-delete-task') || e.target.closest('.btn-delete-task')) {
    const btn = e.target.classList.contains('btn-delete-task') ? e.target : e.target.closest('.btn-delete-task');
    const id = btn.dataset.id;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS, STORAGE_KEYS.SETTINGS]);
    const settings = res[STORAGE_KEYS.SETTINGS] || {};

    if (!settings.quickDelete) {
      if (!confirm(language.confirmDeleteTask || "Bạn có chắc chắn muốn xóa lịch gửi tin này?")) return;
    }

    const memos = (res[STORAGE_KEYS.MEMOS] || []).filter(m => m.id !== id);
    isLocalUpdate = true;
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
    setTimeout(() => { isLocalUpdate = false; }, 100);

    chrome.alarms.clear(id);
    chrome.runtime.sendMessage({ type: 'DISMISS_REMINDER', taskId: id }).catch(() => {});
    loadGroupReminders();
    return;
  }

  // Done checkbox toggle
  if (e.target.classList.contains('task-checkbox')) {
    const id = e.target.dataset.id;
    const isChecked = e.target.checked;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const task = memos.find(m => m.id === id);

    if (task) {
      task.done = isChecked;
      task.doneAt = isChecked ? Date.now() : null;
      isLocalUpdate = true;
      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
      setTimeout(() => { isLocalUpdate = false; }, 100);

      if (isChecked) {
        chrome.alarms.clear(id);
        chrome.runtime.sendMessage({ type: 'DISMISS_REMINDER', taskId: id }).catch(() => {});
      } else if (task.reminder) {
        const reminderTime = new Date(task.reminder).getTime();
        const targetTime = reminderTime > Date.now() ? reminderTime : Date.now() + 5 * 60 * 1000;
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId: id, time: targetTime });
      }
      loadGroupReminders();
    }
    return;
  }

  // Expand / Collapse card
  const collapseBtn = e.target.closest('.collapse-btn') || e.target.closest('.btn-collapse-bottom');
  if (collapseBtn) {
    const id = collapseBtn.dataset.id;
    const card = document.getElementById('item_' + id);
    if (card) {
      const textEl = card.querySelector('.memo-note-text');
      const headerBtn = card.querySelector('.collapse-btn');
      const bottomBar = card.querySelector('.collapse-bottom-bar');
      if (textEl) {
        const isCollapsed = textEl.classList.contains('collapsed');
        if (isCollapsed) {
          textEl.classList.remove('collapsed');
          if (headerBtn) headerBtn.textContent = '▼';
          if (bottomBar) bottomBar.style.display = 'flex';
        } else {
          textEl.classList.add('collapsed');
          if (headerBtn) headerBtn.textContent = '▶';
          if (bottomBar) bottomBar.style.display = 'none';
        }
      }
    }
    return;
  }

  // Edit trigger
  const btnEdit = e.target.closest('.btn-edit-task');
  if (btnEdit) {
    const id = btnEdit.dataset.id;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const task = memos.find(m => m.id === id);

    if (task) {
      const card = document.getElementById('item_' + id);
      if (!card) return;
      const contentEl = card.querySelector('.memo-content');
      if (contentEl) {
        const actionsEl = card.querySelector('.memo-actions');
        if (actionsEl) actionsEl.style.display = 'none';

        contentEl.innerHTML = `
          <div class="inline-edit-form" style="margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
            <textarea class="inline-edit-textarea" rows="6" style="width: 100%; min-height: 120px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; outline: none; background: #fff; resize: vertical; color: var(--text-1);">${escapeHtml(task.note)}</textarea>
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn btn-secondary inline-edit-cancel" data-id="${id}" style="padding: 4px 10px; font-size: 11.5px; height: 26px; border-radius: 6px; cursor:pointer;">${language.cancel || 'Hủy'}</button>
              <button class="btn btn-primary inline-edit-save" data-id="${id}" style="padding: 4px 10px; font-size: 11.5px; height: 26px; border-radius: 6px; cursor:pointer; color:#fff;">${language.save || 'Lưu'}</button>
            </div>
          </div>
        `;
      }
    }
    return;
  }

  // Cancel inline edit
  if (e.target.classList.contains('inline-edit-cancel')) {
    loadGroupReminders();
    return;
  }

  // Save inline edit
  if (e.target.classList.contains('inline-edit-save')) {
    const id = e.target.dataset.id;
    const card = document.getElementById('item_' + id);
    const textarea = card ? card.querySelector('.inline-edit-textarea') : null;
    if (textarea) {
      const newText = textarea.value.trim();
      if (!newText) {
        showToast(language.taskEmptyError || "Nội dung không được để trống");
        return;
      }
      const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
      const memos = res[STORAGE_KEYS.MEMOS] || [];
      const task = memos.find(m => m.id === id);
      if (task) {
        task.note = newText;
        task.updatedAt = Date.now();
        isLocalUpdate = true;
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
        setTimeout(() => { isLocalUpdate = false; }, 100);
      }
      loadGroupReminders();
    }
  }
}
