/**
 * Side Panel Orchestrator — ChatOps Chrome Extension
 */

import { state } from './state.js';
import { setup as setupSearch, reset as resetSearch, getSelects as getSearchSelects } from './tabs/search.tab.js';
import { setup as setupMentions, reset as resetMentions, getSelects as getMentionsSelects, reRender as reRenderMentions } from './tabs/mentions.tab.js';

import { setup as setupMemo, loadMemos, renderCategories } from './tabs/memo.tab.js';
import { setup as setupTasks, loadTasks } from './tabs/tasks.tab.js';
import { setup as setupReminders, loadGroupReminders } from './tabs/reminders.tab.js';
import { setup as setupSettings, getSettings, updateSettings, applyThemeToDOM, applyTabRepositioning, applyTabVisibilityToDOM, renderSidepanelMemes, applyTabOrderToDOM, renderTabOrderList } from './tabs/settings.tab.js';

import { getMyProfile, getMyTeams, getConfig } from '../src/api/index.js';
import { escapeHtml } from '../src/utils/index.js';

import { STORAGE_KEYS, MESSAGE_TYPES, CHATOPS_CONFIG, TABS } from '../src/constants.js';
import { language, loadLanguage, applyI18n, setLanguage, getActiveLanguageCode } from '../src/lang.js';
import { restoreState, setupAutoSave } from './persistence.js';
import { startTour, checkAndAutoStartTour, setTargetTabId } from './tour.js';

// Capture the Mattermost tab ID immediately — before any UI interaction
// moves keyboard focus to the sidepanel and potentially confuses tab queries.
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) setTargetTabId(tabs[0].id);
  });
}

document.addEventListener('DOMContentLoaded', init);

/**
 * Initializes the side panel by fetching config, profile, and teams
 */
async function init() {
  // Load and apply the active language dictionary asynchronously before any tab setup or UI renders
  await loadLanguage();
  applyI18n();

  try {
    const manifest = chrome.runtime.getManifest();
    const versionEl = document.getElementById('header-version');
    if (versionEl) {
      versionEl.textContent = `v${manifest.version}`;
    }
  } catch (versionErr) {
    console.error('[ChatOps Ext] Failed to load version:', versionErr);
  }

  const dropdownEl = document.getElementById('spWorkspaceDropdown');
  try {
    const settings = await getSettings();
    applyThemeToDOM(settings);
    applyTabOrderToDOM(settings.tabOrder);
    applyTabRepositioning(settings, settings.showTabs);
    applyTabVisibilityToDOM(settings);
  } catch (settingsErr) {
    console.error('[ChatOps Ext] Failed to load settings:', settingsErr);
  }

  try {
    const [config, user, teams] = await Promise.all([getConfig(), getMyProfile(), getMyTeams()]);
    state.setConfig(config);
    state.setUser(user);
    await setupWorkspaceSelector(teams, dropdownEl);
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SIDE_PANEL_STATE, state: 'OPEN' });
  } catch (err) {
    if (dropdownEl) {
      const selectedEl = document.getElementById('spWorkspaceSelected');
      if (selectedEl) {
        const text = selectedEl.querySelector('.selected-text');
        if (text) {
          text.textContent = `❌ ${err.message}`;
          text.removeAttribute('data-i18n');
        }
      }
    }
  }

  setupSearch(state);
  setupMentions(state);

  setupMemo(state);
  setupTasks(state);
  setupReminders(state);
  loadGroupReminders();
  setupSettings(state);
  setupTabs();
  setupModalListeners();
  setupLanguageToggle();
  updateRateLinks();
  
  
  const selectors = { ...getSearchSelects(), ...getMentionsSelects() };
  restoreState(selectors);
  setupAutoSave(selectors);
  setupStateHandlers();

  // Show interactive onboarding tour for first-time installation
  checkAndAutoStartTour();

  // Initialize iframe integration for PWA mode
  setupPwaMode();
}

/**
 * Handles custom close behavior inside PWA iframe.
 */
