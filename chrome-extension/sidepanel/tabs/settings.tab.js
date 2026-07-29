import { STORAGE_KEYS, CHATOPS_CONFIG, MESSAGE_TYPES, DEFAULT_MEMES } from '../../src/constants.js';
import { language, setLanguage, applyI18n } from '../../src/lang.js';
import { getCustomEmojis, getConfig, searchCustomEmojis } from '../../src/api/index.js';
import { needsChatOpsConversion, convertForChatOps } from '../../src/utils/imageConverter.js';
let chatopsUrl = CHATOPS_CONFIG.DEFAULT_URL;
const customEmojiMap = new Map();
let cachedCustomEmojis = []; // Local cache of loaded custom emojis
let customEmojiPage = 0; // Current scroll pagination page index
let hasMoreCustomEmojis = true; // Boolean flag to indicate end of workspace custom emojis
let isLoadingCustomEmojis = false; // Flag to prevent redundant parallel page queries

const STANDARD_EMOJIS = [
  // ─── Smileys & Emotions ───
  { name: 'thumbsup', char: '👍' },
  { name: 'heart', char: '❤️' },
  { name: 'fire', char: '🔥' },
  { name: 'rocket', char: '🚀' },
  { name: 'tada', char: '🎉' },
  { name: 'laughing', char: '😂' },
  { name: 'smile', char: '😄' },
  { name: 'wink', char: '😉' },
  { name: 'heart_eyes', char: '😍' },
  { name: 'kissing_heart', char: '😘' },
  { name: 'sunglasses', char: '😎' },
  { name: 'joy', char: '😂' },
  { name: 'sweat_smile', char: '😅' },
  { name: 'sob', char: '😭' },
  { name: 'scream', char: '😱' },
  { name: 'angry', char: '😠' },
  { name: 'rage', char: '😡' },
  { name: 'thinking', char: '🤔' },
  { name: 'shushing_face', char: '🤫' },
  { name: 'exploding_head', char: '🤯' },
  { name: 'clown_face', char: '🤡' },
  { name: 'smiling_imp', char: '😈' },
  { name: 'poop', char: '💩' },
  
  // ─── Gestures & Body ───
  { name: 'clap', char: '👏' },
  { name: 'raised_hands', char: '🙌' },
  { name: 'open_hands', char: '👐' },
  { name: 'pray', char: '🙏' },
  { name: 'ok_hand', char: '👌' },
  { name: 'punch', char: '👊' },
  { name: 'fist', char: '✊' },
  { name: 'v', char: '✌️' },
  { name: 'point_up', char: '👆' },
  { name: 'point_down', char: '👇' },
  { name: 'point_left', char: '👈' },
  { name: 'point_right', char: '👉' },
  { name: 'wave', char: '👋' },
  { name: 'muscle', char: '💪' },
  { name: 'eyes', char: '👀' },
  { name: 'brain', char: '🧠' },

  // ─── Animals & Nature ───
  { name: 'dog', char: '🐶' },
  { name: 'cat', char: '🐱' },
  { name: 'mouse', char: '🐭' },
  { name: 'fox_face', char: '🦊' },
  { name: 'bear', char: '🐻' },
  { name: 'panda_face', char: '🐼' },
  { name: 'koala', char: '🐨' },
  { name: 'tiger', char: '🐯' },
  { name: 'lion', char: '🦁' },
  { name: 'cow', char: '🐮' },
  { name: 'pig', char: '🐷' },
  { name: 'monkey_face', char: '🐵' },
  { name: 'chicken', char: '🐔' },
  { name: 'penguin', char: '🐧' },
  { name: 'bird', char: '🐦' },
  { name: 'duck', char: '🦆' },
  { name: 'eagle', char: '🦅' },
  { name: 'owl', char: '🦉' },
  { name: 'bee', char: '🐝' },
  { name: 'bug', char: '🐛' },
  { name: 'butterfly', char: '🦋' },
  { name: 'snail', char: '🐌' },
  { name: 'ladybug', char: '🐞' },
  { name: 'ant', char: '🐜' },
  { name: 'spider', char: '🕷️' },
  { name: 'octopus', char: '🐙' },
  { name: 'squid', char: '🦑' },
  { name: 'crab', char: '🦀' },
  { name: 'tropical_fish', char: '🐠' },
  { name: 'dolphin', char: '🐬' },
  { name: 'whale', char: '🐳' },
  { name: 'shark', char: '🦈' },
  { name: 'crocodile', char: '🐊' },
  { name: 't-rex', char: '🦖' },
  { name: 'unicorn', char: '🦄' },

  // ─── Food & Drink ───
  { name: 'green_apple', char: '🍏' },
  { name: 'apple', char: '🍎' },
  { name: 'tangerine', char: '🍊' },
  { name: 'lemon', char: '🍋' },
  { name: 'banana', char: '🍌' },
  { name: 'watermelon', char: '🍉' },
  { name: 'grapes', char: '🍇' },
  { name: 'strawberry', char: '🍓' },
  { name: 'cherries', char: '🍒' },
  { name: 'peach', char: '🍑' },
  { name: 'pineapple', char: '🍍' },
  { name: 'coconut', char: '🥥' },
  { name: 'kiwi_fruit', char: '🥝' },
  { name: 'tomato', char: '🍅' },
  { name: 'eggplant', char: '🍆' },
  { name: 'avocado', char: '🥑' },
  { name: 'hot_pepper', char: '🌶️' },
  { name: 'corn', char: '🌽' },
  { name: 'carrot', char: '🥕' },
  { name: 'bread', char: '🍞' },
  { name: 'croissant', char: '🥐' },
  { name: 'hamburger', char: '🍔' },
  { name: 'fries', char: '🍟' },
  { name: 'pizza', char: '🍕' },
  { name: 'hotdog', char: '🌭' },
  { name: 'sandwich', char: '🥪' },
  { name: 'taco', char: '🌮' },
  { name: 'sushi', char: '🍣' },
  { name: 'ramen', char: '🍜' },
  { name: 'dumpling', char: '🥟' },
  { name: 'icecream', char: '🍦' },
  { name: 'doughnut', char: '🍩' },
  { name: 'cookie', char: '🍪' },
  { name: 'chocolate_bar', char: '🍫' },
  { name: 'candy', char: '🍬' },
  { name: 'popcorn', char: '🍿' },
  { name: 'mate', char: '🧉' },

  // ─── Hearts & Colors ───
  { name: 'broken_heart', char: '💔' },
  { name: 'sparkling_heart', char: '💖' },
  { name: 'two_hearts', char: '💕' },
  { name: 'blue_heart', char: '💙' },
  { name: 'green_heart', char: '💚' },
  { name: 'yellow_heart', char: '💛' },
  { name: 'purple_heart', char: '💜' },
  { name: 'orange_heart', char: '🧡' },
  { name: 'black_heart', char: '🖤' },
  { name: 'white_heart', char: '🤍' },
  { name: '100', char: '💯' },

  // ─── Celebration & Activities ───
  { name: 'confetti_ball', char: '🎊' },
  { name: 'balloon', char: '🎈' },
  { name: 'gift', char: '🎁' },
  { name: 'sparkles', char: '✨' },
  { name: 'beer', char: '🍺' },
  { name: 'beers', char: '🍻' },
  { name: 'wine_glass', char: '🍷' },
  { name: 'coffee', char: '☕' },
  { name: 'cake', char: '🍰' },
  { name: 'trophy', char: '🏆' },
  { name: 'medal', char: '🏅' },
  { name: 'crown', char: '👑' },
  { name: 'star', char: '⭐' },
  { name: 'sparkler', char: '🎇' },

  // ─── Sports & Travel ───
  { name: 'soccer', char: '⚽' },
  { name: 'basketball', char: '🏀' },
  { name: 'football', char: '🏈' },
  { name: 'baseball', char: '⚾' },
  { name: 'tennis', char: '🎾' },
  { name: 'volleyball', char: '🏐' },
  { name: '8ball', char: '🎱' },
  { name: 'ping_pong', char: '🏓' },
  { name: 'badminton', char: '🏸' },
  { name: 'boxing_glove', char: '🥊' },
  { name: 'bicyclist', char: '🚴' },
  { name: 'runner', char: '🏃' },
  { name: 'yoga', char: '🧘' },
  { name: 'swimmer', char: '🏊' },
  { name: 'airplane', char: '✈️' },
  { name: 'car', char: '🚗' },
  { name: 'bike', char: '🚲' },
  { name: 'world_map', char: '🗺️' },
  { name: 'volcano', char: '🌋' },
  { name: 'tent', char: '⛺' },

  // ─── Office & Technology ───
  { name: 'computer', char: '💻' },
  { name: 'phone', char: '📱' },
  { name: 'bell', char: '🔔' },
  { name: 'bulb', char: '💡' },
  { name: 'moneybag', char: '💰' },
  { name: 'chart_with_upwards_trend', char: '📈' },
  { name: 'calendar', char: '📅' },
  { name: 'clipboard', char: '📋' },
  { name: 'pushpin', char: '📌' },
  { name: 'key', char: '🔑' },
  { name: 'lock', char: '🔒' },
  { name: 'memo', char: '📒' },
  { name: 'book', char: '📖' },
  { name: 'hammer_and_wrench', char: '🛠️' },

  // ─── Nature & Symbols ───
  { name: 'sun', char: '☀️' },
  { name: 'crescent_moon', char: '🌙' },
  { name: 'rainbow', char: '🌈' },
  { name: 'cloud', char: '☁️' },
  { name: 'umbrella', char: '☔' },
  { name: 'snowflake', char: '❄️' },
  { name: 'zap', char: '⚡' },
  { name: 'warning', char: '⚠️' },
  { name: 'no_entry', char: '⛔' },
  { name: 'checkoff-later', char: '✔️' },
  { name: 'x', char: '❌' },
  { name: 'question', char: '❓' },
  { name: 'exclamation', char: '❗' },
  { name: 'arrows_counterclockwise', char: '🔄' },
  { name: 'gem', char: '💎' },
  { name: 'heart_decoration', char: '💟' }
];

let _state = null;

const DEFAULT_SETTINGS = {
  snoozeMinutes: 5,
  staleThresholdMinutes: 30,
  notificationPosition: 'center',
  notificationAnimation: 'default',
  notificationSize: 'medium',
  headerColor: '#1c58d9',
  headerTextColor: '#ffffff',
  navColor: '#1153ab',
  tabTextColor: '#ffffff',
  accentColor: '#1c58d9',
  accentTextColor: '#ffffff',
  tabsCompactMode: false,
  showTabs: {
    search: true,
    tasks: true, // Always true
    notes: true,
    missed: true,
    reactions: true,
    reminders: true
  },
  promoteTabs: {
    tasks: true,
    notes: true,
    search: true,
    images: false,
    reactions: false,
    mentions: true,
    reminders: true
  },
  floatingButtons: {
    quickNote: true,
    quickTask: true,
    groupReminder: true,
    spamReactions: false,
    reactAlong: false,
    imagePicker: true,
    templatePicker: true,
    quickReply: false,
    quickCopy: false,
    quickMeet: true
  },
  memoCategories: ['General', 'Work'],
  spamEnabled: true,
  memeEnabled: true,
  giphyApiKey: '',
  giphySize: '200',
  spamEmojis: ['thumbsup', 'heart', 'fire', 'rocket', 'tada', 'laughing', 'smile', 'wink', 'heart_eyes', 'kissing_heart'],
  notificationType: 'in-page',
  appPadding: '12px',
  quickDelete: false,
  soundNotification: false,
  customButtonsPosition: 'above',
  activeReactionGroupId: 0,
  reactionGroups: null,
  reactAlongEnabled: false
};

/**
 * Initializes the Settings Tab
 * @param {Object} state - Centralized state module
 */
export async function setup(state) {
  _state = state;
  await loadAndApplySettings();
  setupEventListeners();
}

export async function getSettings() {
  const res = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
  const rawSettings = res[STORAGE_KEYS.SETTINGS] || {};
  const settings = { 
    ...DEFAULT_SETTINGS, 
    ...rawSettings,
    showTabs: { ...DEFAULT_SETTINGS.showTabs, ...rawSettings.showTabs },
    floatingButtons: { ...DEFAULT_SETTINGS.floatingButtons, ...rawSettings.floatingButtons },
    promoteTabs: { ...DEFAULT_SETTINGS.promoteTabs, ...rawSettings.promoteTabs }
  };
  window.activeSettings = settings;

  if (!settings.reactionGroups) {
    settings.reactionGroups = [
      { id: 0, name: 'Nhóm 1', emojis: Array.isArray(settings.spamEmojis) ? settings.spamEmojis : ['thumbsup', 'heart', 'fire', 'rocket', 'tada'] },
      { id: 1, name: 'Nhóm 2', emojis: ['laughing', 'smile', 'wink', 'heart_eyes', 'kissing_heart'] },
      { id: 2, name: 'Nhóm 3', emojis: [] },
      { id: 3, name: 'Nhóm 4', emojis: [] },
      { id: 4, name: 'Nhóm 5', emojis: [] }
    ];
  }

  // Auto-migrate old Vietnamese default categories to English
  if (settings.memoCategories) {
    const vnToEnMap = {
      'chung': 'General',
      'công việc': 'Work',
      'cá nhân': 'Personal',
      'ý tưởng': 'Ideas'
    };
    let migrated = false;
    const newCategories = settings.memoCategories.map(cat => {
      const lower = cat.trim().toLowerCase();
      if (vnToEnMap[lower]) {
        migrated = true;
        return vnToEnMap[lower];
      }
      return cat;
    });

    if (migrated) {
      settings.memoCategories = newCategories;
      await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings });
    }
  }

  // Auto-migrate: Promote search tab to main nav by default
  const migratedKey = 'migrated_promote_search_tab';
  const migrationRes = await chrome.storage.local.get([migratedKey]);
  if (!migrationRes[migratedKey]) {
    settings.promoteTabs.search = true;
    if (settings.tabOrder && !settings.tabOrder.includes('tools-search')) {
      const toolsIdx = settings.tabOrder.indexOf('tools');
      if (toolsIdx !== -1) {
        settings.tabOrder.splice(toolsIdx, 0, 'tools-search');
      } else {
        settings.tabOrder.push('tools-search');
      }
    }
    await chrome.storage.local.set({ 
      [STORAGE_KEYS.SETTINGS]: settings,
      [migratedKey]: true 
    });
  }

  return settings;
}

