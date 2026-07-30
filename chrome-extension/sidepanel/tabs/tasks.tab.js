/**
 * Tasks Tab Module — ChatOps Chrome Extension
 * Manages To-Do tasks with reminders.
 */

import { escapeHtml, makePermalinkSync, formatUnixMsToVN, formatRelativeTime, initCommonFlatpickr, formatRichText, formatDateTime, showToast } from '../../src/utils/index.js';
import { CHATOPS_CONFIG, MESSAGE_TYPES, UI_CONFIG, STORAGE_KEYS, TABS } from '../../src/constants.js';
import { language } from '../../src/lang.js';
import { getMyChannels } from '../../src/api/index.js';

let _state = null;
let currentFilter = 'pending';
let currentCatFilter = 'all';
let isLocalTaskUpdate = false;
let activeListFlatpickrs = [];
let hasShownMissedDigest = false;

async function getTargetTeamName(stateInstance) {
  if (!stateInstance) return CHATOPS_CONFIG.DEFAULT_TEAM;
  const currentTeam = stateInstance.getTeam();
  if (currentTeam && currentTeam.id !== 'all' && currentTeam.name) {
    return currentTeam.name;
  }
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs[0] && tabs[0].url) {
      const url = new URL(tabs[0].url);
      const host = url.host;
      if (host.includes('chat.runsystem.vn') || host.includes('localhost') || host.includes('127.0.0.1')) {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0) {
          const potentialTeamName = pathParts[0];
          const teams = stateInstance.getTeams() || [];
          const matchedTeam = teams.find(t => t.name === potentialTeamName);
          if (matchedTeam) {
            return matchedTeam.name;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error getting team name from URL:', err);
  }
  const teams = stateInstance.getTeams() || [];
  if (teams.length > 0 && teams[0].name && teams[0].id !== 'all') {
    return teams[0].name;
  }
  const cachedConfig = stateInstance.getConfig();
  return cachedConfig?.teamName || CHATOPS_CONFIG.DEFAULT_TEAM;
}

/**
 * Initializes the Tasks Tab
 * @param {Object} state - Centralized state module
 */
export function setup(state) {
  _state = state;

  const quickInput = document.getElementById('quickTaskInput');
  const quickTitleInput = document.getElementById('quickTaskTitle');
  const quickSaveBtn = document.getElementById('btnQuickTaskSave');
  const reminderInput = document.getElementById('quickTaskReminderDt');
  const reminderRow = document.getElementById('quickTaskReminderRow');
  const presetSelect = document.getElementById('quickTaskReminderSelect');
  const categorySelect = document.getElementById('quickTaskCategory');
  const checklistBuilder = document.getElementById('quickTaskChecklistBuilder');
  const checklistContainer = document.getElementById('checklistInputsContainer');
  const addChecklistItemBtn = document.getElementById('btnAddChecklistItem');
  const taskInputRow = quickInput?.closest('.task-quick-input-row');
  
  const repeatDailyCheckbox = document.getElementById('quickTaskRemindDaily');
  const groupReminderFields = document.getElementById('quickTaskGroupReminderFields');
  const reminderChannelSelect = document.getElementById('quickTaskReminderChannel');
  const reminderMentionSelect = document.getElementById('quickTaskReminderMention');
  const reminderUsersRow = document.getElementById('quickTaskReminderUsersRow');
  const reminderUsersInput = document.getElementById('quickTaskReminderUsersInput');

  function syncReminderDimming() {
    // Both "Nhắc" and "Nhắc sau" can be selected independently — no dimming needed
    const customSelect = presetSelect?.nextElementSibling;
    if (reminderRow) reminderRow.style.opacity = '1';
    if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
      customSelect.style.opacity = '1';
    }
  }

  function clearReminderErrorHighlight() {
    if (reminderRow) {
      reminderRow.style.borderColor = '';
      reminderRow.style.boxShadow = '';
    }
    const customSelect = presetSelect?.nextElementSibling;
    if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
      const toggleBtn = customSelect.querySelector('.custom-dropdown-toggle');
      if (toggleBtn) {
        toggleBtn.style.borderColor = '';
        toggleBtn.style.boxShadow = '';
      }
    }
  }

  function togglePresetReminderVisibility(isDaily) {
    const orLabel = document.getElementById('quickTaskOrLabel');
    const customSelect = presetSelect?.nextElementSibling;

    if (isDaily) {
      if (orLabel) orLabel.style.display = 'none';
      if (presetSelect) presetSelect.style.display = 'none';
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        customSelect.style.display = 'none';
      }
      if (presetSelect) {
        presetSelect.value = '';
        if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
          const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
          if (selectedText) selectedText.textContent = 'Remind in...';
        }
      }
    } else {
      if (orLabel) orLabel.style.display = 'inline-flex';
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        customSelect.style.display = 'block';
        if (presetSelect) presetSelect.style.display = 'none';
      } else {
        if (presetSelect) presetSelect.style.display = 'block';
      }
    }
  }

  let fpQuick = null;
  function initQuickFlatpickr(noCalendarMode = false) {
    if (fpQuick) {
      try {
        fpQuick.destroy();
      } catch (e) {}
    }
    if (!reminderInput) return;
    fpQuick = initCommonFlatpickr(reminderInput, {
      noCalendar: noCalendarMode,
      enableTime: true,
      dateFormat: noCalendarMode ? "H:i" : "Y-m-d H:i",
      minDate: "today",
      onChange: function(selectedDates) {
        if (selectedDates.length > 0) {
          clearReminderErrorHighlight();
          if (presetSelect) {
            presetSelect.value = '';
            const customSelect = presetSelect.nextElementSibling;
            if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
              const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
              if (selectedText) selectedText.textContent = 'Remind in...';
            }
          }
        }
        syncReminderDimming();
      },
      onOpen: function() {
        syncReminderDimming();
      }
    });
  }

  if (repeatDailyCheckbox && reminderInput) {
    repeatDailyCheckbox.addEventListener('change', () => {
      const isChecked = repeatDailyCheckbox.checked;
      const currentVal = reminderInput.value;
      
      initQuickFlatpickr(isChecked);
      togglePresetReminderVisibility(isChecked);
      
      if (currentVal) {
        if (isChecked) {
          // If we had a full date, extract only the time
          const match = currentVal.match(/\d{2}:\d{2}/);
          if (match) {
            fpQuick.setDate(match[0], false);
          } else {
            fpQuick.clear();
          }
        } else {
          // If we had a time only, default it to today's date with that time
          const match = currentVal.match(/^(\d{2}):(\d{2})$/);
          if (match) {
            const today = new Date();
            today.setHours(parseInt(match[1], 10), parseInt(match[2], 10), 0, 0);
            fpQuick.setDate(today, false);
          } else {
            fpQuick.clear();
          }
        }
      }
      syncReminderDimming();
    });
  }

  // Initialize Flatpickr initially
  initQuickFlatpickr(repeatDailyCheckbox ? repeatDailyCheckbox.checked : false);

  if (reminderRow && reminderInput) {
    reminderRow.addEventListener('click', (e) => {
      clearReminderErrorHighlight();
      syncReminderDimming();
      if (e.target !== reminderInput && fpQuick) {
        const calendarContainer = fpQuick.calendarContainer;
        if (calendarContainer && calendarContainer.contains(e.target)) {
          return;
        }
        fpQuick.open();
      }
    });
  }

  if (presetSelect && reminderInput) {
    presetSelect.addEventListener('change', () => {
      clearReminderErrorHighlight();
      const val = presetSelect.value;
      if (!val) {
        syncReminderDimming();
        return;
      }
      if (fpQuick) fpQuick.clear();
      syncReminderDimming();
    });

    if (typeof window.convertToCustomDropdown === 'function') {
      window.convertToCustomDropdown('quickTaskReminderSelect', '115px');
      window.convertToCustomDropdown('quickTaskCategory', '140px');
      window.convertToCustomDropdown('quickTaskReminderMention', '140px');
      window.convertToCustomDropdown('quickTaskReminderChannel');
    }

    // Initialize toggle state after custom dropdown is built
    togglePresetReminderVisibility(repeatDailyCheckbox ? repeatDailyCheckbox.checked : false);

    const customSelect = presetSelect?.nextElementSibling;
    if (customSelect) {
      customSelect.addEventListener('click', () => {
        clearReminderErrorHighlight();
        if (fpQuick) fpQuick.clear();
        syncReminderDimming();
      });
    }
  }

    // Checklist builder helpers
    function updateAddButtonState() {
      if (!addChecklistItemBtn) return;
      const currentRows = checklistContainer?.querySelectorAll('.checklist-builder-row') || [];
      if (currentRows.length >= 10) {
        addChecklistItemBtn.style.display = 'none';
      } else {
        addChecklistItemBtn.style.display = 'inline-flex';
      }
    }

    function updateChecklistRowPlaceholders() {
      if (!checklistContainer) return;
      const inputs = checklistContainer.querySelectorAll('.checklist-builder-input');
      const placeholderText = language.checklistPlaceholder || 'Checklist item {num}...';
      inputs.forEach((input, index) => {
        input.placeholder = placeholderText.replace('{num}', index + 1);
      });
    }

    function addChecklistRow(defaultValue = '') {
      if (!checklistContainer) return;
      const currentRows = checklistContainer.querySelectorAll('.checklist-builder-row');
      if (currentRows.length >= 10) return;

      const row = document.createElement('div');
      row.className = 'checklist-builder-row';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.width = '100%';

      const checkboxSpan = document.createElement('span');
      checkboxSpan.style.fontSize = '14px';
      checkboxSpan.style.color = 'var(--text-3)';
      checkboxSpan.style.fontWeight = '500';
      checkboxSpan.style.userSelect = 'none';
      checkboxSpan.textContent = '⬜';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'checklist-builder-input';
      if (defaultValue) {
        input.value = defaultValue;
      }
      const placeholderText = language.checklistPlaceholder || 'Checklist item {num}...';
      input.placeholder = placeholderText.replace('{num}', currentRows.length + 1);
      input.style.flex = '1';
      input.style.height = '32px';
      input.style.fontSize = '12.5px';
      input.style.borderRadius = '6px';
      input.style.border = '1px solid var(--border)';
      input.style.padding = '4px 8px';
      input.style.outline = 'none';
      input.style.boxSizing = 'border-box';
      input.style.fontFamily = 'inherit';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn-remove-checklist-row';
      removeBtn.innerHTML = '&times;';
      removeBtn.style.background = 'none';
      removeBtn.style.border = 'none';
      removeBtn.style.fontSize = '16px';
      removeBtn.style.color = 'var(--text-3)';
      removeBtn.style.cursor = 'pointer';
      removeBtn.style.padding = '4px';
      removeBtn.style.display = 'inline-flex';
      removeBtn.style.alignItems = 'center';
      removeBtn.style.justifyContent = 'center';
      removeBtn.style.height = '24px';
      removeBtn.style.width = '24px';
      removeBtn.style.lineHeight = '1';
      removeBtn.style.transition = 'color 0.2s';

      removeBtn.addEventListener('mouseenter', () => removeBtn.style.color = 'var(--danger)');
      removeBtn.addEventListener('mouseleave', () => removeBtn.style.color = 'var(--text-3)');

      removeBtn.addEventListener('click', () => {
        row.remove();
        updateChecklistRowPlaceholders();
        updateSaveButtonState();
        updateAddButtonState();
      });

      input.addEventListener('input', () => {
        updateSaveButtonState();
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const rows = Array.from(checklistContainer.querySelectorAll('.checklist-builder-row'));
          const idx = rows.indexOf(row);
          if (idx < rows.length - 1) {
            rows[idx + 1].querySelector('.checklist-builder-input')?.focus();
          } else {
            if (rows.length < 10) {
              addChecklistRow();
              const newRows = checklistContainer.querySelectorAll('.checklist-builder-row');
              newRows[newRows.length - 1].querySelector('.checklist-builder-input')?.focus();
            }
          }
        }
      });

      row.appendChild(checkboxSpan);
      row.appendChild(input);
      row.appendChild(removeBtn);
      checklistContainer.appendChild(row);

      updateAddButtonState();
    }

    function initChecklistBuilder() {
      if (!checklistContainer) return;
      checklistContainer.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        addChecklistRow();
      }
    }

    let _channelsLoaded = false;
    async function loadReminderChannels() {
      if (!reminderChannelSelect) return;
      reminderChannelSelect.innerHTML = `<option value="">${language.loading || 'Loading...'}</option>`;
      if (typeof window.convertToCustomDropdown === 'function') {
        window.convertToCustomDropdown(reminderChannelSelect);
      }

      try {
        const team = _state.getTeam();
        let channels = [];
        if (team && team.id) {
          if (team.id === 'all') {
            const teams = _state.getTeams() || [];
            const lists = await Promise.all(teams.map(t => getMyChannels(t.id).catch(() => [])));
            const all = lists.flat();
            const seen = new Set();
            channels = all.filter(c => {
              if (!c || !c.id || seen.has(c.id)) return false;
              seen.add(c.id);
              return true;
            });
          } else {
            channels = await getMyChannels(team.id);
          }
        }

        channels.sort((a, b) => {
          const nameA = (a.display_name || a.name || '').toLowerCase();
          const nameB = (b.display_name || b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });

        let optionsHtml = `<option value="">${language.selectChannelPlaceholder || 'Chọn Group...'}</option>`;
        channels.forEach(ch => {
          let displayName = ch.display_name || ch.name;
          if (ch.type === 'D') {
            displayName = `👤 ${displayName}`;
          } else if (ch.type === 'P') {
            displayName = `🔒 ${displayName}`;
          } else {
            displayName = `🌐 ${displayName}`;
          }
          optionsHtml += `<option value="${ch.id}">${escapeHtml(displayName)}</option>`;
        });

        reminderChannelSelect.innerHTML = optionsHtml;
        _channelsLoaded = true;

      } catch (e) {
        console.error('[ChatOps Ext] Failed to load channels for group reminder:', e);
        reminderChannelSelect.innerHTML = `<option value="">⚠️ Error loading channels</option>`;
      } finally {
        if (typeof window.convertToCustomDropdown === 'function') {
          window.convertToCustomDropdown(reminderChannelSelect);
        }
      }
    }

    function handleCategoryChange() {
      const category = categorySelect?.value || 'normal';
      const repeatDailyRow = repeatDailyCheckbox?.closest('.task-reminder-repeat-row');

      if (category === 'checklist') {
        if (taskInputRow) taskInputRow.style.display = 'none';
        if (checklistBuilder) checklistBuilder.style.display = 'flex';
        if (groupReminderFields) groupReminderFields.style.display = 'none';
        if (repeatDailyRow) repeatDailyRow.style.display = 'flex';
        if (repeatDailyCheckbox) repeatDailyCheckbox.disabled = false;
        
        // Populate checklist builder from textarea if it has content
        const rawText = quickInput?.value?.trim() || '';
        if (rawText) {
          const lines = rawText.split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')).filter(Boolean);
          if (lines.length > 0) {
            checklistContainer.innerHTML = '';
            lines.slice(0, 10).forEach(line => {
              addChecklistRow(line);
            });
            updateAddButtonState();
          }
        }
        
        const inputs = checklistContainer?.querySelectorAll('.checklist-builder-input') || [];
        if (inputs.length === 0) {
          initChecklistBuilder();
        }
        
        const isDaily = repeatDailyCheckbox ? repeatDailyCheckbox.checked : false;
        initQuickFlatpickr(isDaily);
        togglePresetReminderVisibility(isDaily);
      } else if (category === 'group_reminder') {
        if (taskInputRow) taskInputRow.style.display = 'block';
        if (checklistBuilder) checklistBuilder.style.display = 'none';
        if (groupReminderFields) groupReminderFields.style.display = 'flex';
        
        if (repeatDailyCheckbox) {
          repeatDailyCheckbox.checked = true;
          repeatDailyCheckbox.disabled = true;
        }
        if (repeatDailyRow) {
          repeatDailyRow.style.display = 'none';
        }
        
        initQuickFlatpickr(true);
        togglePresetReminderVisibility(true);
        
        loadReminderChannels();
      } else {
        if (taskInputRow) taskInputRow.style.display = 'block';
        if (checklistBuilder) checklistBuilder.style.display = 'none';
        if (groupReminderFields) groupReminderFields.style.display = 'none';
        if (repeatDailyRow) repeatDailyRow.style.display = 'flex';
        if (repeatDailyCheckbox) repeatDailyCheckbox.disabled = false;
        
        const isDaily = repeatDailyCheckbox ? repeatDailyCheckbox.checked : false;
        initQuickFlatpickr(isDaily);
        togglePresetReminderVisibility(isDaily);
      }
      updateSaveButtonState();
    }

    if (categorySelect) {
      categorySelect.addEventListener('change', handleCategoryChange);
    }

    if (reminderMentionSelect && reminderUsersRow) {
      reminderMentionSelect.addEventListener('change', () => {
        if (reminderMentionSelect.value === 'users') {
          reminderUsersRow.style.display = 'flex';
        } else {
          reminderUsersRow.style.display = 'none';
        }
      });
    }

    if (addChecklistItemBtn) {
      addChecklistItemBtn.addEventListener('click', () => {
        addChecklistRow();
        const inputs = checklistContainer?.querySelectorAll('.checklist-builder-input') || [];
        if (inputs.length > 0) {
          inputs[inputs.length - 1].focus();
        }
      });
    }

    function resetTaskForm() {
      try {
        if (quickInput) {
          quickInput.value = '';
          quickInput.style.height = 'auto';
        }
        if (quickTitleInput) {
          quickTitleInput.value = '';
        }
        
        const repeatDailyCheckbox = document.getElementById('quickTaskRemindDaily');
        if (repeatDailyCheckbox) {
          repeatDailyCheckbox.checked = false;
          repeatDailyCheckbox.disabled = false;
          const repeatDailyRow = repeatDailyCheckbox.closest('.task-reminder-repeat-row');
          if (repeatDailyRow) repeatDailyRow.style.display = 'flex';
        }

        if (reminderChannelSelect) {
          reminderChannelSelect.value = '';
          if (typeof window.convertToCustomDropdown === 'function') {
            window.convertToCustomDropdown(reminderChannelSelect);
          }
        }
        if (reminderMentionSelect) {
          reminderMentionSelect.value = 'none';
          if (typeof window.convertToCustomDropdown === 'function') {
            window.convertToCustomDropdown(reminderMentionSelect);
          }
        }
        if (reminderUsersInput) {
          reminderUsersInput.value = '';
        }
        if (reminderUsersRow) {
          reminderUsersRow.style.display = 'none';
        }

        initQuickFlatpickr(false);
        if (categorySelect) {
          categorySelect.value = 'normal';
          const customSelect = categorySelect.nextElementSibling;
          if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
            const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
            if (selectedText) {
              selectedText.textContent = language.categoryNormal || 'Normal';
            }
          }
        }
        if (fpQuick && typeof fpQuick.clear === 'function') {
          try {
            fpQuick.clear();
          } catch (e) {}
        }
        if (presetSelect) {
          presetSelect.value = '';
          const customSelect = presetSelect.nextElementSibling;
          if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
            const selectedText = customSelect.querySelector('.custom-dropdown-selected-text');
            if (selectedText) selectedText.textContent = language.remindInPreset || 'Nhắc sau...';
          }
        }
        if (checklistContainer) {
          checklistContainer.innerHTML = '';
        }
        handleCategoryChange();
        syncReminderDimming();
        updateSaveButtonState();
      } catch (err) {
        console.warn('[ChatOps Ext] Error in resetTaskForm:', err);
      }
    }

  const autoExpand = (el) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  };

  const updateSaveButtonState = () => {
    const category = categorySelect?.value || 'normal';
    let hasContent = false;
    if (category === 'checklist') {
      const inputs = Array.from(checklistContainer?.querySelectorAll('.checklist-builder-input') || []);
      hasContent = inputs.some(input => input.value.trim().length > 0);
    } else {
      hasContent = quickInput?.value?.trim()?.length > 0;
    }

    if (hasContent) {
      quickSaveBtn.style.opacity = '1';
      quickSaveBtn.style.cursor = 'pointer';
    } else {
      quickSaveBtn.style.opacity = '0.5';
      quickSaveBtn.style.cursor = 'not-allowed';
    }
  };

  if (quickInput) {
    quickInput.addEventListener('input', () => {
      updateSaveButtonState();
      autoExpand(quickInput);
    });
  }
  updateSaveButtonState();

  const saveTask = async () => {
    const titleText = quickTitleInput ? quickTitleInput.value.trim() : '';
    const taskCat = categorySelect?.value || 'normal';
    let text = '';
    let checklistItems = [];

    if (taskCat === 'checklist') {
      const inputs = Array.from(checklistContainer?.querySelectorAll('.checklist-builder-input') || []);
      const vals = inputs.map(i => i.value.trim()).filter(v => v !== '');
      if (vals.length === 0) {
        const firstInput = checklistContainer?.querySelector('.checklist-builder-input');
        if (firstInput) {
          firstInput.style.borderColor = 'var(--danger)';
          firstInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
          firstInput.focus();
          setTimeout(() => {
            firstInput.style.borderColor = '';
            firstInput.style.boxShadow = '';
          }, 1500);
        }
        return;
      }
      text = vals.join('\n');
      const id = `task_${Date.now()}`;
      checklistItems = vals.map((lineText, idx) => ({ id: `${id}_line_${idx}`, text: lineText, done: false }));
    } else if (taskCat === 'group_reminder') {
      text = quickInput.value.trim();
      if (!text) {
        quickInput.style.borderColor = 'var(--danger)';
        quickInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
        quickInput.focus();
        setTimeout(() => {
          quickInput.style.borderColor = '';
          quickInput.style.boxShadow = '';
        }, 1500);
        return;
      }
      
      // Validate channel selection
      if (!reminderChannelSelect || !reminderChannelSelect.value) {
        const channelDropdown = reminderChannelSelect?.nextElementSibling;
        if (channelDropdown && channelDropdown.classList.contains('custom-dropdown-container')) {
          const toggleBtn = channelDropdown.querySelector('.custom-dropdown-toggle');
          if (toggleBtn) {
            toggleBtn.style.borderColor = 'var(--danger)';
            toggleBtn.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
            toggleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
              toggleBtn.style.borderColor = '';
              toggleBtn.style.boxShadow = '';
            }, 1500);
          }
        }
        return;
      }
      
      // Validate tag users
      if (reminderMentionSelect?.value === 'users' && (!reminderUsersInput || !reminderUsersInput.value.trim())) {
        if (reminderUsersInput) {
          reminderUsersInput.style.borderColor = 'var(--danger)';
          reminderUsersInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
          reminderUsersInput.focus();
          setTimeout(() => {
            reminderUsersInput.style.borderColor = '';
            reminderUsersInput.style.boxShadow = '';
          }, 1500);
        }
        return;
      }
    } else {
      text = quickInput.value.trim();
      if (!text) {
        quickInput.style.borderColor = 'var(--danger)';
        quickInput.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
        quickInput.focus();
        setTimeout(() => {
          quickInput.style.borderColor = '';
          quickInput.style.boxShadow = '';
        }, 1500);
        return;
      }
    }

    const repeatDailyCheckbox = document.getElementById('quickTaskRemindDaily');
    const isRepeatDaily = repeatDailyCheckbox ? repeatDailyCheckbox.checked : false;

    let reminderVal = reminderInput?.value || null;
    const presetVal = presetSelect?.value;
    if (!reminderVal && presetVal) {
      const mins = parseInt(presetVal, 10);
      if (!isNaN(mins)) {
        reminderVal = formatDateTime(new Date(Date.now() + mins * 60 * 1000));
      }
    }

    // Bắt buộc phải chọn thời gian nhắc nhở
    if (!reminderVal) {
      // Highlight both reminder inputs to guide user
      if (reminderRow) {
        reminderRow.style.borderColor = 'var(--danger)';
        reminderRow.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
        reminderRow.style.borderRadius = '6px';
        reminderRow.style.transition = 'all 0.2s';
      }
      const customSelect = presetSelect?.nextElementSibling;
      if (customSelect && customSelect.classList.contains('custom-dropdown-container')) {
        const toggleBtn = customSelect.querySelector('.custom-dropdown-toggle');
        if (toggleBtn) {
          toggleBtn.style.borderColor = 'var(--danger)';
          toggleBtn.style.boxShadow = '0 0 0 2px rgba(208, 69, 76, 0.2)';
          toggleBtn.style.transition = 'all 0.2s';
        }
      }
      return;
    }

    // Chặn không cho chọn thời gian ở quá khứ
    if (reminderVal && !isRepeatDaily) {
      const selectedTime = new Date(reminderVal).getTime();
      if (!isNaN(selectedTime) && selectedTime < Date.now()) {
        showToast(language.pastDateError);
        if (reminderRow) {
          reminderRow.style.borderColor = 'var(--danger)';
          reminderRow.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.2)';
          reminderRow.style.borderRadius = '6px';
          reminderRow.style.transition = 'all 0.2s';
        }
        return;
      }
    }

    if (reminderVal && isRepeatDaily && reminderVal.length === 5 && reminderVal.includes(':')) {
      const today = new Date();
      const parts = reminderVal.split(':');
      today.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      if (today.getTime() <= Date.now()) {
        today.setDate(today.getDate() + 1);
      }
      reminderVal = formatDateTime(today);
    }

    const id = `task_${Date.now()}`;
    const item = {
      id,
      type: taskCat === 'group_reminder' ? 'group_reminder' : 'task',
      postId: null,
      postText: null,
      title: titleText || '',
      note: text,
      createdAt: Date.now(),
      done: false,
      reminder: reminderVal,
      repeatDaily: isRepeatDaily,
      status: 'pending',
      teamName: await getTargetTeamName(_state),
      taskCategory: taskCat,
      checklist: taskCat === 'checklist' ? checklistItems : [],
      targetChannelId: taskCat === 'group_reminder' ? reminderChannelSelect.value : null,
      targetChannelName: taskCat === 'group_reminder' ? (reminderChannelSelect.options[reminderChannelSelect.selectedIndex]?.textContent || '').replace(/^[👤🔒🌐]\s*/, '') : null,
      mentionTarget: taskCat === 'group_reminder' ? reminderMentionSelect.value : null,
      mentionUsers: (taskCat === 'group_reminder' && reminderMentionSelect.value === 'users') ? reminderUsersInput.value.trim() : null
    };

    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    memos.unshift(item);
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });

    resetTaskForm();

    if (item.reminder) {
      const startTime = new Date(item.reminder).getTime();
      if (!isNaN(startTime)) {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId: id, time: startTime });
      }
    }
    
    loadTasks();

    if (window.ModalManager) {
      window.ModalManager.close();
    }
  };

  if (quickInput) {
    quickInput.addEventListener('keydown', e => { 
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        saveTask(); 
      }
    });
  }
  if (quickSaveBtn) {
    quickSaveBtn.addEventListener('click', saveTask);
  }

  const cancelBtn = document.getElementById('btnCancelTask');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      try {
        resetTaskForm();
      } catch (err) {
        console.error('[ChatOps Ext] Error in cancel button handler:', err);
      }
      if (window.ModalManager) {
        window.ModalManager.close();
      }
    });
  }

  // Handle toggle collapse
  const btnToggle = document.getElementById('btnToggleTasks');
  const tasksForm = document.getElementById('spTasksForm');
  if (btnToggle && tasksForm) {
    btnToggle.addEventListener('click', () => {
      tasksForm.classList.toggle('collapsed');
      btnToggle.classList.toggle('collapsed');
    });
  }



  // Sub-tabs
  document.querySelectorAll('#taskSubTabs .memo-sub-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#taskSubTabs .memo-sub-tab').forEach(b => b.classList.remove('active'));
      const clickedBtn = e.target.closest('.memo-sub-tab') || e.target;
      clickedBtn.classList.add('active');
      currentFilter = clickedBtn.dataset.filter;
      loadTasks();
    });
  });

  // Clear All Tasks
  const btnClearAllTasks = document.getElementById('btnClearAllTasks');
  if (btnClearAllTasks) {
    btnClearAllTasks.addEventListener('click', async () => {
      const confirmMsg = currentFilter === 'pending'
        ? language.confirmClearPendingTasks
        : language.confirmClearCompletedTasks;
      if (!confirm(confirmMsg)) return;
      const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
      const allMemos = res[STORAGE_KEYS.MEMOS] || [];
      const memos = allMemos.filter(m => {
        if (m.type !== 'task') return true;
        if (currentFilter === 'pending') {
          return m.done; // Keep completed tasks, remove pending
        } else {
          return !m.done; // Keep pending tasks, remove completed
        }
      });
      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
      loadTasks();
    });
  }

  // Task search input listener
  const tasksSearchInput = document.getElementById('tasksSearchInput');
  if (tasksSearchInput) {
    tasksSearchInput.addEventListener('input', () => {
      loadTasks();
    });
  }

  // Event delegation for task list click
  document.getElementById('taskList').addEventListener('click', async (e) => {
    await handleTaskClick(e, 'tasks');
  });

  // Reload when tab is clicked
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === TABS.TASKS) btn.addEventListener('click', loadTasks);
  });

  // Listen to storage changes reactively to reload tasks list
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.MEMOS]) {
      if (isLocalTaskUpdate) return;
      loadTasks();
    }
  });

  loadTasks();
}