function setupPwaMode() {
  // 1. Detect PWA/Modal mode from URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const isPwaMode = urlParams.get('mode') === 'pwa';
  const viewParam = urlParams.get('view');
  const isModalMode = viewParam === 'modal';
  const tabParam = urlParams.get('tab');
  
  if (isPwaMode) {
    document.body.classList.add('pwa-mode');
  }
  
  if (isModalMode) {
    document.body.classList.add('modal-mode');
    
    // Automatically move search and mentions forms inline
    const searchForm = document.getElementById('spSearchForm');
    const searchFormPlaceholder = document.getElementById('spSearchFormPlaceholder');
    if (searchForm && searchFormPlaceholder) {
      searchFormPlaceholder.appendChild(searchForm);
      searchFormPlaceholder.style.display = 'block';
    }

    const mentionsForm = document.getElementById('spMentionsForm');
    const mentionsFormPlaceholder = document.getElementById('spMentionsFormPlaceholder');
    if (mentionsForm && mentionsFormPlaceholder) {
      mentionsFormPlaceholder.appendChild(mentionsForm);
      mentionsFormPlaceholder.style.display = 'block';
    }

    // Set up postMessage close listener for modal mode
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CLOSE_CHATOPS_MODAL') {
        window.parent.postMessage({ type: 'CLOSE_CHATOPS_MODAL' }, '*');
      }
    });
  }
  
  const closeIframeBtn = document.getElementById('btnHeaderCloseIframe');
  if (closeIframeBtn) {
    if (isPwaMode) {
      closeIframeBtn.style.display = 'block';
      closeIframeBtn.addEventListener('click', () => {
        window.parent.postMessage({ type: 'CLOSE_PWA_SIDE_PANEL' }, '*');
      });
    } else if (isModalMode) {
      closeIframeBtn.style.display = 'block';
      closeIframeBtn.addEventListener('click', () => {
        window.parent.postMessage({ type: 'CLOSE_CHATOPS_MODAL' }, '*');
      });
    } else {
      closeIframeBtn.style.display = 'none';
    }
  }

  // Handle active tab routing from URL
  if (tabParam) {
    setTimeout(() => {
      if (tabParam === 'search') {
        switchTab('tools-search');
      } else if (tabParam === 'mentions') {
        switchTab('mentions');
      } else {
        switchTab(tabParam);
      }
    }, 150);
  }
}

/**
 * Sets up the workspace dropdown selector — powering all three instances:
 * the hidden master, the Search inline row, and the Mentions inline row.
 */
async function setupWorkspaceSelector(teams, dropdownContainer) {
  if (!teams?.length) {
    // Show "no workspaces" in all visible selected-text spans
    document.querySelectorAll('#spWorkspaceSelected .selected-text, #spWorkspaceSelectedSearch .selected-text, #spWorkspaceSelectedMentions .selected-text').forEach(el => {
      el.textContent = language.noWorkspaces || 'No workspaces';
      el.removeAttribute('data-i18n');
    });
    return;
  }

  // Store all teams in state
  state.setTeams(teams);

  const saved = await chrome.storage.local.get([STORAGE_KEYS.CURRENT_TEAM]);
  const config = state.getConfig();
  
  let defaultTeam;
  if (saved[STORAGE_KEYS.CURRENT_TEAM] === 'all') {
    defaultTeam = { id: 'all', display_name: language.allWorkspacesOption || 'Tất cả' };
  } else {
    defaultTeam = teams.find(t => String(t.id) === String(saved[STORAGE_KEYS.CURRENT_TEAM]))
      || teams.find(t => t.name === (config.teamName || CHATOPS_CONFIG.DEFAULT_TEAM))
      || teams[0];
  }

  state.setTeam(defaultTeam);

  // Helper: set all selected-text spans to the team display name
  function syncAllSelectedText(team) {
    document.querySelectorAll('#spWorkspaceSelected .selected-text, #spWorkspaceSelectedSearch .selected-text, #spWorkspaceSelectedMentions .selected-text').forEach(el => {
      el.textContent = team.display_name;
      el.removeAttribute('data-i18n');
    });
  }

  // Helper: render options into a given optionsEl
  function renderOptions(optionsEl, currentTeamId) {
    if (!optionsEl) return;
    let html = teams.map(t => `
      <div class="custom-dropdown-option ${t.id === currentTeamId ? 'selected' : ''}" data-value="${t.id}">
        ${escapeHtml(t.display_name)}
      </div>
    `).join('');
    
    // Add "All Workspaces" option
    html += `
      <div class="custom-dropdown-option ${currentTeamId === 'all' ? 'selected' : ''}" data-value="all" data-i18n="allWorkspacesOption">
        ${language.allWorkspacesOption || 'Tất cả'}
      </div>
    `;
    optionsEl.innerHTML = html;
  }

  // Helper: handle team selection from any dropdown
  function onTeamSelected(val, ownerDropdown, ownerOptions) {
    let selectedTeam;
    if (val === 'all') {
      selectedTeam = { id: 'all', display_name: language.allWorkspacesOption || 'Tất cả' };
    } else {
      selectedTeam = teams.find(t => String(t.id) === String(val));
    }
    if (!selectedTeam) return;

    syncAllSelectedText(selectedTeam);

    // Sync selected state in ALL option lists
    document.querySelectorAll('.workspace-inline-dropdown .custom-dropdown-option, #spWorkspaceOptions .custom-dropdown-option').forEach(item => {
      item.classList.toggle('selected', item.dataset.value === val);
    });

    // Show/hide performance warning
    const isAll = val === 'all';
    const searchWarning = document.getElementById('searchWorkspaceWarning');
    const mentionsWarning = document.getElementById('mentionsWorkspaceWarning');
    if (searchWarning) searchWarning.style.display = isAll ? 'block' : 'none';
    if (mentionsWarning) mentionsWarning.style.display = isAll ? 'block' : 'none';

    state.setTeam(selectedTeam);
    chrome.storage.local.set({ [STORAGE_KEYS.CURRENT_TEAM]: val });

    // Close this dropdown
    ownerDropdown?.classList.remove('open');
    ownerOptions?.classList.remove('show');

    setTimeout(() => { resetAllTabs(); }, 50);
  }

  // Initialize all dropdown instances
  const instances = [
    {
      container: document.getElementById('spWorkspaceDropdown'),
      selectedEl: document.getElementById('spWorkspaceSelected'),
      optionsEl: document.getElementById('spWorkspaceOptions'),
    },
    {
      container: document.getElementById('spWorkspaceDropdownSearch'),
      selectedEl: document.getElementById('spWorkspaceSelectedSearch'),
      optionsEl: document.getElementById('spWorkspaceOptionsSearch'),
    },
    {
      container: document.getElementById('spWorkspaceDropdownMentions'),
      selectedEl: document.getElementById('spWorkspaceSelectedMentions'),
      optionsEl: document.getElementById('spWorkspaceOptionsMentions'),
    },
  ];

  syncAllSelectedText(defaultTeam);

  instances.forEach(({ container, selectedEl, optionsEl }) => {
    if (!container || !selectedEl || !optionsEl) return;

    renderOptions(optionsEl, defaultTeam.id);

    // Toggle dropdown open/close
    selectedEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = container.classList.contains('open');
      // Close all other instances first
      instances.forEach(i => {
        if (i.container && i.container !== container) {
          i.container.classList.remove('open');
          i.optionsEl?.classList.remove('show');
        }
      });
      container.classList.toggle('open', !isOpen);
      optionsEl.classList.toggle('show', !isOpen);
    });

    // Handle option click
    optionsEl.addEventListener('click', (e) => {
      const optionItem = e.target.closest('.custom-dropdown-option');
      if (!optionItem) return;
      onTeamSelected(optionItem.dataset.value, container, optionsEl);
    });
  });

  // Set initial warning states
  const isAll = defaultTeam.id === 'all';
  const searchWarning = document.getElementById('searchWorkspaceWarning');
  const mentionsWarning = document.getElementById('mentionsWorkspaceWarning');
  if (searchWarning) searchWarning.style.display = isAll ? 'block' : 'none';
  if (mentionsWarning) mentionsWarning.style.display = isAll ? 'block' : 'none';

  // Close all dropdowns when clicking outside
  document.addEventListener('click', () => {
    instances.forEach(({ container, optionsEl }) => {
      container?.classList.remove('open');
      optionsEl?.classList.remove('show');
    });
  });


  // Global click listener to show note images in the preview modal
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('meme-img')) {
      const modal = document.getElementById('imagePreviewModal');
      const previewImg = document.getElementById('imgPreviewTarget');
      if (modal && previewImg) {
        previewImg.src = e.target.src;
        modal.style.display = 'flex';
      }
    }
  });
}