async function loadAndApplySettings() {
  const settings = await getSettings();

  const snoozeInput = document.getElementById('settingSnoozeMinutes');
  if (snoozeInput) {
    snoozeInput.value = settings.snoozeMinutes;
  }

  const staleThresholdInput = document.getElementById('settingStaleThresholdMinutes');
  if (staleThresholdInput) {
    staleThresholdInput.value = settings.staleThresholdMinutes ?? 30;
  }

  const giphyApiKeyInput = document.getElementById('settingGiphyApiKey');
  if (giphyApiKeyInput) {
    giphyApiKeyInput.value = settings.giphyApiKey || '';
  }


  const giphySizeSelect = document.getElementById('settingGiphySize');
  if (giphySizeSelect) {
    giphySizeSelect.value = settings.giphySize || '200';
  }
  

  const notificationTypeSelect = document.getElementById('settingNotificationType');
  if (notificationTypeSelect) {
    notificationTypeSelect.value = settings.notificationType || 'both';
  }

  const notificationPosSelect = document.getElementById('settingNotificationPosition');
  if (notificationPosSelect) {
    notificationPosSelect.value = settings.notificationPosition || 'top-right';
  }

  const notificationAnimSelect = document.getElementById('settingNotificationAnimation');
  if (notificationAnimSelect) {
    notificationAnimSelect.value = settings.notificationAnimation || 'default';
  }

  const notificationSizeSelect = document.getElementById('settingNotificationSize');
  if (notificationSizeSelect) {
    notificationSizeSelect.value = settings.notificationSize || 'medium';
  }

  const appPaddingSelect = document.getElementById('settingAppPadding');
  if (appPaddingSelect) {
    appPaddingSelect.value = settings.appPadding || '12px';
  }
  
  // Apply colors to pickers
  const colorKeys = ['headerColor', 'headerTextColor', 'navColor', 'tabTextColor', 'accentColor', 'accentTextColor'];
  colorKeys.forEach(key => {
    const row = document.querySelector(`.color-presets-row[data-key="${key}"]`);
    if (row) {
      const activeColor = settings[key] || DEFAULT_SETTINGS[key];
      let matchedPreset = false;
      const presets = row.querySelectorAll('.color-preset:not(.color-preset-custom-wrapper)');
      presets.forEach(btn => {
        const isMatched = btn.dataset.color === activeColor;
        btn.classList.toggle('active', isMatched);
        if (isMatched) matchedPreset = true;
      });

      const customWrapper = row.querySelector('.color-preset-custom-wrapper');
      if (customWrapper) {
        const customInput = customWrapper.querySelector('.custom-color-picker-input');
        if (!matchedPreset && activeColor) {
          customWrapper.classList.add('active');
          customWrapper.dataset.color = activeColor;
          customWrapper.style.background = activeColor;
          if (customInput) customInput.value = activeColor;
        } else {
          customWrapper.classList.remove('active');
          customWrapper.dataset.color = '';
          customWrapper.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
          if (customInput) customInput.value = '#000000';
        }
      }
    }
  });
  
  // Apply toggles
  document.getElementById('settingShowSearch').checked = settings.showTabs.search !== false;
  document.getElementById('settingShowTasks').checked = settings.showTabs.tasks !== false;
  document.getElementById('settingShowNotes').checked = settings.showTabs.notes !== false;
  document.getElementById('settingShowMissed').checked = settings.showTabs.missed !== false;

  const settingShowReactionsEl = document.getElementById('settingShowReactions');
  if (settingShowReactionsEl) settingShowReactionsEl.checked = settings.showTabs.reactions !== false;

  const settingShowRemindersEl = document.getElementById('settingShowReminders');
  if (settingShowRemindersEl) settingShowRemindersEl.checked = settings.showTabs.reminders !== false;

  // Apply promote toggles
  const promoteTasksEl = document.getElementById('settingPromoteTasks');
  if (promoteTasksEl) promoteTasksEl.checked = settings.promoteTabs?.tasks !== false;

  const promoteNotesEl = document.getElementById('settingPromoteNotes');
  if (promoteNotesEl) promoteNotesEl.checked = settings.promoteTabs?.notes !== false;

  const promoteSearchEl = document.getElementById('settingPromoteSearch');
  if (promoteSearchEl) promoteSearchEl.checked = settings.promoteTabs?.search === true;

  const promoteMentionsEl = document.getElementById('settingPromoteMentions');
  if (promoteMentionsEl) promoteMentionsEl.checked = settings.promoteTabs?.mentions !== false;

  const promoteImagesEl = document.getElementById('settingPromoteImages');
  if (promoteImagesEl) promoteImagesEl.checked = settings.promoteTabs?.images === true;

  const promoteReactionsEl = document.getElementById('settingPromoteReactions');
  if (promoteReactionsEl) promoteReactionsEl.checked = settings.promoteTabs?.reactions === true;

  const promoteRemindersEl = document.getElementById('settingPromoteReminders');
  if (promoteRemindersEl) promoteRemindersEl.checked = settings.promoteTabs?.reminders === true;

  // Apply floating buttons checkboxes
  document.getElementById('settingFloatingQuickTask').checked = settings.floatingButtons?.quickTask !== false;
  document.getElementById('settingFloatingQuickNote').checked = settings.floatingButtons?.quickNote !== false;
  document.getElementById('settingFloatingSpamReactions').checked = settings.floatingButtons?.spamReactions !== false;
  document.getElementById('settingReactAlongEnabled').checked = settings.floatingButtons?.reactAlong !== false;
  document.getElementById('settingFloatingImagePicker').checked = settings.floatingButtons?.imagePicker !== false;
  document.getElementById('settingFloatingTemplatePicker').checked = settings.floatingButtons?.templatePicker !== false;
  document.getElementById('settingFloatingQuickReply').checked = settings.floatingButtons?.quickReply !== false;
  document.getElementById('settingFloatingQuickCopy').checked = settings.floatingButtons?.quickCopy !== false;
  const grToggle = document.getElementById('settingFloatingGroupReminder');
  if (grToggle) grToggle.checked = settings.floatingButtons?.groupReminder !== false;
  const qmToggle = document.getElementById('settingFloatingQuickMeet');
  if (qmToggle) qmToggle.checked = settings.floatingButtons?.quickMeet !== false;

  // Sync disabled/dimmed states
  updateFloatingCheckboxesSync(settings);

  // Apply Menu Tabs, Floating Buttons, and Data Storage accordions open/close state
  const resAcc = await chrome.storage.local.get(['accordionMenuTabsOpen', 'accordionFloatingButtonsOpen', 'accordionDataStorageOpen']);
  
  const menuTabsOpen = resAcc.accordionMenuTabsOpen !== false;
  const menuTabsAcc = document.getElementById('accordionMenuTabs');
  if (menuTabsAcc) {
    menuTabsAcc.classList.toggle('open', menuTabsOpen);
  }

  const floatingButtonsOpen = resAcc.accordionFloatingButtonsOpen !== false;
  const floatingButtonsAcc = document.getElementById('accordionFloatingButtons');
  if (floatingButtonsAcc) {
    floatingButtonsAcc.classList.toggle('open', floatingButtonsOpen);
  }

  const dataStorageOpen = resAcc.accordionDataStorageOpen === true;
  const dataStorageAcc = document.getElementById('accordionDataStorage');
  if (dataStorageAcc) {
    dataStorageAcc.classList.toggle('open', dataStorageOpen);
  }

  // Apply categories
  renderCategoryList(settings.memoCategories || []);

  // Apply tab order and render list
  if (settings.tabOrder) {
    applyTabOrderToDOM(settings.tabOrder);
  }
  await renderTabOrderList();

  // Fetch chatopsUrl
  const config = await getConfig();
  chatopsUrl = config.chatopsUrl || CHATOPS_CONFIG.DEFAULT_URL;

  // Apply spam reactions configuration area state (always active and interactive)
  const configArea = document.getElementById('reactionsConfigArea');
  if (configArea) {
    configArea.style.opacity = '1';
    configArea.style.pointerEvents = 'auto';
  }

  // Apply personal memes toggle
  const chkMemeEnabled = document.getElementById('settingMemeEnabled');
  if (chkMemeEnabled) {
    chkMemeEnabled.checked = settings.memeEnabled !== false;
    const configArea = document.getElementById('personalMemesConfigArea');
    if (configArea) {
      configArea.style.opacity = '1';
      configArea.style.pointerEvents = 'auto';
    }
  }

  const chkQuickDelete = document.getElementById('settingQuickDelete');
  if (chkQuickDelete) {
    chkQuickDelete.checked = settings.quickDelete === true;
  }

  const chkSoundNotification = document.getElementById('settingSoundNotification');
  if (chkSoundNotification) {
    chkSoundNotification.checked = settings.soundNotification === true;
  }

  const customButtonsPosSelect = document.getElementById('settingCustomButtonsPosition');
  if (customButtonsPosSelect) {
    customButtonsPosSelect.value = settings.customButtonsPosition || 'before';
  }

  // Pre-load selected, standard grid, and personal memes
  renderReactionGroups(settings);
  renderSelectedEmojis(settings);
  renderStandardEmojiGrid(settings);
  renderSidepanelMemes();

  applyThemeToDOM(settings);
  applyTabRepositioning(settings, settings.showTabs);
  applyTabVisibilityToDOM(settings);
  
  // Update snooze hint text dynamically
  const snoozeHint = document.getElementById('snoozeHintText');
  if (snoozeHint) {
    snoozeHint.innerHTML = language.taskReminderHint.replace('{minutes}', settings.snoozeMinutes);
  }


  if (typeof window.convertToCustomDropdown === 'function') {
    window.convertToCustomDropdown('settingNotificationType', '220px');
    window.convertToCustomDropdown('settingNotificationPosition', '220px');
    window.convertToCustomDropdown('settingNotificationAnimation', '220px');
    window.convertToCustomDropdown('settingNotificationSize', '220px');
    window.convertToCustomDropdown('settingAppPadding', '200px');
    window.convertToCustomDropdown('settingCustomButtonsPosition', '180px');
  }

  // Validate Giphy API Key on load
  if (settings.giphyApiKey) {
    validateGiphyApiKey(settings.giphyApiKey);
  }


}

