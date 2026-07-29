/**
 * Bilingual Language Strings — ChatOps Chrome Extension
 * Centralized dictionary for English and Vietnamese UI text.
 */

// Initialize an empty language object that will be mutated in-place
export const language = {};

// English Dictionary
const en = {
  // Common
  loading: 'Loading...',
  loadingMore: 'Loading more...',
  loadMoreBtn: 'Load More',
  searching: 'Searching...',
  errorLoading: 'Error loading data',
  noResults: 'No results found',
  noResultsFriendly: 'No matching results found. Please check your workspace or search filters.',
  viewMessage: 'View Message',
  openInChatOps: 'Open in ChatOps',
  unknown: 'Unknown',
  channel: 'channel',
  in: 'in',
  copied: 'Copied!',
  cancel: 'Cancel',
  save: 'Save',
  expandCollapseBtn: 'Expand/Collapse',
  modalSearchTitle: 'Search Messages',
  headerSearchTooltip: 'Advanced Search',
  headerMentionsTooltip: 'Missed Mentions',
  headerKanbanTooltip: 'Open Kanban Board (Ctrl+Shift+K)',
  quickTaskTooltip: 'Create Task (🎯)',
  modalAddTaskTitle: 'Add New Task',
  modalAddNoteTitle: 'Add New Note',
  modalScannerFiltersTitle: 'Scanner Filters',
  stopSearch: 'Stop Search',
  stopScanning: 'Stop Scanning',
  confirmClearPendingTasks: 'Delete all pending tasks? This cannot be undone.',
  confirmClearCompletedTasks: 'Delete all completed tasks? This cannot be undone.',
  confirmClearCategoryNotes: 'Delete all notes in category "{category}"? This cannot be undone.',
  atLeastOneCategoryRequired: 'At least one category must exist!',

  // Sidepanel Search Tab
  search: 'Search',
  searchEmptyState: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">How to use?</h4><p class="card-desc">Click the search icon (🔍) to customize filters and search messages!</p></div></div>',
  searchChannelPlaceholder: 'Search channel...',
  searchPerformanceNotice: 'Select specific channels to optimize scanning performance.',
  searchCriteriaRequired: 'Please enter at least 1 search criteria',
  searchHelpTooltip: 'Search messages by keyword, sender, channel, and date range.',
  searchKeywordHelper: 'Keyword should be 2 or more characters.',
  searchIncludeDM: 'Include Direct Messages (DMs with Users)',
  searchIsOr: 'OR Search (Match any keyword)',
  resultsFor: 'Results for',
  today: 'Today',
  last7Days: 'Last 7 Days',
  last30Days: 'Last 30 Days',
  clearResults: 'Clear Results',
  reactAllBtn: 'React All',
  allWorkspacesOption: 'All',
  workspacePerformanceWarning: '⚠️ Searching across all workspaces may affect performance and take longer.',
  mentionsPerformanceWarning: '⚠️ Scanning across all workspaces may affect performance and take longer.',

  // Sidepanel Mentions Tab
  scanMentions: 'Scan Now',
  scanMentionsStart: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">How to use?</h4><p class="card-desc">Click the scan icon (🔔) to configure filters and scan. It scans for posts where you were mentioned but haven\'t reacted or replied to yet.</p></div></div>',
  scanningChannels: 'Scanning channels...',
  scanTimeNotice: 'This process may take some time. You can explore other tabs/features and come back later to see the results.',
  scanTimeNoticeModal: 'This process may take some time. Please keep this modal open until the scan finishes to see the results.',
  noMissedMentions: 'No missed mentions in the last {hours}h!',
  mentionsFound: 'Detected {count} pending mentions in {channels} channels',
  notConnected: 'Not connected. Please check <a href="#" class="settings-subtab-link" data-subtab="features-toggle" style="color: var(--accent); font-weight: 700; text-decoration: underline;">Settings</a>.',

  // Sidepanel Leave Tab
  leaveEmptyState: 'Enter information and press Search',
  selectChannelRequired: 'Please select at least 1 channel (e.g. CHECK.OFF.LATER)',
  userNotFound: 'User not found with email: {email}',
  invalidDate: 'Invalid date format',
  noLeaveRequests: 'No leave requests found',
  foundMessages: 'Found {count} messages',

  // Sidepanel Tasks Tab
  taskTabLabel: 'Tasks',
  taskEmpty: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">How to use?</h4><p class="card-desc">Click the add button <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 15px; height: 15px; border-radius: 50%; font-size: 10px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> to add a task, or hover over any message in ChatOps and click the 🎯 button to pin it as a task!</p></div></div>',
  taskClickHint: '📌 Pin messages in ChatOps or click the add <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> button.',
  taskPending: 'Pending',
  taskCompleted: 'Completed',
  taskClearAll: 'Clear All',
  taskPlaceholder: 'Enter task name...',
  taskMarkIncomplete: 'Mark as incomplete',
  taskMarkDone: 'Mark as completed',
  taskMarkDoneShort: 'Done',
  taskNoContent: '(No content)',
  taskDefaultTitle: 'Task',
  taskOverdue: 'Overdue',
  taskDelete: 'Delete',
  taskViewOriginal: 'View original message',
  taskReminderLabel: 'Remind:',
  taskReminderHint: '⏰ Starts at selected time — snoozes every {minutes} mins until completed (<a href="#" class="settings-subtab-link" data-subtab="features-snooze" style="color: var(--accent); font-weight: 700; text-decoration: underline;">change in Settings</a>)',
  taskAddBtn: 'Add Task',
  taskEmptyError: 'Task content cannot be empty.',
  taskReminderRequired: '⏰ Please set a reminder time ("Remind" or "Remind in") before saving the task.',
  pastDateError: '⏰ Reminder time cannot be in the past.',
  noCompletedTasks: 'No completed tasks yet.',
  changeReminderTime: 'Change reminder time',
  editTask: 'Edit Task',

  // Sidepanel Memo (Notes) Tab
  memoTasksEmpty: 'No tasks yet.',
  memoNotesEmpty: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">How to use?</h4><p class="card-desc">Click the add button <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 15px; height: 15px; border-radius: 50%; font-size: 10px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> to add a note, or hover over any message in ChatOps and click the 📒 button to pin it as a note!</p></div></div>',
  memoClickHint: '📒 Pin notes in ChatOps or click the add <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> button.',
  memoPending: 'Pending',
  memoCompleted: 'Completed',
  memoClearAll: 'Clear All',
  memoTaskPlaceholder: 'Enter task name...',
  memoNotePlaceholder: 'Enter note... (Shift+Enter to save)',
  memoMarkIncomplete: 'Mark as incomplete',
  memoMarkDone: 'Mark as completed',
  memoNoContent: '(No content)',
  memoEmptyNote: 'Empty note',
  memoOverdue: 'Overdue',
  memoDelete: 'Delete',
  memoViewOriginal: 'View original message',
  memoCopyNote: 'Copy content',
  memoEmptyNoteError: 'Note content cannot be empty.',
  editNote: 'Edit Note',
  deletePostTooltip: 'Delete Message (ChatOps)',
  confirmDeletePost: '⚠️ Are you sure you want to delete this message?',

  // Workspace Selector
  noWorkspaces: 'No workspaces found',

  // Content Script - Reminder Banner
  reminderTaskTitle: 'Pending Task',
  reminderTitle: 'ChatOps Reminder',
  reminderDoneBtn: '✅ Done — Stop reminding',
  reminderSkipBtn: '⏭️ Skip Today',
  gifNotSupported: 'GIF (Resize & edit not supported)',
  reminderTaskCompleted: '✅ Completed!',
  missedRemindersTitle: 'Missed Reminders',
  missedRemindersDigest: 'You missed {count} task reminders while you were away.',
  missedRemindersView: 'View Missed Tasks',
  missedAt: 'Missed at',
  
  // Content Script - Floating Button
  floatingBtnTitle: 'Open ChatOps++',
  floatingBtnHide: 'Hide this button',
  extensionUpdated: 'ChatOps++ has been updated! Please reload the page (F5) to continue.',

  // Content Script - Image Picker
  imageLibrary: 'Images',
  imageLibrarySettingsTitle: 'Image Settings',
  noCustomImages: 'No custom images yet',
  clickToSend: 'Click to send',
  deleteImage: 'Delete image',
  yourImages: 'Your images',
  uploadImageBtn: '+ Upload image',
  drawBtn: 'Draw by yourself',
  noImagesHint: 'No images yet. Click "Upload image" to add!',
  maxUploadLimitError: 'You can only upload up to 5 images at once.',
  uploadOnlyImages: 'Please select only image files.',
  storageLimitExceeded: 'Storage limit reached (10 MB). Please delete some images before uploading.',
  imageLibraryEmptyState: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 200px; padding: 24px 0; text-align: center; color: var(--text-3); font-size: 13px; font-weight: 500; grid-column: 1 / -1;"><p style="margin: 0; line-height: 1.5; max-width: 240px;">No custom images yet. Upload some images using the button above to start!</p></div>',

  // Content Script - Quick Task Popover
  quickTaskCreate: 'Quick Task',
  quickTaskTitle: 'Quick Task',
  quickTaskNotePlaceholder: 'Add note (optional)...',
  quickTaskRemindAt: 'Remind at:',
  quickTaskHint: '⏰ Starts at selected time — snoozes every {minutes} mins until completed (<a href="#" class="settings-subtab-link" data-subtab="features-snooze" style="color: var(--accent); font-weight: 700; text-decoration: underline;">change in Settings</a>)',
  quickTaskSave: 'Save',
  quickTaskCancel: 'Cancel',
  quickTaskSaveSuccess: 'Task saved',
  quickNoteTitle: 'Quick Note',
  quickNoteCreate: 'Quick Note',
  quickNoteSaveSuccess: 'Note saved',
  reminderTaskDefault: 'You have a pending task.',
  directMessage: 'Direct Message',
  includeDirectMessage: 'Include Direct Messages',
  categoryLabel: 'Category:',
  orLabel: 'OR',
  quickTaskRemindAfter: 'Remind after:',
  msgPreviewImage: '[Image] Please view directly on ChatOps',
  imagePlaceholder: 'Image',
  msgPreviewNoText: '[No text content]',

  // Content Script - Reaction spam/retraction
  spamReactionsTitle: 'Spam Reactions',
  spamSuccess: 'Spam reactions added successfully! 🔥',
  spamErrorPrefix: 'Spam reactions error: ',
  undoSpamTitle: 'Undo Spam Reactions',
  undoSpamSuccess: 'Spam reactions removed successfully! ↩️',
  undoSpamErrorPrefix: 'Undo reactions error: ',
  reactionAlreadyExists: 'You have already spammed/reacted to this post!',
  reactionNotFound: 'No reactions to retract!',
  reactAlongTitle: 'Mimic Reactions',
  reactAlongSuccess: 'Copied post reactions successfully! 🎭',
  reactAlongErrorPrefix: 'Mimic reaction error: ',
  reactAlongTooltip: 'Mimic existing post reactions',
  reactAlongEnabled: 'Mimic Reactions Button (🎭)',
  submitSaveBtn: 'Submit & Save',
  sendOnlyBtn: 'Send',
  saveCopy: 'Save to Library',
  reactionGroupsTitle: 'Reaction Groups',
  groupNameLengthError: 'Group name cannot exceed 10 characters!',
  renameGroupBtn: 'Rename',
  groupNamePlaceholder: 'Group name...',

  // Categories
  categoryAll: 'All',
  categoryGeneral: 'General',
  categoryWork: 'Work',
  categoryPersonal: 'Personal',
  categoryIdeas: 'Ideas',
  categorySelect: 'Select category...',

  // Settings Tab & Sync
  backupToCloud: 'Backup to Cloud',
  backingUp: 'Backing up...',
  restoring: 'Restoring...',
  restoreFromCloud: 'Restore from Cloud',
  cleaningUp: 'Cleaning up...',
  cleanUpNow: 'Clean up now',
  confirmRestore: '⚠️ Are you sure you want to restore data from Cloud?\nAll current notes and tasks on this machine will be completely OVERWRITTEN by data from your Google account.',
  confirmCleanup: '🧹 Are you sure you want to clean up completed tasks older than your set duration now?',
  testBannerSuccess: '🟢 Test notification sent!',
  testSystemSuccess: '🟢 Test notification sent!',
  testBothSuccess: '🟢 Test notification sent!',
  testErrorPrefix: '🔴 Background notification error: ',
  testBgWorkerError: '🔴 Cannot connect to Background Service Worker. Please reload the extension at chrome://extensions.',
  testInPageBannerMsg: '🔔 This is a test notification from ChatOps++!',
  testSystemTitle: '🎯 ChatOps++ Test Notification',
  testSystemMsg: 'OS push notification system is working perfectly!',
  backupSuccess: '🎉 Successfully backed up data to your Google account!',
  backupFailed: '❌ Backup failed. Please try again.',
  restoreSuccess: '🎉 Successfully restored data from your Google account!',
  restoreFailed: '❌ Restore failed. Please try again.',
  cleanupSuccess: '🎉 Cleanup completed successfully! Removed {count} old items from local storage.',
  cleanupFailed: '❌ Cleanup failed. Please try again.',
  autoSaved: 'Auto-saved',
  lastSyncText: '☁️ Last sync: <strong style="color:var(--success); font-weight:700;">{time}</strong>',
  neverSyncedText: '⏳ Never backed up or restored on this device.',
  storageUsageText: '💻 Local: <strong style="color:var(--accent);">{local}</strong> | ☁️ Cloud: <strong style="color:var(--success);">{sync}</strong> / 100KB',

  // HTML Static Texts
  supportVibecodingTitle: '☕ Support Development!',
  supportVibecodingDesc: 'If this extension has been helpful to you, consider buying the developer a coffee to support future projects 🚀',
  rateExtensionTooltip: 'Rate 5 Stars on Chrome Web Store ⭐',
  supportRateTitle: 'Rate & Feedback',
  supportRateDesc: 'Support development by rating 5 stars',
  rateAppDescription: 'If this extension has been helpful to you, please consider rating us 5 stars on the Chrome Web Store to support development! ⭐',
  rateAppButton: 'Rate 5 Stars Now',
  supportContactDesc: 'For any feedback or bug reports, please contact: <a href="mailto:dinhhan09091998@gmail.com" style="color:var(--accent); text-decoration:underline;">dinhhan09091998@gmail.com</a>',
  tabOrderTitle: 'Tab Order Placement',
  tabOrderDesc: 'Customize navigation tab sorting',
  tabOrderGuide: 'Use the arrow buttons to rearrange the sequence of tabs on the navigation bar.',
  categoryNameLengthError: 'Category name cannot exceed 10 characters!',
  categoryAlreadyExists: 'This category already exists!',
  maxCategoriesLimit: 'Maximum of 5 categories allowed!',
  categoryNameEmptyError: 'Category name cannot be empty!',
  categoryContainsNotesError: 'Category "{category}" contains notes and cannot be deleted!',
  noReactionsToClone: 'No reactions on this post to clone!',
  alreadyClonedAllReactions: 'You have already reacted to all existing emojis on this post!',
  toastSentAndSavedNext: 'Sent & saved image! Switching to next image...',
  toastSentAndSavedAll: 'All images sent & saved successfully! 🎉',
  toastSentOnlyNext: 'Sent image! Switching to next image...',
  toastSentAll: 'All images sent successfully! 🎉',
  webpConvertingToast: 'Converting image for ChatOps... Please wait.',
  webpConvertedToGif: 'Animated image converted to GIF ✅',
  webpConvertedToPng: 'Image converted to PNG ✅',
  toastSavedToLibraryNext: 'Saved image to library! Switching to next image...',
  toastSavedToLibraryAll: 'All images saved to library successfully! 🎉',
  memoNotesLabel: 'Notes',
  toolsTabLabel: 'Other Tools',
  toolsSearchSubTab: 'Search',
  toolsMentionsSubTab: 'Missed Messages',
  toolsImagesSubTab: 'Images',
  toolsReactionsSubTab: 'Spam Reactions',
  showToolsToggle: 'Tools (Search, Images, Reactions)',
  showReactions: 'Spam Reactions',
  settingsAlwaysVisible: 'Settings (always visible)',
  alwaysOnBadge: 'Always On',
  settingsTabLabel: 'Settings',
  searchTermsPlaceholder: 'Search keyword... (Enter to search)',
  searchUserPlaceholder: 'Search user...',
  searchAfterPlaceholder: 'After date',
  searchBeforePlaceholder: 'Before date',
  searchNewBtn: 'New Search',
  syncTooltip: 'Click to backup or restore data via Google account',
  syncText: 'Sync',

  clearAllTasks: '🗑️ Clear All',
  clearAllNotes: '🗑️ Clear All',
  confirmClearAllTasks: 'Delete ALL tasks? This cannot be undone.',
  confirmClearAllNotes: 'Delete ALL notes? This cannot be undone.',
  langToggleTooltip: 'Switch to Vietnamese 🇻🇳',
  titleOptional: 'Title (optional)',
  chooseDatePlaceholder: 'Choose...',
  taskTextareaPlaceholder: 'Add new task... (Shift + Enter to save)',
  remindInPreset: 'Remind in...',
  noteTextareaPlaceholder: 'Write a note... (Shift + Enter to save)',
  categoryLabelPrefix: 'Category:',
  customizeCategories: '➕ Customize Categories',
  memoAddBtn: 'Add Note',
  last24Hours: 'Last 24 hours',
  last48Hours: 'Last 48 hours',
  last72Hours: 'Last 72 hours',
  last14Days: 'Last 14 Days',
  mentionDirect: 'Direct mention (@you)',
  mentionHere: 'Group mention (@here)',
  mentionChannel: 'Channel mention (@channel / @all)',
  mentionDMs: 'Direct Messages (DM / GM)',
  mentionOnlyUnread: 'Only show messages without reaction/reply',
  imageLibraryTab: 'My Library',
  resizeImage: 'Resize image',
  resizeImageTitle: 'Resize Image',
  resizeScaleLabel: 'Scale',
  saveCopy: 'Save',
  saved: 'Saved!',
  insertToChat: 'Insert to Chat',
  editImageBtn: '✏️ Edit Image',
  editImageTitle: 'Edit Image',
  drawTitle: 'Quick Draw',
  drawToolBrush: 'Brush',
  drawToolRect: 'Rectangle',
  drawToolCircle: 'Circle',
  drawToolTriangle: 'Triangle',
  drawToolLine: 'Line',
  drawToolArrow: 'Arrow',
  drawToolText: 'Text',
  drawToolEraser: 'Eraser',
  drawToolShapes: 'Shapes',
  customColorTitle: 'Choose Color',
  drawColorLabel: 'Color:',
  drawSizeLabel: 'Size:',
  drawUndoBtn: 'Undo',
  drawResetBtn: 'Reset',
  drawApplyBtn: 'Apply',
  editorUploadBg: 'Upload Background',
  editorUploadBgBtn: '📁 Upload Image',
  noImageInClipboard: 'No image found in clipboard.',
  clipboardPermissionDenied: 'Clipboard access denied. Please use Ctrl+V to paste.',
  autoSendLabel: 'Send directly',
  drawUploadBtn: 'Upload & Draw',
  gifLibraryTab: 'GIFs',
  reactionSpammerTab: 'Spam Reactions',
  giphyGifSearch: 'Giphy GIFs',
  searchGifPlaceholder: 'Search GIFs on Giphy...',
  gifDefaultHint: '💡 These are trending GIFs. Search above to find more!',
  imageLibraryDesc: 'Click the image icon 🖼️ in the chatbox toolbar to open the picker.',
  usedStorageSpace: 'Used Storage Space',
  howToUseTitle: 'How to use?',
  reactionSpammerDesc: 'Hover over any message on ChatOps, then click the <strong>Fire button (🔥)</strong> in the hover actions menu to instantly spam your selected emojis, or click the <strong>Return button (↩️)</strong> to retract them!',
  selectedEmojisTitle: 'Selected Emojis',
  selectedEmojisDesc: 'Click on an emoji below to remove it from your quick-spam list.',
  addEmojisTitle: 'Add Emojis',
  addEmojisDesc: 'Click on an emoji below to add it to your quick-spam list.',
  emojiTabStandard: 'STANDARD',
  emojiTabCustom: 'WORKSPACE',
  searchEmojiPlaceholder: 'Search emoji by name (e.g. fire, heart)...',
  loadingMoreEmojis: 'Loading more emojis...',
  settingsSubFeaturesTab: 'Features',
  settingsSubUITab: 'UI',
  settingsSubDataTab: 'Data',
  settingsOverviewWelcome: 'Welcome to <strong style="color: var(--accent); font-weight: 700;">ChatOps++</strong>! Your productivity toolkit:',
  overviewSearchDesc: '<strong>Search Messages:</strong> Instant chat history query.',
  overviewTasksDesc: '<strong>Tasks:</strong> Smart task manager with snooze alerts.',
  overviewNotesDesc: '<strong>Notes:</strong> Category-based quick note-taking with instant click-to-copy individual lines.',
  overviewMissedDesc: '<strong>Missed Messages:</strong> Track missed channel messages.',
  overviewSpamDesc: '<strong>Spam Reactions:</strong> Express multiple emojis instantly and retract them easily.',
  overviewImageDesc: '<strong>Images:</strong> Upload and quick-send your favorite personal images.',
  overviewQuickDeleteDesc: '<strong>Quick Delete:</strong> Instantly fade out and delete your own chat messages.',
  overviewPrivacyTitle: 'Privacy & Security Commitment',
  overviewPrivacyDesc: '<strong>ChatOps++</strong> does not collect, store, or transmit your personal data. All data is stored 100% locally in your browser (Local Storage) under your full control.',
  overviewSupportTitle: 'Support & Feedback',
  overviewSupportDesc: 'For any questions, suggestions, or bug reports, please contact <a href="https://chat.runsystem.vn/runsystem/messages/@hannd-runsystem.net" class="support-chatops-link" style="color: #3498db; font-weight: 700; text-decoration: underline;">hannd@runsystem.net</a> via ChatOps.',
  featureSettingsTitle: 'Feature Settings',
  featuresToggleTab: '⚙️ Toggles',
  featuresSnoozeTab: '⏳ Snooze',
  featuresAlertsTab: '🔔 Alerts',
  featuresGifTab: '🎬 GIFs',
  giphyApiKeyTitle: 'Giphy API Key',
  giphyApiKeyDesc: 'Enter your Giphy API Key to search and use GIFs.',
  giphyNoApiKey: 'Giphy API Key not set up yet.',
  giphySetupLink: 'Set up in Settings → GIFs',
  giphyRateLimitWarning: '',
  giphyApiKeyPlaceholder: 'Paste Giphy API Key here...',
  giphyGuideTitle: '🔑 How to get a free Giphy API Key',
  giphyGuideStep1: 'Visit <a href="https://https://developers.giphy.com/dashboard" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:600;">https://developers.giphy.com/dashboard</a>',
  giphyGuideStep2: 'Click <strong>Create an API key</strong> → choose <strong>API (not SDK)</strong>',
  giphyGuideStep3: 'Enter any app name → click <strong>Next Step</strong>',
  giphyGuideStep4: 'Copy the provided <strong>API Key</strong> → paste it into the field above',
  giphyGuideNote: '💡 <strong>Free Tier</strong> supports 100 requests/hour.',
  giphyCheckingKey: 'Checking API Key...',
  giphyValidKey: 'Giphy API Key is valid!',
  giphyInvalidKey: 'Giphy API Key is invalid or expired.',
  giphyConnectionError: 'Connection error: Failed to validate Giphy API Key.',
  giphyLoadError: 'Failed to load GIFs.',
  giphyHttpError: 'HTTP {status} — check your API Key or try again later (limit: 100 req/h).',
  giphyNotFound: 'No GIFs found.',
  giphySizeTitle: 'Giphy Send Size',
  giphySizeDesc: 'Choose the size of the GIF image when inserting it into the chat.',
  giphySize200: 'Large (200px - Default)',
  giphySize100: 'Small (100px)',
  featuresToggleTitle: 'Enable/Disable Features',
  featuresToggleDesc: 'Select which modules you want to display in the sidepanel.',
  menuTabsTitle: 'Sidepanel Menu Tabs',
  menuTabsDesc: 'Select which tabs you want to show in the sidepanel navigation.',
  promoteToMainTab: 'Promote to Main Tab',
  otherToolsDisabledNotice: 'Other Tools is OFF',
  floatingButtonsTitle: 'Quick Actions on ChatOps',
  floatingButtonsDesc: 'Floating buttons & position layout',
  floatingQuickTask: 'Quick Create Task Button (🎯)',
  floatingQuickNote: 'Quick Create Note Button (📒)',
  floatingSpamReactions: 'Spam & Revert reaction Hover Buttons (🔥/↩️ )',
  floatingImagePicker: 'Send Image Button (🖼️)',
  floatingQuickReply: 'Quick Reply Tag Button (💬)',
  floatingQuickCopy: 'Quick Copy Message Button (📋)',
  floatingTemplatePicker: 'Quick Template Button (📒)',
  templatePickerTitle: 'Note Templates',
  searchTemplatePlaceholder: 'Search by title, content, category...',
  searchTasksPlaceholder: 'Search tasks...',
  permalinkJumpTip: 'Tip: To jump accurately to a message, ensure that the channel/group chat is set to Default View mode.',
  noTemplatesHint: 'No templates found. Go to Notes tab in the side panel or click + to add one!',
  quickTemplateTooltip: 'Insert Note Template (📒)',
  floatingGroupReminder: 'Group Reminder Button (📢)',
  quickGroupReminderTooltip: 'Schedule message to this channel (📢)',
  floatingQuickMeet: 'Quick Google Meet Button (📹)',
  quickMeetTooltip: 'Create Google Meet Room',
  meetRoomCreatedToast: 'Google Meet link created and inserted!',
  modalAddGroupReminderTitle: 'SCHEDULE MESSAGE TO CHANNEL',
  groupReminderTextareaPlaceholder: 'Enter message content... (type @ to tag users)',
  groupReminderSectionTitle: 'Schedule Message to Channel',
  groupReminderLabel: 'Schedule Message',
  groupRemindersTabLabel: 'Schedule Message',
  quickGroupReminderSaveSuccess: 'Schedule message saved successfully!',
  targetChannelInfo: 'Messages will be sent to channel: {channel}',
  autoMessagePrefix: '##### --- This is an automated message --- #####',
  scheduleSendLabel: 'Send at:',
  groupReminderSentToast: 'Automated message sent to channel: {channel}',
  noScheduledReminders: 'No scheduled messages pending',
  noCompletedReminders: 'No completed scheduled messages',
  reminderConfirmClear: 'Are you sure you want to clear all completed scheduled messages?',


  quickReplyBtnTooltip: 'Quick Reply (@tag)',
  quickCopyBtnTooltip: 'Quick Copy Message',
  copiedToClipboard: 'Copied message content to clipboard!',
  usernameNotFoundError: 'Could not find username to tag!',
  additionalSettingsTitle: 'Additional Options',
  snoozeTitle: 'Default Snooze Time',
  snoozeDesc: 'Default snooze duration (minutes) for new task reminders.',
  minutesLabel: 'minutes',
  staleThresholdTitle: 'Stale Alarm Threshold',
  staleThresholdDesc: 'If a task reminder fires more than this many minutes late (e.g. after Chrome was closed), it is silently skipped and rescheduled — not shown as a notification.',
  staleThresholdLabel: 'Skip if delayed more than',
  alertsTitle: 'Alert Delivery Type',
  alertsDesc: 'Select how you want to be notified when a task reminder is triggered.',
  alertsOptionBoth: '🔔 Both',
  alertsOptionSystem: '🖥️ OS System Notification only',
  alertsOptionInPage: '💬 In-page Banner only',
  testNotificationBtn: '🔔 Test Notification',
  alertsHelpTitle: 'ℹ️ HOW TO ENABLE SYSTEM NOTIFICATIONS',
  alertsHelpDesc: `
    <div>
      🍏 <strong>macOS:</strong> Go to <em>System Settings</em> → <em>Notifications</em> → <strong>Google
        Chrome</strong> → Enable <strong>Allow Notifications</strong> and select <strong>Banners</strong>
      or <strong>Alerts</strong>.
    </div>
    <div>
      🪟 <strong>Windows:</strong> Go to <em>Settings</em> → <em>System</em> → <em>Notifications</em> →
        Ensure general alerts are ON and allow <strong>Google Chrome</strong>.
    </div>
    <div>
      🐧 <strong>Ubuntu (Linux):</strong> Go to <em>Settings</em> → <em>Notifications</em> →
        <strong>Google Chrome</strong> → Ensure notifications are enabled.
    </div>
    <div
      style="border-top: 1px dashed var(--border); margin-top: 6px; padding-top: 8px; font-style: italic; color: var(--accent); font-weight: 500;">
      💡 Tip: If notifications do not appear after enabling, restart Google Chrome completely (Cmd+Q on
      macOS, or close all windows) for the OS to apply permissions.
    </div>
  `,
  snoozeAlertDesc: 'Snooze time, alert type & sound',
  giphyApiDesc: 'API key & rate limit settings',
  manageCategoriesDesc: 'Manage custom note categories',
  createCategoryHint: '💡 You can <a href="#" class="settings-subtab-link" data-subtab="categories" style="color: var(--accent); text-decoration: underline; font-weight: 600;">add categories</a> in Settings',
  themeSettingsTitle: 'Theme Settings',
  themeHeaderTitle: 'Header Component',
  themeNavTitle: 'Navigation Bar (Tabs)',
  themeTabTextTitle: 'Tab Text Color',
  themeAccentTitle: 'Accent Buttons & Highlights',
  colorBgLabel: 'BG',
  colorTextLabel: 'Text',
  themePaddingTitle: 'Layout Spacing (Padding)',
  themePaddingDesc: 'Fine-tune the density and spacing of lists, cards, and panels across the extension.',
  paddingCompact: 'Compact (10px)',
  paddingDefault: 'Default (12px)',
  paddingComfortable: 'Comfortable (16px)',
  paddingSpacious: 'Spacious (20px)',

  categoriesTitle: 'Note Categories',
  newCategoryPlaceholder: 'Enter new category...',
  addBtn: 'Add',
  dataManagementTitle: 'Data Management',
  syncCloudTab: '☁️ Cloud Sync',
  syncCleanupTab: '🧹 Cleanup & Space',
  cloudSyncTitle: 'Cloud Sync (Google Account)',
  cloudSyncDesc: 'Backup or restore your tasks and notes to the cloud via your Google account to sync data across computers.',
  backupToCloudBtn: 'Backup',
  restoreFromCloudBtn: 'Restore',
  noBackupsFound: 'No backups found on this computer.',
  whySyncTitle: 'Why use manual sync?',
  whySyncDesc: 'To ensure maximum privacy and instant speed, all data is stored offline by default. Manual sync lets you decide exactly when to backup or transfer your data.',
  cleanupTitle: 'Cleanup & Storage Optimization',
  cleanupDesc: 'Automatically delete completed tasks after a certain period of time to keep your data synchronized quickly.',
  storageUsedLabel: 'Storage Used:',
  autoCleanupLabel: 'Auto Cleanup Period:',
  autoCleanupSublabel: 'Only applies to completed tasks.',
  cleanupNever: 'Never',
  cleanupOnOpen: 'Upon opening Extension',
  cleanup1Day: 'After 1 day',
  cleanup7Days: 'After 7 days',
  cleanup30Days: 'After 30 days',
  cleanup90Days: 'After 90 days',
  cleanupNowBtn: 'Cleanup Now',
  confirmDeleteTask: '⚠️ Are you sure you want to delete this task?',
  confirmDeleteNote: '⚠️ Are you sure you want to delete this note?',
  settingQuickDelete: 'Quick Delete Button (🗑️)',
  customButtonsPositionLabel: 'Buttons Position',
  customButtonsPositionSublabel: 'Configure layout relative to ChatOps menu',
  posHorizontalBefore: 'Horizontal - Before Actions',
  posHorizontalAfter: 'Horizontal - After Actions',
  posAbove: 'Vertical - Above Actions',
  posBelow: 'Vertical - Below Actions',
  settingSoundNotification: 'Play sound for notifications',
  settingsSaved: 'Saved automatically',
  notificationPositionTitle: 'Notification Position',
  notificationPositionDesc: 'Set the position of the in-page notification banner.',
  posTopRight: 'Top Right (Default)',
  posTopLeft: 'Top Left',
  posBottomRight: 'Bottom Right',
  posBottomLeft: 'Bottom Left',
  posTopCenter: 'Top Center',
  posBottomCenter: 'Bottom Center',
  posCenter: 'Center',
  notificationAnimationTitle: 'Notification Animation',
  notificationAnimationDesc: 'Select the entrance animation for in-page reminders.',
  animDefault: 'Slide In (Default)',
  animStrong: 'Strong Shake & Glow',
  animShakeContinuous: 'Continuous Shake',
  animPulseGlow: 'Continuous Pulse Glow',
  animBounce: 'Continuous Bounce',
  notificationSizeTitle: 'Notification Size',
  notificationSizeDesc: 'Select the size of the in-page reminder banner.',
  sizeMedium: 'Medium (Default)',
  sizeLarge: 'Large',
  tabsCompactToggleTooltip: 'Toggle Compact Tabs (Icon Only)',
  customColorLabel: 'Custom...',
  exportNotesBtn: 'Export',
  importNotesBtn: 'Import',
  exportNotesBtnTitle: 'Export notes to Markdown (.md) file',
  importNotesBtnTitle: 'Import notes from Markdown (.md), TXT or JSON file',
  importSuccess: '🎉 Successfully imported {count} notes!',
  importFailed: '❌ Import failed. Please check the file content.',
  categoryNormal: 'Normal',
  categoryChecklist: 'Checklist',
  categoryGroupReminder: 'Group Reminder',
  reminderTargetGroupLabel: 'Remind in Group:',
  selectChannelPlaceholder: 'Choose Group...',
  mentionTargetLabel: 'Tag whom:',
  mentionTargetNone: 'No Tag',
  mentionTargetAll: '@all (All)',
  mentionTargetHere: '@here (Online)',
  mentionTargetUsers: 'Specific users...',
  mentionUsersLabel: 'Users to tag:',
  addChecklineBtn: '+ Add item',
  checklistPlaceholder: 'checklist {num}...',
  checklistMinError: 'Please enter at least one checklist item.',
  taskRemindDailyLabel: 'Repeat daily at selected time',
  repeatDailyBadgeText: 'Daily',
  collapseBtnBottom: 'Collapse',
  groupMessage: 'Group Message',
  userGuideTitle: 'System Guide 💡',
  userGuideHTML: `
    <div class="guide-container">

      <!-- Section 1: Core Tabs & Functions -->
      <div>
        <h4 class="guide-section-title">🚀 CHATOPS++ CORE TABS & FEATURES</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          
          <div class="settings-road-card main-tab-link" data-tab="tasks">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🎯</span>
              <a href="#" class="main-tab-link-anchor" data-tab="tasks">Tasks</a>
            </div>
            <p>Manage daily to-do lists. Supports rich text lists, interactive nested Checklists, and recurring alarms. Can be promoted to the main menu or demoted inside ⚡ Other Tools.</p>
          </div>

          <div class="settings-road-card main-tab-link" data-tab="memo">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">📒</span>
              <a href="#" class="main-tab-link-anchor" data-tab="memo">Notes</a>
            </div>
            <p>Quickly capture personal ideas or save important chat messages with 1-click. Organize notes with folders and labels. Can be promoted to the main menu or demoted inside ⚡ Other Tools.</p>
          </div>

          <div class="settings-road-card main-tab-link" data-tab="mentions">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔔</span>
              <a href="#" class="main-tab-link-anchor" data-tab="mentions">Missed Messages (Mentions)</a>
            </div>
            <p>Track tags (@mentions), DMs, and thread discussions centrally. Provides helpful bulleted summaries and swift reply capabilities.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="tools-search">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔍</span>
              <a href="#" class="settings-subtab-link" data-subtab="tools-search">Advanced Search</a>
            </div>
            <p>Smart chat history crawler. Filter by sender, keywords, or date range easily, supporting OR conditions and excluding DMs.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="reactions-images">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🖼️</span>
              <a href="#" class="settings-subtab-link" data-subtab="reactions-images">Images & Meme Library</a>
            </div>
            <p>Manage your custom image/meme library, supports batch uploads and fast direct inserting into chat box. Auto-compresses image sizes.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="reactions-picker">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔥</span>
              <a href="#" class="settings-subtab-link" data-subtab="reactions-picker">Spam & Revert Reactions</a>
            </div>
            <p>Toggle quick emoji reactions. Set up custom reaction groups to instantly spam multiple emojis with a single click, or undo them instantly.</p>
          </div>

        </div>
      </div>
      
      <!-- Section 1.5: Interactive Settings Map -->
      <div>
        <h4 class="guide-section-title">⚙️ INTERACTIVE SYSTEM SETTINGS MAP</h4>
        <div class="guide-grid">
          
          <div class="settings-road-card settings-subtab-link" data-subtab="features-toggle">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-toggle">Menu & Tab Positioning</a>
            </div>
            <p>Toggle show/hide for all 6 primary tabs, sort their visual order using arrow buttons ↕️, and promote or demote them to the ⚡ Other Tools container.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-floating">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-floating">Quick Floating Buttons</a>
            </div>
            <p>Customize floating action buttons over messages (Task 🎯, Note 📒, Spam 🔥, Mimic Reactions 🎭, Send Image 🖼, Reply 💬, Copy 📋).</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-snooze">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-snooze">Alarms & Snooze Durations</a>
            </div>
            <p>Configure task reminder alarms, sound alert types (Gentle / Alarm), and default snooze durations (minutes).</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-gif">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-gif">Giphy API & Cache GIFs</a>
            </div>
            <p>Set personal Giphy API key and choose GIF display size (100px / 200px). Trending GIFs are cached automatically to conserve API limit.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="categories">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="categories">Notes Categories</a>
            </div>
            <p>Create and edit custom category labels to classify your personal ideas, checklist logs, and saved items cleanly.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="sync-data">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="sync-data">Cloud Backups & Auto-cleanup</a>
            </div>
            <p>Sync all tasks/notes data to your secure Google Drive. Enable auto-cleanup options to systematically delete old logs and free up space.</p>
          </div>

        </div>
      </div>

      <!-- Section 2: Hover Quick Actions -->
      <div class="guide-info-box">
        <h4 class="guide-info-title">⚡ HOVER ACTIONS ON MESSAGES</h4>
        <div class="guide-info-list">
          <div class="guide-info-item"><span>🎯</span> <span style="color: var(--text-2);">Pin message as a pending <strong>Task</strong></span></div>
          <div class="guide-info-item"><span>📒</span> <span style="color: var(--text-2);">Save message as a personal <strong>Note</strong></span></div>
          <div class="guide-info-item"><span>💬</span> <span style="color: var(--text-2);"><strong>Quick Reply (@tag)</strong> to automatically tag sender</span></div>
          <div class="guide-info-item"><span>📋</span> <span style="color: var(--text-2);"><strong>Quick Copy</strong> message body to clipboard</span></div>
          <div class="guide-info-item"><span>🔥</span> <span style="color: var(--text-2);">Dynamic <strong>Spam Reactions</strong> in 1-click</span></div>
          <div class="guide-info-item"><span>🎭</span> <span style="color: var(--text-2);"><strong>React-Along</strong> to copy all existing emojis on the post</span></div>
          <div class="guide-info-item"><span>↩️</span> <span style="color: var(--text-2);"><strong>Instantly clear</strong> all your reactions</span></div>
          <div class="guide-info-item"><span style="color: #dc2626;">🗑️</span> <span style="color: var(--text-2);"><strong>Delete your own messages</strong> instantly (no confirmation popup)</span></div>
        </div>
      </div>

      <!-- Section 3: Power Tips -->
      <div class="guide-tip-section">
        <h4 class="guide-section-title">💡 DYNAMIC POWER TIPS</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="guide-tip-box">
            <strong>⚡ Double-Click Shortcut:</strong>
            <span> Double-click any navigation tab (Search, Tasks, Notes) at the top of the sidepanel to pop open its entry form instantly!</span>
          </div>
          <div class="guide-tip-box">
            <strong>✂️ Clipboard Copy:</strong>
            <span> Hover over any text line in an expanded Note card, click the clipboard icon to copy *only that specific line*!</span>
          </div>
        </div>
      </div>
    </div>
  `,
  previewImage: 'Preview full image',
  systemHelpTooltip: 'System Help & Tips',
  closeModal: 'Close modal',
  clickToRemove: 'Click to remove',
  editBtn: 'Edit',
  deleteBtn: 'Delete',
  clickToCopyLine: 'Click to copy this line',
  quickCopyTextOnlyError: 'Quick copy only supports text messages.',
  colorOrange: 'Orange',
  colorTeal: 'Teal',
  colorRose: 'Rose',
  colorSlate: 'Slate',
  colorWhite: 'White',
  colorLightGray: 'Light Gray',
  colorYellow: 'Yellow',
  colorDark: 'Dark',

  // Interactive Onboarding Tour
  tourSkip: 'Skip Tour',
  tourPrev: '← Back',
  tourNext: 'Next →',
  tourFinish: '🚀 Get Started!',
  tourStepOf: '{current} / {total}',
  tourModalPreview: '(Form preview — click <strong>Next</strong> to continue)',

  tourStep1Title: '👋 Welcome to ChatOps++!',
  tourStep1Desc: 'This quick tour walks you through the key features.<br><br>⚡ <strong>Primary usage:</strong> Hover over any message on ChatOps to show the <strong>Quick Action Panel</strong> above the message:<div style="position: relative; display: flex; gap: 8px; padding: 10px 12px; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 6px; margin: 20px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; text-align: left; line-height: 1.4;"><div style="width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">CO</div><div style="flex-grow: 1; min-width: 0;"><div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;"><span style="font-weight: 600; font-size: 12px; color: var(--text);">Hannd</span><span style="font-size: 10px; color: var(--text-3);">10:30 AM</span></div><div style="font-size: 12px; color: var(--text-2); word-break: break-word;">Dự án ChatOps++ này cần hoàn thành trước ngày 20 nhé cả nhà!</div></div><div style="position: absolute; right: 10px; top: -14px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.1); display: inline-flex; align-items: center; padding: 2px 4px; gap: 2px; z-index: 5;"><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="🎯 Pin Task" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🎯</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="📒 Save Note" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">📒</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="💬 Quick Reply" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">💬</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="📋 Quick Copy" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">📋</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="🔥 Spam Reactions" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🔥</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="🎭 Clone Reactions" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🎭</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="↩️ Undo Reactions" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">↩️</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="🗑️ Delete Message" onmouseover="this.style.background=\'rgba(255,0,0,0.1)\'" onmouseout="this.style.background=\'transparent\'">🗑️</span></div></div>Click <strong>Next</strong> to begin, or <strong>Skip</strong> to explore on your own.',

  tourStep2Title: '🎯 Tasks — Manage your work',
  tourStep2Desc: 'Track daily to-dos. Pin any ChatOps message as a task with one hover-click.<br><br>💡 <strong>Pro tip:</strong> Double-click this tab to open the Add Task modal!',

  tourStep3Title: 'Create Tasks',
  tourStep3Desc: 'Create the tasks you want to track and get reminded about at the time you set.',

  tourStep4Title: '📒 Notes — Capture ideas',
  tourStep4Desc: 'Save ideas or important ChatOps messages as personal notes. Organize them with custom categories.<br><br>💡 <strong>Pro tip:</strong> Double-click this tab to open the Add Note modal!',

  tourStep5Title: 'Create Notes',
  tourStep5Desc: 'Create personal notes by category so you can easily search and reference them later.',

  tourStep6Title: '🔔 Missed Messages — Track @mentions',
  tourStep6Desc: 'Never miss an @mention again! Scan channels for messages you have not reacted or replied to.<br><br>💡 <strong>Pro tip:</strong> Double-click this tab to open the scan filters modal!',

  tourStep7Title: 'Scan Mentions',
  tourStep7Desc: 'Scan and filter missed mentions in your channels to make sure you never miss an important message.',

  tourStep8Title: '⚡ Other Tools — Advanced utilities',
  tourStep8Desc: 'Explore advanced productivity tools, including your Image Library and Reaction configurations.',

  tourStep9Title: 'Search Messages',
  tourStep9Desc: 'Search through message history with advanced filters.<br><br>💡 <strong>Pro tip:</strong> Double-click this tab to open the Search panel!',
  tourStep9ModalTitle: 'Search Filters',
  tourStep9ModalDesc: 'Enter keywords, filter by sender, channel, or date range to find messages precisely.',

  tourStep10Title: '🖼️ Image Library',
  tourStep10Desc: 'Upload images/memes by clicking the upload button or dragging files here, then click directly on an image to insert or send it.',

  tourStep11Title: '🔥 Spam Reactions',
  tourStep11Desc: 'Configure a list of emojis for quick reaction spam. Click emojis to add/remove them. Changes are saved automatically.',

  tourStep12Title: '⚙️ Settings — Customize everything',
  tourStep12Desc: 'Configure extension settings and behaviors. Remember, hovering over any ChatOps message displays handy quick action icons.',

  tourStep13Title: '🚀 Quick Hover Actions',
  tourStep13Desc: 'Toggle quick buttons visible when hovering over ChatOps messages (Pin Task, Save Note, Spam React, Copy, Reply, etc.).',

  tourStep14Title: '🔔 In-app Notifications',
  tourStep14Desc: 'Configure sound notifications and desktop alerts for new mentions or updates.',

  tourStep15Title: '🎬 Giphy Integration',
  tourStep15Desc: 'Configure Giphy integration settings to search and send animated GIFs directly inside chat. To use them, click the image icon (🖼️) in the chat toolbar and select the GIFs tab.',

  tourStep16Title: '🏷️ Note Categories',
  tourStep16Desc: 'Manage your custom categories to classify and filter your personal notes.',

  tourStep17Title: '🗂️ Menu Tabs Configuration',
  tourStep17Desc: 'Show/hide menu tabs or promote nested sub-tabs directly to the main navigation bar.',

  tourStep18Title: '↕️ Tab Order Customization',
  tourStep18Desc: 'Reorder active tabs on the navigation bar by clicking the up and down arrow buttons to move tabs left or right.',

  tourStep19Title: '🎨 Theme & UI Customization',
  tourStep19Desc: 'Change accent colors, header and navigation backgrounds, text color, and layout density (Compact vs Spacious).',

  tourStep20Title: '☁️ Cloud Sync',
  tourStep20Desc: 'Backup or restore your tasks and notes via Google account to keep data in sync across computers.',

  tourStep21Title: '🧹 Cleanup & Space',
  tourStep21Desc: 'Optimize extension storage and configure auto-cleanup settings for completed tasks.',

  tourStep22Title: '✅ You\'re all set!',
  tourStep22Desc: 'That covers everything! Click <strong>Get Started</strong> to dive in. Replay this tour anytime via the <strong>?</strong> button in the header.',

  tourReplayBtn: '▶ Replay Tour',
  tourOpenDocsBtn: '📖 Open Docs',

  tourKeyboardHint: '⌨️ Use Arrow keys (← / →) to navigate',

  filterAll: 'All',
  filterTasks: 'Tasks',
  filterGroupReminders: 'Schedule Send',
  mentionAllDesc: 'Notify everyone in this channel',
  mentionHereDesc: 'Notify active members in this channel',
};