/**
 * Switches the active tab in the UI
 */
function switchTab(id) {
  const promoteTabs = window.activeSettings?.promoteTabs || { tasks: true, notes: true, search: false, images: false, reactions: false, mentions: true, reminders: false };
  const isTasksPromoted = promoteTabs.tasks !== false;
  const isNotesPromoted = promoteTabs.notes !== false;
  const isSearchPromoted = promoteTabs.search === true;
  const isImagesPromoted = promoteTabs.images === true;
  const isReactionsPromoted = promoteTabs.reactions === true;
  const isMentionsPromoted = promoteTabs.mentions !== false;
  const isRemindersPromoted = promoteTabs.reminders === true;

  let mainId = id;
  let subId = null;

  if (id === 'tasks') {
    if (!isTasksPromoted) {
      mainId = 'tools';
      subId = 'tasks';
    }
  } else if (id === 'memo') {
    if (!isNotesPromoted) {
      mainId = 'tools';
      subId = 'notes';
    }
  } else if (id === 'tools-search') {
    if (!isSearchPromoted) {
      mainId = 'tools';
      subId = 'search';
    }
  } else if (id === 'tools-images') {
    if (!isImagesPromoted) {
      mainId = 'tools';
      subId = 'images';
    }
  } else if (id === 'tools-reactions') {
    if (!isReactionsPromoted) {
      mainId = 'tools';
      subId = 'reactions';
    }
  } else if (id === 'tools-reminders') {
    if (!isRemindersPromoted) {
      mainId = 'tools';
      subId = 'reminders';
    }
  } else if (id === 'mentions') {
    if (!isMentionsPromoted) {
      mainId = 'tools';
      subId = 'mentions';
    }
  } else if (id.startsWith('tools-')) {
    mainId = 'tools';
    subId = id.substring(6);
  }

  const activeTabBtnId = (mainId === 'tools' && subId) ? 'tools' : mainId;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === activeTabBtnId));

  // Update header settings gear icon visual state
  const headerSettingsGear = document.getElementById('btnHeaderSettings');
  if (headerSettingsGear) {
    headerSettingsGear.classList.toggle('active', mainId === 'settings');
  }

  const getPanelId = (mid) => {
    if (mid === 'tasks') return 'tab-tasks';
    if (mid === 'memo') return 'tab-memo';
    if (mid === 'mentions') return 'tab-mentions';
    if (mid === 'tools') return 'tab-tools';
    if (mid === 'tools-search') return 'tools-section-search';
    if (mid === 'tools-images') return 'tools-section-images';
    if (mid === 'tools-reactions') return 'tools-section-reactions';
    if (mid === 'tools-reminders') return 'tools-section-reminders';
    if (mid === 'settings') return 'tab-settings';
    return '';
  };
  const activePanelId = getPanelId(mainId);

  document.querySelectorAll('.tab-content').forEach(c => {
    const isTarget = c.id === activePanelId;
    c.classList.toggle('active', isTarget);
    if (isTarget) {
      c.style.display = 'flex';
    } else {
      c.style.display = 'none';
    }
  });

  const toolsSubTabs = document.getElementById('toolsSubTabs');
  if (toolsSubTabs) {
    if (mainId === 'tools') {
      toolsSubTabs.parentElement.style.removeProperty('display');
    } else {
      toolsSubTabs.parentElement.style.setProperty('display', 'none', 'important');
    }
  }

  if (subId) {
    const subTabBtn = document.querySelector(`#toolsSubTabs .memo-sub-tab[data-section="${subId}"]`);
    if (subTabBtn) {
      subTabBtn.click();
    }
  }

  if (id === 'settings') {
    if (window.isRedirectingToSetting) return;

    document.querySelectorAll('.settings-accordion').forEach(acc => {
      if (acc.id === 'accordionMenuTabs') {
        chrome.storage.local.get(['accordionMenuTabsOpen'], (res) => {
          const isOpen = res.accordionMenuTabsOpen !== false;
          acc.classList.toggle('open', isOpen);
        });
      } else if (acc.id === 'accordionFloatingButtons') {
        chrome.storage.local.get(['accordionFloatingButtonsOpen'], (res) => {
          const isOpen = res.accordionFloatingButtonsOpen !== false;
          acc.classList.toggle('open', isOpen);
        });
      } else {
        acc.classList.remove('open');
      }
      acc.classList.remove('highlighted');
    });
  }

  // Remove loading-tab classes after routing has finished
  const docClass = document.documentElement.className;
  if (docClass.includes('loading-tab-')) {
    document.documentElement.className = docClass.replace(/\bloading-tab-\S+/g, '').trim();
  }
}