async function validateGiphyApiKey(key) {
  const statusEl = document.getElementById('settingGiphyApiKeyStatus');
  if (!statusEl) return;

  if (!key) {
    statusEl.style.display = 'none';
    statusEl.textContent = '';
    statusEl.removeAttribute('data-i18n');
    return;
  }

  statusEl.setAttribute('data-i18n', 'giphyCheckingKey');
  statusEl.textContent = language.giphyCheckingKey;
  statusEl.style.color = 'var(--text-3)';
  statusEl.style.display = 'block';

  try {
    const res = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=1`);
    if (res.ok) {
      statusEl.setAttribute('data-i18n', 'giphyValidKey');
      statusEl.textContent = language.giphyValidKey;
      statusEl.style.color = '#10b981'; // Green
    } else {
      statusEl.setAttribute('data-i18n', 'giphyInvalidKey');
      statusEl.textContent = language.giphyInvalidKey;
      statusEl.style.color = '#ef4444'; // Red
    }
  } catch (err) {
    statusEl.setAttribute('data-i18n', 'giphyConnectionError');
    statusEl.textContent = language.giphyConnectionError;
    statusEl.style.color = '#ef4444'; // Red
  }
}


function setupEventListeners() {
  const fileInput = document.getElementById('sidepanel-meme-upload');
  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      if (files.length > 5) {
        showErrorFeedback(language.maxUploadLimitError || 'Bạn chỉ có thể tải lên tối đa 5 ảnh cùng lúc.');
        fileInput.value = '';
        return;
      }

      const res = await chrome.storage.local.get(['custom_memes']);
      const customMemes = res.custom_memes || [];

      const getBase64Size = (url) => {
        if (!url) return 0;
        const base64Part = url.split(',')[1];
        if (!base64Part) return url.length;
        const padding = base64Part.endsWith('==') ? 2 : (base64Part.endsWith('=') ? 1 : 0);
        return (base64Part.length * 3 / 4) - padding;
      };

      let totalBytes = 0;
      customMemes.forEach(url => {
        totalBytes += getBase64Size(url);
      });

      let hitLimit = false;

      for (const file of files) {
        const isGifOrJpeg = file.type === 'image/gif' || file.type === 'image/jpeg' || file.type === 'image/jpg';
        const isAnimatedGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');
        if (!file.type.startsWith('image/') && !isAnimatedGif) {
          showErrorFeedback(`${file.name}: ${language.uploadOnlyImages}`);
          continue;
        }

        let dataUrl;
        if (needsChatOpsConversion(file.type, file.name)) {
          showSuccessFeedback(language.webpConvertingToast || 'Converting image... Please wait.');
          try {
            const converted = await convertForChatOps(file);
            dataUrl = converted.dataUrl;
            showSuccessFeedback(converted.type === 'image/gif'
              ? (language.webpConvertedToGif || 'Converted to GIF ✅')
              : (language.webpConvertedToPng || 'Converted to PNG ✅'));
          } catch (err) {
            console.error('[ChatOps] Conversion failed:', err);
            showErrorFeedback(`Error converting ${file.name}`);
            continue;
          }
        } else {
          dataUrl = await new Promise((resolve) => {
            if (isGifOrJpeg || isAnimatedGif) {
              const reader = new FileReader();
              reader.onload = (ev) => resolve(ev.target.result);
              reader.readAsDataURL(file);
            } else {
              compressSidepanelImage(file, 1000, 1000, 0.9, (compressedUrl) => {
                resolve(compressedUrl);
              });
            }
          });
        }

        if (dataUrl) {
          const newBytes = getBase64Size(dataUrl);
          if (totalBytes + newBytes > 10 * 1024 * 1024) {
            hitLimit = true;
            break;
          }
          totalBytes += newBytes;
          customMemes.unshift(dataUrl);
        }
      }

      if (hitLimit) {
        showErrorFeedback(language.storageLimitExceeded);
      }

      await chrome.storage.local.set({ custom_memes: customMemes });
      fileInput.value = '';
      renderSidepanelMemes();
    });
  }

  const memesGrid = document.getElementById('sidepanel-memes-grid');
  if (memesGrid) {
    memesGrid.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.sidepanel-meme-delete') || e.target.closest('.chatops-custom-image-delete');
      if (delBtn) {
        e.stopPropagation();
        const idx = parseInt(delBtn.dataset.idx, 10);
        const res = await chrome.storage.local.get(['custom_memes']);
        const customMemes = res.custom_memes || [];
        customMemes.splice(idx, 1);
        await chrome.storage.local.set({ custom_memes: customMemes });
        renderSidepanelMemes();
        return;
      }

      // Preview image when clicking the image itself
      const clickedImg = e.target.closest('img');
      if (clickedImg) {
        const modal = document.getElementById('imagePreviewModal');
        const previewImg = document.getElementById('imgPreviewTarget');
        if (modal && previewImg) {
          previewImg.src = clickedImg.src;
          modal.style.display = 'flex';
        }
      }
    });
  }

  // Close image preview modal handlers
  const btnImgPreviewClose = document.getElementById('btnImagePreviewClose');
  const imgPreviewModal = document.getElementById('imagePreviewModal');
  if (btnImgPreviewClose && imgPreviewModal) {
    btnImgPreviewClose.addEventListener('click', () => {
      imgPreviewModal.style.display = 'none';
    });
    imgPreviewModal.addEventListener('click', (e) => {
      if (e.target === imgPreviewModal) {
        imgPreviewModal.style.display = 'none';
      }
    });
  }

  const snoozeInput = document.getElementById('settingSnoozeMinutes');
  if (snoozeInput) {
    snoozeInput.addEventListener('change', async (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      e.target.value = val;
      await updateSettings({ snoozeMinutes: val });
      
      const snoozeHint = document.getElementById('snoozeHintText');
      if (snoozeHint) {
        snoozeHint.innerHTML = language.taskReminderHint.replace('{minutes}', val);
      }

      // Note: we intentionally do NOT reschedule existing alarms here.
      // The snoozeMinutes setting is read fresh from storage every time an alarm fires
      // in alarms.js (handleTaskAlarm), so the new value takes effect automatically on
      // the next alarm fire. Rescheduling here would incorrectly override initial alarms
      // (tasks not yet fired) causing them to trigger immediately at the snooze interval
      // instead of at the user's originally scheduled time.

      showAutoSaveFeedback();
    });
  }

  const staleThresholdInput = document.getElementById('settingStaleThresholdMinutes');
  if (staleThresholdInput) {
    staleThresholdInput.addEventListener('change', async (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 5) val = 5;
      e.target.value = val;
      await updateSettings({ staleThresholdMinutes: val });
      showAutoSaveFeedback();
    });
  }


  const giphyApiKeyInput = document.getElementById('settingGiphyApiKey');
  if (giphyApiKeyInput) {
    giphyApiKeyInput.addEventListener('change', async (e) => {
      const val = e.target.value.trim();
      await updateSettings({ giphyApiKey: val });
      showAutoSaveFeedback();
      validateGiphyApiKey(val);
    });
  }


  const giphySizeSelect = document.getElementById('settingGiphySize');
  if (giphySizeSelect) {
    giphySizeSelect.addEventListener('change', async (e) => {
      await updateSettings({ giphySize: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const notificationTypeSelect = document.getElementById('settingNotificationType');
  if (notificationTypeSelect) {
    notificationTypeSelect.addEventListener('change', async (e) => {
      await updateSettings({ notificationType: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const notificationPosSelect = document.getElementById('settingNotificationPosition');
  if (notificationPosSelect) {
    notificationPosSelect.addEventListener('change', async (e) => {
      await updateSettings({ notificationPosition: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const notificationAnimSelect = document.getElementById('settingNotificationAnimation');
  if (notificationAnimSelect) {
    notificationAnimSelect.addEventListener('change', async (e) => {
      await updateSettings({ notificationAnimation: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const notificationSizeSelect = document.getElementById('settingNotificationSize');
  if (notificationSizeSelect) {
    notificationSizeSelect.addEventListener('change', async (e) => {
      await updateSettings({ notificationSize: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const appPaddingSelect = document.getElementById('settingAppPadding');
  if (appPaddingSelect) {
    appPaddingSelect.addEventListener('change', async (e) => {
      await updateSettings({ appPadding: e.target.value });
      applyThemeToDOM(await getSettings());
      showAutoSaveFeedback();
    });
  }

  const customButtonsPosSelect = document.getElementById('settingCustomButtonsPosition');
  if (customButtonsPosSelect) {
    customButtonsPosSelect.addEventListener('change', async (e) => {
      await updateSettings({ customButtonsPosition: e.target.value });
      showAutoSaveFeedback();
    });
  }

  const btnTestNotification = document.getElementById('btnTestNotification');
  if (btnTestNotification) {
    btnTestNotification.addEventListener('click', () => {
      const typeVal = document.getElementById('settingNotificationType')?.value || 'both';
      chrome.runtime.sendMessage({ 
        type: MESSAGE_TYPES.TEST_NOTIFICATION, 
        notificationType: typeVal 
      }, (response) => {
        if (response && response.ok) {
          if (typeVal === 'in-page') {
            showSuccessFeedback(language.testBannerSuccess);
          } else if (typeVal === 'system') {
            showSuccessFeedback(language.testSystemSuccess);
          } else {
            showSuccessFeedback(language.testBothSuccess);
          }
        } else if (response && !response.ok) {
          showErrorFeedback(language.testErrorPrefix + response.error);
        } else if (!response) {
          showErrorFeedback(language.testBgWorkerError);
        }
      });
    });
  }

  document.querySelectorAll('.color-preset:not(.color-preset-custom-wrapper)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.color-presets-row');
      if (row) {
        row.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        // Reset the sibling custom color picker wrapper back to original gradient state if a preset was clicked
        const customWrapper = row.querySelector('.color-preset-custom-wrapper');
        if (customWrapper) {
          customWrapper.classList.remove('active');
          customWrapper.dataset.color = '';
          customWrapper.style.background = 'linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)';
          const customInput = customWrapper.querySelector('.custom-color-picker-input');
          if (customInput) customInput.value = '#000000';
        }
        
        // Auto-save structural color
        const newSettings = {
          headerColor: document.querySelector('.color-presets-row[data-key="headerColor"] .color-preset.active, .color-presets-row[data-key="headerColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          headerTextColor: document.querySelector('.color-presets-row[data-key="headerTextColor"] .color-preset.active, .color-presets-row[data-key="headerTextColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          navColor: document.querySelector('.color-presets-row[data-key="navColor"] .color-preset.active, .color-presets-row[data-key="navColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          tabTextColor: document.querySelector('.color-presets-row[data-key="tabTextColor"] .color-preset.active, .color-presets-row[data-key="tabTextColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          accentColor: document.querySelector('.color-presets-row[data-key="accentColor"] .color-preset.active, .color-presets-row[data-key="accentColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          accentTextColor: document.querySelector('.color-presets-row[data-key="accentTextColor"] .color-preset.active, .color-presets-row[data-key="accentTextColor"] .color-preset-custom-wrapper.active')?.dataset.color
        };
        updateSettings(newSettings);
        applyThemeToDOM(newSettings);
        showAutoSaveFeedback();
      }
    });
  });

  document.querySelectorAll('.custom-color-picker-input').forEach(input => {
    const handleCustomColorChange = async (e) => {
      const color = e.target.value;
      const wrapper = e.target.closest('.color-preset-custom-wrapper');
      const row = e.target.closest('.color-presets-row');
      
      if (wrapper && row) {
        row.querySelectorAll('.color-preset').forEach(b => b.classList.remove('active'));
        wrapper.classList.add('active');
        wrapper.dataset.color = color;
        wrapper.style.background = color;
        
        // Auto-save structural color
        const newSettings = {
          headerColor: document.querySelector('.color-presets-row[data-key="headerColor"] .color-preset.active, .color-presets-row[data-key="headerColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          headerTextColor: document.querySelector('.color-presets-row[data-key="headerTextColor"] .color-preset.active, .color-presets-row[data-key="headerTextColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          navColor: document.querySelector('.color-presets-row[data-key="navColor"] .color-preset.active, .color-presets-row[data-key="navColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          tabTextColor: document.querySelector('.color-presets-row[data-key="tabTextColor"] .color-preset.active, .color-presets-row[data-key="tabTextColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          accentColor: document.querySelector('.color-presets-row[data-key="accentColor"] .color-preset.active, .color-presets-row[data-key="accentColor"] .color-preset-custom-wrapper.active')?.dataset.color,
          accentTextColor: document.querySelector('.color-presets-row[data-key="accentTextColor"] .color-preset.active, .color-presets-row[data-key="accentTextColor"] .color-preset-custom-wrapper.active')?.dataset.color
        };
        await updateSettings(newSettings);
        applyThemeToDOM(newSettings);
        showAutoSaveFeedback();
      }
    };
    input.addEventListener('input', handleCustomColorChange);
    input.addEventListener('change', handleCustomColorChange);
  });



  const chkMemeEnabled = document.getElementById('settingMemeEnabled');
  if (chkMemeEnabled) {
    chkMemeEnabled.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await updateSettings({ memeEnabled: isChecked });
      showAutoSaveFeedback();
      const configArea = document.getElementById('personalMemesConfigArea');
      if (configArea) {
        configArea.style.opacity = '1';
        configArea.style.pointerEvents = 'auto';
      }
      const settings = await getSettings();
      applyTabRepositioning(settings, settings.showTabs);
      applyTabVisibilityToDOM(settings);
      updateFloatingCheckboxesSync(settings);
      chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
    });
  }

  const chkQuickDelete = document.getElementById('settingQuickDelete');
  if (chkQuickDelete) {
    chkQuickDelete.addEventListener('change', async (e) => {
      await updateSettings({ quickDelete: e.target.checked });
      showAutoSaveFeedback();
    });
  }

  const chkSoundNotification = document.getElementById('settingSoundNotification');
  if (chkSoundNotification) {
    chkSoundNotification.addEventListener('change', async (e) => {
      await updateSettings({ soundNotification: e.target.checked });
      showAutoSaveFeedback();
    });
  }

  const bindTabToggle = (checkboxId, key) => {
    const chk = document.getElementById(checkboxId);
    if (chk) {
      chk.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        const settings = await getSettings();
        if (!settings.showTabs) settings.showTabs = {};
        if (key === 'meme') {
          await updateSettings({ memeEnabled: isChecked });
          settings.memeEnabled = isChecked;
        } else {
          settings.showTabs[key] = isChecked;
          await updateSettings({ showTabs: settings.showTabs });
        }
        applyTabRepositioning(settings, settings.showTabs);
        applyTabVisibilityToDOM(settings);
        updateFloatingCheckboxesSync(settings);
        showAutoSaveFeedback();
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      });
    }
  };

  bindTabToggle('settingShowSearch', 'search');
  bindTabToggle('settingShowTasks', 'tasks');
  bindTabToggle('settingShowNotes', 'notes');
  bindTabToggle('settingShowMissed', 'missed');
  bindTabToggle('settingShowReactions', 'reactions');
  bindTabToggle('settingShowReminders', 'reminders');

  const bindPromoteToggle = (elementId, key) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        const settings = await getSettings();
        if (!settings.promoteTabs) settings.promoteTabs = {};
        settings.promoteTabs[key] = isChecked;
        await updateSettings({ promoteTabs: settings.promoteTabs });
        
        applyTabRepositioning(settings, settings.showTabs);
        applyTabVisibilityToDOM(settings);
        await renderTabOrderList();
        showAutoSaveFeedback();
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      });
    }
  };

  bindPromoteToggle('settingPromoteTasks', 'tasks');
  bindPromoteToggle('settingPromoteNotes', 'notes');
  bindPromoteToggle('settingPromoteSearch', 'search');
  bindPromoteToggle('settingPromoteMentions', 'mentions');
  bindPromoteToggle('settingPromoteImages', 'images');
  bindPromoteToggle('settingPromoteReactions', 'reactions');
  bindPromoteToggle('settingPromoteReminders', 'reminders');

  // Floating buttons toggle saving
  const bindFloatingToggle = (checkboxId, key) => {
    const chk = document.getElementById(checkboxId);
    if (chk) {
      chk.addEventListener('change', async (e) => {
        const isChecked = e.target.checked;
        const settings = await getSettings();
        if (!settings.floatingButtons) settings.floatingButtons = {};
        settings.floatingButtons[key] = isChecked;
        await updateSettings({ floatingButtons: settings.floatingButtons });
        showAutoSaveFeedback();

        if (key === 'spamReactions') {
          const configArea = document.getElementById('reactionsConfigArea');
          if (configArea) {
            configArea.style.opacity = '1';
            configArea.style.pointerEvents = 'auto';
          }
        }
        chrome.runtime.sendMessage({ type: 'SETTINGS_UPDATED' });
      });
    }
  };

  bindFloatingToggle('settingFloatingQuickTask', 'quickTask');
  bindFloatingToggle('settingFloatingQuickNote', 'quickNote');
  bindFloatingToggle('settingFloatingSpamReactions', 'spamReactions');
  bindFloatingToggle('settingReactAlongEnabled', 'reactAlong');
  bindFloatingToggle('settingFloatingImagePicker', 'imagePicker');
  bindFloatingToggle('settingFloatingTemplatePicker', 'templatePicker');
  bindFloatingToggle('settingFloatingQuickReply', 'quickReply');
  bindFloatingToggle('settingFloatingQuickCopy', 'quickCopy');
  bindFloatingToggle('settingFloatingAiSummarize', 'aiSummarize');
  bindFloatingToggle('settingFloatingGroupReminder', 'groupReminder');
  bindFloatingToggle('settingFloatingQuickMeet', 'quickMeet');

  const btnTabStd = document.getElementById('emojiTabStandard');
  const btnTabCustom = document.getElementById('emojiTabCustom');
  const gridStd = document.getElementById('standardEmojiGrid');
  const gridCustom = document.getElementById('customEmojiGrid');

  if (btnTabStd && btnTabCustom && gridStd && gridCustom) {
    btnTabStd.addEventListener('click', () => {
      btnTabStd.classList.add('active');
      btnTabCustom.classList.remove('active');
      gridStd.style.display = 'grid';
      gridCustom.style.display = 'none';
    });

    btnTabCustom.addEventListener('click', async () => {
      btnTabCustom.classList.add('active');
      btnTabStd.classList.remove('active');
      gridStd.style.display = 'none';
      gridCustom.style.display = 'flex'; // Use flex for column layout of items + loader
      
      // Reset paging states to pull fresh on first activation
      customEmojiPage = 0;
      hasMoreCustomEmojis = true;
      cachedCustomEmojis = [];
      const gridItems = document.getElementById('customEmojiGridItems');
      if (gridItems) gridItems.innerHTML = '';
      
      const settings = await getSettings();
      await loadNextCustomEmojiPage(settings);
    });

    // Infinite scroll listener
    gridCustom.addEventListener('scroll', async () => {
      if (gridCustom.scrollTop + gridCustom.clientHeight >= gridCustom.scrollHeight - 20) {
        const settings = await getSettings();
        await loadNextCustomEmojiPage(settings);
      }
    });
  }

  let emojiSearchTimeout = null;
  const searchInput = document.getElementById('emojiSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', async (e) => {
      const term = e.target.value.trim();
      const settings = await getSettings();
      
      // Always render standard grid instantly
      renderStandardEmojiGrid(settings, term.toLowerCase());
      
      // Render local custom grid instantly
      renderCustomEmojiGrid(settings, term.toLowerCase());
      
      // Debounce and search server-side custom emojis if WORKSPACE tab is active
      const btnTabCustom = document.getElementById('emojiTabCustom');
      const isCustomTabActive = btnTabCustom && btnTabCustom.classList.contains('active');
      
      clearTimeout(emojiSearchTimeout);
      if (isCustomTabActive && term.length >= 1) {
        emojiSearchTimeout = setTimeout(async () => {
          try {
            const serverResults = await searchCustomEmojis(term);
            if (Array.isArray(serverResults)) {
              let newlyAdded = false;
              serverResults.forEach(e => {
                if (!cachedCustomEmojis.some(existing => existing.name === e.name)) {
                  cachedCustomEmojis.push(e);
                  customEmojiMap.set(e.name, e.id);
                  newlyAdded = true;
                }
              });
              if (newlyAdded) {
                // Re-render custom grid with updated cache
                renderCustomEmojiGrid(settings, term.toLowerCase());
              }
            }
          } catch (err) {
            console.error('[ChatOps Ext] Server emoji search failed:', err);
          }
        }, 300);
      }
    });
  }

  const selectedContainer = document.getElementById('selectedEmojisContainer');
  if (selectedContainer) {
    selectedContainer.addEventListener('click', async (e) => {
      const removeBtn = e.target.closest('.emoji-tag-remove');
      if (removeBtn) {
        const tag = removeBtn.closest('.selected-emoji-tag');
        if (tag) {
          const name = tag.dataset.name;
          if (name) {
            await toggleEmojiSelection(name);
          }
        }
      }
    });
  }

  const handleGridClick = async (e) => {
    const btn = e.target.closest('.emoji-btn');
    if (btn) {
      const name = btn.dataset.name;
      if (name) {
        await toggleEmojiSelection(name);
      }
    }
  };

  gridStd?.addEventListener('click', handleGridClick);
  // Grid click target should be the sub-grid items container
  document.getElementById('customEmojiGridItems')?.addEventListener('click', handleGridClick);

  // Dynamic Capturing Image Error Delegation (satisfies Manifest V3 CSP directive 'script-src 'self'')
  gridCustom?.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      e.target.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">❓</text></svg>';
    }
  }, true); // useCapture = true is critical because error events do not bubble

  selectedContainer?.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') {
      e.target.style.display = 'none';
    }
  }, true); // useCapture = true is critical because error events do not bubble

  // Reaction groups tab click listener
  const groupsTabs = document.getElementById('reactionGroupsTabs');
  if (groupsTabs) {
    groupsTabs.addEventListener('click', async (e) => {
      const btn = e.target.closest('.memo-sub-tab');
      if (btn) {
        const id = parseInt(btn.dataset.groupId, 10);
        if (!isNaN(id)) {
          const settings = await getSettings();
          await updateSettings({ activeReactionGroupId: id, spamEmojis: settings.reactionGroups[id].emojis || [] });
          const updatedSettings = await getSettings();
          renderReactionGroups(updatedSettings);
          renderSelectedEmojis(updatedSettings);
          renderStandardEmojiGrid(updatedSettings);
          
          const searchInput = document.getElementById('emojiSearchInput');
          const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
          renderCustomEmojiGrid(updatedSettings, term);
        }
      }
    });
  }

  // Reaction group rename listener
  const btnSaveGroupName = document.getElementById('btnSaveReactionGroupName');
  const inputGroupName = document.getElementById('reactionGroupNameInput');
  if (btnSaveGroupName && inputGroupName) {
    btnSaveGroupName.addEventListener('click', async () => {
      const val = inputGroupName.value.trim();
      if (!val) return;
      if (val.length > 10) {
        showErrorFeedback(language.groupNameLengthError || "Group name cannot exceed 10 characters!");
        return;
      }
      
      const settings = await getSettings();
      const activeGroupId = settings.activeReactionGroupId !== undefined ? settings.activeReactionGroupId : 0;
      const groups = settings.reactionGroups || [];
      const activeGroup = groups.find(g => g.id === activeGroupId);
      if (activeGroup) {
        activeGroup.name = val;
        await updateSettings({ reactionGroups: groups });
        showAutoSaveFeedback();
        const updatedSettings = await getSettings();
        renderReactionGroups(updatedSettings);
      }
    });

    // Enter key to rename
    inputGroupName.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        btnSaveGroupName.click();
      }
    });
  }

  const inputCat = document.getElementById('settingNewCategory');
  const btnAddCat = document.getElementById('btnAddCategory');
  const listCat = document.getElementById('settingCategoryList');

  const addCategory = async () => {
    const val = inputCat.value.trim();
    if (!val) return;
    if (val.length > 10) {
      showErrorFeedback(language.categoryNameLengthError || "Category name cannot exceed 10 characters!");
      return;
    }
    const settings = await getSettings();
    if (!settings.memoCategories) settings.memoCategories = [];
    
    // Check duplicate case-insensitively
    const isDuplicate = settings.memoCategories.some(cat => cat.toLowerCase() === val.toLowerCase());
    if (isDuplicate) {
      showErrorFeedback(language.categoryAlreadyExists || "This category already exists!");
      return;
    }

    // Check maximum 5 categories
    if (settings.memoCategories.length >= 5) {
      showErrorFeedback(language.maxCategoriesLimit || "Maximum of 5 categories allowed!");
      return;
    }
    
    settings.memoCategories.push(val);
    await updateSettings({ memoCategories: settings.memoCategories });
    renderCategoryList(settings.memoCategories);
    showAutoSaveFeedback();
    chrome.runtime.sendMessage({ type: 'MEMO_CATEGORIES_UPDATED' });
    inputCat.value = '';
    const counterEl = document.getElementById('categoryCharCounter');
    if (counterEl) counterEl.textContent = '0/10';
  };

  if (btnAddCat) btnAddCat.addEventListener('click', addCategory);
  if (inputCat) {
    inputCat.addEventListener('keydown', e => { if (e.key === 'Enter') addCategory(); });
    inputCat.addEventListener('input', () => {
      if (inputCat.value.length > 10) {
        inputCat.value = inputCat.value.slice(0, 10);
      }
      const counterEl = document.getElementById('categoryCharCounter');
      if (counterEl) {
        counterEl.textContent = `${inputCat.value.length}/10`;
      }
    });
  }

  if (listCat) {
    listCat.addEventListener('click', async (e) => {
      // Edit button click -> switch to edit mode
      const btnEdit = e.target.closest('.btn-edit-cat');
      if (btnEdit) {
        const li = btnEdit.closest('li');
        const cat = btnEdit.dataset.cat;
        const idx = btnEdit.dataset.idx;
        
        li.innerHTML = `
          <div class="cat-edit-mode" style="display:flex; align-items:center; gap:8px; width:100%;">
            <input type="text" class="edit-cat-input" maxlength="10" value="${escapeHtml(cat)}" style="flex:1; height:28px; font-size:13px; font-weight:600; padding:4px 8px; border-radius:6px; border:1px solid var(--border); outline:none; box-sizing:border-box; background:var(--bg-1); color:var(--text-1);" autocomplete="off">
            <button class="btn-save-cat-edit" data-idx="${idx}" data-old="${escapeHtml(cat)}" title="${language.saveBtn || 'Save'}" style="background:none; border:none; padding:4px 6px; cursor:pointer; color:var(--success); font-size:14px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;">✓</button>
            <button class="btn-cancel-cat-edit" title="${language.cancel || 'Cancel'}" style="background:none; border:none; padding:4px 6px; cursor:pointer; color:var(--danger); font-size:14px; font-weight:bold; display:inline-flex; align-items:center; justify-content:center;">✗</button>
          </div>
        `;
        
        const input = li.querySelector('.edit-cat-input');
        input.focus();
        input.select();
        
        input.addEventListener('input', () => {
          if (input.value.length > 10) {
            input.value = input.value.slice(0, 10);
          }
        });
        
        input.addEventListener('keydown', (evt) => {
          if (evt.key === 'Enter') {
            li.querySelector('.btn-save-cat-edit').click();
          } else if (evt.key === 'Escape') {
            li.querySelector('.btn-cancel-cat-edit').click();
          }
        });
        return;
      }

      // Cancel edit click
      const btnCancel = e.target.closest('.btn-cancel-cat-edit');
      if (btnCancel) {
        const settings = await getSettings();
        renderCategoryList(settings.memoCategories || []);
        return;
      }

      // Save edit click
      const btnSave = e.target.closest('.btn-save-cat-edit');
      if (btnSave) {
        const idx = parseInt(btnSave.dataset.idx, 10);
        const oldCat = btnSave.dataset.old;
        const li = btnSave.closest('li');
        const input = li.querySelector('.edit-cat-input');
        const newVal = input.value.trim();
        
        if (!newVal) {
          showErrorFeedback(language.categoryNameEmptyError || "Category name cannot be empty!");
          return;
        }
        if (newVal.length > 10) {
          showErrorFeedback(language.categoryNameLengthError || "Category name cannot exceed 10 characters!");
          return;
        }
        
        const settings = await getSettings();
        const categories = settings.memoCategories || [];
        
        // Check duplicate case-insensitively, ignoring current index
        const isDuplicate = categories.some((c, i) => i !== idx && c.toLowerCase() === newVal.toLowerCase());
        if (isDuplicate) {
          showErrorFeedback(language.categoryAlreadyExists || "This category already exists!");
          return;
        }
        
        categories[idx] = newVal;
        settings.memoCategories = categories;
        await updateSettings({ memoCategories: categories });
        
        // Update category name in existing memos
        const resMemos = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
        const memos = resMemos[STORAGE_KEYS.MEMOS] || [];
        let memosChanged = false;
        
        memos.forEach(m => {
          if (m.type === 'memo' && (m.category || 'General') === oldCat) {
            m.category = newVal;
            memosChanged = true;
          }
        });
        
        if (memosChanged) {
          await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
        }
        
        // If edited category was activeMemoCategory, update it as well
        const activeRes = await chrome.storage.local.get(['activeMemoCategory']);
        if (activeRes.activeMemoCategory === oldCat) {
          await chrome.storage.local.set({ activeMemoCategory: newVal });
        }
        
        renderCategoryList(categories);
        showAutoSaveFeedback();
        chrome.runtime.sendMessage({ type: 'MEMO_CATEGORIES_UPDATED' });
        return;
      }

      const btn = e.target.closest('.btn-delete-cat');
      if (btn) {
        const cat = btn.dataset.cat;
        
        // Check if there is active data associated with this category
        const resMemos = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
        const memos = resMemos[STORAGE_KEYS.MEMOS] || [];
        const hasData = memos.some(m => m.type === 'memo' && (m.category || 'General') === cat);
        
        if (hasData) {
          showErrorFeedback((language.categoryContainsNotesError || 'Category "{category}" contains notes and cannot be deleted!').replace('{category}', cat));
          return;
        }
        
        const settings = await getSettings();
        const categories = settings.memoCategories || [];
        if (categories.length <= 1) {
          showErrorFeedback(language.atLeastOneCategoryRequired || "At least one category must exist!");
          return;
        }
        settings.memoCategories = categories.filter(c => c !== cat);
        await updateSettings({ memoCategories: settings.memoCategories });
        renderCategoryList(settings.memoCategories);
        showAutoSaveFeedback();
        chrome.runtime.sendMessage({ type: 'MEMO_CATEGORIES_UPDATED' });
      }
    });
  }

  // Tab order click listener
  const tabOrderContainer = document.getElementById('tabOrderListContainer');
  if (tabOrderContainer) {
    tabOrderContainer.addEventListener('click', async (e) => {
      const upBtn = e.target.closest('.btn-tab-order-up');
      const downBtn = e.target.closest('.btn-tab-order-down');
      
      if (!upBtn && !downBtn) return;
      
      const settings = await getSettings();
      const defaultOrder = ['tasks', 'memo', 'tools-reminders', 'mentions', 'tools-search', 'tools-images', 'tools-reactions', 'tools'];
      let order = settings.tabOrder || [...defaultOrder];
      const missingKeys = defaultOrder.filter(key => !order.includes(key));
      if (missingKeys.length > 0) {
        order = [...order, ...missingKeys];
      }
      order = order.filter(key => defaultOrder.includes(key));
      
      const isTabVisibleAsMain = (id) => {
        const promoteTabs = settings.promoteTabs || {
          tasks: true,
          notes: true,
          search: true,
          images: false,
          reactions: false,
          mentions: true,
          reminders: false
        };
        if (promoteTabs.tasks === undefined) promoteTabs.tasks = true;
        if (promoteTabs.notes === undefined) promoteTabs.notes = true;
        if (promoteTabs.mentions === undefined) promoteTabs.mentions = true;
        if (promoteTabs.reminders === undefined) promoteTabs.reminders = false;

        const toolsVisible = (
          (promoteTabs.tasks === false && (settings.showTabs.tasks !== false)) ||
          (promoteTabs.notes === false && (settings.showTabs.notes !== false)) ||
          (!promoteTabs.search && (settings.showTabs.search !== false)) ||
          (!promoteTabs.images && (settings.memeEnabled !== false)) ||
          (!promoteTabs.reactions && (settings.showTabs.reactions !== false)) ||
          (promoteTabs.mentions === false && (settings.showTabs.missed !== false)) ||
          (!promoteTabs.reminders && (settings.showTabs.reminders !== false))
        );

        if (id === 'settings') return false; // settings is in the header, not nav
        if (id === 'tasks') return settings.showTabs.tasks !== false && promoteTabs.tasks !== false;
        if (id === 'memo') return settings.showTabs.notes !== false && promoteTabs.notes !== false;
        if (id === 'tools') return toolsVisible;
        if (id === 'mentions') return (settings.showTabs.missed !== false) && (promoteTabs.mentions !== false);
        if (id === 'tools-search') return (settings.showTabs.search !== false) && (promoteTabs.search === true);
        if (id === 'tools-images') return (settings.memeEnabled !== false) && (promoteTabs.images === true);
        if (id === 'tools-reactions') return (settings.showTabs.reactions !== false) && (promoteTabs.reactions === true);
        if (id === 'tools-reminders') return (settings.showTabs.reminders !== false) && (promoteTabs.reminders === true);
        return false;
      };

      const visibleOrder = order.filter(isTabVisibleAsMain);
      
      const btn = upBtn || downBtn;
      const idx = parseInt(btn.dataset.idx, 10);
      
      if (upBtn && idx > 0) {
        const id1 = visibleOrder[idx];
        const id2 = visibleOrder[idx - 1];
        const fullIdx1 = order.indexOf(id1);
        const fullIdx2 = order.indexOf(id2);
        if (fullIdx1 !== -1 && fullIdx2 !== -1) {
          [order[fullIdx1], order[fullIdx2]] = [order[fullIdx2], order[fullIdx1]];
        }
      } else if (downBtn && idx < visibleOrder.length - 1) {
        const id1 = visibleOrder[idx];
        const id2 = visibleOrder[idx + 1];
        const fullIdx1 = order.indexOf(id1);
        const fullIdx2 = order.indexOf(id2);
        if (fullIdx1 !== -1 && fullIdx2 !== -1) {
          [order[fullIdx1], order[fullIdx2]] = [order[fullIdx2], order[fullIdx1]];
        }
      }
      
      await updateSettings({ tabOrder: order });
      applyTabOrderToDOM(order);
      await renderTabOrderList();
      showAutoSaveFeedback();
    });
  }

  // Settings sub-tabs
  document.getElementById('settingsSubTabs')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('memo-sub-tab')) {
      const sectionId = e.target.dataset.section;
      if (!sectionId) return;

      // Update tabs
      document.querySelectorAll('#settingsSubTabs .memo-sub-tab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      // Update panels
      document.querySelectorAll('.settings-tab-panel').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
      });
      const targetPanel = document.getElementById(`settings-section-${sectionId}`);
      if (targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.classList.add('active');
      }
      
      if (window.isRedirectingToSetting) return;

      // Collapse other accordions but restore the Menu Tabs, Floating Buttons, & Data Storage accordion states
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
        } else if (acc.id === 'accordionDataStorage') {
          chrome.storage.local.get(['accordionDataStorageOpen'], (res) => {
            const isOpen = res.accordionDataStorageOpen === true;
            acc.classList.toggle('open', isOpen);
          });
        } else {
          acc.classList.remove('open');
        }
        acc.classList.remove('highlighted');
      });
    }
  });

  // Tools sub-tabs
  document.getElementById('toolsSubTabs')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('memo-sub-tab')) {
      const sectionId = e.target.dataset.section;
      if (!sectionId) return;

      // Update tabs active state
      document.querySelectorAll('#toolsSubTabs .memo-sub-tab').forEach(b => b.classList.toggle('active', b === e.target));

      // Update panels active state
      document.querySelectorAll('#tab-tools .tools-tab-panel').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
      });
      
      let targetPanelId = `tools-section-${sectionId}`;
      if (sectionId === 'mentions') targetPanelId = 'tab-mentions';
      else if (sectionId === 'tasks') targetPanelId = 'tab-tasks';
      else if (sectionId === 'notes') targetPanelId = 'tab-memo';

      const targetPanel = document.getElementById(targetPanelId);
      if (targetPanel) {
        targetPanel.style.display = 'flex';
        targetPanel.classList.add('active');
      }

      // Initialize content dynamically
      if (sectionId === 'images') {
        fetchGiphyGifs(document.getElementById('gifSearchInput')?.value || '');
        renderSidepanelMemes();
      } else if (sectionId === 'reactions') {
        getSettings().then(settings => {
          renderStandardEmojiGrid(settings);
          renderCustomEmojiGrid(settings, document.getElementById('customEmojiSearchInput')?.value || '');
        });
      }
    }
  });

  // Giphy GIFs Search Debounce
  const gifSearchInput = document.getElementById('gifSearchInput');
  if (gifSearchInput) {
    gifSearchInput.addEventListener('input', (e) => {
      clearTimeout(giphyTimeout);
      giphyTimeout = setTimeout(() => {
        fetchGiphyGifs(e.target.value);
      }, 300);
    });
  }

  // Giphy Grid Interactions
  const giphyGifsGrid = document.getElementById('giphy-gifs-grid');
  if (giphyGifsGrid) {
    giphyGifsGrid.addEventListener('click', async (e) => {
      const sendBtn = e.target.closest('.btn-send');
      if (sendBtn) {
        const url = sendBtn.dataset.url;
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'INSERT_IMAGE_TO_CHAT', url });
        }
        return;
      }

      const previewBtn = e.target.closest('.btn-preview');
      const clickedImg = e.target.closest('img');
      if (previewBtn || (clickedImg && !e.target.closest('.gif-item-btn'))) {
        const url = previewBtn ? previewBtn.dataset.url : e.target.closest('.gif-item').dataset.fullUrl;
        const modal = document.getElementById('imagePreviewModal');
        const previewImg = document.getElementById('imgPreviewTarget');
        if (modal && previewImg) {
          previewImg.src = url;
          modal.style.display = 'flex';
        }
      }
    });
  }

  // Handle click on sub-tabs inside panels (Reactions & Sync)
  document.querySelectorAll('.settings-subtab-bar').forEach(bar => {
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.settings-subtab-btn');
      if (!btn) return;

      const subtabName = btn.dataset.subtab;
      if (!subtabName) return;

      // Deactivate all sibling buttons in this bar
      bar.querySelectorAll('.settings-subtab-btn').forEach(b => {
        b.classList.remove('active');
      });

      // Activate clicked button
      btn.classList.add('active');

      // Find the parent panel (e.g. #settings-section-reactions or #settings-section-sync)
      const panel = bar.closest('.settings-tab-panel') || bar.closest('#tab-reactions');
      if (panel) {
        // Hide all subtab content divs inside this panel
        panel.querySelectorAll('.settings-subtab-content').forEach(content => {
          content.style.display = 'none';
        });

        // Show target subtab content div
        const targetContent = panel.querySelector(`#subtab-content-${subtabName}`);
        if (targetContent) {
          targetContent.style.display = 'block';
        }
      }
    });
  });

  // Global accordion helper to open a specific group by child key/subtab name
  window.openSettingsAccordion = function(subtabName) {
    if (!subtabName) return;
    let elementId = '';
    if (subtabName === 'features-toggle') {
      elementId = 'settingShowSearch';
    } else if (subtabName === 'features-floating') {
      elementId = 'settingFloatingQuickTask';
    } else if (subtabName === 'features-snooze') {
      elementId = 'settingSnoozeMinutes';
    } else if (subtabName === 'features-gif') {
      elementId = 'settingGiphyApiKey';
    } else if (subtabName === 'categories') {
      elementId = 'settingNewCategory';
    }

    if (elementId) {
      const el = document.getElementById(elementId);
      const accordion = el ? el.closest('.settings-accordion') : null;
      if (accordion) {
        // Close all other accordions first (except restoring Menu Tabs, Floating Buttons, & Data Storage states)
        document.querySelectorAll('.settings-accordion').forEach(acc => {
          if (acc === accordion) return;
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
          } else if (acc.id === 'accordionDataStorage') {
            chrome.storage.local.get(['accordionDataStorageOpen'], (res) => {
              const isOpen = res.accordionDataStorageOpen === true;
              acc.classList.toggle('open', isOpen);
            });
          } else {
            acc.classList.remove('open');
          }
          acc.classList.remove('highlighted');
        });
        // Open and highlight target accordion
        accordion.classList.add('open');
        accordion.classList.add('highlighted');
        
        // Scroll into view
        setTimeout(() => {
          const container = document.getElementById('settingsScrollContainer');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const accRect = accordion.getBoundingClientRect();
            const relativeTop = accRect.top - containerRect.top + container.scrollTop;
            const targetScrollTop = relativeTop - 12; // 12px margin
            container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
          } else {
            accordion.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  };

  // Helper to programmatically navigate to a settings sub-tab
  function navigateToSubtab(subtabName) {
    let sectionId = '';
    if (subtabName === 'features-toggle') {
      sectionId = 'ui';
    } else if (subtabName.startsWith('features-') || subtabName === 'categories') {
      sectionId = 'features';
    } else if (subtabName.startsWith('reactions-')) {
      sectionId = 'reactions';
    } else if (subtabName.startsWith('sync-')) {
      sectionId = 'sync';
    }

    if (!sectionId) return;

    // 1. Switch top-level Settings Category
    const tabBtn = document.querySelector(`#settingsSubTabs .memo-sub-tab[data-section="${sectionId}"]`);
    if (tabBtn) {
      // Deactivate sibling top-level buttons
      document.querySelectorAll('#settingsSubTabs .memo-sub-tab').forEach(b => b.classList.remove('active'));
      // Activate target top-level button
      tabBtn.classList.add('active');

      // Show target section panel
      document.querySelectorAll('.settings-tab-panel').forEach(p => {
        p.style.display = 'none';
        p.classList.remove('active');
      });
      const targetPanel = document.getElementById(`settings-section-${sectionId}`);
      if (targetPanel) {
        targetPanel.style.display = 'block';
        targetPanel.classList.add('active');
      }
    }

    // 2. Open corresponding accordion if target section is features
    if (sectionId === 'features') {
      window.openSettingsAccordion(subtabName);
    }
  }

  window.navigateToSettingsSubtab = navigateToSubtab;



  // Listen for storage changes to sync custom images reactively
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.custom_memes) {
      renderSidepanelMemes();
    }
  });

  // Accordion Toggle
  document.querySelectorAll('.settings-accordion-header').forEach(header => {
    header.addEventListener('click', (e) => {
      if (e.target.closest('input, button, a, select')) return;
      const acc = header.parentElement;
      const isOpening = !acc.classList.contains('open');
      
      // Close other accordions first
      if (isOpening) {
        document.querySelectorAll('.settings-accordion').forEach(other => {
          if (other !== acc) {
            other.classList.remove('open');
            other.classList.remove('highlighted');
          }
        });
      }
      
      acc.classList.toggle('open', isOpening);
      if (!isOpening) {
        acc.classList.remove('highlighted');
      } else {
        acc.classList.add('highlighted');
        setTimeout(() => {
          const container = document.getElementById('settingsScrollContainer');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const accRect = acc.getBoundingClientRect();
            const relativeTop = accRect.top - containerRect.top + container.scrollTop;
            const targetScrollTop = relativeTop - 12; // 12px margin
            container.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
          } else {
            acc.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 180);
      }

      // Persist accordion open/close states
      if (acc.id === 'accordionMenuTabs') {
        const isOpen = acc.classList.contains('open');
        chrome.storage.local.set({ accordionMenuTabsOpen: isOpen });
      } else if (acc.id === 'accordionFloatingButtons') {
        const isOpen = acc.classList.contains('open');
        chrome.storage.local.set({ accordionFloatingButtonsOpen: isOpen });
      } else if (acc.id === 'accordionDataStorage') {
        const isOpen = acc.classList.contains('open');
        chrome.storage.local.set({ accordionDataStorageOpen: isOpen });
      }
    });
  });
}