// Vietnamese Dictionary
const vi = {
  // Common
  loading: 'Đang tải...',
  loadingMore: 'Đang tải thêm...',
  loadMoreBtn: 'Tải thêm',
  searching: 'Đang tìm kiếm...',
  errorLoading: 'Lỗi khi tải dữ liệu',
  noResults: 'Không tìm thấy kết quả',
  noResultsFriendly: 'Không tìm thấy kết quả phù hợp. Vui lòng kiểm tra không gian làm việc hoặc bộ lọc tìm kiếm.',
  viewMessage: 'Xem tin nhắn',
  openInChatOps: 'Mở trong ChatOps',
  unknown: 'Không xác định',
  channel: 'kênh',
  in: 'trong',
  copied: 'Đã sao chép!',
  cancel: 'Hủy',
  save: 'Lưu',
  expandCollapseBtn: 'Mở rộng/Thu gọn',
  modalSearchTitle: 'Tìm kiếm tin nhắn',
  headerSearchTooltip: 'Tìm kiếm tin nhắn nâng cao',
  headerMentionsTooltip: 'Tìm tin nhắn bị bỏ lỡ',
  headerKanbanTooltip: 'Mở Kanban Board (Ctrl+Shift+K)',
  quickTaskTooltip: 'Tạo công việc (🎯)',
  modalAddTaskTitle: 'Thêm công việc mới',
  modalAddNoteTitle: 'Thêm ghi chú mới',
  modalScannerFiltersTitle: 'Bộ lọc quét tin nhắn',
  stopSearch: 'Dừng tìm kiếm',
  stopScanning: 'Dừng quét',
  confirmClearPendingTasks: 'Xóa toàn bộ công việc chưa hoàn thành? Hành động này không thể hoàn tác.',
  confirmClearCompletedTasks: 'Xóa toàn bộ công việc đã hoàn thành? Hành động này không thể hoàn tác.',
  confirmClearCategoryNotes: 'Xóa toàn bộ ghi chú trong danh mục "{category}"? Hành động này không thể hoàn tác.',
  atLeastOneCategoryRequired: 'Phải luôn tồn tại ít nhất một danh mục!',

  // Sidepanel Search Tab
  search: 'Tìm kiếm',
  searchEmptyState: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">Hướng dẫn sử dụng</h4><p class="card-desc">Nhấp vào biểu tượng tìm kiếm (🔍) để tùy chỉnh bộ lọc và tìm kiếm tin nhắn!</p></div></div>',
  searchChannelPlaceholder: 'Tìm kiếm kênh...',
  searchPerformanceNotice: 'Chọn kênh cụ thể để tối ưu hiệu suất quét.',
  searchCriteriaRequired: 'Vui lòng nhập ít nhất 1 tiêu chí tìm kiếm',
  searchHelpTooltip: 'Tìm kiếm tin nhắn theo từ khóa, người gửi, kênh và khoảng thời gian.',
  searchKeywordHelper: 'Từ khóa phải có từ 2 ký tự trở lên.',
  searchIncludeDM: 'Bao gồm cả Tin nhắn trực tiếp (DM với User)',
  searchIsOr: 'Tìm kiếm OR (Khớp bất kỳ từ khóa nào)',
  resultsFor: 'Kết quả cho',
  today: 'Hôm nay',
  last7Days: '7 ngày qua',
  last30Days: '30 ngày qua',
  clearResults: 'Xóa kết quả',
  reactAllBtn: 'React tất cả',
  allWorkspacesOption: 'Tất cả',
  workspacePerformanceWarning: '⚠️ Tìm kiếm trên tất cả không gian làm việc có thể ảnh hưởng đến hiệu suất.',
  mentionsPerformanceWarning: '⚠️ Quét tin nhắn trên tất cả không gian làm việc có thể ảnh hưởng đến hiệu suất.',

  // Sidepanel Mentions Tab
  scanMentions: 'Quét ngay',
  scanMentionsStart: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">Hướng dẫn sử dụng</h4><p class="card-desc">Nhấp vào biểu tượng (🔔) để cấu hình bộ lọc và quét. Hệ thống sẽ quét các bài viết bạn được nhắc đến nhưng chưa phản hồi hoặc phản ứng.</p></div></div>',
  scanningChannels: 'Đang quét các kênh...',
  scanTimeNotice: 'Quá trình này có thể mất nhiều thời gian. Bạn có thể khám phá các tính năng khác rồi quay lại xem kết quả sau.',
  scanTimeNoticeModal: 'Quá trình này có thể mất nhiều thời gian. Vui lòng giữ modal này mở cho đến khi quét xong để xem kết quả.',
  noMissedMentions: 'Không có tin nhắn bị bỏ lỡ trong {hours}h qua!',
  mentionsFound: 'Phát hiện {count} tin nhắn bỏ lỡ đang chờ xử lý trong {channels} kênh',
  notConnected: 'Chưa kết nối. Vui lòng kiểm tra <a href="#" class="settings-subtab-link" data-subtab="features-toggle" style="color: var(--accent); font-weight: 700; text-decoration: underline;">Cài đặt</a>.',

  // Sidepanel Leave Tab
  leaveEmptyState: 'Nhập thông tin và nhấn Tìm kiếm',
  selectChannelRequired: 'Vui lòng chọn ít nhất 1 kênh (ví dụ: CHECK.OFF.LATER)',
  userNotFound: 'Không tìm thấy người dùng với email: {email}',
  invalidDate: 'Định dạng ngày không hợp lệ',
  noLeaveRequests: 'Không tìm thấy yêu cầu nghỉ phép nào',
  foundMessages: 'Tìm thấy {count} tin nhắn',

  // Sidepanel Tasks Tab
  taskTabLabel: 'Công việc',
  taskEmpty: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">Hướng dẫn sử dụng</h4><p class="card-desc">Nhấp vào nút thêm <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 15px; height: 15px; border-radius: 50%; font-size: 10px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> để thêm công việc, hoặc di chuột qua bất kỳ tin nhắn nào trong ChatOps và nhấp vào biểu tượng 🎯 để ghim công việc!</p></div></div>',
  taskClickHint: '📌 Ghim tin nhắn trong ChatOps hoặc nhấp vào nút thêm <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span>.',
  taskPending: 'Chờ xử lý',
  taskCompleted: 'Đã hoàn thành',
  taskClearAll: 'Xóa tất cả',
  taskPlaceholder: 'Nhập tên công việc...',
  taskMarkIncomplete: 'Đánh dấu chưa hoàn thành',
  taskMarkDone: 'Đánh dấu đã hoàn thành',
  taskMarkDoneShort: 'Hoàn thành',
  taskNoContent: '(Không có nội dung)',
  taskDefaultTitle: 'Công việc',
  taskOverdue: 'Quá hạn',
  taskDelete: 'Xóa',
  taskViewOriginal: 'Xem tin nhắn gốc',
  taskReminderLabel: 'Nhắc:',
  taskReminderHint: '⏰ Bắt đầu lúc thời gian đã chọn — nhắc lại mỗi {minutes} phút cho đến khi hoàn thành (<a href="#" class="settings-subtab-link" data-subtab="features-snooze" style="color: var(--accent); font-weight: 700; text-decoration: underline;">thay đổi trong Cài đặt</a>)',
  taskAddBtn: 'Thêm công việc',
  taskEmptyError: 'Nội dung công việc không được để trống.',
  taskReminderRequired: '⏰ Vui lòng chọn thời gian nhắc nhở ("Nhắc" hoặc "Nhắc sau") trước khi lưu công việc.',
  pastDateError: '⏰ Thời gian nhắc nhở không được ở quá khứ.',
  noCompletedTasks: 'Chưa có công việc hoàn thành nào.',
  changeReminderTime: 'Thay đổi thời gian nhắc nhở',
  editTask: 'Sửa công việc',

  // Sidepanel Memo (Notes) Tab
  memoTasksEmpty: 'Chưa có công việc nào.',
  memoNotesEmpty: '<div class="sp-how-to-use-card"><div class="card-icon">💡</div><div><h4 class="card-title">Hướng dẫn sử dụng</h4><p class="card-desc">Nhấp vào nút thêm <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 15px; height: 15px; border-radius: 50%; font-size: 10px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span> để thêm ghi chú, hoặc di chuột qua bất kỳ tin nhắn nào trong ChatOps và nhấp vào biểu tượng 📒 để ghim ghi chú!</p></div></div>',
  memoClickHint: '📒 Ghim ghi chú trong ChatOps hoặc nhấp vào nút thêm <span style="display: inline-flex; align-items: center; justify-content: center; background: var(--accent); color: #fff; width: 14px; height: 14px; border-radius: 50%; font-size: 9px; font-weight: bold; line-height: 1; margin: 0 2px; vertical-align: middle; position: relative; top: -1px; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">+</span>.',
  memoPending: 'Chờ xử lý',
  memoCompleted: 'Đã hoàn thành',
  memoClearAll: 'Xóa tất cả',
  memoTaskPlaceholder: 'Nhập tên công việc...',
  memoNotePlaceholder: 'Nhập ghi chú... (Shift+Enter để lưu)',
  memoMarkIncomplete: 'Đánh dấu chưa hoàn thành',
  memoMarkDone: 'Đánh dấu đã hoàn thành',
  memoNoContent: '(Không có nội dung)',
  memoEmptyNote: 'Ghi chú trống',
  memoOverdue: 'Quá hạn',
  memoDelete: 'Xóa',
  memoViewOriginal: 'Xem tin nhắn gốc',
  memoCopyNote: 'Sao chép nội dung',
  memoEmptyNoteError: 'Nội dung ghi chú không được để trống.',
  editNote: 'Sửa ghi chú',
  deletePostTooltip: 'Xóa tin nhắn (ChatOps)',
  confirmDeletePost: '⚠️ Bạn có chắc chắn muốn xóa tin nhắn này không?',

  // Workspace Selector
  noWorkspaces: 'Không tìm thấy không gian làm việc nào',

  // Content Script - Reminder Banner
  reminderTaskTitle: 'Công việc chưa hoàn thành',
  reminderTitle: 'Nhắc nhở ChatOps',
  reminderDoneBtn: '✅ Đã xong — Dừng nhắc nhở',
  reminderSkipBtn: '⏭️ Bỏ qua hôm nay',
  gifNotSupported: 'GIF (Không hỗ trợ resize & edit)',
  reminderTaskCompleted: '✅ Đã hoàn thành!',
  missedRemindersTitle: 'Nhắc nhở bị bỏ lỡ',
  missedRemindersDigest: 'Bạn đã bỏ lỡ {count} nhắc nhở công việc khi không hoạt động.',
  missedRemindersView: 'Xem các công việc bị lỡ',
  missedAt: 'Lỡ lúc',
  
  // Content Script - Floating Button
  floatingBtnTitle: 'Mở ChatOps++',
  floatingBtnHide: 'Ẩn nút này',
  extensionUpdated: 'ChatOps++ đã được cập nhật! Vui lòng tải lại trang (F5) để tiếp tục.',

  // Content Script - Image Picker
  imageLibrary: 'Hình ảnh',
  imageLibrarySettingsTitle: 'Cài đặt hình ảnh',
  noCustomImages: 'Chưa có ảnh tải lên',
  clickToSend: 'Nhấp để gửi',
  deleteImage: 'Xóa ảnh',
  yourImages: 'Ảnh của bạn',
  uploadImageBtn: '+ Tải ảnh lên',
  drawBtn: 'Tự vẽ',
  noImagesHint: 'Chưa có ảnh nào. Nhấp "Tải ảnh lên" để thêm!',
  maxUploadLimitError: 'Bạn chỉ có thể tải lên tối đa 5 ảnh cùng lúc.',
  uploadOnlyImages: 'Vui lòng chỉ chọn các tệp hình ảnh.',
  storageLimitExceeded: 'Đạt giới hạn dung lượng lưu trữ (10 MB). Vui lòng xóa bớt ảnh trước khi tải lên.',
  imageLibraryEmptyState: '<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; min-height: 200px; padding: 24px 0; text-align: center; color: var(--text-3); font-size: 13px; font-weight: 500; grid-column: 1 / -1;"><p style="margin: 0; line-height: 1.5; max-width: 240px;">Chưa có ảnh tải lên. Nhấp vào nút tải ảnh phía trên để bắt đầu!</p></div>',

  // Content Script - Quick Task Popover
  quickTaskCreate: 'Tạo nhanh công việc',
  quickTaskTitle: 'Tạo nhanh công việc',
  quickTaskNotePlaceholder: 'Thêm ghi chú (tùy chọn)...',
  quickTaskRemindAt: 'Nhắc nhở lúc:',
  quickTaskHint: '⏰ Bắt đầu lúc thời gian đã chọn — nhắc lại mỗi {minutes} phút cho đến khi hoàn thành (<a href="#" class="settings-subtab-link" data-subtab="features-snooze" style="color: var(--accent); font-weight: 700; text-decoration: underline;">thay đổi trong Cài đặt</a>)',
  quickTaskSave: 'Lưu',
  quickTaskCancel: 'Hủy',
  quickTaskSaveSuccess: 'Đã lưu công việc',
  quickNoteTitle: 'Tạo nhanh ghi chú',
  quickNoteCreate: 'Tạo nhanh ghi chú',
  quickNoteSaveSuccess: 'Đã lưu ghi chú',
  reminderTaskDefault: 'Bạn có một công việc đang chờ xử lý.',
  directMessage: 'Tin nhắn Trực tiếp',
  includeDirectMessage: 'Bao gồm Tin nhắn Trực tiếp',
  categoryLabel: 'Danh mục:',
  orLabel: 'HOẶC',
  quickTaskRemindAfter: 'Nhắc nhở sau:',
  msgPreviewImage: '[Hình ảnh] Vui lòng xem trực tiếp trên ChatOps',
  imagePlaceholder: 'Hình ảnh',
  msgPreviewNoText: '[Không có nội dung văn bản]',

  // Content Script - Reaction spam/retraction
  spamReactionsTitle: 'Spam cảm xúc',
  spamSuccess: 'Thêm spam cảm xúc thành công! 🔥',
  spamErrorPrefix: 'Lỗi spam cảm xúc: ',
  undoSpamTitle: 'Hoàn tác spam cảm xúc',
  undoSpamSuccess: 'Xóa spam cảm xúc thành công! ↩️',
  undoSpamErrorPrefix: 'Lỗi hoàn tác cảm xúc: ',
  reactionAlreadyExists: 'Bạn đã tương tác/spam bài viết này rồi!',
  reactionNotFound: 'Không có cảm xúc nào để hoàn tác!',
  reactAlongTitle: 'Clone reaction',
  reactAlongSuccess: 'Sao chép các biểu tượng cảm xúc thành công! 🎭',
  reactAlongErrorPrefix: 'Lỗi sao chép reaction: ',
  reactAlongTooltip: 'Clone reaction',
  reactAlongEnabled: 'Nút clone reaction (🎭)',
  submitSaveBtn: 'Gửi & Lưu',
  sendOnlyBtn: 'Gửi',
  saveCopy: 'Lưu thư viện',
  reactionGroupsTitle: 'Nhóm Reactions',
  groupNameLengthError: 'Tên nhóm không được vượt quá 10 ký tự!',
  renameGroupBtn: 'Đổi tên',
  groupNamePlaceholder: 'Tên nhóm...',

  // Categories
  categoryAll: 'Tất cả',
  categoryGeneral: 'Chung',
  categoryWork: 'Công việc',
  categoryPersonal: 'Cá nhân',
  categoryIdeas: 'Ý tưởng',
  categorySelect: 'Chọn danh mục...',

  // Settings Tab & Sync
  backupToCloud: 'Sao lưu lên Đám mây',
  backingUp: 'Đang sao lưu...',
  restoring: 'Đang khôi phục...',
  restoreFromCloud: 'Khôi phục từ Đám mây',
  cleaningUp: 'Đang dọn dẹp...',
  cleanUpNow: 'Dọn dẹp ngay',
  confirmRestore: '⚠️ Bạn có chắc chắn muốn khôi phục dữ liệu từ Đám mây?\nToàn bộ ghi chú và công việc hiện tại trên máy này sẽ bị GHI ĐÈ hoàn toàn bởi dữ liệu từ tài khoản Google của bạn.',
  confirmCleanup: '🧹 Bạn có chắc chắn muốn dọn dẹp các công việc đã hoàn thành cũ hơn thời gian đã đặt?',
  testBannerSuccess: '🟢 Đã gửi thông báo thử nghiệm!',
  testSystemSuccess: '🟢 Đã gửi thông báo thử nghiệm!',
  testBothSuccess: '🟢 Đã gửi thông báo thử nghiệm!',
  testErrorPrefix: '🔴 Lỗi thông báo chạy ngầm: ',
  testBgWorkerError: '🔴 Không thể kết nối với Background Service Worker. Vui lòng tải lại tiện ích mở rộng tại chrome://extensions.',
  testInPageBannerMsg: '🔔 Đây là thông báo thử nghiệm từ ChatOps++!',
  testSystemTitle: '🎯 Thông báo thử nghiệm ChatOps++',
  testSystemMsg: 'Hệ thống thông báo đẩy trên hệ điều hành đang hoạt động hoàn hảo!',
  backupSuccess: '🎉 Đã sao lưu dữ liệu lên tài khoản Google của bạn thành công!',
  backupFailed: '❌ Sao lưu thất bại. Vui lòng thử lại.',
  restoreSuccess: '🎉 Đã khôi phục dữ liệu từ tài khoản Google của bạn thành công!',
  restoreFailed: '❌ Khôi phục thất bại. Vui lòng thử lại.',
  cleanupSuccess: '🎉 Dọn dẹp hoàn tất thành công! Đã xóa {count} mục cũ khỏi bộ nhớ cục bộ.',
  cleanupFailed: '❌ Dọn dẹp thất bại. Vui lòng thử lại.',
  autoSaved: 'Đã tự động lưu',
  lastSyncText: '☁️ Đồng bộ gần nhất: <strong style="color:var(--success); font-weight:700;">{time}</strong>',
  neverSyncedText: '⏳ Chưa từng sao lưu hoặc khôi phục trên thiết bị này.',
  storageUsageText: '💻 Máy cục bộ: <strong style="color:var(--accent);">{local}</strong> | ☁️ Đám mây: <strong style="color:var(--success);">{sync}</strong> / 100KB',

  // HTML Static Texts
  supportVibecodingTitle: '☕ Hỗ trợ phát triển!',
  supportVibecodingDesc: 'Nếu tiện ích này hữu ích với bạn, hãy mời nhà phát triển một tách cà phê để tiếp thêm động lực cho những dự án mới nhé 🚀',
  rateExtensionTooltip: 'Đánh giá 5 sao trên Chrome Web Store ⭐',
  supportRateTitle: 'Đánh giá & Phản hồi',
  supportRateDesc: 'Đánh giá 5 sao để ủng hộ tiện ích',
  rateAppDescription: 'Nếu tiện ích này hữu ích với bạn, hãy dành chút thời gian đánh giá 5 sao trên Chrome Web Store để ủng hộ nhà phát triển nhé! ⭐',
  rateAppButton: 'Đánh giá 5 sao ngay',
  supportContactDesc: 'Mọi ý kiến đóng góp hoặc báo cáo lỗi xin vui lòng liên hệ: <a href="mailto:dinhhan09091998@gmail.com" style="color:var(--accent); text-decoration:underline;">dinhhan09091998@gmail.com</a>',
  tabOrderTitle: 'Thứ tự hiển thị các Tab',
  tabOrderDesc: 'Tùy chỉnh sắp xếp vị trí các Tab',
  tabOrderGuide: 'Sử dụng các nút mũi tên để thay đổi thứ tự sắp xếp của các Tab trên thanh điều hướng.',
  categoryNameLengthError: 'Tên danh mục không được vượt quá 10 ký tự!',
  categoryAlreadyExists: 'Danh mục này đã tồn tại!',
  maxCategoriesLimit: 'Chỉ cho phép tối đa 5 danh mục!',
  categoryNameEmptyError: 'Tên danh mục không được để trống!',
  categoryContainsNotesError: 'Danh mục "{category}" đang chứa ghi chú và không thể xóa!',
  noReactionsToClone: 'Không có cảm xúc nào trên bài viết để sao chép!',
  alreadyClonedAllReactions: 'Bạn đã sao chép toàn bộ cảm xúc trên bài viết này rồi!',
  toastSentAndSavedNext: 'Đã gửi & lưu ảnh! Đang chuyển sang ảnh tiếp theo...',
  toastSentAndSavedAll: 'Đã gửi & lưu toàn bộ ảnh thành công! 🎉',
  toastSentOnlyNext: 'Đã gửi ảnh! Đang chuyển sang ảnh tiếp theo...',
  toastSentAll: 'Đã gửi toàn bộ ảnh thành công! 🎉',
  webpConvertingToast: 'Đang chuyển đổi ảnh cho ChatOps... Vui lòng chờ.',
  webpConvertedToGif: 'Ảnh động đã được chuyển thành GIF ✅',
  webpConvertedToPng: 'Ảnh đã được chuyển thành PNG ✅',
  toastSavedToLibraryNext: 'Đã lưu ảnh vào thư viện! Đang chuyển sang ảnh tiếp theo...',
  toastSavedToLibraryAll: 'Đã lưu toàn bộ ảnh vào thư viện! 🎉',
  memoNotesLabel: 'Ghi chú',
  toolsTabLabel: 'Công cụ khác',
  toolsSearchSubTab: 'Tìm kiếm',
  toolsMentionsSubTab: 'Tin nhắn bỏ lỡ',
  toolsImagesSubTab: 'Hình ảnh',
  toolsReactionsSubTab: 'Spam Cảm xúc',
  showToolsToggle: 'Công cụ (Tìm kiếm, Hình ảnh, Cảm xúc)',
  showReactions: 'Spam Cảm xúc',
  settingsAlwaysVisible: 'Cài đặt (luôn hiển thị)',
  alwaysOnBadge: 'Luôn bật',
  settingsTabLabel: 'Cài đặt',
  searchTermsPlaceholder: 'Từ khóa tìm kiếm... (Ấn Enter để tìm)',
  searchUserPlaceholder: 'Tìm kiếm người dùng...',
  searchAfterPlaceholder: 'Sau ngày',
  searchBeforePlaceholder: 'Trước ngày',
  searchNewBtn: 'Tìm kiếm mới',
  syncTooltip: 'Nhấp để sao lưu hoặc khôi phục dữ liệu qua tài khoản Google',
  syncText: 'Đồng bộ',

  clearAllTasks: '🗑️ Xóa tất cả',
  clearAllNotes: '🗑️ Xóa tất cả',
  confirmClearAllTasks: 'Xóa TẤT CẢ công việc? Hành động này không thể hoàn tác.',
  confirmClearAllNotes: 'Xóa TẤT CẢ ghi chú? Hành động này không thể hoàn tác.',
  langToggleTooltip: 'Chuyển sang Tiếng Anh 🇺🇸',
  titleOptional: 'Tiêu đề (tùy chọn)',
  chooseDatePlaceholder: 'Chọn...',
  taskTextareaPlaceholder: 'Thêm công việc mới... (Shift + Enter để lưu)',
  remindInPreset: 'Nhắc sau...',
  noteTextareaPlaceholder: 'Viết ghi chú... (Shift + Enter để lưu)',
  categoryLabelPrefix: 'Danh mục:',
  customizeCategories: '➕ Tùy chỉnh',
  memoAddBtn: 'Thêm ghi chú',
  last24Hours: '24 giờ qua',
  last48Hours: '48 giờ qua',
  last72Hours: '72 giờ qua',
  last14Days: '14 ngày qua',
  mentionDirect: 'Nhắc tên trực tiếp (@bạn)',
  mentionHere: 'Nhắc tên nhóm (@here)',
  mentionChannel: 'Nhắc tên kênh (@channel / @all)',
  mentionDMs: 'Tin nhắn trực tiếp (DM / GM)',
  mentionOnlyUnread: 'Chỉ hiển thị tin nhắn chưa tương tác (reaction/reply)',
  imageLibraryTab: 'Ảnh của tôi',
  resizeImage: 'Thay đổi kích thước',
  resizeImageTitle: 'Thay đổi kích thước ảnh',
  resizeScaleLabel: 'Tỷ lệ scale',
  saveCopy: 'Lưu',
  saved: 'Đã lưu!',
  insertToChat: 'Chèn vào khung chat',
  editImageBtn: '✏️ Sửa ảnh',
  editImageTitle: 'Chỉnh sửa ảnh',
  drawTitle: 'Tự vẽ',
  drawToolBrush: 'Cọ vẽ',
  drawToolRect: 'Hình hộp',
  drawToolCircle: 'Hình tròn',
  drawToolTriangle: 'Hình tam giác',
  drawToolLine: 'Đường thẳng',
  drawToolArrow: 'Mũi tên',
  drawToolText: 'Văn bản',
  drawToolEraser: 'Tẩy',
  drawToolShapes: 'Hình dạng',
  customColorTitle: 'Chọn màu',
  drawColorLabel: 'Màu:',
  drawSizeLabel: 'Cỡ:',
  drawUndoBtn: 'Hoàn tác',
  drawResetBtn: 'Xóa hết',
  drawApplyBtn: 'Áp dụng',
  editorUploadBg: 'Upload ảnh nền',
  editorUploadBgBtn: '📁 Upload ảnh',
  noImageInClipboard: 'Không tìm thấy ảnh trong clipboard.',
  clipboardPermissionDenied: 'Quyền truy cập clipboard bị từ chối. Vui lòng dùng Ctrl+V để dán.',
  autoSendLabel: 'Gửi trực tiếp',
  drawUploadBtn: 'Vẽ từ ảnh',
  gifLibraryTab: 'GIFs',
  reactionSpammerTab: 'Spam Cảm xúc',
  giphyGifSearch: 'GIFs từ Giphy',
  searchGifPlaceholder: 'Tìm kiếm ảnh GIF...',
  gifDefaultHint: '💡 Đây là các ảnh GIFs nổi bật mặc định. Nhập từ khóa để tìm thêm nhiều ảnh khác!',
  imageLibraryDesc: 'Nhấp vào biểu tượng ảnh (🖼️) trong thanh công cụ chatbox để mở thư viện.',
  usedStorageSpace: 'Dung lượng đã sử dụng',
  howToUseTitle: 'Hướng dẫn sử dụng',
  reactionSpammerDesc: 'Di chuột qua bất kỳ tin nhắn nào trên ChatOps, sau đó nhấp vào <strong>nút Ngọn lửa (🔥)</strong> trong thanh công cụ để spam ngay lập tức các biểu tượng cảm xúc đã chọn, hoặc nhấp vào <strong>nút Hoàn tác (↩️)</strong> để thu hồi!',
  selectedEmojisTitle: 'Cảm xúc đã chọn',
  selectedEmojisDesc: 'Nhấp vào một biểu tượng cảm xúc bên dưới để xóa khỏi danh sách spam nhanh.',
  addEmojisTitle: 'Thêm cảm xúc',
  addEmojisDesc: 'Nhấp vào một biểu tượng cảm xúc bên dưới để thêm vào danh sách spam nhanh.',
  emojiTabStandard: 'TIÊU CHUẨN',
  emojiTabCustom: 'WORKSPACE',
  searchEmojiPlaceholder: 'Tìm kiếm emoji theo tên (ví dụ: fire, heart)...',
  loadingMoreEmojis: 'Đang tải thêm emoji...',
  settingsSubFeaturesTab: 'Chức năng',
  settingsSubUITab: 'Giao diện',
  settingsSubDataTab: 'Dữ liệu',
  settingsOverviewWelcome: 'Chào mừng bạn đến với <strong style="color: var(--accent); font-weight: 700;">ChatOps++</strong>! Bộ công cụ tăng năng suất của bạn:',
  overviewSearchDesc: '<strong>Tìm kiếm tin nhắn:</strong> Truy vấn lịch sử trò chuyện tức thì.',
  overviewTasksDesc: '<strong>Công việc:</strong> Quản lý công việc thông minh với thông báo nhắc lại.',
  overviewNotesDesc: '<strong>Ghi chú:</strong> Ghi chú nhanh theo phân loại danh mục và hỗ trợ click để sao chép nhanh từng dòng.',
  overviewMissedDesc: '<strong>Tin nhắn bỏ lỡ:</strong> Theo dõi các tin nhắn kênh bị bỏ qua.',
  overviewSpamDesc: '<strong>Spam cảm xúc:</strong> Bày tỏ nhiều cảm xúc cùng lúc tức thì và thu hồi dễ dàng.',
  overviewImageDesc: '<strong>Hình ảnh:</strong> Tải lên và gửi nhanh các hình ảnh cá nhân yêu thích của bạn.',
  overviewQuickDeleteDesc: '<strong>Xóa nhanh tin nhắn:</strong> Xóa ngay lập tức các tin nhắn của chính bạn trên khung chat.',
  overviewPrivacyTitle: 'Cam kết Bảo mật & Riêng tư',
  overviewPrivacyDesc: '<strong>ChatOps++</strong> không thu thập, lưu trữ hoặc truyền tải dữ liệu cá nhân của bạn. Tất cả dữ liệu được lưu trữ 100% cục bộ trong trình duyệt của bạn (Local Storage) dưới toàn quyền kiểm soát của bạn.',
  overviewSupportTitle: 'Hỗ trợ & Góp ý',
  overviewSupportDesc: 'Đối với bất kỳ câu hỏi, đề xuất hoặc báo cáo lỗi nào, vui lòng liên hệ <a href="https://chat.runsystem.vn/runsystem/messages/@hannd-runsystem.net" class="support-chatops-link" style="color: #3498db; font-weight: 700; text-decoration: underline;">hannd@runsystem.net</a> qua ChatOps.',
  featureSettingsTitle: 'Cấu hình Tính năng',
  featuresToggleTab: '⚙️ Bật/ tắt',
  featuresSnoozeTab: '⏳ Nhắc lại',
  featuresAlertsTab: '🔔 Cảnh báo',
  featuresGifTab: '🎬 GIFs',
  snoozeAlertDesc: 'Thời gian nhắc lại, phương thức & âm thanh cảnh báo',
  giphyApiDesc: 'Cấu hình API Key & giới hạn lượt gọi',
  manageCategoriesDesc: 'Quản lý các danh mục ghi chú tự chọn',
  giphyApiKeyTitle: 'Giphy API Key',
  giphyApiKeyDesc: 'Nhập API Key Giphy của bạn để tìm kiếm và dùng GIF.',
  giphyNoApiKey: 'Chưa cấu hình Giphy API Key.',
  giphySetupLink: 'Thiết lập tại Cài Đặt → GIFs',
  giphyRateLimitWarning: '',
  giphyApiKeyPlaceholder: 'Nhập API Key Giphy của bạn tại đây...',
  giphyGuideTitle: '🔑 Cách lấy Giphy API Key miễn phí',
  giphyGuideStep1: 'Truy cập <a href="https://developers.giphy.com/dashboard" target="_blank" style="color:var(--accent); text-decoration:none; font-weight:600;">developers.giphy.com/dashboard</a>',
  giphyGuideStep2: 'Nhấn <strong>Create an API key</strong> → chọn <strong>API (not SDK)</strong>',
  giphyGuideStep3: 'Đặt tên app bất kỳ → nhấn <strong>Next Step</strong>',
  giphyGuideStep4: 'Copy <strong>API Key</strong> được cấp → paste vào ô trên',
  giphyGuideNote: '💡 <strong>Gói miễn phí</strong> hỗ trợ 100 request/giờ.',
  giphyCheckingKey: 'Đang kiểm tra API Key...',
  giphyValidKey: 'Giphy API Key hợp lệ!',
  giphyInvalidKey: 'Giphy API Key không hợp lệ hoặc hết hạn.',
  giphyConnectionError: 'Lỗi kết nối: Không thể xác thực Giphy API Key.',
  giphyLoadError: 'Không tải được GIF.',
  giphyHttpError: 'HTTP {status} — kiểm tra API Key hoặc thử lại sau (giới hạn 100 req/h).',
  giphyNotFound: 'Không tìm thấy GIF nào.',
  giphySizeTitle: 'Kích thước GIF khi gửi',
  giphySizeDesc: 'Chọn kích thước hình ảnh GIF khi chèn vào khung chat.',
  giphySize200: 'Lớn (200px - Mặc định)',
  giphySize100: 'Nhỏ (100px)',
  featuresToggleTitle: 'Bật/Tắt Tính năng',
  featuresToggleDesc: 'Chọn mô-đun nào bạn muốn hiển thị trên thanh bên.',
  menuTabsTitle: 'Hiển thị Tab trong Menu',
  menuTabsDesc: 'Chọn các tab bạn muốn hiển thị trên thanh bên Sidepanel.',
  promoteToMainTab: 'Đưa ra thanh menu chính',
  otherToolsDisabledNotice: 'Tab Công cụ khác đang TẮT',
  floatingButtonsTitle: 'Nút tương tác nhanh trên ChatOps',
  floatingButtonsDesc: 'Nút tương tác nhanh & vị trí hiển thị',
  floatingQuickTask: 'Nút tạo công việc nhanh (🎯)',
  floatingQuickNote: 'Nút tạo ghi chú nhanh (📒)',
  floatingSpamReactions: 'Nút spam & revert reaction (🔥/↩️ )',
  floatingImagePicker: 'Nút gửi ảnh trong khung chat (🖼️)',
  floatingQuickReply: 'Nút phản hồi nhanh (@) (💬)',
  floatingQuickCopy: 'Nút sao chép nhanh tin nhắn (📋)',
  floatingTemplatePicker: 'Nút chèn mẫu ghi chú nhanh (📒)',
  templatePickerTitle: 'Mẫu ghi chú',
  searchTemplatePlaceholder: 'Tìm theo tiêu đề, nội dung, danh mục...',
  searchTasksPlaceholder: 'Tìm kiếm công việc...',
  permalinkJumpTip: 'Mẹo: Để nhảy chính xác đến tin nhắn, hãy đảm bảo kênh/group chat đó đã được chuyển sang chế độ Xem mặc định (Default View).',
  noTemplatesHint: 'Không tìm thấy mẫu nào. Hãy thêm ghi chú trong Side Panel để sử dụng!',
  quickTemplateTooltip: 'Chèn mẫu ghi chú (📒)',
  floatingGroupReminder: 'Nút nhắc nhở nhóm (📢)',
  quickGroupReminderTooltip: 'Lên lịch gửi tin vào kênh này (📢)',
  floatingQuickMeet: 'Nút tạo nhanh Google Meet (📹)',
  quickMeetTooltip: 'Tạo phòng họp Google Meet',
  meetRoomCreatedToast: 'Đã tạo và chèn link Google Meet!',
  modalAddGroupReminderTitle: 'LÊN LỊCH GỬI TIN VÀO KÊNH NÀY',
  groupReminderTextareaPlaceholder: 'Nhập nội dung... (gõ @ để tag người)',
  groupReminderSectionTitle: 'Lên lịch gửi tin vào kênh',
  groupReminderLabel: 'Lên lịch gửi tin',
  groupRemindersTabLabel: 'Lên lịch gửi tin',
  quickGroupReminderSaveSuccess: 'Đã lên lịch gửi tin nhắn thành công!',
  targetChannelInfo: 'Tin nhắn sẽ được gửi vào kênh: {channel}',
  autoMessagePrefix: '##### --- Đây là tin nhắn tự động --- #####',
  scheduleSendLabel: 'Gửi lúc:',
  groupReminderSentToast: 'Đã tự động gửi tin nhắn đến kênh: {channel}',
  noScheduledReminders: 'Không có lịch gửi tin nào đang chờ',
  noCompletedReminders: 'Chưa có lịch gửi tin nào hoàn thành',
  reminderConfirmClear: 'Bạn có chắc chắn muốn xoá tất cả lịch gửi tin đã hoàn thành?',


  quickReplyBtnTooltip: 'Phản hồi nhanh (@)',
  quickCopyBtnTooltip: 'Sao chép nhanh tin nhắn',
  copiedToClipboard: 'Đã sao chép tin nhắn vào clipboard!',
  usernameNotFoundError: 'Không tìm thấy tên người dùng để tag!',
  additionalSettingsTitle: 'Tùy chọn bổ sung',
  snoozeTitle: 'Thời gian nhắc lại mặc định',
  snoozeDesc: 'Thời gian nhắc lại mặc định (phút) cho các nhắc nhở công việc mới.',
  minutesLabel: 'phút',
  staleThresholdTitle: 'Ngưỡng bỏ qua thông báo trễ',
  staleThresholdDesc: 'Nếu thông báo công việc bị trễ quá số phút này (ví dụ: do Chrome đã tắt), thông báo sẽ bị bỏ qua và tự động lên lịch lại — không hiện thông báo lỗi thời.',
  staleThresholdLabel: 'Bỏ qua nếu trễ hơn',
  alertsTitle: 'Phương thức nhận cảnh báo',
  alertsDesc: 'Chọn cách bạn muốn được thông báo khi nhắc nhở công việc được kích hoạt.',
  alertsOptionBoth: '🔔 Cả hai',
  alertsOptionSystem: '🖥️ Chỉ thông báo hệ thống (OS)',
  alertsOptionInPage: '💬 Chỉ biểu ngữ trong trang',
  testNotificationBtn: '🔔 Thử thông báo',
  alertsHelpTitle: 'ℹ️ CÁCH BẬT THÔNG BÁO HỆ THỐNG',
  alertsHelpDesc: `
    <div>
      🍏 <strong>macOS:</strong> Vào <em>Cài đặt Hệ thống</em> → <em>Thông báo</em> → <strong>Google
        Chrome</strong> → Bật <strong>Cho phép Thông báo</strong> và chọn dạng <strong>Biểu ngữ</strong>
      hoặc <strong>Cảnh báo</strong>.
    </div>
    <div>
      🪟 <strong>Windows:</strong> Vào <em>Cài đặt</em> → <em>Hệ thống</em> → <em>Thông báo</em> →
        Đảm bảo thông báo chung đang BẬT và cho phép <strong>Google Chrome</strong>.
    </div>
    <div>
      🐧 <strong>Ubuntu (Linux):</strong> Vào <em>Cài đặt</em> → <em>Thông báo</em> →
        <strong>Google Chrome</strong> → Đảm bảo thông báo đã được bật.
    </div>
    <div
      style="border-top: 1px dashed var(--border); margin-top: 6px; padding-top: 8px; font-style: italic; color: var(--accent); font-weight: 500;">
      💡 Gợi ý: Nếu thông báo không hiển thị sau khi bật, hãy khởi động lại hoàn toàn Google Chrome (Cmd+Q trên macOS, hoặc đóng tất cả cửa sổ) để OS áp dụng quyền thông báo.
    </div>
  `,
  userGuideTitle: 'Hướng dẫn Hệ thống 💡',
  userGuideHTML: `
    <div class="guide-container">

      <!-- Section 1: Core Tabs & Functions -->
      <div>
        <h4 class="guide-section-title">🚀 CÁC TÍNH NĂNG CHÍNH CỦA CHATOPS++</h4>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          
          <div class="settings-road-card main-tab-link" data-tab="tasks">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🎯</span>
              <a href="#" class="main-tab-link-anchor" data-tab="tasks">Tasks (Công việc)</a>
            </div>
            <p>Quản lý danh sách việc cần làm. Hỗ trợ tạo ghi chú văn bản hoặc các hộp kiểm Checklist tương tác. Lên lịch báo thức nhắc nhở hằng ngày đúng hẹn. Có thể đưa ra menu chính hoặc thu gọn vào tab ⚡ Công cụ khác.</p>
          </div>

          <div class="settings-road-card main-tab-link" data-tab="memo">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">📒</span>
              <a href="#" class="main-tab-link-anchor" data-tab="memo">Notes (Ghi chú)</a>
            </div>
            <p>Lưu nhanh các ý tưởng hoặc lưu tin nhắn quan trọng chỉ với 1-click. Sắp xếp, quản lý ghi chú theo nhãn thư mục tự chọn. Hỗ trợ đưa ra menu chính hoặc thu gọn vào tab ⚡ Công cụ khác.</p>
          </div>

          <div class="settings-road-card main-tab-link" data-tab="mentions">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔔</span>
              <a href="#" class="main-tab-link-anchor" data-tab="mentions">Mentions (Tin nhắn bỏ lỡ)</a>
            </div>
            <p>Theo dõi tập trung tất cả lượt nhắc tên (@mention), tin nhắn riêng (DM) hoặc thảo luận trong thread chưa đọc. Tóm tắt ý chính và thả phản hồi cực nhanh.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="tools-search">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔍</span>
              <a href="#" class="settings-subtab-link" data-subtab="tools-search">Tìm kiếm tin nhắn nâng cao</a>
            </div>
            <p>Công cụ tìm kiếm thông minh giúp lọc lịch sử chat, tìm theo keyword hoặc người gửi dễ dàng, hỗ trợ tìm kiếm dạng OR và loại bỏ DMs.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="reactions-images">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🖼️</span>
              <a href="#" class="settings-subtab-link" data-subtab="reactions-images">Thư viện hình ảnh & Meme</a>
            </div>
            <p>Quản lý kho ảnh, ảnh chế (meme) cá nhân của bạn, hỗ trợ tải lên hàng loạt và chèn nhanh trực tiếp vào khung chat. Tự động nén tối ưu dung lượng.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="reactions-picker">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 15px;">🔥</span>
              <a href="#" class="settings-subtab-link" data-subtab="reactions-picker">Spam & Revert Reactions</a>
            </div>
            <p>Bật/tắt phím tắt cảm xúc nhanh. Thiết lập các nhóm cảm xúc ưa thích để tự động spam thả hàng loạt emoji chỉ với 1-click hoặc thu hồi cảm xúc đã thả.</p>
          </div>

        </div>
      </div>
      
      <!-- Section 1.5: Interactive Settings Map -->
      <div>
        <h4 class="guide-section-title">⚙️ BẢN ĐỒ CÀI ĐẶT HỆ THỐNG</h4>
        <div class="guide-grid">
          
          <div class="settings-road-card settings-subtab-link" data-subtab="features-toggle">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-toggle">Cấu hình Menu & Sắp xếp Tab</a>
            </div>
            <p>Ẩn/hiện toàn bộ 6 tab chính, sắp xếp thứ tự hiển thị bằng các nút mũi tên ↕️, chọn đưa ra menu chính hoặc thu gọn gọn gàng vào ⚡ Công cụ khác.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-floating">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-floating">Nút tương tác nhanh (Floating)</a>
            </div>
            <p>Bật/tắt các nút tương tác nhanh trên khung chat (Tạo Task 🎯, Lưu Note 📒, Spam Reactions 🔥, Bắt chước cảm xúc 🎭, Gửi ảnh 🖼️, Phản hồi nhanh 💬, Sao chép 📋).</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-snooze">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-snooze">Nhắc Nhở & Báo Thức</a>
            </div>
            <p>Thiết lập thời gian nhắc lại mặc định (Snooze), kiểu hiển thị thông báo (Hệ thống OS / Banner), phát nhạc báo động hoặc nhạc chuông nhẹ nhàng khi đến hạn.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="features-gif">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="features-gif">Giphy API & Cache GIFs</a>
            </div>
            <p>Cấu hình API Key Giphy riêng của bạn và chọn kích thước GIF khi gửi (100px / 200px). Hệ thống tự động cache GIFs trending để tiết kiệm lượt gọi API.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="categories">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="categories">Danh mục Ghi chú</a>
            </div>
            <p>Quản lý các nhãn danh mục để phân loại ghi chú cá nhân. Hỗ trợ tạo mới, chỉnh sửa tên và sắp xếp danh mục ghi chú ngăn nắp.</p>
          </div>

          <div class="settings-road-card settings-subtab-link" data-subtab="sync-data">
            <div style="display: flex; align-items: center; gap: 6px;">
              <a href="#" class="settings-subtab-link" data-subtab="sync-data">Sao lưu Google & Tự động dọn dẹp</a>
            </div>
            <p>Đồng bộ dữ liệu an toàn lên tài khoản Google Drive cá nhân của bạn. Cấu hình tự động dọn dẹp (auto-cleanup) các công việc/ghi chú cũ để giải phóng dung lượng.</p>
          </div>

        </div>
      </div>

      <!-- Section 2: Hover Quick Actions -->
      <div class="guide-info-box">
        <h4 class="guide-info-title">⚡ PHÍM TẮT DI CHUỘT TRÊN TIN NHẮN CHATOPS</h4>
        <div class="guide-info-list">
          <div class="guide-info-item"><span>🎯</span> <span style="color: var(--text-2);">Lưu tin nhắn thành <strong>Công việc cần làm</strong></span></div>
          <div class="guide-info-item"><span>📒</span> <span style="color: var(--text-2);">Lưu tin nhắn thành <strong>Ghi chú cá nhân</strong></span></div>
          <div class="guide-info-item"><span>💬</span> <span style="color: var(--text-2);"><strong>Phản hồi nhanh (@)</strong> tự động tag người gửi</span></div>
          <div class="guide-info-item"><span>📋</span> <span style="color: var(--text-2);"><strong>Sao chép nhanh</strong> tin nhắn vào clipboard</span></div>
          <div class="guide-info-item"><span>🔥</span> <span style="color: var(--text-2);"><strong>Spam Cảm xúc</strong> hàng loạt với 1-click</span></div>
          <div class="guide-info-item"><span>🎭</span> <span style="color: var(--text-2);"><strong>Bắt chước cảm xúc (React-Along)</strong> để tự động thả toàn bộ emoji giống bài viết</span></div>
          <div class="guide-info-item"><span>↩️</span> <span style="color: var(--text-2);"><strong>Thu hồi nhanh</strong> tất cả cảm xúc đã thả</span></div>
          <div class="guide-info-item"><span style="color: #dc2626;">🗑️</span> <span style="color: var(--text-2);"><strong>Xóa nhanh tin nhắn</strong> của chính bạn (không cần xác nhận lại)</span></div>
        </div>
      </div>

      <!-- Section 3: Power Tips -->
      <div class="guide-tip-section">
        <h4 class="guide-section-title">💡 MẸO NĂNG SUẤT ĐỈNH CAO</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div class="guide-tip-box">
            <strong>⚡ Click Đúp Mở Nhanh:</strong>
            <span> Nhập đúp vào bất kỳ tab điều hướng nào (Search, Tasks, Notes) để mở form nhập liệu tương ứng tức thì!</span>
          </div>
          <div class="guide-tip-box">
            <strong>✂️ Sao chép dòng:</strong>
            <span> Di chuột vào dòng văn bản ở thẻ Ghi chú, click icon copy nhỏ để chỉ sao chép riêng dòng đó!</span>
          </div>
        </div>
      </div>
    </div>
  `,
  previewImage: 'Xem ảnh kích thước đầy đủ',
  systemHelpTooltip: 'Hướng dẫn & Trợ giúp hệ thống',
  closeModal: 'Đóng cửa sổ',
  clickToRemove: 'Nhấp để xóa',
  editBtn: 'Chỉnh sửa',
  deleteBtn: 'Xóa',
  clickToCopyLine: 'Nhấp để sao chép dòng này',
  quickCopyTextOnlyError: 'Sao chép nhanh chỉ hỗ trợ tin nhắn dạng văn bản.',
  colorOrange: 'Cam',
  colorTeal: 'Xanh ngọc',
  colorRose: 'Hồng rose',
  colorSlate: 'Xám slate',
  colorWhite: 'Trắng',
  colorLightGray: 'Xám sáng',
  colorYellow: 'Vàng',
  colorDark: 'Tối',
  themeSettingsTitle: 'Giao diện & Màu sắc',
  themeHeaderTitle: 'Thành phần Header',
  themeNavTitle: 'Thanh điều hướng (Tab)',
  themeTabTextTitle: 'Màu chữ của Tab',
  themeAccentTitle: 'Nút bật & Điểm nhấn',
  colorBgLabel: 'Nền',
  colorTextLabel: 'Chữ',
  themePaddingTitle: 'Mật độ khoảng cách (Padding)',
  themePaddingDesc: 'Tùy chỉnh khoảng cách và mật độ hiển thị của danh sách, thẻ và thanh điều hướng.',
  paddingCompact: 'Thu gọn (10px)',
  paddingDefault: 'Mặc định (12px)',
  paddingComfortable: 'Dễ nhìn (16px)',
  paddingSpacious: 'Rộng rãi (20px)',

  categoriesTitle: 'Danh mục Ghi chú',
  newCategoryPlaceholder: 'Nhập tên danh mục mới...',
  addBtn: 'Thêm',
  dataManagementTitle: 'Quản lý Dữ liệu',
  syncCloudTab: '☁️ Sao lưu đám mây',
  syncCleanupTab: '🧹 Dọn dẹp & Bộ nhớ',
  cloudSyncTitle: 'Đồng bộ đám mây (Tài khoản Google)',
  cloudSyncDesc: 'Sao lưu hoặc khôi phục các công việc và ghi chú của bạn lên đám mây thông qua tài khoản Google để đồng bộ dữ liệu giữa các máy tính.',
  backupToCloudBtn: 'Sao lưu',
  restoreFromCloudBtn: 'Khôi phục',
  noBackupsFound: 'Không tìm thấy bản sao lưu nào trên máy tính này.',
  whySyncTitle: 'Tại sao nên đồng bộ thủ công?',
  whySyncDesc: 'Để đảm bảo quyền riêng tư tối đa và tốc độ tức thì, tất cả dữ liệu được lưu trữ ngoại tuyến theo mặc định. Đồng bộ thủ công cho phép bạn quyết định chính xác thời điểm sao lưu hoặc truyền dữ liệu của mình.',
  cleanupTitle: 'Dọn dẹp & Tối ưu dung lượng',
  cleanupDesc: 'Tự động xóa các công việc đã hoàn thành sau một khoảng thời gian nhất định để giữ cho dữ liệu của bạn được đồng bộ nhanh chóng.',
  storageUsedLabel: 'Dung lượng đã dùng:',
  autoCleanupLabel: 'Chu kỳ tự động dọn dẹp:',
  autoCleanupSublabel: 'Chỉ áp dụng cho các công việc đã hoàn thành.',
  cleanupNever: 'Không bao giờ',
  cleanupOnOpen: 'Khi mở Tiện ích',
  cleanup1Day: 'Sau 1 ngày',
  cleanup7Days: 'Sau 7 ngày',
  cleanup30Days: 'Sau 30 ngày',
  cleanup90Days: 'Sau 90 ngày',
  cleanupNowBtn: 'Dọn dẹp ngay',
  confirmDeleteTask: '⚠️ Bạn có chắc chắn muốn xóa công việc này?',
  confirmDeleteNote: '⚠️ Bạn có chắc chắn muốn xóa ghi chú này?',
  settingQuickDelete: 'Nút xóa nhanh tin nhắn (🗑️)',
  customButtonsPositionLabel: 'Vị trí các nút tương tác nhanh',
  customButtonsPositionSublabel: 'Cấu hình vị trí nút tương tác nhanh so với menu ChatOps',
  posHorizontalBefore: 'Ngang - Trước các chức năng',
  posHorizontalAfter: 'Ngang - Sau các chức năng',
  posAbove: 'Dọc - Trên các chức năng',
  posBelow: 'Dọc - Dưới các chức năng',
  settingSoundNotification: 'Phát âm thanh khi có nhắc nhở',
  settingsSaved: 'Đã lưu tự động',
  notificationPositionTitle: 'Vị trí hiển thị thông báo',
  notificationPositionDesc: 'Cài đặt vị trí hiển thị của popup thông báo nhắc nhở.',
  posTopRight: 'Góc trên bên phải (Mặc định)',
  posTopLeft: 'Góc trên bên trái',
  posBottomRight: 'Góc dưới bên phải',
  posBottomLeft: 'Góc dưới bên trái',
  posTopCenter: 'Giữa phía trên',
  posBottomCenter: 'Giữa phía dưới',
  posCenter: 'Chính giữa',
  notificationAnimationTitle: 'Hiệu ứng thông báo',
  notificationAnimationDesc: 'Chọn hiệu ứng xuất hiện của thông báo để dễ chú ý.',
  animDefault: 'Slide-in chuẩn (Mặc định)',
  animStrong: 'Rung & Phát sáng mạnh',
  animShakeContinuous: 'Rung lắc liên tục',
  animPulseGlow: 'Nhấp nháy phát sáng',
  animBounce: 'Nảy nhảy liên tục',
  notificationSizeTitle: 'Kích thước thông báo',
  notificationSizeDesc: 'Chọn kích thước hiển thị của popup thông báo nhắc nhở.',
  sizeMedium: 'Vừa (Mặc định)',
  sizeLarge: 'Lớn',
  customColorLabel: 'Tự chọn...',
  exportNotesBtn: 'Xuất ghi chú',
  importNotesBtn: 'Nhập ghi chú',
  exportNotesBtnTitle: 'Xuất ghi chú ra tệp Markdown (.md)',
  importNotesBtnTitle: 'Nhập ghi chú từ tệp Markdown (.md), TXT hoặc JSON',
  importSuccess: '🎉 Đã nhập thành công {count} ghi chú!',
  importFailed: '❌ Nhập ghi chú thất bại. Vui lòng kiểm tra lại nội dung tệp.',
  categoryNormal: 'Thường',
  categoryChecklist: 'Checklist',
  categoryGroupReminder: 'Nhắc nhở nhóm',
  reminderTargetGroupLabel: 'Nhắc tại Group:',
  selectChannelPlaceholder: 'Chọn Group...',
  mentionTargetLabel: 'Tag ai:',
  mentionTargetNone: 'Không Tag',
  mentionTargetAll: '@all (Tất cả)',
  mentionTargetHere: '@here (Online)',
  mentionTargetUsers: 'Người cụ thể...',
  mentionUsersLabel: 'Người cần tag:',
  addChecklineBtn: '+ Thêm mục',
  checklistPlaceholder: 'mục checklist {num}...',
  checklistMinError: 'Vui lòng nhập ít nhất một mục checklist.',
  taskRemindDailyLabel: 'Lặp lại hàng ngày vào giờ đã chọn',
  repeatDailyBadgeText: 'Hàng ngày',
  collapseBtnBottom: 'Thu gọn',
  groupMessage: 'Tin nhắn nhóm',
  userGuideTitle: 'Hướng dẫn Hệ thống 💡',
  tabsCompactToggleTooltip: 'Thu gọn menu (Chỉ hiển thị icon)',

  // Interactive Onboarding Tour
  tourSkip: 'Bỏ qua',
  tourPrev: '← Quay lại',
  tourNext: 'Tiếp →',
  tourFinish: '🚀 Bắt đầu!',
  tourStepOf: '{current} / {total}',
  tourModalPreview: '(Xem trước form — nhấn <strong>Tiếp</strong> để tiếp tục)',

  tourStep1Title: '👋 Chào mừng đến ChatOps++!',
  tourStep1Desc: 'Chuyến tham quan nhanh sẽ giới thiệu các tính năng chính.<br><br>⚡ <strong>Thao tác chủ yếu:</strong> Di chuột (hover) qua bất kỳ tin nhắn nào trên ChatOps để hiển thị <strong>Thanh tác vụ nhanh</strong> phía trên tin nhắn:<div style="position: relative; display: flex; gap: 8px; padding: 10px 12px; background: rgba(0, 0, 0, 0.03); border: 1px solid rgba(0, 0, 0, 0.05); border-radius: 6px; margin: 20px 0 8px 0; font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; text-align: left; line-height: 1.4;"><div style="width: 30px; height: 30px; border-radius: 50%; background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">CO</div><div style="flex-grow: 1; min-width: 0;"><div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;"><span style="font-weight: 600; font-size: 12px; color: var(--text);">Hannd</span><span style="font-size: 10px; color: var(--text-3);">10:30 AM</span></div><div style="font-size: 12px; color: var(--text-2); word-break: break-word;">Dự án ChatOps++ này cần hoàn thành trước ngày 20 nhé cả nhà!</div></div><div style="position: absolute; right: 10px; top: -14px; background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.12); border-radius: 6px; box-shadow: 0 3px 8px rgba(0,0,0,0.1); display: inline-flex; align-items: center; padding: 2px 4px; gap: 2px; z-index: 5;"><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="🎯 Ghim công việc" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🎯</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Lưu ghi chú" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">📒</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Phản hồi nhanh" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">💬</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Sao chép nhanh" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">📋</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Spam cảm xúc" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🔥</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Clone reaction" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">🎭</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Hoàn tác cảm xúc" onmouseover="this.style.background=\'rgba(0,0,0,0.06)\'" onmouseout="this.style.background=\'transparent\'">↩️</span><span style="font-size: 13px; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 4px; transition: background 0.1s;" title="Xóa tin nhắn" onmouseover="this.style.background=\'rgba(255,0,0,0.1)\'" onmouseout="this.style.background=\'transparent\'">🗑️</span></div></div>Nhấn <strong>Tiếp</strong> để bắt đầu, hoặc <strong>Bỏ qua</strong> để tự khám phá.',

  tourStep2Title: '🎯 Công việc — Quản lý task',
  tourStep2Desc: 'Theo dõi công việc hàng ngày. Ghim tin nhắn ChatOps thành task chỉ với một hover-click.<br><br>💡 <strong>Mẹo:</strong> Bạn có thể click đúp (double-click) vào tab này để mở modal tạo công việc!',

  tourStep3Title: 'Tạo công việc',
  tourStep3Desc: 'Tạo công việc mà bạn muốn theo dõi và nhắc nhở theo thời gian đã thiết lập',

  tourStep4Title: '📒 Ghi chú — Lưu ý tưởng',
  tourStep4Desc: 'Lưu ý tưởng hoặc tin nhắn quan trọng dưới dạng ghi chú cá nhân. Phân loại theo danh mục tuỳ chỉnh.<br><br>💡 <strong>Mẹo:</strong> Bạn có thể click đúp (double-click) vào tab này để mở modal tạo ghi chú!',

  tourStep5Title: 'Tạo ghi chú',
  tourStep5Desc: 'Tạo các ghi chú cá nhân theo danh mục, giúp bạn dễ dàng tìm kiếm và tra cứu lại sau này.',

  tourStep6Title: '🔔 Tin nhắn bỏ lỡ — Theo dõi @mention',
  tourStep6Desc: 'Không bỏ sót @mention nào nữa! Quét kênh để tìm tin nhắn chưa phản hồi hoặc chưa react.<br><br>💡 <strong>Mẹo:</strong> Bạn có thể click đúp (double-click) vào tab này để mở modal quét tin nhắn!',

  tourStep7Title: 'Quét tin nhắn bỏ lỡ',
  tourStep7Desc: 'Quét và lọc các lượt nhắc tên (@mention) trong kênh, đảm bảo bạn không bỏ lỡ thông tin quan trọng nào.',

  tourStep8Title: '⚡ Công cụ khác — Tiện ích nâng cao',
  tourStep8Desc: 'Khám phá các công cụ hỗ trợ nâng cao trong quá trình làm việc, bao gồm Thư viện ảnh và Spam Reactions.',

  tourStep9Title: 'Tìm kiếm tin nhắn',
  tourStep9Desc: 'Tìm kiếm thông tin trong lịch sử tin nhắn với các bộ lọc.<br><br>💡 <strong>Mẹo:</strong> Bạn có thể click đúp (double-click) vào tab này để mở khung tìm kiếm!',
  tourStep9ModalTitle: 'Bộ lọc tìm kiếm',
  tourStep9ModalDesc: 'Nhập từ khóa, lọc theo người gửi, kênh hoặc khoảng thời gian để tìm kiếm tin nhắn một cách chính xác.',

  tourStep10Title: '🖼️ Thư viện ảnh',
  tourStep10Desc: 'Lưu trữ các hình ảnh và meme yêu thích của bạn. Nhấn vào nút chọn ảnh hoặc kéo thả ảnh để tải lên, sau đó click trực tiếp vào ảnh để gửi nhanh hoặc chèn vào khung chat.',

  tourStep11Title: '🔥 Spam Reactions',
  tourStep11Desc: 'Cấu hình danh sách các emoji phản hồi hàng loạt. Hãy click chọn các emoji bạn muốn sử dụng, cấu hình được tự động lưu lại.',

  tourStep12Title: '⚙️ Cài đặt — Tuỳ chỉnh mọi thứ',
  tourStep12Desc: 'Cấu hình các thiết lập hoạt động của extension ChatOps++. Ngoài ra, khi hover qua các tin nhắn trên ChatOps, bạn sẽ thấy xuất hiện các icon chức năng để thực hiện quick action.',

  tourStep13Title: '🚀 Quick Actions khi hover',
  tourStep13Desc: 'Bật/tắt các biểu tượng tính năng nhanh xuất hiện khi di chuột qua tin nhắn ChatOps (Ghim công việc, Lưu ghi chú, Spam emoji, Copy nhanh, Quick reply, ...).',

  tourStep14Title: '🔔 Thông báo ứng dụng',
  tourStep14Desc: 'Thiết lập âm thanh thông báo và cảnh báo màn hình cho các lượt nhắc tên hoặc cập nhật mới.',

  tourStep15Title: '🎬 Tích hợp Giphy',
  tourStep15Desc: 'Cấu hình tích hợp Giphy để tìm kiếm và gửi ảnh động trực tiếp trong cuộc hội thoại. Để sử dụng, click vào biểu tượng ảnh (🖼️) ở thanh công cụ chat và chọn tab GIFs.',

  tourStep16Title: '🏷️ Danh mục Ghi chú',
  tourStep16Desc: 'Quản lý các nhãn phân loại tùy chỉnh để sắp xếp và chọn lọc ghi chú cá nhân dễ dàng.',

  tourStep17Title: '🗂️ Quản lý Menu & Tab',
  tourStep17Desc: 'Bật/tắt hiển thị các tab chức năng hoặc đưa các công cụ con ra thanh điều hướng chính.',

  tourStep18Title: '↕️ Sắp xếp thứ tự Tab',
  tourStep18Desc: 'Thay đổi vị trí hiển thị của các tab trên thanh điều hướng chính bằng cách click vào các nút mũi tên để di chuyển tab sang trái hoặc sang phải theo ý muốn.',

  tourStep19Title: '🎨 Tuỳ chỉnh Giao diện',
  tourStep19Desc: 'Thay đổi màu sắc chủ đạo, màu nền header, màu thanh điều hướng, màu chữ của tab hoặc thay đổi khoảng cách giãn dòng (Compact / Spacious) phù hợp với bạn.',

  tourStep20Title: '☁️ Đồng bộ đám mây',
  tourStep20Desc: 'Sao lưu dự phòng và phục hồi toàn bộ công việc, ghi chú của bạn thông qua tài khoản Google để đồng bộ dữ liệu giữa các máy tính khác nhau.',

  tourStep21Title: '🧹 Dọn dẹp & Lưu trữ',
  tourStep21Desc: 'Tối ưu hóa dung lượng lưu trữ của tiện ích và thiết lập tự động dọn dẹp các công việc đã hoàn thành.',

  tourStep22Title: '✅ Sẵn sàng rồi!',
  tourStep22Desc: 'Vậy là giới thiệu xong tất cả! Nhấn <strong>Bắt đầu</strong> để dùng ngay. Xem lại tour bất kỳ lúc nào qua nút <strong>?</strong> trên header.',

  tourReplayBtn: '▶ Xem lại Tour',
  tourOpenDocsBtn: '📖 Mở Tài liệu',

  tourKeyboardHint: '⌨️ Dùng phím mũi tên (← / →) để di chuyển',

  filterAll: 'Tất cả',
  filterTasks: 'Công việc',
  filterGroupReminders: 'Lên lịch gửi tin',
  mentionAllDesc: 'Thông báo cho mọi người trong kênh',
  mentionHereDesc: 'Thông báo cho thành viên đang hoạt động',
};