// Expose switchTab globally for the tour engine
window.switchTab = switchTab;

/**
 * Handles tab switching UI logic
 */
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    btn.addEventListener('dblclick', () => {
      const tab = btn.dataset.tab;
      if (tab === 'tasks') {
        window.ModalManager.open(
          language.modalAddTaskTitle,
          'spTasksForm',
          'spTaskFormPlaceholder'
        );
      } else if (tab === 'memo') {
        window.ModalManager.open(
          language.modalAddNoteTitle,
          'spMemoForm',
          'spMemoFormPlaceholder'
        );
      } else if (tab === 'mentions') {
        window.ModalManager.open(
          language.modalScannerFiltersTitle,
          'spMentionsForm',
          'spMentionsFormPlaceholder'
        );
      } else if (tab === 'tools-search') {
        // Double-click on Search tab opens search filters modal
        window.ModalManager.open(
          language.modalSearchTitle || 'Search',
          'spSearchForm',
          'spSearchFormPlaceholder'
        );
      }
    });
  });
  
  // Handle sync badge clicks to navigate to settings sync section
  ['syncBadgeTasks', 'syncBadgeNotes'].forEach(badgeId => {
    document.getElementById(badgeId)?.addEventListener('click', () => {
      switchTab('settings');
      
      // Select the data sub-tab (previously sync) in Settings
      const syncSubTabBtn = document.querySelector(`#settingsSubTabs .memo-sub-tab[data-section="data"]`);
      if (syncSubTabBtn) {
        syncSubTabBtn.click();
      }
      
      setTimeout(() => {
        const syncSection = document.getElementById('cloudSyncConfigArea');
        if (syncSection) {
          syncSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
          syncSection.style.transition = 'all 0.4s ease';
          syncSection.style.boxShadow = '0 0 16px var(--accent)';
          syncSection.style.transform = 'scale(1.02)';
          setTimeout(() => {
            syncSection.style.boxShadow = '';
            syncSection.style.transform = '';
          }, 1200);
        }
      }, 150);
    });
  });

  // Handle programmatic links to settings/tools sub-tabs (e.g. from Tasks, Mentions, etc.)
  document.addEventListener('click', (e) => {
    const supportLink = e.target.closest('.support-chatops-link');
    if (supportLink) {
      e.preventDefault();
      const url = supportLink.getAttribute('href');
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.update(tabs[0].id, { url });
        }
      });
      return;
    }

    const mainTabLink = e.target.closest('.main-tab-link') || e.target.closest('.main-tab-link-anchor');
    if (mainTabLink) {
      e.preventDefault();
      if (window.ModalManager) {
        window.ModalManager.close();
      }
      const targetTab = mainTabLink.dataset.tab;
      if (targetTab) {
        switchTab(targetTab);
      }
      return;
    }

    const link = e.target.closest('.settings-subtab-link');
    if (link) {
      e.preventDefault();
      if (window.ModalManager) {
        window.ModalManager.close();
      }
      const subtabName = link.dataset.subtab;
      if (!subtabName) return;

      // Set redirection flag to bypass standard accordion resetting
      window.isRedirectingToSetting = true;

      let tabId = 'settings';
      let sectionId = '';

      if (subtabName.startsWith('reactions-') || subtabName === 'tools-search') {
        tabId = 'tools';
        if (subtabName === 'reactions-picker') {
          sectionId = 'reactions';
        } else if (subtabName === 'reactions-images') {
          sectionId = 'images';
        } else if (subtabName === 'tools-search') {
          sectionId = 'search';
        }
      } else if (subtabName.startsWith('features-') || subtabName === 'categories') {
        tabId = 'settings';
        sectionId = 'features';
      } else if (subtabName.startsWith('ui-')) {
        tabId = 'settings';
        sectionId = 'ui';
      } else if (subtabName.startsWith('sync-')) {
        tabId = 'settings';
        sectionId = 'data';
      }

      // 1. Switch to the correct main tab
      switchTab(tabId);

      // 2. Switch top-level sub-tab/category
      if (sectionId) {
        const selector = tabId === 'settings' ? '#settingsSubTabs' : '#toolsSubTabs';
        const tabBtn = document.querySelector(`${selector} .memo-sub-tab[data-section="${sectionId}"]`);
        if (tabBtn) {
          tabBtn.click();
          if (tabId === 'settings' && window.openSettingsAccordion) {
            window.openSettingsAccordion(subtabName);
          }
        }
      }

      // Reset redirection flag after call stack and async click animations complete
      setTimeout(() => {
        window.isRedirectingToSetting = false;
      }, 300);
    }
  });
  
  function handleStorageRedirect(targetTab, targetSubTab) {
    if (!targetTab) return;
    
    if (window.ModalManager) {
      window.ModalManager.close();
    }
    
    // Support legacy tab redirects: search/reactions map to tools
    let mappedTab = targetTab;
    if (targetTab === 'reactions' || targetTab === 'search') {
      mappedTab = 'tools';
    }
    
    window.isRedirectingToSetting = true;
    switchTab(mappedTab);
    chrome.storage.local.remove(STORAGE_KEYS.SIDEPANEL_TAB);
    
    if (targetSubTab) {
      chrome.storage.local.remove('sidePanelSubTab');
      
      let tabId = mappedTab;
      let sectionId = '';
      if (targetSubTab.startsWith('reactions-') || targetSubTab === 'tools-search') {
        tabId = 'tools';
        if (targetSubTab === 'reactions-picker') {
          sectionId = 'reactions';
        } else if (targetSubTab === 'reactions-images') {
          sectionId = 'images';
        } else if (targetSubTab === 'tools-search') {
          sectionId = 'search';
        }
      } else if (targetSubTab.startsWith('features-') || targetSubTab === 'categories') {
        tabId = 'settings';
        sectionId = 'features';
      } else if (targetSubTab.startsWith('sync-')) {
        tabId = 'settings';
        sectionId = 'data';
      }

      if (sectionId) {
        setTimeout(() => {
          const selector = tabId === 'settings' ? '#settingsSubTabs' : '#toolsSubTabs';
          const tabBtn = document.querySelector(`${selector} .memo-sub-tab[data-section="${sectionId}"]`);
          if (tabBtn) {
            tabBtn.click();
            if (tabId === 'settings' && window.openSettingsAccordion) {
              window.openSettingsAccordion(targetSubTab);
            }
          }
          window.isRedirectingToSetting = false;
        }, 150);
      } else {
        window.isRedirectingToSetting = false;
      }
    } else {
      window.isRedirectingToSetting = false;
    }
  }

  // 1. Startup redirect handling (only if tab parameter is not present in URL)
  const urlParams = new URLSearchParams(window.location.search);
  if (!urlParams.get('tab')) {
    chrome.storage.local.get([STORAGE_KEYS.SIDEPANEL_TAB, 'sidePanelSubTab'], (res) => { 
      if (res[STORAGE_KEYS.SIDEPANEL_TAB]) { 
        handleStorageRedirect(res[STORAGE_KEYS.SIDEPANEL_TAB], res['sidePanelSubTab']);
      } 
    });
  }

  // 2. Reactive redirect handling (when sidepanel is already open)
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[STORAGE_KEYS.SIDEPANEL_TAB]) {
      const newTab = changes[STORAGE_KEYS.SIDEPANEL_TAB].newValue;
      if (newTab) {
        chrome.storage.local.get(['sidePanelSubTab'], (res) => {
          handleStorageRedirect(newTab, res['sidePanelSubTab']);
        });
      }
    }
  });
}