let autoSaveTimeoutId = null;
let warningClickListener = null;

function showAutoSaveFeedback() {
  const fb = document.getElementById('settingsStatus');
  if (!fb) return;

  if (autoSaveTimeoutId) {
    clearTimeout(autoSaveTimeoutId);
  }

  if (warningClickListener) {
    fb.removeEventListener('click', warningClickListener);
    warningClickListener = null;
  }
  fb.style.pointerEvents = 'none';
  fb.style.cursor = 'default';

  fb.style.background = '#10b981';
  fb.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 8px 10px -6px rgba(16, 185, 129, 0.4)';
  fb.innerHTML = `
    <span style="font-size: 15px;">✓</span>
    <span>${language.settingsSaved || 'Saved automatically'}</span>
  `;

  fb.style.opacity = '1';
  fb.style.transform = 'translateX(-50%) translateY(0)';

  autoSaveTimeoutId = setTimeout(() => {
    fb.style.opacity = '0';
    fb.style.transform = 'translateX(-50%) translateY(20px)';
    autoSaveTimeoutId = null;
  }, 2000);
}

function showSuccessFeedback(message) {
  const fb = document.getElementById('settingsStatus');
  if (!fb) return;

  if (autoSaveTimeoutId) {
    clearTimeout(autoSaveTimeoutId);
  }

  if (warningClickListener) {
    fb.removeEventListener('click', warningClickListener);
    warningClickListener = null;
  }
  fb.style.pointerEvents = 'none';
  fb.style.cursor = 'default';

  fb.style.background = '#10b981';
  fb.style.boxShadow = '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 8px 10px -6px rgba(16, 185, 129, 0.4)';
  fb.innerHTML = `
    <span style="font-size: 15px;">✓</span>
    <span>${escapeHtml(message)}</span>
  `;

  fb.style.opacity = '1';
  fb.style.transform = 'translateX(-50%) translateY(0)';

  autoSaveTimeoutId = setTimeout(() => {
    fb.style.opacity = '0';
    fb.style.transform = 'translateX(-50%) translateY(20px)';
    autoSaveTimeoutId = null;
  }, 3500);
}