/**
 * Loads and renders all tasks from storage
 */
export async function loadTasks() {
  const taskList = document.getElementById('taskList');
  if (!taskList) return;

  // Destroy previous flatpickr instances inside tasks list to prevent memory leaks
  taskList.querySelectorAll('.flatpickr-input').forEach(el => {
    if (el._flatpickr) {
      try {
        el._flatpickr.destroy();
      } catch (err) {
        console.error('Error destroying flatpickr inside taskList:', err);
      }
    }
  });

  const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
  const allItems = res[STORAGE_KEYS.MEMOS] || [];
  const regularTasks = allItems.filter(m => (m.type === 'task' || !m.type) && m.taskCategory !== 'group_reminder');
  const groupReminders = allItems.filter(m => m.type === 'group_reminder' || m.taskCategory === 'group_reminder');

  const allPendingTasks = regularTasks.filter(t => !t.done);
  const pendingReminders = groupReminders.filter(t => !t.done);

  // Update tasks badge
  const taskBadge = document.getElementById('taskTabBadge');
  if (taskBadge) taskBadge.textContent = allPendingTasks.length > 0 ? allPendingTasks.length : '';

  // Update reminders badge too
  const reminderBadge = document.getElementById('reminderTabBadge');
  if (reminderBadge) reminderBadge.textContent = pendingReminders.length > 0 ? pendingReminders.length : '';

  // Apply search query filter if exists
  const searchInput = document.getElementById('tasksSearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  let filteredTasks = regularTasks;
  if (query) {
    filteredTasks = regularTasks.filter(t => {
      const titleMatch = (t.title || '').toLowerCase().includes(query);
      const noteMatch = (t.note || '').toLowerCase().includes(query);
      const postTextMatch = (t.postText || '').toLowerCase().includes(query);
      return titleMatch || noteMatch || postTextMatch;
    });
  }

  const pendingTasks = filteredTasks.filter(t => !t.done);
  const doneTasks = filteredTasks.filter(t => t.done);

  const now = Date.now();

  const hasPendingTasks = pendingTasks.length > 0;
  const hasDoneTasks = doneTasks.length > 0;

  // FAB pulse when matching section is empty
  const isEmpty = currentFilter === 'pending' ? !hasPendingTasks : !hasDoneTasks;
  const fab = document.getElementById('btnFabAddTask');
  if (fab) {
    if (isEmpty) fab.classList.add('empty-pulsing');
    else fab.classList.remove('empty-pulsing');
  }

  let html = '';
  const btnClearAllTasks = document.getElementById('btnClearAllTasks');

  if (currentFilter === 'pending') {
    if (btnClearAllTasks) btnClearAllTasks.style.display = hasPendingTasks ? 'inline-flex' : 'none';
    if (!hasPendingTasks) {
      html = `<div class="empty-state">${language.taskEmpty}</div>`;
    } else {
      html += pendingTasks.map(t => renderTaskCard(t, now)).join('');
    }
  } else {
    if (btnClearAllTasks) btnClearAllTasks.style.display = hasDoneTasks ? 'inline-flex' : 'none';
    if (!hasDoneTasks) {
      html = `<div class="empty-state">${language.noCompletedTasks}</div>`;
    } else {
      html += doneTasks.map(t => renderTaskCard(t, now)).join('');
    }
  }

  taskList.innerHTML = html;

  // Only show collapse button if the text overflows (more than 2 lines)
  taskList.querySelectorAll('.memo-item').forEach(card => {
    const textEl = card.querySelector('.memo-note-text');
    const collapseBtn = card.querySelector('.collapse-btn');
    if (textEl && collapseBtn) {
      const isOverflowing = textEl.scrollHeight > textEl.clientHeight + 1;
      if (!isOverflowing) {
        collapseBtn.style.display = 'none';
      }
    }
  });

  // Re-init flatpickr on date elements inside the task cards
  initFlatpickrOnList(taskList, allItems, loadTasks);
}

/**
 * Loads and renders group reminders in the dedicated Tools panel
 */
/**
 * Initialize Flatpickr on updates inside rendering panels
 */
function initFlatpickrOnList(container, allItems, reloadFn) {
  container.querySelectorAll('.task-update-reminder').forEach(el => {
    const id = el.dataset.id;
    const task = allItems.find(t => t.id === id);
    const isRepeatDaily = task ? task.repeatDaily : false;

    const fpInstance = initCommonFlatpickr(el, {
      noCalendar: isRepeatDaily,
      enableTime: true,
      dateFormat: isRepeatDaily ? "H:i" : "Y-m-d H:i",
      minDate: "today",
      onClose: async (selectedDates, dateStr) => {
        if (selectedDates.length > 0 && !isRepeatDaily) {
          const selectedTime = selectedDates[0].getTime();
          if (selectedTime < Date.now()) {
            showToast(language.pastDateError);
            reloadFn();
            return;
          }
        }

        const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
        const memos = res[STORAGE_KEYS.MEMOS] || [];
        const taskIndex = memos.findIndex(m => m.id === id);
        
        if (taskIndex !== -1) {
          const oldReminder = memos[taskIndex].reminder;
          let finalReminder = dateStr || null;
          if (dateStr && isRepeatDaily && dateStr.length === 5 && dateStr.includes(':')) {
            const today = new Date();
            const parts = dateStr.split(':');
            today.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
            if (today.getTime() <= Date.now()) {
              today.setDate(today.getDate() + 1);
            }
            finalReminder = formatDateTime(today);
          }

          if (oldReminder === finalReminder) {
            return;
          }

          memos[taskIndex].reminder = finalReminder;
          memos[taskIndex].updatedAt = Date.now();
          await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
          
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
        reloadFn();
      }
    });
    if (fpInstance) {
      activeListFlatpickrs.push(fpInstance);
    }
  });
}

/**
 * Handle clicks on task items (delete, toggle complete, edit, cancel edit, save edit)
 */
async function handleTaskClick(e) {
  const reload = () => {
    loadTasks();
  };

  // Delete item
  if (e.target.classList.contains('btn-delete-task')) {
    const id = e.target.dataset.id;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS, STORAGE_KEYS.SETTINGS]);
    const settings = res[STORAGE_KEYS.SETTINGS] || {};
    const quickDelete = settings.quickDelete === true;
    
    if (!quickDelete) {
      if (!confirm(language.confirmDeleteTask || "Are you sure you want to delete this task?")) {
        return;
      }
    }
    
    const memos = (res[STORAGE_KEYS.MEMOS] || []).filter(m => m.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
    chrome.alarms.clear(id);
    chrome.runtime.sendMessage({ type: 'DISMISS_REMINDER', taskId: id }).catch(() => {});
    reload();
  }

  // Task completion toggle
  if (e.target.classList.contains('task-checkbox')) {
    const id = e.target.dataset.id;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS, STORAGE_KEYS.SETTINGS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const settings = res[STORAGE_KEYS.SETTINGS] || { snoozeMinutes: 5 };
    const task = memos.find(m => m.id === id);
    if (task) {
      task.done = e.target.checked;
      task.doneAt = e.target.checked ? Date.now() : null;
      
      // If task is checked done, check all checklist items done
      if (task.taskCategory === 'checklist' && task.checklist) {
        task.checklist.forEach(item => {
          item.done = e.target.checked;
        });
      }
      
      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
      if (e.target.checked) {
        chrome.alarms.clear(id);
        chrome.runtime.sendMessage({ type: 'DISMISS_REMINDER', taskId: id }).catch(() => {});
      } else if (task.reminder) {
        // Task marked undone — restore alarm
        if (task.repeatDaily) {
          // Daily task: reschedule to next correct daily occurrence, not a snooze interval
          const reminderDate = new Date(task.reminder);
          const nextTime = new Date();
          nextTime.setHours(reminderDate.getHours(), reminderDate.getMinutes(), 0, 0);
          if (nextTime.getTime() <= Date.now()) {
            nextTime.setDate(nextTime.getDate() + 1);
          }
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId: id, time: nextTime.getTime() });
        } else {
          // One-time task: restore at original reminder time (if still future), else snooze
          const reminderTime = new Date(task.reminder).getTime();
          const targetTime = reminderTime > Date.now() ? reminderTime : Date.now() + (settings.snoozeMinutes || 5) * 60 * 1000;
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId: id, time: targetTime });
        }
      }
      reload();
    }
  }

  // Checklist item toggle
  if (e.target.classList.contains('task-checklist-item-checkbox')) {
    const taskId = e.target.dataset.taskId;
    const itemIdx = parseInt(e.target.dataset.itemIdx);
    const isChecked = e.target.checked;
    
    // Update styling immediately on the DOM to ensure zero jitter/lag
    const parentLine = e.target.closest('.task-checklist-line');
    if (parentLine) {
      const textSpan = parentLine.querySelector('.task-checklist-text');
      if (textSpan) {
        textSpan.style.color = isChecked ? 'var(--text-3)' : 'var(--text-1)';
        textSpan.style.textDecoration = isChecked ? 'line-through' : 'none';
      }
    }

    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS, STORAGE_KEYS.SETTINGS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const settings = res[STORAGE_KEYS.SETTINGS] || { snoozeMinutes: 5 };
    const task = memos.find(m => m.id === taskId);
    
    if (task && task.checklist && task.checklist[itemIdx]) {
      task.checklist[itemIdx].done = isChecked;
      
      // Check if all checklist items are completed
      const allDone = task.checklist.every(item => item.done === true);
      const card = document.getElementById('item_' + taskId);
      
      if (allDone) {
        task.done = true;
        task.doneAt = Date.now();
        chrome.alarms.clear(taskId);
        
        isLocalTaskUpdate = false;
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
        // Re-render when status changes so task moves to the completed section
        reload();
      } else {
        // If task was previously done but now a checklist item is unchecked
        let statusChanged = false;
        if (task.done) {
          task.done = false;
          task.doneAt = null;
          statusChanged = true;
          const snoozeMins = settings.snoozeMinutes || 5;
          chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SET_TASK_ALARM, taskId, time: Date.now() + snoozeMins * 60 * 1000 });
        }
        
        isLocalTaskUpdate = true;
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
        setTimeout(() => { isLocalTaskUpdate = false; }, 100);
        
        if (statusChanged) {
          isLocalTaskUpdate = false;
          reload();
        } else {
          // Just update parent task checkbox and layout status if needed without re-rendering everything
          if (card) {
            const parentCheckbox = card.querySelector('.task-checkbox');
            if (parentCheckbox) parentCheckbox.checked = false;
            card.classList.remove('memo-done');
          }
        }
      }
    }
  }

  // Inline edit trigger
  const btnEdit = e.target.closest('.btn-edit-task');
  if (btnEdit) {
    const id = btnEdit.dataset.id;
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const task = memos.find(m => m.id === id);
    if (task) {
      const card = document.getElementById('item_' + id);
      const collapseBtn = card?.querySelector('.collapse-btn');
      if (collapseBtn) collapseBtn.style.display = 'none';

      const contentEl = card.querySelector('.memo-content');
      if (contentEl) {
        const actionsEl = card.querySelector('.memo-actions');
        if (actionsEl) actionsEl.style.display = 'none';
        
        contentEl.innerHTML = `
          <div class="inline-edit-form" style="margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
            <input type="text" class="inline-edit-title" placeholder="Title (optional)" value="${escapeHtml(task.title || '')}" style="width: 100%; height: 28px; font-size: 13px; font-weight: 600; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--border); outline: none; box-sizing: border-box; font-family: inherit;" autocomplete="off">
            <textarea class="inline-edit-textarea" rows="10" style="width: 100%; min-height: 180px; padding: 8px; border: 1px solid var(--border); border-radius: 8px; font-family: inherit; font-size: 13px; outline: none; background: #fff; resize: vertical; color: var(--text-1);">${escapeHtml(task.note)}</textarea>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; font-weight:600; color:var(--text-2);">${language.categoryLabel || 'Category:'}</span>
              <select class="sp-compact-select inline-edit-category" style="max-width:120px; margin:0;">
                <option value="normal" ${task.taskCategory !== 'checklist' && task.taskCategory !== 'group_reminder' ? 'selected' : ''}>${language.categoryNormal || 'Normal'}</option>
                <option value="checklist" ${task.taskCategory === 'checklist' ? 'selected' : ''}>${language.categoryChecklist || 'Checklist'}</option>
                ${task.taskCategory === 'group_reminder' ? `<option value="group_reminder" selected>Group Reminder</option>` : ''}
              </select>
              <label style="display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:var(--text-2); margin-left:12px; cursor:pointer;">
                <input type="checkbox" class="inline-edit-repeat-daily" ${task.repeatDaily ? 'checked' : ''} ${task.taskCategory === 'group_reminder' ? 'disabled' : ''} style="margin:0; width:13px; height:13px; cursor:pointer;">
                <span>🔄 ${language.repeatDailyBadgeText || 'Daily'}</span>
              </label>
            </div>
            <div style="display: flex; gap: 6px; justify-content: flex-end;">
              <button class="btn btn-secondary inline-edit-cancel" data-id="${id}" style="padding: 4px 10px; font-size: 11.5px; height: 26px; border-radius: 6px; cursor:pointer;">${language.cancel}</button>
              <button class="btn btn-primary inline-edit-save" data-id="${id}" style="padding: 4px 10px; font-size: 11.5px; height: 26px; border-radius: 6px; cursor:pointer; color:#fff;">${language.save}</button>
            </div>
          </div>
        `;
        
        const selectEl = contentEl.querySelector('.inline-edit-category');
        if (selectEl && typeof window.convertToCustomDropdown === 'function') {
          window.convertToCustomDropdown(selectEl, '110px', '22px');
        }

        const ta = contentEl.querySelector('.inline-edit-textarea');
        if (ta) {
          ta.style.boxSizing = 'border-box';
          ta.style.height = 'auto';
          ta.style.height = Math.max(180, ta.scrollHeight) + 'px';
          ta.style.overflowY = 'hidden';
          ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = Math.max(180, ta.scrollHeight) + 'px';
          });
        }
      }
    }
  }

  // Cancel edit
  if (e.target.classList.contains('inline-edit-cancel')) {
    reload();
  }

  // Save edit
  if (e.target.classList.contains('inline-edit-save')) {
    const id = e.target.dataset.id;
    const card = document.getElementById('item_' + id);
    const titleInput = card.querySelector('.inline-edit-title');
    const textarea = card.querySelector('.inline-edit-textarea');
    const newTitle = titleInput ? titleInput.value.trim() : '';
    if (textarea) {
      const newText = textarea.value.trim();
      if (!newText) {
        if (typeof window.showErrorFeedback === 'function') {
          window.showErrorFeedback(language.taskEmptyError);
        } else {
          console.warn(language.taskEmptyError);
        }
        return;
      }
      
      const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
      const memos = res[STORAGE_KEYS.MEMOS] || [];
      const taskIndex = memos.findIndex(m => m.id === id);
      if (taskIndex !== -1) {
        const task = memos[taskIndex];
        task.title = newTitle;
        task.note = newText;
        task.updatedAt = Date.now();
        
        const categorySelect = card.querySelector('.inline-edit-category');
        if (categorySelect) {
          task.taskCategory = categorySelect.value;
          if (task.taskCategory === 'group_reminder') {
            task.type = 'group_reminder';
          } else {
            task.type = 'task';
          }
        }
        
        const repeatDailyCheckbox = card.querySelector('.inline-edit-repeat-daily');
        const oldRepeatDaily = task.repeatDaily;
        if (repeatDailyCheckbox) {
          task.repeatDaily = repeatDailyCheckbox.checked;
        }

        if (task.repeatDaily !== oldRepeatDaily) {
          if (task.repeatDaily) {
            // Switched to daily: reschedule alarm to next daily occurrence
            if (task.reminder) {
              const originalDate = new Date(task.reminder);
              if (!isNaN(originalDate.getTime())) {
                const today = new Date();
                today.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);
                if (today.getTime() <= Date.now()) {
                  today.setDate(today.getDate() + 1);
                }
                task.reminder = formatDateTime(today);
                chrome.runtime.sendMessage({
                  type: MESSAGE_TYPES.SET_TASK_ALARM,
                  taskId: id,
                  time: today.getTime()
                });
              }
            }
          } else {
            // Switched from daily to one-time: clear daily alarm, reschedule at
            // original reminder time if still in the future, else clear entirely
            chrome.alarms.clear(id);
            if (task.reminder) {
              const reminderTime = new Date(task.reminder).getTime();
              if (reminderTime > Date.now()) {
                chrome.runtime.sendMessage({
                  type: MESSAGE_TYPES.SET_TASK_ALARM,
                  taskId: id,
                  time: reminderTime
                });
              }
            }
          }
        }
        
        if (task.taskCategory === 'checklist') {
          const newLines = newText.split('\n').filter(l => l.trim());
          const oldChecklist = task.checklist || [];
          
          task.checklist = newLines.map((lineText, idx) => {
            const trimmedText = lineText.trim();
            const cleanText = trimmedText.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '');
            const matchedOld = oldChecklist.find(oldItem => oldItem.text === cleanText || oldItem.text === trimmedText);
            return {
              id: `${id}_line_${idx}`,
              text: cleanText,
              done: matchedOld ? matchedOld.done : false
            };
          });
          
          // Recalculate done status of the whole task
          const allDone = task.checklist.every(item => item.done === true);
          task.done = allDone;
          if (allDone) {
            task.doneAt = Date.now();
            chrome.alarms.clear(id);
          } else {
            task.doneAt = null;
          }
        } else {
          task.checklist = [];
        }
        
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
      }
      reload();
    }
  }
}