function resetAllTabs() {
  resetSearch();
  resetMentions();
}

/**
 * Sets up message listeners and global event handlers
 */
function setupStateHandlers() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === MESSAGE_TYPES.PING_SIDE_PANEL) sendResponse({ open: true });
    else if (msg.type === MESSAGE_TYPES.MEMO_UPDATED) {
      loadMemos();
      loadTasks();
      loadGroupReminders();
    } else if (msg.type === 'APP_LANG_CHANGED') {
      applyI18n();
      updateRateLinks();
      renderCategories();
      loadMemos();
      loadTasks();
      loadGroupReminders();
      renderSidepanelMemes();
      if (typeof reRenderMentions === 'function') {
        reRenderMentions();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'SWITCH_TAB') {
      switchTab(msg.tab);
      sendResponse({ ok: true });
    } else if (msg.type === 'NAVIGATE_TO_SUBTAB') {
      const subtabName = msg.subtab;
      if (subtabName) {
        window.isRedirectingToSetting = true;
        let tabId = 'settings';
        let sectionId = '';

        if (subtabName.startsWith('reactions-') || subtabName === 'tools-search' || subtabName === 'tools-reminders') {
          tabId = 'tools';
          if (subtabName === 'reactions-picker') {
            sectionId = 'reactions';
          } else if (subtabName === 'reactions-images') {
            sectionId = 'images';
          } else if (subtabName === 'tools-search') {
            sectionId = 'search';
          } else if (subtabName === 'tools-reminders') {
            sectionId = 'reminders';
          }
        } else if (subtabName.startsWith('features-') || subtabName === 'categories') {
          tabId = 'settings';
          sectionId = 'features';
        } else if (subtabName.startsWith('ui-')) {
          tabId = 'settings';
          sectionId = 'ui';
        } else if (subtabName.startsWith('sync-')) {
          tabId = 'settings';
          sectionId = 'data';
        }

        switchTab(tabId);

        if (sectionId) {
          const selector = tabId === 'settings' ? '#settingsSubTabs' : '#toolsSubTabs';
          const tabBtn = document.querySelector(`${selector} .memo-sub-tab[data-section="${sectionId}"]`);
          if (tabBtn) {
            tabBtn.click();
            if (tabId === 'settings' && window.openSettingsAccordion) {
              window.openSettingsAccordion(subtabName);
            }
          }
        }
      }
      sendResponse({ ok: true });
    }
  });

  window.addEventListener('beforeunload', () => {
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SIDE_PANEL_STATE, state: 'CLOSED' });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!chrome.runtime?.id) return;
      try {
        chrome.runtime.sendMessage({ type: MESSAGE_TYPES.RESET_BADGE });
      } catch (e) {
        // Extension context invalidated — ignore
      }
    }
  });
  


  // Donate modal listeners
  const coffeeBtn = document.getElementById('btnHeaderCoffee');
  const donateModal = document.getElementById('donateModal');
  const donateClose = document.getElementById('btnDonateModalClose');

  if (coffeeBtn && donateModal) {
    coffeeBtn.addEventListener('click', () => {
      donateModal.style.display = 'flex';
    });
  }

  // Rate button in header listener
  const rateBtn = document.getElementById('btnHeaderRate');
  if (rateBtn) {
    rateBtn.addEventListener('click', () => {
      const activeLang = getActiveLanguageCode();
      const url = `https://chromewebstore.google.com/detail/chatops++/mmemhnbgmhfaognbfjhienigmmephjgm/reviews?hl=${activeLang === 'vi' ? 'vi' : 'en'}&authuser=0`;
      window.open(url, '_blank');
    });
  }

  // Help / Guide button — click to replay interactive tour
  const helpBtn = document.getElementById('btnHeaderHelp');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      startTour();
    });
  }

  if (donateClose && donateModal) {
    donateClose.addEventListener('click', () => {
      donateModal.style.display = 'none';
    });
  }

  if (donateModal) {
    donateModal.addEventListener('click', (e) => {
      if (e.target === donateModal) {
        donateModal.style.display = 'none';
      }
    });
  }
  // Global delegated click listener for collapsible items
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.collapse-btn');
    if (btn) {
      const cardEl = btn.closest('.post-item') || btn.closest('.memo-item');
      if (cardEl) {
        const bodyEl = cardEl.querySelector('.collapsible-body') || cardEl.querySelector('.memo-note-text');
        const postPreviewEl = cardEl.querySelector('.post-preview');
        
        btn.classList.toggle('expanded');
        if (btn.classList.contains('expanded')) {
          btn.innerHTML = '▼';
          if (bodyEl) bodyEl.classList.remove('collapsed');
          if (postPreviewEl) postPreviewEl.style.display = 'block';
        } else {
          btn.innerHTML = '▶';
          if (bodyEl) bodyEl.classList.add('collapsed');
          if (postPreviewEl) postPreviewEl.style.display = 'none';
        }
      }
    }
    const bottomCollapseBtn = e.target.closest('.btn-collapse-bottom');
    if (bottomCollapseBtn) {
      const cardEl = bottomCollapseBtn.closest('.memo-item');
      if (cardEl) {
        const topCollapseBtn = cardEl.querySelector('.collapse-btn');
        if (topCollapseBtn && topCollapseBtn.classList.contains('expanded')) {
          topCollapseBtn.click();
          cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    const link = e.target.closest('.post-jump-link');
    if (!link) return;
    
    e.preventDefault();
    const url = link.href;
    const postId = link.dataset.postId;
    const rootId = link.dataset.rootId;

    if (document.body.classList.contains('modal-mode')) {
      console.log(`[ChatOps Ext] Post-jump link clicked in modal mode. Closing modal and navigating internally: ${url}`);
      window.parent.postMessage({
        type: 'NAVIGATE_CHATOPS_PATH',
        url: url,
        postId: postId,
        rootId: rootId
      }, '*');
      return;
    }

    const triggerThreadOpen = (tabId) => {
      if (!postId) return;
      console.log(`[ChatOps Ext] Sending open_post_thread to tab ${tabId} for post ${postId}`);
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: "open_post_thread",
          postId: postId,
          rootId: rootId
        }, () => {
          if (chrome.runtime.lastError) {
            // Ignore
          }
        });
      }, 800);
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.url?.includes(CHATOPS_CONFIG.DOMAIN)) {
        chrome.tabs.sendMessage(activeTab.id, {
          type: 'NAVIGATE_INTERNALLY',
          url: url,
          postId: postId,
          rootId: rootId
        }, () => {
          if (chrome.runtime.lastError) {
            chrome.tabs.update(activeTab.id, { url }, () => {
              triggerThreadOpen(activeTab.id);
            });
          }
        });
      } else {
        chrome.tabs.query({ currentWindow: true }, (allTabs) => {
          const chatOpsTab = allTabs.find(t => t.url?.includes(CHATOPS_CONFIG.DOMAIN));
          if (chatOpsTab) {
            chrome.tabs.update(chatOpsTab.id, { active: true }, () => {
              setTimeout(() => {
                chrome.tabs.sendMessage(chatOpsTab.id, {
                  type: 'NAVIGATE_INTERNALLY',
                  url: url,
                  postId: postId,
                  rootId: rootId
                }, () => {
                  if (chrome.runtime.lastError) {
                    chrome.tabs.update(chatOpsTab.id, { url }, () => {
                      triggerThreadOpen(chatOpsTab.id);
                    });
                  }
                });
              }, 150);
            });
          } else {
            chrome.tabs.create({ url }, (newTab) => {
              setTimeout(() => {
                triggerThreadOpen(newTab.id);
              }, 1200);
            });
          }
        });
      }
    });
  });
}