function showErrorFeedback(message) {
  const fb = document.getElementById('settingsStatus');
  if (!fb) return;

  if (autoSaveTimeoutId) {
    clearTimeout(autoSaveTimeoutId);
  }

  if (warningClickListener) {
    fb.removeEventListener('click', warningClickListener);
    warningClickListener = null;
  }
  fb.style.pointerEvents = 'none';
  fb.style.cursor = 'default';

  fb.style.background = '#ef4444';
  fb.style.boxShadow = '0 10px 25px -5px rgba(239, 68, 68, 0.4), 0 8px 10px -6px rgba(239, 68, 68, 0.4)';
  fb.innerHTML = `
    <span style="font-size: 15px;">✗</span>
    <span>${escapeHtml(message)}</span>
  `;

  fb.style.opacity = '1';
  fb.style.transform = 'translateX(-50%) translateY(0)';

  autoSaveTimeoutId = setTimeout(() => {
    fb.style.opacity = '0';
    fb.style.transform = 'translateX(-50%) translateY(20px)';
    autoSaveTimeoutId = null;
  }, 3000);
}

function showWarningFeedback(message, actionText, actionCallback) {
  const fb = document.getElementById('settingsStatus');
  if (!fb) return;

  if (autoSaveTimeoutId) {
    clearTimeout(autoSaveTimeoutId);
    autoSaveTimeoutId = null;
  }

  if (warningClickListener) {
    fb.removeEventListener('click', warningClickListener);
    warningClickListener = null;
  }

  fb.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
  fb.style.boxShadow = '0 10px 25px -5px rgba(217, 119, 6, 0.4), 0 8px 10px -6px rgba(217, 119, 6, 0.4)';
  fb.style.pointerEvents = 'auto';
  fb.style.cursor = 'pointer';

  fb.innerHTML = `
    <span style="font-size: 15px;">⚠️</span>
    <span style="margin-right: 4px;">${escapeHtml(message)}</span>
    ${actionText ? `<span class="toast-action" style="text-decoration: underline; font-weight: 700; margin-left: 6px; padding: 2px 6px; background: rgba(255,255,255,0.2); border-radius: 4px; transition: background 0.2s;">${escapeHtml(actionText)}</span>` : ''}
  `;

  fb.style.opacity = '1';
  fb.style.transform = 'translateX(-50%) translateY(0)';

  warningClickListener = (e) => {
    if (actionCallback) {
      actionCallback(e);
    }
    fb.style.opacity = '0';
    fb.style.transform = 'translateX(-50%) translateY(20px)';
    fb.style.pointerEvents = 'none';
    fb.style.cursor = 'default';
    fb.removeEventListener('click', warningClickListener);
    warningClickListener = null;
    if (autoSaveTimeoutId) {
      clearTimeout(autoSaveTimeoutId);
      autoSaveTimeoutId = null;
    }
  };

  fb.addEventListener('click', warningClickListener);

  autoSaveTimeoutId = setTimeout(() => {
    fb.style.opacity = '0';
    fb.style.transform = 'translateX(-50%) translateY(20px)';
    fb.style.pointerEvents = 'none';
    fb.style.cursor = 'default';
    if (warningClickListener) {
      fb.removeEventListener('click', warningClickListener);
      warningClickListener = null;
    }
    autoSaveTimeoutId = null;
  }, 6000);
}

// Expose toast helpers to the window object for other tab modules
window.showSuccessFeedback = showSuccessFeedback;
window.showErrorFeedback = showErrorFeedback;
window.showWarningFeedback = showWarningFeedback;

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
  );
}

/**
 * Renders currently selected emojis in Reactions tab
 */
function getActiveEmojisList(settings) {
  const activeGroupId = settings.activeReactionGroupId !== undefined ? settings.activeReactionGroupId : 0;
  const groups = settings.reactionGroups || [];
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  return activeGroup ? (activeGroup.emojis || []) : [];
}

function renderReactionGroups(settings) {
  const tabsContainer = document.getElementById('reactionGroupsTabs');
  if (!tabsContainer) return;

  const activeGroupId = settings.activeReactionGroupId !== undefined ? settings.activeReactionGroupId : 0;
  const groups = settings.reactionGroups || [];

  tabsContainer.innerHTML = groups.map(g => {
    const isActive = g.id === activeGroupId;
    const checkmark = isActive ? '<span style="color:#10b981; font-weight:bold; margin-left:4px;">✓</span>' : '';
    return `
      <button type="button" class="memo-sub-tab ${isActive ? 'active' : ''}" data-group-id="${g.id}" style="display:flex; align-items:center; gap:4px; font-weight:600; padding:6px 12px; border-radius:6px; font-size:12.5px;">
        ${escapeHtml(g.name || `Nhóm ${g.id + 1}`)} ${checkmark}
      </button>
    `;
  }).join('');

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const renameInput = document.getElementById('reactionGroupNameInput');
  if (renameInput && activeGroup) {
    renameInput.value = activeGroup.name || `Nhóm ${activeGroup.id + 1}`;
  }
}