/**
 * Renders a task card component
 */
function renderTaskCard(task, now) {
  const reminderMs = task.reminder ? new Date(task.reminder).getTime() : null;
  const isOverdue = !task.done && reminderMs && reminderMs < now;

  let reminderDisplayVal = task.reminder || '';
  if (task.repeatDaily && task.reminder) {
    const match = task.reminder.match(/\d{2}:\d{2}/);
    if (match) {
      reminderDisplayVal = match[0];
    }
  }

  const cachedConfig = _state.getConfig();
  const currentTeam = _state.getTeam();
  const permalink = task.postId && cachedConfig
    ? makePermalinkSync(task.postId, cachedConfig.chatopsUrl, task.teamName || currentTeam?.name || CHATOPS_CONFIG.DEFAULT_TEAM)
    : null;

  // Only show postText if it's different from the note (to avoid duplication)
  const hasOriginalPost = task.postId && task.postText && task.postText !== task.note;

  let taskBodyHtml = '';
  if (task.taskCategory === 'checklist' && task.checklist && task.checklist.length > 0) {
    taskBodyHtml = task.checklist.map((item, idx) => {
      return `<div class="task-checklist-line" style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:13px;white-space:normal;"><label class="memo-checkbox-container footer-checkbox" style="margin:0;position:relative;top:2px;" title="${language.taskMarkDone}"><input type="checkbox" class="task-checklist-item-checkbox" data-task-id="${task.id}" data-item-idx="${idx}" ${item.done ? 'checked' : ''}><span class="memo-checkmark-custom"></span></label><span class="task-checklist-text" style="flex:1;min-width:0;color:${item.done ? 'var(--text-3)' : 'var(--text-1)'};text-decoration:${item.done ? 'line-through' : 'none'};transition:all 0.2s;white-space:normal !important;">${formatRichText(item.text)}</span></div>`;
    }).join('');
  } else {
    taskBodyHtml = formatRichText(task.note || language.taskNoContent);
  }

  return `
    <div class="memo-item task-item ${task.done ? 'memo-done' : ''} ${isOverdue ? 'memo-overdue' : ''}" id="item_${task.id}" style="${task.type === 'group_reminder' ? 'border-left:3px solid #f59e0b;' : ''}">
      <div class="memo-item-header" style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom: 4px;">
        <div class="memo-content-title-area" style="flex:1; min-width:0;">
          ${task.title
            ? `<div class="memo-item-title" style="font-weight:700; font-size:13.5px; color:var(--text-1); letter-spacing:-0.1px; margin:0;">${escapeHtml(task.title)}</div>`
            : task.type === 'group_reminder'
              ? `<div class="memo-item-title" style="font-weight:700; font-size:13.5px; color:#d97706; letter-spacing:-0.1px; margin:0;">${language.groupReminderLabel || 'Lên lịch gửi tin'}</div>`
              : `<div class="memo-item-title" style="font-weight:700; font-size:13.5px; color:var(--text-3); font-style:italic; letter-spacing:-0.1px; margin:0;">${language.taskDefaultTitle || 'Task'}</div>`
          }
        </div>
        <button class="collapse-btn" data-id="${task.id}" style="margin:0; flex-shrink:0;" title="${language.expandCollapseBtn}">▶</button>
      </div>
      <div class="task-content-row" style="width:100%;">
        <div class="memo-content" style="width:100%; display:flex; flex-direction:column; gap:4px;">
          ${hasOriginalPost ? `<div class="memo-post-preview post-preview" style="display:none; margin-bottom:4px; width:100%;">📌 ${escapeHtml(task.postText)}</div>` : ''}
          <div class="memo-note-text task-text collapsible-body collapsed" style="margin-top:0; width:100%;">${taskBodyHtml}</div>
          <div class="collapse-bottom-bar" style="display:none; justify-content:center; padding: 4px 0; margin-top: 6px; border-top: 1px dashed var(--border); width:100%;">
            <button class="btn-collapse-bottom" data-id="${task.id}" style="background:none; border:none; color:var(--accent); font-size:11.5px; cursor:pointer; display:flex; align-items:center; gap:4px; font-weight:700; outline:none; margin:0;" title="${language.collapseBtnBottom}">
              <span>${language.collapseBtnBottom}</span> ▲
            </button>
          </div>
        </div>
      </div>
      ${task.repeatDaily ? `
        <div class="task-attributes-row" style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; padding-top:6px; border-top:1px dashed var(--border); width:100%;">
          <span class="repeat-daily-badge" style="font-size:10px; font-weight:700; color:var(--accent); background:rgba(28,88,217,0.08); padding:1.5px 5px; border-radius:4px; display:inline-flex; align-items:center; gap:2px; flex-shrink:0; white-space:nowrap;" title="${language.taskRemindDailyLabel}">
            🔄 ${language.repeatDailyBadgeText || 'Daily'}
          </span>
        </div>
      ` : ''}
      <div class="memo-footer" style="margin-top:6px; padding-top:6px; border-top:1px solid var(--border);">
        <div class="memo-meta" style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">
          <label class="task-done-badge ${task.done ? 'is-done' : ''}" title="${task.done ? language.taskMarkIncomplete : language.taskMarkDone}">
            <div class="memo-checkbox-container footer-checkbox" style="margin: 0; position: relative;">
              <input type="checkbox" class="task-checkbox" data-id="${task.id}" ${task.done ? 'checked' : ''}>
              <span class="memo-checkmark-custom"></span>
            </div>
            <span class="task-done-text">
              ${task.done ? (language.taskCompleted || 'Completed') : (language.taskMarkDoneShort || 'Hoàn thành')}
            </span>
          </label>
          ${!task.done ? `
            <div class="task-update-reminder-wrapper ${task.reminder ? 'has-reminder' : ''} ${isOverdue ? 'overdue' : ''}" style="margin:0; flex-shrink:0;">
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