/**
 * Global Modal Manager for Overlay Action Forms
 */
const ModalManager = {
  activeForm: null,
  activePlaceholderId: null,

  open(title, formId, placeholderId, onOpen = null) {
    const modal = document.getElementById('spGlobalModal');
    const modalTitle = document.getElementById('spGlobalModalTitle');
    const modalBody = document.getElementById('spGlobalModalBody');
    const form = document.getElementById(formId);

    if (!modal || !modalTitle || !modalBody || !form) {
      console.error('[ChatOps Ext] Modal elements or target form not found!', { formId, placeholderId });
      return;
    }

    if (this.activeForm) {
      this.close();
    }

    this.activeForm = form;
    this.activePlaceholderId = placeholderId;

    modalTitle.textContent = title;
    modalBody.appendChild(form);
    modal.style.display = 'flex';

    if (onOpen) onOpen();

    // Prevent automatic browser focus when modal is shown/appended
    if (document.activeElement && modal.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    setTimeout(() => {
      if (document.activeElement && modal.contains(document.activeElement)) {
        document.activeElement.blur();
      }
    }, 50);
  },

  close() {
    const modal = document.getElementById('spGlobalModal');
    const placeholder = document.getElementById(this.activePlaceholderId);
    const modalBody = document.getElementById('spGlobalModalBody');

    if (this.activeForm && placeholder) {
      placeholder.appendChild(this.activeForm);
    }

    if (modal) modal.style.display = 'none';
    if (modalBody) modalBody.innerHTML = '';

    this.activeForm = null;
    this.activePlaceholderId = null;
  }
};

window.ModalManager = ModalManager;

function setupModalListeners() {
  const modalClose = document.getElementById('spGlobalModalClose');
  const modal = document.getElementById('spGlobalModal');

  modalClose?.addEventListener('click', () => {
    window.ModalManager.close();
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      window.ModalManager.close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
      window.ModalManager.close();
    }
  });

  document.getElementById('btnFabSearch')?.addEventListener('click', () => {
    window.ModalManager.open(
      language.modalSearchTitle,
      'spSearchForm',
      'spSearchFormPlaceholder'
    );
  });

  document.getElementById('btnFabAddTask')?.addEventListener('click', () => {
    window.ModalManager.open(
      language.modalAddTaskTitle,
      'spTasksForm',
      'spTaskFormPlaceholder'
    );
  });

  document.getElementById('btnFabAddNote')?.addEventListener('click', () => {
    window.ModalManager.open(
      language.modalAddNoteTitle,
      'spMemoForm',
      'spMemoFormPlaceholder'
    );
  });

  document.getElementById('btnFabScanMentions')?.addEventListener('click', () => {
    window.ModalManager.open(
      language.modalScannerFiltersTitle,
      'spMentionsForm',
      'spMentionsFormPlaceholder'
    );
  });
}