/**
 * Renders currently selected emojis in Reactions tab
 */
function renderSelectedEmojis(settings) {
  const container = document.getElementById('selectedEmojisContainer');
  if (!container) return;

  let currentList = getActiveEmojisList(settings);

  const countBadge = document.getElementById('selectedEmojisCountBadge');
  if (countBadge) {
    countBadge.textContent = `${currentList.length} / 20`;
    if (currentList.length >= 20) {
      countBadge.style.background = '#fde8e8';
      countBadge.style.color = '#e02424';
      countBadge.style.borderColor = '#f8b4b4';
    } else {
      countBadge.style.background = 'var(--bg-3)';
      countBadge.style.color = 'var(--text-2)';
      countBadge.style.borderColor = 'var(--border)';
    }
  }

  if (currentList.length === 0) {
    container.innerHTML = `<span style="font-size:12px; color:var(--text-3); font-style:italic;">No emojis selected. Select from below!</span>`;
    return;
  }

  // HTML5 Drag and Drop Handlers for Reordering
  let dragSrcEl = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.name);
    this.classList.add('dragging');
    console.log('[ChatOps Ext] Emoji Drag Start:', this.dataset.name);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drag-over');
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  async function handleDrop(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    
    this.classList.remove('drag-over');
    
    const srcName = e.dataTransfer.getData('text/plain') || (dragSrcEl ? dragSrcEl.dataset.name : null);
    const destName = this.dataset.name;
    
    console.log('[ChatOps Ext] Emoji Drag Drop:', srcName, 'over', destName);
    
    if (srcName && destName && srcName !== destName) {
      const settings = await getSettings();
      const activeGroupId = settings.activeReactionGroupId !== undefined ? settings.activeReactionGroupId : 0;
      const groups = settings.reactionGroups || [];
      const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
      let list = activeGroup ? (activeGroup.emojis || []) : [];
      
      const srcIndex = list.indexOf(srcName);
      const destIndex = list.indexOf(destName);
      
      if (srcIndex > -1 && destIndex > -1) {
        list.splice(srcIndex, 1);
        list.splice(destIndex, 0, srcName);
        
        if (activeGroup) {
          activeGroup.emojis = list;
        }
        
        await updateSettings({ 
          reactionGroups: groups,
          spamEmojis: list
        });
        showAutoSaveFeedback();
        
        const updatedSettings = await getSettings();
        renderSelectedEmojis(updatedSettings);
      }
    }
    return false;
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    container.querySelectorAll('.selected-emoji-tag').forEach(tag => {
      tag.classList.remove('dragging');
      tag.classList.remove('drag-over');
    });
    console.log('[ChatOps Ext] Emoji Drag End');
  }

  container.innerHTML = currentList.map(name => {
    const std = STANDARD_EMOJIS.find(s => s.name === name);
    let content = '';
    if (std) {
      content = `<span style="font-size:16px;">${std.char}</span>`;
    } else {
      const customEmojiId = customEmojiMap.get(name);
      if (customEmojiId) {
        content = `<img src="${chatopsUrl}/api/v4/emoji/${customEmojiId}/image" />`;
      } else {
        content = `<span style="font-size:12px; font-weight:600; color:var(--accent);">:${name}:</span>`;
      }
    }

    return `
      <div class="selected-emoji-tag" draggable="true" data-name="${name}" title="${language.clickToRemove || 'Click to remove'}">
        ${content}
        <span class="emoji-tag-remove">&times;</span>
      </div>
    `;
  }).join('');

  // Bind drag & drop events to the tags
  const tags = container.querySelectorAll('.selected-emoji-tag');
  tags.forEach(tag => {
    tag.addEventListener('dragstart', handleDragStart);
    tag.addEventListener('dragover', handleDragOver);
    tag.addEventListener('dragenter', handleDragEnter);
    tag.addEventListener('dragleave', handleDragLeave);
    tag.addEventListener('drop', handleDrop);
    tag.addEventListener('dragend', handleDragEnd);
  });
}

/**
 * Renders Standard Emojis Grid
 */
function renderStandardEmojiGrid(settings, filterQuery = '') {
  const grid = document.getElementById('standardEmojiGrid');
  if (!grid) return;

  let currentList = getActiveEmojisList(settings);

  // Filter standard emojis locally in memory
  const filtered = STANDARD_EMOJIS.filter(item => item.name.toLowerCase().includes(filterQuery));

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-3); font-size:12px;">No matching emojis found.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const active = currentList.includes(item.name);
    return `
      <button type="button" class="emoji-btn ${active ? 'active' : ''}" data-name="${item.name}" title="${item.name}">
        ${item.char}
      </button>
    `;
  }).join('');
}

/**
 * Loads and renders Custom Emojis from Workspace
 */
/**
 * Loads and renders the next page of Custom Emojis from Workspace (Load More / Infinite Scroll)
 */
async function loadNextCustomEmojiPage(settings) {
  if (isLoadingCustomEmojis || !hasMoreCustomEmojis) return;

  isLoadingCustomEmojis = true;
  const loadingEl = document.getElementById('customEmojiLoading');
  if (loadingEl) loadingEl.style.display = 'block';

  try {
    const customEmojis = await getCustomEmojis(customEmojiPage, 200);
    
    if (Array.isArray(customEmojis)) {
      customEmojis.forEach(e => {
        // Only append if it's not already in cachedCustomEmojis to prevent duplicates
        if (!cachedCustomEmojis.some(existing => existing.name === e.name)) {
          cachedCustomEmojis.push(e);
          customEmojiMap.set(e.name, e.id);
        }
      });
      
      if (customEmojis.length < 200) {
        hasMoreCustomEmojis = false;
      }
      
      customEmojiPage++;
    } else {
      hasMoreCustomEmojis = false;
    }

    // Determine current search filter query
    const searchInput = document.getElementById('emojiSearchInput');
    const filterQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

    renderCustomEmojiGrid(settings, filterQuery);
  } catch (err) {
    console.error('Failed to load next custom emojis page:', err);
    const gridItems = document.getElementById('customEmojiGridItems');
    if (gridItems && gridItems.children.length === 0) {
      gridItems.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:#e74c3c; font-size:12px;">Cannot connect to ChatOps server or cookies not synced.</div>`;
    }
  } finally {
    isLoadingCustomEmojis = false;
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

/**
 * Renders Custom Emojis Grid inside #customEmojiGridItems
 */
function renderCustomEmojiGrid(settings, filterQuery = '') {
  const gridItems = document.getElementById('customEmojiGridItems');
  if (!gridItems) return;

  let currentList = getActiveEmojisList(settings);

  // Filter custom emojis locally in memory
  const filtered = cachedCustomEmojis.filter(item => item.name.toLowerCase().includes(filterQuery));

  if (filtered.length === 0) {
    if (customEmojiPage <= 1) {
      gridItems.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--text-3); font-size:12px;">No matching custom emojis found.</div>`;
    }
    return;
  }

  gridItems.innerHTML = filtered.map(item => {
    const active = currentList.includes(item.name);
    const imgSrc = `${chatopsUrl}/api/v4/emoji/${item.id}/image`;
    return `
      <button type="button" class="emoji-btn ${active ? 'active' : ''}" data-name="${item.name}" title="${item.name}">
        <img src="${imgSrc}" loading="lazy" />
      </button>
    `;
  }).join('');
}

/**
 * Toggles an emoji in selected list
 */
async function toggleEmojiSelection(emojiName) {
  const settings = await getSettings();
  const activeGroupId = settings.activeReactionGroupId !== undefined ? settings.activeReactionGroupId : 0;
  const groups = settings.reactionGroups || [];
  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  
  let list = activeGroup ? (activeGroup.emojis || []) : [];

  if (list.includes(emojiName)) {
    list = list.filter(name => name !== emojiName);
  } else {
    if (list.length >= 20) {
      showErrorFeedback('Select up to 20 emojis for spam!');
      return;
    }
    list.push(emojiName);
  }

  if (activeGroup) {
    activeGroup.emojis = list;
  }

  await updateSettings({ 
    reactionGroups: groups,
    spamEmojis: list 
  });
  showAutoSaveFeedback();

  // Re-render keeping search query intact
  const updatedSettings = await getSettings();
  renderSelectedEmojis(updatedSettings);

  const searchInput = document.getElementById('emojiSearchInput');
  const filterQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';

  renderStandardEmojiGrid(updatedSettings, filterQuery);
  renderCustomEmojiGrid(updatedSettings, filterQuery);
}

function renderCategoryList(categories) {
  const listEl = document.getElementById('settingCategoryList');
  if (!listEl) return;

  const countBadge = document.getElementById('categoriesCountBadge');
  if (countBadge) {
    countBadge.textContent = `${categories.length} / 5`;
    if (categories.length >= 5) {
      countBadge.style.background = '#fde8e8';
      countBadge.style.color = '#e02424';
      countBadge.style.borderColor = '#f8b4b4';
    } else {
      countBadge.style.background = 'var(--bg-3)';
      countBadge.style.color = 'var(--text-2)';
      countBadge.style.borderColor = 'var(--border)';
    }
  }
  listEl.innerHTML = categories.map((cat, idx) => `
    <li data-cat="${escapeHtml(cat)}" class="category-item-card" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:var(--bg-1); border-radius:8px; border:1px solid var(--border); margin-bottom: 8px; min-width: 0; gap: 8px; transition: all 0.2s ease;">
      <span class="cat-name" style="font-size:13px; font-weight:600; color:var(--text-1); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; text-align:left;">${escapeHtml(cat)}</span>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn-edit-cat btn-edit-memo" data-idx="${idx}" data-cat="${escapeHtml(cat)}" title="${language.editBtn || 'Edit'}" style="background:none; border:none; padding:4px; cursor:pointer; color:var(--text-3); display:inline-flex; align-items:center;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
        <button class="btn-delete-cat btn-delete-memo" data-cat="${escapeHtml(cat)}" title="${language.deleteBtn || 'Delete'}" style="background:none; border:none; padding:4px; cursor:pointer; color:var(--text-3); display:inline-flex; align-items:center;">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" style="pointer-events:none;"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
        </button>
      </div>
    </li>
  `).join('');

  // Automatically hide the add row if 5 or more categories exist, otherwise show it
  const addRow = document.querySelector('.category-add-row');
  if (addRow) {
    addRow.style.setProperty('display', categories.length >= 5 ? 'none' : 'flex', 'important');
  }
}

export async function updateSettings(partial) {
  const settings = await getSettings();
  const newSettings = { ...settings, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings });
}

export function applyThemeToDOM(settings) {
  const root = document.documentElement;
  
  // Header Block
  const headerColor = settings.headerColor || '#1c58d9';
  root.style.setProperty('--header-bg', headerColor);
  const headerTextColor = settings.headerTextColor || '#ffffff';
  root.style.setProperty('--header-text-color', headerTextColor);
  
  // Nav Block
  const navColor = settings.navColor || '#1153ab';
  root.style.setProperty('--nav-bg', navColor);

  // Tab Text Color
  const tabTextColor = settings.tabTextColor || '#ffffff';
  root.style.setProperty('--tab-text-color', tabTextColor);
  
  // Accent Block (Primary color for buttons, etc)
  const accentColor = settings.accentColor || '#1c58d9';
  root.style.setProperty('--accent', accentColor);
  const accentTextColor = settings.accentTextColor || '#ffffff';
  root.style.setProperty('--accent-text-color', accentTextColor);

  // App Padding
  const appPaddingVal = settings.appPadding || '12px';
  root.style.setProperty('--app-padding', appPaddingVal);
  
  // Calculate content, main navigation tabs, and inner sub-tabs density proportionally
  let contentPaddingVal = '10px';
  let tabNavPaddingVal = '4px 8px';
  let tabBtnPaddingVal = '4px 3px';
  let subTabsMarginVal = '8px 12px';
  let subTabPaddingVal = '5px 10px';
  let settingsSubtabPaddingVal = '8px 12px';
  let settingsSubtabsMarginVal = '18px';

  if (appPaddingVal === '10px') {
    contentPaddingVal = '8px';
    tabNavPaddingVal = '3px 6px';
    tabBtnPaddingVal = '3px 2px';
    subTabsMarginVal = '4px 10px';
    subTabPaddingVal = '3px 6px';
    settingsSubtabPaddingVal = '5px 8px';
    settingsSubtabsMarginVal = '12px';
  } else if (appPaddingVal === '12px') {
    contentPaddingVal = '10px';
    tabNavPaddingVal = '4px 8px';
    tabBtnPaddingVal = '4px 3px';
    subTabsMarginVal = '8px 12px';
    subTabPaddingVal = '5px 10px';
    settingsSubtabPaddingVal = '8px 12px';
    settingsSubtabsMarginVal = '18px';
  } else if (appPaddingVal === '16px') {
    contentPaddingVal = '12px';
    tabNavPaddingVal = '6px 12px';
    tabBtnPaddingVal = '6px 4px';
    subTabsMarginVal = '12px 16px';
    subTabPaddingVal = '7px 14px';
    settingsSubtabPaddingVal = '10px 16px';
    settingsSubtabsMarginVal = '24px';
  } else if (appPaddingVal === '20px') {
    contentPaddingVal = '16px';
    tabNavPaddingVal = '8px 16px';
    tabBtnPaddingVal = '8px 6px';
    subTabsMarginVal = '16px 20px';
    subTabPaddingVal = '9px 18px';
    settingsSubtabPaddingVal = '12px 20px';
    settingsSubtabsMarginVal = '30px';
  }

  root.style.setProperty('--content-padding', contentPaddingVal);
  root.style.setProperty('--tab-nav-padding', tabNavPaddingVal);
  root.style.setProperty('--tab-btn-padding', tabBtnPaddingVal);
  root.style.setProperty('--sub-tabs-margin', subTabsMarginVal);
  root.style.setProperty('--sub-tab-padding', subTabPaddingVal);
  root.style.setProperty('--settings-subtab-padding', settingsSubtabPaddingVal);
  root.style.setProperty('--settings-subtabs-margin', settingsSubtabsMarginVal);

  // Dynamic Live Preview Mockup Update
  const mockHeader = document.getElementById('mockupHeader');
  if (mockHeader) {
    mockHeader.style.background = headerColor;
    mockHeader.style.color = headerTextColor;
  }

  const mockNav = document.getElementById('mockupNav');
  if (mockNav) {
    mockNav.style.background = navColor;
    mockNav.querySelectorAll('.mock-tab-btn').forEach(btn => {
      btn.style.color = tabTextColor;
    });
  }

  const mockAccentBtn = document.getElementById('mockupAccentBtn');
  if (mockAccentBtn) {
    mockAccentBtn.style.background = accentColor;
    mockAccentBtn.style.color = accentTextColor;
  }

}