// Swaps the active language dictionary key-value pairs in-place
export function setLanguage(langCode) {
  const dict = langCode === 'vi' ? vi : en;
  
  // Clean all existing keys in case of dictionary hot-swapping
  for (const key in language) {
    delete language[key];
  }
  
  // Assign all keys in-place (with en as fallback for missing keys)
  Object.assign(language, en, dict);
}

// Function to dynamically retrieve active locale code
export function getActiveLanguageCode() {
  return language.loading === 'Đang tải...' ? 'vi' : 'en';
}

// Initialize with a default locale synchronously
setLanguage('vi');

// Asynchronously load language from chrome.storage.local
export async function loadLanguage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['app_lang'], (res) => {
      const savedLang = res.app_lang || 'vi';
      setLanguage(savedLang);
      resolve(savedLang);
    });
  });
}

// Scans container and translates all data-i18n attributes
export function applyI18n(container = document) {
  // Translate textContent
  container.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (language[key] !== undefined) {
      el.textContent = language[key];
    }
  });

  // Translate innerHTML (for rich static blocks)
  container.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (language[key] !== undefined) {
      el.innerHTML = language[key];
    }
  });

  // Translate placeholder
  container.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (language[key] !== undefined) {
      el.setAttribute('placeholder', language[key]);
      const childInput = el.querySelector('input');
      if (childInput) {
        childInput.placeholder = language[key];
      }
    }
  });

  // Translate title
  container.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (language[key] !== undefined) {
      el.setAttribute('title', language[key]);
    }
  });
}