/**
 * Sets up the dynamic Language Flag Toggle button in the header
 */
function setupLanguageToggle() {
  const btnHeaderLang = document.getElementById('btnHeaderLang');
  if (!btnHeaderLang) return;

  // Initialize flag display based on active language
  const currentLang = getActiveLanguageCode();
  btnHeaderLang.textContent = currentLang === 'en' ? 'EN' : 'VI';

  btnHeaderLang.addEventListener('click', async () => {
    const activeLang = getActiveLanguageCode();
    const nextLang = activeLang === 'en' ? 'vi' : 'en';

    // 1. Save language preference to chrome storage
    await chrome.storage.local.set({ app_lang: nextLang });

    // 2. Hot-swap the mutated language dictionary in-place
    setLanguage(nextLang);

    // 3. Immediately translate static DOM elements in the side panel
    applyI18n();

    // Re-translate workspace dropdown option text and selected text if 'all' is selected
    const allText = language.allWorkspacesOption || 'Tất cả';
    document.querySelectorAll('.custom-dropdown-option[data-value="all"]').forEach(opt => {
      opt.textContent = allText;
    });
    if (state.getTeam()?.id === 'all') {
      state.setTeam({ id: 'all', display_name: allText });
      const labelEls = [
        document.querySelector('#spWorkspaceDropdownSearch .selected-text'),
        document.querySelector('#spWorkspaceDropdownMentions .selected-text'),
        document.querySelector('#spWorkspaceDropdown .selected-text')
      ];
      labelEls.forEach(el => {
        if (el) el.textContent = allText;
      });
    }

    // Re-render tabs dynamically to translate content, empty states and labels
    if (typeof reRenderMentions === 'function') reRenderMentions();
    if (typeof loadTasks === 'function') loadTasks();
    if (typeof loadMemos === 'function') loadMemos();
    if (typeof loadGroupReminders === 'function') loadGroupReminders();
    if (typeof renderCategories === 'function') renderCategories();
    if (typeof renderTabOrderList === 'function') renderTabOrderList();

    // 4. Update the flag button display
    btnHeaderLang.textContent = nextLang === 'en' ? 'EN' : 'VI';


    // 5. Update custom select trigger text if the settings tab is open/rendered
    document.querySelectorAll('.custom-select-wrapper').forEach(wrapper => {
      const select = wrapper.querySelector('select');
      const trigger = wrapper.querySelector('.custom-select-trigger span');
      if (select && trigger) {
        const activeOpt = select.querySelector(`option[value="${select.value}"]`);
        if (activeOpt) {
          const i18nKey = activeOpt.getAttribute('data-i18n');
          if (i18nKey && language[i18nKey]) {
            trigger.textContent = language[i18nKey];
          }
        }
      }
    });

    // Update custom dropdown elements (created by convertToCustomDropdown)
    document.querySelectorAll('.custom-dropdown-container').forEach(container => {
      const select = container.previousElementSibling;
      if (select && select.tagName === 'SELECT') {
        const toggleSpan = container.querySelector('.custom-dropdown-selected-text');
        if (toggleSpan) {
          const activeOpt = select.options[select.selectedIndex];
          if (activeOpt) {
            toggleSpan.textContent = activeOpt.textContent;
          }
        }
        // Also update the options list text
        const items = container.querySelectorAll('.custom-dropdown-item');
        items.forEach(item => {
          const val = item.getAttribute('data-value');
          const opt = select.querySelector(`option[value="${val}"]`);
          if (opt) {
            item.textContent = opt.textContent;
          }
        });
      }
    });

    // 6. Refresh active views to render correct dynamic translations
    updateRateLinks();
    renderCategories();
    if (typeof loadMemos === 'function') loadMemos();
    if (typeof loadTasks === 'function') loadTasks();
    if (typeof renderSidepanelMemes === 'function') renderSidepanelMemes();
    if (typeof renderTabOrderList === 'function') renderTabOrderList();

    // 7. Broadcast the change to other contexts (background, active content script tabs)
    chrome.runtime.sendMessage({ type: 'APP_LANG_CHANGED', lang: nextLang });
    chrome.tabs.query({}).then((tabs) => {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'APP_LANG_CHANGED', lang: nextLang }).catch(() => {
          // Ignore tabs where content scripts aren't loaded or supported
        });
      }
    });
  });
}

/**
 * Updates review links' href attributes based on the current language
 */
function updateRateLinks() {
  const activeLang = getActiveLanguageCode();
  const url = `https://chromewebstore.google.com/detail/chatops++/mmemhnbgmhfaognbfjhienigmmephjgm/reviews?hl=${activeLang === 'vi' ? 'vi' : 'en'}&authuser=0`;
  
  const rateAppStore = document.getElementById('btnRateAppStore');
  if (rateAppStore) {
    rateAppStore.setAttribute('href', url);
  }
  const donateRateLink = document.getElementById('btnDonateRateLink');
  if (donateRateLink) {
    donateRateLink.setAttribute('href', url);
  }
}