export function applyTabRepositioning(settings, showTabs) {
  const promoteTabs = settings.promoteTabs || {
    tasks: true,
    notes: true,
    search: true,
    images: false,
    reactions: false,
    mentions: true
  };
  
  if (promoteTabs.tasks === undefined) promoteTabs.tasks = true;
  if (promoteTabs.notes === undefined) promoteTabs.notes = true;
  if (promoteTabs.mentions === undefined) promoteTabs.mentions = true;
  if (promoteTabs.reminders === undefined) promoteTabs.reminders = false;

  const panelContainer = document.querySelector('.panel-container');
  const tabTools = document.getElementById('tab-tools');
  
  if (!panelContainer || !tabTools) return;

  const activeTabBtn = document.querySelector('.tab-nav .tab-btn.active');
  const activeTabId = activeTabBtn ? activeTabBtn.dataset.tab : '';

  const mapping = [
    { key: 'tasks', elId: 'tab-tasks', defaultPromoted: true },
    { key: 'notes', elId: 'tab-memo', defaultPromoted: true },
    { key: 'search', elId: 'tools-section-search', defaultPromoted: false },
    { key: 'images', elId: 'tools-section-images', defaultPromoted: false },
    { key: 'reactions', elId: 'tools-section-reactions', defaultPromoted: false },
    { key: 'mentions', elId: 'tab-mentions', defaultPromoted: true },
    { key: 'reminders', elId: 'tools-section-reminders', defaultPromoted: false }
  ];

  const toolsEnabled = true;

  mapping.forEach(({ key, elId, defaultPromoted }) => {
    const el = document.getElementById(elId);
    if (!el) return;

    const promoted = promoteTabs[key] !== undefined ? promoteTabs[key] === true : defaultPromoted;

    let isTabEnabled = true;
    if (key === 'tasks') isTabEnabled = showTabs.tasks !== false && (promoted || toolsEnabled);
    else if (key === 'notes') isTabEnabled = showTabs.notes !== false && (promoted || toolsEnabled);
    else if (key === 'search') isTabEnabled = showTabs.search !== false && (promoted || toolsEnabled);
    else if (key === 'images') isTabEnabled = settings.memeEnabled !== false && (promoted || toolsEnabled);
    else if (key === 'reactions') isTabEnabled = showTabs.reactions !== false && (promoted || toolsEnabled);
    else if (key === 'mentions') isTabEnabled = showTabs.missed !== false && (promoted || toolsEnabled);
    else if (key === 'reminders') isTabEnabled = showTabs.reminders !== false && (promoted || toolsEnabled);

    if (promoted) {
      if (el.parentNode !== panelContainer) {
        panelContainer.appendChild(el);
      }
      el.classList.add('tab-content');
      el.classList.remove('tools-tab-panel');

      // Set display based on active tab state
      let tabNavId = '';
      if (key === 'tasks') tabNavId = 'tasks';
      else if (key === 'notes') tabNavId = 'memo';
      else if (key === 'search') tabNavId = 'tools-search';
      else if (key === 'images') tabNavId = 'tools-images';
      else if (key === 'reactions') tabNavId = 'tools-reactions';
      else if (key === 'mentions') tabNavId = 'mentions';
      else if (key === 'reminders') tabNavId = 'tools-reminders';

      if (isTabEnabled && activeTabId === tabNavId) {
        el.style.display = 'flex';
      } else {
        el.style.display = 'none';
      }
    } else {
      if (el.parentNode !== tabTools) {
        tabTools.appendChild(el);
      }
      el.classList.remove('tab-content');
      el.classList.add('tools-tab-panel');
      
      // Hide if tabTools is not active, or if it is not enabled
      const activeToolsBtn = document.querySelector('.tab-nav .tab-btn.active[data-tab="tools"]');
      if (!activeToolsBtn || !isTabEnabled) {
        el.style.display = 'none';
      } else {
        // If tabTools is active and tab is enabled, check if this is the active sub-tab inside Tools
        const activeSubBtn = document.querySelector('#toolsSubTabs .memo-sub-tab.active');
        const activeSub = activeSubBtn ? activeSubBtn.dataset.section : '';
        
        let tabSubSectionId = '';
        if (key === 'tasks') tabSubSectionId = 'tasks';
        else if (key === 'notes') tabSubSectionId = 'notes';
        else if (key === 'search') tabSubSectionId = 'search';
        else if (key === 'images') tabSubSectionId = 'images';
        else if (key === 'reactions') tabSubSectionId = 'reactions';
        else if (key === 'mentions') tabSubSectionId = 'mentions';
        else if (key === 'reminders') tabSubSectionId = 'reminders';

        if (activeSub === tabSubSectionId) {
          el.style.display = 'flex';
        } else {
          el.style.display = 'none';
        }
      }
    }
  });

  const toolsSubTabs = document.getElementById('toolsSubTabs');
  if (toolsSubTabs) {
    let subTabsHtml = '';
    
    if (toolsEnabled) {
      if (promoteTabs.tasks === false && (showTabs.tasks !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="tasks" data-i18n="taskTabLabel">${language.taskTabLabel || 'Tasks'}</button>`;
      }
      if (promoteTabs.notes === false && (showTabs.notes !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="notes" data-i18n="memoNotesLabel">${language.memoNotesLabel || 'Notes'}</button>`;
      }
      if (!promoteTabs.search && (showTabs.search !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="search" data-i18n="toolsSearchSubTab">${language.toolsSearchSubTab || 'Search'}</button>`;
      }
      if (!promoteTabs.images && (settings.memeEnabled !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="images" data-i18n="toolsImagesSubTab">${language.toolsImagesSubTab || 'Images'}</button>`;
      }
      if (!promoteTabs.reactions && (showTabs.reactions !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="reactions" data-i18n="toolsReactionsSubTab">${language.toolsReactionsSubTab || 'Reactions'}</button>`;
      }
      if (promoteTabs.mentions === false && (showTabs.missed !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="mentions" data-i18n="toolsMentionsSubTab">${language.toolsMentionsSubTab || 'Mentions'}</button>`;
      }
      if (promoteTabs.reminders === false && (showTabs.reminders !== false)) {
        subTabsHtml += `<button class="memo-sub-tab" data-section="reminders" data-i18n="groupRemindersTabLabel">${language.groupRemindersTabLabel || 'Schedule Message'}</button>`;
      }
    }

    toolsSubTabs.innerHTML = subTabsHtml;

    // Check if there is an active subtab. If not, set the first one as active
    const activeSub = toolsSubTabs.querySelector('.memo-sub-tab.active');
    if (!activeSub) {
      const firstSub = toolsSubTabs.querySelector('.memo-sub-tab');
      if (firstSub) {
        firstSub.classList.add('active');
        const sectionId = firstSub.dataset.section;
        
        let targetPanelId = `tools-section-${sectionId}`;
        if (sectionId === 'mentions') targetPanelId = 'tab-mentions';
        else if (sectionId === 'tasks') targetPanelId = 'tab-tasks';
        else if (sectionId === 'notes') targetPanelId = 'tab-memo';

        document.querySelectorAll('#tab-tools .tools-tab-panel').forEach(p => {
          p.style.display = 'none';
          p.classList.remove('active');
        });
        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) {
          targetPanel.style.display = 'flex';
          targetPanel.classList.add('active');
        }
      }
    }
  }
}

export function applyTabVisibilityToDOM(settings) {
  const showTabs = settings.showTabs || {};
  const memeEnabled = settings.memeEnabled;
  const promoteTabs = settings.promoteTabs || {
    tasks: true,
    notes: true,
    search: true,
    images: false,
    reactions: false,
    mentions: true,
    reminders: false
  };
  
  // Set default values for promoteTabs if undefined
  if (promoteTabs.tasks === undefined) promoteTabs.tasks = true;
  if (promoteTabs.notes === undefined) promoteTabs.notes = true;
  if (promoteTabs.mentions === undefined) promoteTabs.mentions = true;
  if (promoteTabs.reminders === undefined) promoteTabs.reminders = false;

  const toolsEnabled = true;

  // 1. Sync show/hide sub-options wrapper visibility (visible if parent tab is enabled)
  const wrapperPairs = [
    { enabled: showTabs.tasks !== false, wrapperId: 'promoteTasksWrapper' },
    { enabled: showTabs.notes !== false, wrapperId: 'promoteNotesWrapper' },
    { enabled: showTabs.search !== false, wrapperId: 'promoteSearchWrapper' },
    { enabled: showTabs.missed !== false, wrapperId: 'promoteMentionsWrapper' },
    { enabled: memeEnabled !== false, wrapperId: 'promoteImagesWrapper' },
    { enabled: showTabs.reactions !== false, wrapperId: 'promoteReactionsWrapper' },
    { enabled: showTabs.reminders !== false, wrapperId: 'promoteRemindersWrapper' }
  ];
  wrapperPairs.forEach(({ enabled, wrapperId }) => {
    const wrapper = document.getElementById(wrapperId);
    if (wrapper) {
      if (enabled) {
        wrapper.classList.add('visible');
      } else {
        wrapper.classList.remove('visible');
      }
    }
  });

  // 2. Dim cards in Settings UI if demoted and "Other Tools" is turned OFF
  const dimPairs = [
    { key: 'tasks', checkboxId: 'settingShowTasks', cardEl: document.getElementById('settingShowTasks')?.closest('.menu-tab-card') },
    { key: 'notes', checkboxId: 'settingShowNotes', cardEl: document.getElementById('settingShowNotes')?.closest('.menu-tab-card') },
    { key: 'search', checkboxId: 'settingShowSearch', cardEl: document.getElementById('settingShowSearch')?.closest('.menu-tab-card') },
    { key: 'mentions', checkboxId: 'settingShowMissed', cardEl: document.getElementById('settingShowMissed')?.closest('.menu-tab-card') },
    { key: 'images', checkboxId: 'settingMemeEnabled', cardEl: document.getElementById('settingMemeEnabled')?.closest('.menu-tab-card') },
    { key: 'reactions', checkboxId: 'settingShowReactions', cardEl: document.getElementById('settingShowReactions')?.closest('.menu-tab-card') },
    { key: 'reminders', checkboxId: 'settingShowReminders', cardEl: document.getElementById('settingShowReminders')?.closest('.menu-tab-card') }
  ];

  dimPairs.forEach(({ key, checkboxId, cardEl }) => {
    if (!cardEl) return;
    
    // Check if demoted (promoted is false)
    const isPromoted = key === 'tasks' ? promoteTabs.tasks !== false
                     : key === 'notes' ? promoteTabs.notes !== false
                     : key === 'mentions' ? promoteTabs.mentions !== false
                     : key === 'images' ? promoteTabs.images === true
                     : key === 'reactions' ? promoteTabs.reactions === true
                     : key === 'reminders' ? promoteTabs.reminders === true
                     : promoteTabs[key] === true;
                     
    if (!isPromoted && !toolsEnabled) {
      cardEl.classList.add('tools-disabled');
      cardEl.setAttribute('data-disabled-reason', language.otherToolsDisabledNotice || 'Hộp công cụ tắt');
    } else {
      cardEl.classList.remove('tools-disabled');
      cardEl.removeAttribute('data-disabled-reason');
    }
  });

  // 3. Navigation tabs visibility rules
  const tasksVisible = showTabs.tasks !== false && (promoteTabs.tasks !== false || toolsEnabled);
  const notesVisible = showTabs.notes !== false && (promoteTabs.notes !== false || toolsEnabled);
  const mentionsVisible = showTabs.missed !== false && (promoteTabs.mentions !== false || toolsEnabled);
  const reactionsVisible = showTabs.reactions !== false && (promoteTabs.reactions === true || toolsEnabled);
  const searchVisible = showTabs.search !== false && (promoteTabs.search === true || toolsEnabled);
  const imagesVisible = memeEnabled !== false && (promoteTabs.images === true || toolsEnabled);
  
  // Tools main tab is visible if there is at least one active demoted tab!
  const toolsVisible = (
    (promoteTabs.tasks === false && (showTabs.tasks !== false)) ||
    (promoteTabs.notes === false && (showTabs.notes !== false)) ||
    (!promoteTabs.search && (showTabs.search !== false)) ||
    (!promoteTabs.images && (memeEnabled !== false)) ||
    (!promoteTabs.reactions && (showTabs.reactions !== false)) ||
    (promoteTabs.mentions === false && (showTabs.missed !== false)) ||
    (!promoteTabs.reminders && (showTabs.reminders !== false))
  );

  // Set display on main navigation tab buttons
  const tasksBtn = document.querySelector('.tab-btn[data-tab="tasks"]');
  if (tasksBtn) tasksBtn.style.display = (showTabs.tasks !== false && promoteTabs.tasks !== false) ? 'flex' : 'none';
  
  const notesBtn = document.querySelector('.tab-btn[data-tab="memo"]');
  if (notesBtn) notesBtn.style.display = (showTabs.notes !== false && promoteTabs.notes !== false) ? 'flex' : 'none';
  
  const mentionsBtn = document.querySelector('.tab-btn[data-tab="mentions"]');
  if (mentionsBtn) mentionsBtn.style.display = (showTabs.missed !== false && promoteTabs.mentions !== false) ? 'flex' : 'none';
  
  const toolsBtn = document.querySelector('.tab-btn[data-tab="tools"]');
  if (toolsBtn) toolsBtn.style.display = toolsVisible ? 'flex' : 'none';

  const toolsSearchBtn = document.querySelector('.tab-btn[data-tab="tools-search"]');
  if (toolsSearchBtn) toolsSearchBtn.style.display = (showTabs.search !== false && promoteTabs.search === true) ? 'flex' : 'none';

  const toolsImagesBtn = document.querySelector('.tab-btn[data-tab="tools-images"]');
  if (toolsImagesBtn) toolsImagesBtn.style.display = (memeEnabled !== false && promoteTabs.images === true) ? 'flex' : 'none';

  const toolsReactionsBtn = document.querySelector('.tab-btn[data-tab="tools-reactions"]');
  if (toolsReactionsBtn) toolsReactionsBtn.style.display = (showTabs.reactions !== false && promoteTabs.reactions === true) ? 'flex' : 'none';

  const toolsRemindersBtn = document.querySelector('.tab-btn[data-tab="tools-reminders"]');
  if (toolsRemindersBtn) toolsRemindersBtn.style.display = (showTabs.reminders !== false && promoteTabs.reminders === true) ? 'flex' : 'none';

  // Settings is visible in navigation
  const settingsBtn = document.querySelector('.tab-btn[data-tab="settings"]');
  if (settingsBtn) settingsBtn.style.display = 'flex';

  // Find first active visible tab dynamically based on DOM sequence
  const visibleBtn = Array.from(document.querySelectorAll('.tab-nav .tab-btn')).find(btn => btn.style.display !== 'none');
  const firstVisibleTabId = visibleBtn ? visibleBtn.dataset.tab : 'tasks';

  // Check if current active tab is hidden, if so switch to first visible tab
  const activeBtn = document.querySelector('.tab-btn.active');
  if (activeBtn) {
    const activeTab = activeBtn.dataset.tab;
    let isCurrentTabVisible = true;
    if (activeTab === 'memo') isCurrentTabVisible = (showTabs.notes !== false && promoteTabs.notes !== false);
    else if (activeTab === 'tools') isCurrentTabVisible = toolsVisible;
    else if (activeTab === 'tasks') isCurrentTabVisible = (showTabs.tasks !== false && promoteTabs.tasks !== false);
    else if (activeTab === 'mentions') isCurrentTabVisible = (showTabs.missed !== false && promoteTabs.mentions !== false);
    else if (activeTab === 'tools-search') isCurrentTabVisible = (showTabs.search !== false && promoteTabs.search === true);
    else if (activeTab === 'tools-images') isCurrentTabVisible = (memeEnabled !== false && promoteTabs.images === true);
    else if (activeTab === 'tools-reactions') isCurrentTabVisible = (showTabs.reactions !== false && promoteTabs.reactions === true);
    else if (activeTab === 'tools-reminders') isCurrentTabVisible = (showTabs.reminders !== false && promoteTabs.reminders === true);

    if (!isCurrentTabVisible) {
      const fallbackBtn = document.querySelector(`.tab-btn[data-tab="${firstVisibleTabId}"]`);
      if (fallbackBtn) fallbackBtn.click();
    }
  }

  // Also auto-switch Tools sub-tab if the active Tools sub-tab is hidden
  const activeToolsSubBtn = document.querySelector('#toolsSubTabs .memo-sub-tab.active');
  if (activeToolsSubBtn) {
    const activeSub = activeToolsSubBtn.dataset.section;
    let isSubVisible = true;
    if (activeSub === 'search') isSubVisible = showTabs.search !== false;
    else if (activeSub === 'images') isSubVisible = memeEnabled !== false;
    else if (activeSub === 'mentions') isSubVisible = showTabs.missed !== false;
    else if (activeSub === 'reactions') isSubVisible = showTabs.reactions !== false;
    else if (activeSub === 'tasks') isSubVisible = showTabs.tasks !== false;
    else if (activeSub === 'notes') isSubVisible = showTabs.notes !== false;

    if (!isSubVisible) {
      const visibleSubBtn = Array.from(document.querySelectorAll('#toolsSubTabs .memo-sub-tab')).find(btn => btn.style.display !== 'none');
      if (visibleSubBtn) visibleSubBtn.click();
    }
  }
}

export async function renderSidepanelMemes() {
  const res = await chrome.storage.local.get(['custom_memes']);
  let customMemes = res.custom_memes;
  if (customMemes === undefined) {
    customMemes = DEFAULT_MEMES;
    await chrome.storage.local.set({ custom_memes: customMemes });
  }
  const container = document.getElementById('sidepanel-memes-grid');
  if (!container) return;

  // Helper functions for size calculation
  const getBase64Size = (dataURL) => {
    if (!dataURL) return 0;
    const base64Part = dataURL.split(',')[1];
    if (!base64Part) return dataURL.length;
    const padding = base64Part.endsWith('==') ? 2 : (base64Part.endsWith('=') ? 1 : 0);
    return (base64Part.length * 3 / 4) - padding;
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Calculate total size and individual sizes
  let totalBytes = 0;
  const memeSizes = customMemes.map(url => {
    const bytes = getBase64Size(url);
    totalBytes += bytes;
    return bytes;
  });

  // Update dynamic storage indicators
  const storageText = document.getElementById('sidepanel-memes-storage-text');
  const storageBar = document.getElementById('sidepanel-memes-storage-bar');
  const maxStorageBytes = 10 * 1024 * 1024; // 10MB limit

  if (storageText && storageBar) {
    const totalFormatted = formatSize(totalBytes);
    storageText.textContent = `${totalFormatted} / 10 MB`;
    const percent = Math.min((totalBytes / maxStorageBytes) * 100, 100);
    storageBar.style.width = `${percent}%`;
    
    if (percent > 85) {
      storageBar.style.background = 'var(--danger)';
    } else if (percent > 60) {
      storageBar.style.background = 'var(--warning)';
    } else {
      storageBar.style.background = 'var(--accent)';
    }
  }

  if (customMemes.length === 0) {
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.minHeight = 'auto';
    container.style.background = 'transparent';
    container.style.border = 'none';
    container.style.padding = '16px 0';
    container.style.justifyContent = 'stretch';
    container.style.alignItems = 'stretch';
    container.innerHTML = language.imageLibraryEmptyState;
    return;
  }

  container.style.display = 'flex';
  container.style.flexDirection = 'row';
  container.style.gap = '16px';
  container.style.minHeight = '300px';
  container.style.background = 'var(--bg-2)';
  container.style.border = '1px solid var(--border)';
  container.style.padding = '12px 10px 12px 2px';
  container.style.alignItems = 'flex-start';

  let col1Html = '';
  let col2Html = '';

  customMemes.forEach((url, idx) => {
    const formattedSize = formatSize(memeSizes[idx]);
    const cellHtml = `
      <div class="chatops-custom-image-cell">
        <img src="${url}" class="chatops-custom-image-item" loading="lazy" />
        <span class="sidepanel-meme-size" style="bottom: 4px; left: 4px;">${formattedSize}</span>
        <button class="chatops-custom-image-delete" data-idx="${idx}" title="${language.deleteImage || 'Delete Image'}">&times;</button>
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

export function compressSidepanelImage(file, maxWidth, maxHeight, quality, callback) {
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



export function updateFloatingCheckboxesSync(settings) {
  // Disabling a menu tab should no longer affect its corresponding floating buttons.
  // So all of them are always enabled.
  const ids = [
    { row: 'rowFloatingQuickTask', chk: 'settingFloatingQuickTask' },
    { row: 'rowFloatingGroupReminder', chk: 'settingFloatingGroupReminder' },
    { row: 'rowFloatingQuickNote', chk: 'settingFloatingQuickNote' },
    { row: 'rowFloatingSpamReactions', chk: 'settingFloatingSpamReactions' },
    { row: 'rowFloatingReactAlong', chk: 'settingReactAlongEnabled' },
    { row: 'rowFloatingImagePicker', chk: 'settingFloatingImagePicker' },
    { row: 'rowFloatingTemplatePicker', chk: 'settingFloatingTemplatePicker' },
    { row: 'rowFloatingAiSummarize', chk: 'settingFloatingAiSummarize' },
    { row: 'rowFloatingQuickMeet', chk: 'settingFloatingQuickMeet' }
  ];
  ids.forEach(({ row, chk }) => {
    const rowEl = document.getElementById(row);
    const chkEl = document.getElementById(chk);
    if (rowEl && chkEl) {
      chkEl.disabled = false;
      rowEl.style.opacity = '1.0';
      rowEl.style.pointerEvents = 'auto';
    }
  });
}

let giphyTimeout = null;
let cachedTrendingGifs = [];
let cachedTrendingApiKey = '';

function renderGifItems(data, container) {
  const size = window.activeSettings?.giphySize || '200';
  container.innerHTML = data.map(gif => {
    const previewUrl = gif.images.fixed_height_small.url;
    const sendUrl = size === '100' ? gif.images.fixed_height_small.url : gif.images.fixed_height.url;
    return `
      <div class="gif-item" data-full-url="${gif.images.fixed_height.url}">
        <img src="${previewUrl}" alt="${gif.title}" loading="lazy">
        <div class="gif-item-overlay">
          <button class="gif-item-btn btn-send" data-url="${sendUrl}">⚡ Send</button>
          <button class="gif-item-btn btn-preview" data-url="${gif.images.fixed_height.url}">🔍 View</button>
        </div>
      </div>
    `;
  }).join('');
}

async function fetchGiphyGifs(query = '') {
  const container = document.getElementById('giphy-gifs-grid');
  if (!container) return;

  const settings = await getSettings();
  const apiKey = settings.giphyApiKey || '';

  if (!apiKey) {
    container.innerHTML = `
      <div style="grid-column: span 2; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; min-height:200px; text-align:center; padding:20px;">
        <p style="font-size:13px; color:var(--text-2); margin:0;">${language.giphyNoApiKey}</p>
        <a href="#" class="settings-subtab-link" data-subtab="features-gif"
          style="font-size:13px; color:var(--accent); font-weight:600; text-decoration:none;">
          ${language.giphySetupLink} ↗
        </a>
      </div>
    `;
    return;
  }

  // If trending (empty query) and we have a valid cache for same key → reuse
  if (query.trim() === '' && cachedTrendingGifs.length > 0 && cachedTrendingApiKey === apiKey) {
    renderGifItems(cachedTrendingGifs, container);
    return;
  }

  container.innerHTML = '<div style="grid-column: span 2; display:flex; align-items:center; justify-content:center; min-height: 200px;"><span class="spinner"></span></div>';

  try {
    let url;
    if (query.trim() === '') {
      url = `https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=20&rating=g`;
    } else {
      url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&limit=20&offset=0&rating=g&lang=en`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(language.giphyHttpError.replace('{status}', response.status));
    }
    const result = await response.json();
    if (result.data && result.data.length > 0) {
      // Cache trending results
      if (query.trim() === '') {
        cachedTrendingGifs = result.data;
        cachedTrendingApiKey = apiKey;
      }
      renderGifItems(result.data, container);
    } else {
      container.innerHTML = `<div style="grid-column: span 2; display:flex; align-items:center; justify-content:center; color: var(--text-3); font-size:13px; min-height:200px;">${language.giphyNotFound}</div>`;
    }
  } catch (error) {
    console.error('Failed to fetch GIFs:', error);
    container.innerHTML = `
      <div style="grid-column: span 2; display:flex; flex-direction:column; align-items:center; justify-content:center; color: #ef4444; font-size:12.5px; padding: 20px; text-align:center; min-height:200px; gap:8px;">
        <span>❌ ${language.giphyLoadError}</span>
        <span style="font-size:11px; color:var(--text-3);">${error.message}</span>
      </div>
    `;
  }
}
export function applyTabOrderToDOM(order) {
  const container = document.querySelector('.tab-nav');
  if (!container) return;
  const defaultOrder = ['tasks', 'memo', 'tools-reminders', 'mentions', 'tools-search', 'tools-images', 'tools-reactions', 'tools'];
  let tabIds = order || [...defaultOrder];
  const missingKeys = defaultOrder.filter(key => !tabIds.includes(key));
  if (missingKeys.length > 0) {
    tabIds = [...tabIds, ...missingKeys];
  }
  tabIds = tabIds.filter(key => defaultOrder.includes(key));

  tabIds.forEach(id => {
    const btn = container.querySelector(`.tab-btn[data-tab="${id}"]`);
    if (btn) {
      container.appendChild(btn);
    }
  });

  // Always keep settings at the very end
  const settingsBtn = container.querySelector('.tab-btn[data-tab="settings"]');
  if (settingsBtn) {
    container.appendChild(settingsBtn);
  }
}

export async function renderTabOrderList() {
  const container = document.getElementById('tabOrderListContainer');
  if (!container) return;

  const settings = await getSettings();
  const defaultOrder = ['tasks', 'memo', 'tools-reminders', 'mentions', 'tools-search', 'tools-images', 'tools-reactions', 'tools'];
  let order = settings.tabOrder || [...defaultOrder];
  const missingKeys = defaultOrder.filter(key => !order.includes(key));
  if (missingKeys.length > 0) {
    order = [...order, ...missingKeys];
  }
  order = order.filter(key => defaultOrder.includes(key));

  const isTabVisibleAsMain = (id) => {
    const promoteTabs = settings.promoteTabs || {
      tasks: true,
      notes: true,
      search: true,
      images: false,
      reactions: false,
      mentions: true,
      reminders: false
    };
    if (promoteTabs.tasks === undefined) promoteTabs.tasks = true;
    if (promoteTabs.notes === undefined) promoteTabs.notes = true;
    if (promoteTabs.mentions === undefined) promoteTabs.mentions = true;
    if (promoteTabs.reminders === undefined) promoteTabs.reminders = false;

    const toolsVisible = (
      (promoteTabs.tasks === false && (settings.showTabs.tasks !== false)) ||
      (promoteTabs.notes === false && (settings.showTabs.notes !== false)) ||
      (!promoteTabs.search && (settings.showTabs.search !== false)) ||
      (!promoteTabs.images && (settings.memeEnabled !== false)) ||
      (!promoteTabs.reactions && (settings.showTabs.reactions !== false)) ||
      (promoteTabs.mentions === false && (settings.showTabs.missed !== false)) ||
      (!promoteTabs.reminders && (settings.showTabs.reminders !== false))
    );

    if (id === 'settings') return false; // settings is in the header, not nav
    if (id === 'tasks') return settings.showTabs.tasks !== false && promoteTabs.tasks !== false;
    if (id === 'memo') return settings.showTabs.notes !== false && promoteTabs.notes !== false;
    if (id === 'tools') return toolsVisible;
    if (id === 'mentions') return (settings.showTabs.missed !== false) && (promoteTabs.mentions !== false);
    if (id === 'tools-search') return (settings.showTabs.search !== false) && (promoteTabs.search === true);
    if (id === 'tools-images') return (settings.memeEnabled !== false) && (promoteTabs.images === true);
    if (id === 'tools-reactions') return (settings.showTabs.reactions !== false) && (promoteTabs.reactions === true);
    if (id === 'tools-reminders') return (settings.showTabs.reminders !== false) && (promoteTabs.reminders === true);
    return false;
  };

  const visibleOrder = order.filter(isTabVisibleAsMain);

  const tabMeta = {
    tasks: { icon: '🎯', labelKey: 'taskTabLabel', fallback: 'Tasks' },
    memo: { icon: '📒', labelKey: 'memoNotesLabel', fallback: 'Notes' },
    mentions: { icon: '🔔', labelKey: 'toolsMentionsSubTab', fallback: 'Mentions' },
    'tools-search': { icon: '🔍', labelKey: 'toolsSearchSubTab', fallback: 'Search' },
    'tools-images': { icon: '🖼️', labelKey: 'toolsImagesSubTab', fallback: 'Images' },
    'tools-reactions': { icon: '🔥', labelKey: 'toolsReactionsSubTab', fallback: 'Reactions' },
    'tools-reminders': { icon: '📢', labelKey: 'groupRemindersTabLabel', fallback: 'Schedule Message' },
    tools: { icon: '⚡', labelKey: 'toolsTabLabel', fallback: 'Other Tools' },
    settings: { icon: '⚙️', labelKey: 'settingsTabLabel', fallback: 'Settings' }
  };

  let html = '';
  visibleOrder.forEach((id, idx) => {
    const meta = tabMeta[id];
    if (!meta) return;
    const name = language[meta.labelKey] || meta.fallback;
    const isFirst = idx === 0;
    const isLast = idx === visibleOrder.length - 1;

    html += `
      <div class="tab-order-item" data-id="${id}">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:16px;">${meta.icon}</span>
          <span style="color:var(--text-1); font-weight:500;">${name}</span>
        </div>
        <div class="tab-order-actions">
          <button class="btn-tab-order-up" data-idx="${idx}" title="Move Up" ${isFirst ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>▲</button>
          <button class="btn-tab-order-down" data-idx="${idx}" title="Move Down" ${isLast ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>▼</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}


