import { getMyProfile, getMyChannelMembers, getTeamByName, getConfig, createPost } from '../api/index.js';
import { ALARMS, UI_CONFIG, CHATOPS_CONFIG, MESSAGE_TYPES, STORAGE_KEYS } from '../constants.js';
import { language, loadLanguage } from '../lang.js';
import { formatDateTime } from '../utils/date.js';

/**
 * Handles periodic mention checks
 */
export async function handleMentionCheck() {
  try {
    // Disabled setting badge for unread mentions count per user request
    chrome.action.setBadgeText({ text: '' });
  } catch (err) {
    console.warn('[ChatOps Extension] Mention check failed:', err.message);
  }
}

/**
 * Reschedules a daily task to the next occurrence of its configured daily time.
 * Updates task.reminder in storage and creates a new Chrome alarm.
 * @param {Object} task - the task object (will be mutated)
 * @param {Array} memos - full memos array (will be persisted)
 */
async function rescheduleToNextDailyOccurrence(task, memos) {
  // Extract HH:mm from the stored reminder string (format: "YYYY-MM-DD HH:mm")
  const reminderStr = task.reminder || '';
  const timeMatch = reminderStr.match(/(\d{2}):(\d{2})$/);

  const now = new Date();
  let nextTime = new Date();

  if (timeMatch) {
    nextTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
    // If that time today has already passed, push to tomorrow
    if (nextTime.getTime() <= now.getTime()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  } else {
    // Fallback: schedule 24 hours from now
    nextTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  task.reminder = formatDateTime(nextTime);
  await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
  chrome.alarms.create(task.id, { when: nextTime.getTime() });
  console.log('[ChatOps Ext] Daily task rescheduled to next occurrence:', task.id, '->', nextTime.toLocaleString());
}

// Set to track task IDs currently executing handleTaskAlarm to prevent concurrent race conditions
const _activeFiringTaskIds = new Set();

/**
 * Handles task reminders
 * @param {string} taskId
 * @param {number} [alarmScheduledTime] - The time the alarm was originally scheduled to fire (ms).
 *   Passed from chrome.alarms.onAlarm event. Used to detect stale/suspended alarms.
 */
export async function handleTaskAlarm(taskId, alarmScheduledTime) {
  if (_activeFiringTaskIds.has(taskId)) {
    console.log('[ChatOps Ext] handleTaskAlarm: Task already executing, skipping duplicate:', taskId);
    return;
  }
  _activeFiringTaskIds.add(taskId);
  try {
    await loadLanguage();
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    const task = memos.find(m => m.id === taskId);

    if (!task) {
      console.warn('[ChatOps Ext] Task not found, clearing alarm:', taskId);
      chrome.alarms.clear(taskId);
      return;
    }

    if (task.type === 'group_reminder' || task.taskCategory === 'group_reminder') {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Guard A: One-time reminder already done
      if (!task.repeatDaily && task.done) {
        console.log('[ChatOps Ext] Group reminder already done, skipping:', taskId);
        chrome.alarms.clear(taskId);
        return;
      }

      // Guard B: Daily group reminder already fired today
      if (task.repeatDaily && task.lastFiredDate === todayStr) {
        console.log('[ChatOps Ext] Daily group reminder already fired today, rescheduling to tomorrow:', taskId);
        await rescheduleToNextDailyOccurrence(task, memos);
        return;
      }

      // Persist fired state in storage IMMEDIATELY before sending API request to prevent duplicate triggers
      if (task.repeatDaily) {
        task.lastFiredDate = todayStr;
      } else {
        task.done = true;
        task.doneAt = Date.now();
      }
      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });

      try {
        // Message content already includes any @mentions the user typed
        const postMessage = task.note;

        if (task.targetChannelId) {
          console.log('[ChatOps Ext] Posting group reminder to channel:', task.targetChannelId);
          await createPost(task.targetChannelId, postMessage);
          
          // Send toast notification message to all open tabs
          const channelName = task.targetChannelName ? `#${task.targetChannelName}` : '';
          const toastMsg = (language.groupReminderSentToast || 'Đã tự động gửi tin nhắn đến kênh: {channel}').replace('{channel}', channelName);
          const tabs = await chrome.tabs.query({ url: `${CHATOPS_CONFIG.DEFAULT_URL}/*` });
          for (const tab of tabs) {
            chrome.tabs.sendMessage(tab.id, {
              type: MESSAGE_TYPES.SHOW_TOAST,
              message: toastMsg,
              duration: 10000
            }).catch(() => {});
          }
        } else {
          console.warn('[ChatOps Ext] Group reminder missing targetChannelId:', taskId);
        }
      } catch (postErr) {
        console.error('[ChatOps Ext] Failed to post group reminder:', postErr);
        // Show error toast on tabs
        const tabs = await chrome.tabs.query({ url: `${CHATOPS_CONFIG.DEFAULT_URL}/*` });
        for (const tab of tabs) {
          chrome.tabs.sendMessage(tab.id, {
            type: MESSAGE_TYPES.SHOW_TOAST,
            message: `[ChatOps++] Failed to send group reminder: ${postErr.message}`,
            duration: 10000
          }).catch(() => {});
        }
      }


      if (task.repeatDaily) {
        // Reschedule to next daily occurrence
        await rescheduleToNextDailyOccurrence(task, memos);
      } else {
        chrome.alarms.clear(taskId);
      }
      return;
    }

    if (task.done) {
      if (task.repeatDaily) {
        // Reset done status for the new day's reminder
        task.done = false;
        task.doneAt = null;
        if (task.checklist) {
          task.checklist.forEach(item => {
            item.done = false;
          });
        }
        await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
      } else {
        chrome.alarms.clear(taskId);
        return;
      }
    }

    // === STALE ALARM GUARD ===
    // Chrome Alarms are suspended when the browser is closed. When Chrome restarts,
    // all overdue alarms fire immediately. If an alarm fires significantly later than
    // its scheduled time (e.g. snooze alarm from last Friday fires on Monday morning),
    // it is "stale" — we must NOT show a notification. Instead:
    //   - Daily tasks: reschedule silently to the next correct occurrence.
    //   - One-time tasks: the moment is missed, clear the alarm (task stays in list as pending).
    const settingsRes = await chrome.storage.local.get([STORAGE_KEYS.SETTINGS]);
    const settings = settingsRes[STORAGE_KEYS.SETTINGS] || {};
    const staleThresholdMinutes = settings.staleThresholdMinutes ?? 30;
    const STALE_THRESHOLD_MS = staleThresholdMinutes * 60 * 1000;
    const now = Date.now();

    // Guard 1: alarm.scheduledTime is stale (Chrome was suspended/closed)
    let isStale = false;
    if (alarmScheduledTime) {
      if (task.repeatDaily) {
        // Daily tasks: stale only if scheduled for a different calendar day in local time
        const scheduledDate = new Date(alarmScheduledTime).toDateString();
        const currentDate = new Date(now).toDateString();
        isStale = (scheduledDate !== currentDate) && (now - alarmScheduledTime > STALE_THRESHOLD_MS);
      } else {
        // One-time tasks: standard stale threshold check
        isStale = (now - alarmScheduledTime > STALE_THRESHOLD_MS);
      }
    }

    if (isStale) {
      console.warn(
        '[ChatOps Ext] Stale alarm detected for task:', taskId,
        '— scheduled:', new Date(alarmScheduledTime).toLocaleString(),
        '— now:', new Date(now).toLocaleString(),
        '— delay:', Math.round((now - alarmScheduledTime) / 60000), 'min'
      );

      if (task.repeatDaily) {
        await rescheduleToNextDailyOccurrence(task, memos);
      } else {
        chrome.alarms.clear(taskId);
        console.log('[ChatOps Ext] Stale one-time alarm cleared (task left as pending):', taskId);
      }
      return; // Do NOT show any notification
    }

    // Guard 2: snooze loop — alarm.scheduledTime is fresh (5 min ago), but task.reminder is
    // hours in the past because user never clicked Done/Skip. Without this guard the snooze
    // chain runs forever.
    //
    // NOTE: This guard is intentionally SKIPPED for repeatDaily tasks.
    // For daily tasks, task.reminder always stores the original absolute timestamp (e.g.
    // "yesterday at 08:56"), so `now - originalReminderTime` is always ≥ 24h — far
    // exceeding any stale threshold — which would incorrectly block every daily notification.
    // Guard 1 (alarm.scheduledTime stale check) already handles the suspended-browser case
    // for all task types, so daily tasks are fully protected without Guard 2.
    if (!task.repeatDaily) {
      const originalReminderTime = task.reminder ? new Date(task.reminder).getTime() : null;
      if (originalReminderTime && (now - originalReminderTime > STALE_THRESHOLD_MS)) {
        console.warn(
          '[ChatOps Ext] Snooze loop guard triggered for one-time task:', taskId,
          '— original reminder:', new Date(originalReminderTime).toLocaleString(),
          '— overdue by:', Math.round((now - originalReminderTime) / 60000), 'min'
        );
        chrome.alarms.clear(taskId);
        console.log('[ChatOps Ext] Snooze loop broken for one-time task (left as pending):', taskId);
        return; // Do NOT show any notification
      }
    }

    // --- Alarm is fresh — proceed to notify ---

    let message = '';
    if (task.postText) message += task.postText.slice(0, 100);
    if (task.note) message += (message ? ' — ' : '') + task.note;
    if (!message) message = language.reminderTaskDefault;

    // Get notification settings (reuse `settings` already loaded above for stale guard)
    const notificationType = settings.notificationType || 'both';
    const snoozeMinutes = settings.snoozeMinutes || 5;

    // 1. Send banner to all ChatOps tabs if configured
    if (notificationType === 'both' || notificationType === 'in-page') {
      const tabs = await chrome.tabs.query({ url: `${CHATOPS_CONFIG.DEFAULT_URL}/*` });
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          type: MESSAGE_TYPES.SHOW_REMINDER,
          message,
          taskId,
          postId: task.postId,
          teamName: task.teamName,
          isTask: true,
          isDaily: task.repeatDaily
        }).catch(() => {});
      }
    }

    // 2. Trigger native OS notification if configured
    if (notificationType === 'both' || notificationType === 'system') {
      console.log('[ChatOps Ext] Attempting to trigger OS notification for task:', taskId);
      // Clear previous notification with same id before creating new one
      chrome.notifications.clear(taskId, () => {
        chrome.notifications.create(taskId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: language.reminderTitle,
          message: message,
          priority: 2,
          requireInteraction: true
        }, (notificationId) => {
          if (chrome.runtime.lastError) {
            console.error('[ChatOps Ext] Failed to create OS notification:', chrome.runtime.lastError.message);
          } else {
            console.log('[ChatOps Ext] OS notification created successfully with ID:', notificationId);
          }
        });
      });
    }

    // 3. Schedule snooze alarm so notification repeats until user acts (Done / Skip).
    // The stale guard above ensures that if Chrome was suspended and this snooze
    // alarm fires much later, it will be discarded gracefully instead of looping.
    // Note: for repeatDaily tasks, the snooze loop is intentional — it keeps reminding
    // the user until they click Done or Skip. Once they act, handleMarkTaskDone /
    // handleSkipTaskDaily will reschedule the alarm to the next day's occurrence.
    chrome.alarms.create(taskId, { delayInMinutes: snoozeMinutes });
    console.log('[ChatOps Ext] Task alarm fired, snooze scheduled in', snoozeMinutes, 'min:', taskId);

  } catch (err) {
    console.error('[ChatOps Ext] handleTaskAlarm error:', err);
  } finally {
    _activeFiringTaskIds.delete(taskId);
  }
}

// Guard to prevent concurrent syncTaskAlarms calls (e.g. initialize() called twice on onInstalled + module load)
let _syncInProgress = false;

/**
 * Synchronizes and registers Chrome alarms for all active (pending) tasks.
 * Reschedules past daily tasks to their next correct occurrence.
 */
export async function syncTaskAlarms() {
  if (_syncInProgress) {
    console.log('[ChatOps Ext] syncTaskAlarms already running — skipping duplicate call');
    return;
  }
  _syncInProgress = true;
  try {
    const res = await chrome.storage.local.get([STORAGE_KEYS.MEMOS]);
    const memos = res[STORAGE_KEYS.MEMOS] || [];
    let updated = false;

    // Get current alarms to clear existing task alarms before rebuilding
    const alarms = await chrome.alarms.getAll();
    for (const alarm of alarms) {
      if (alarm.name.startsWith(ALARMS.TASK_PREFIX)) {
        await chrome.alarms.clear(alarm.name);
      }
    }

    const now = Date.now();
    const tasksToFire = [];

    for (const task of memos) {
      // Schedule alarms for:
      // - One-time tasks that are NOT done.
      // - Daily tasks (even if currently marked done, because they need to fire tomorrow to reset status).
      if ((task.type === 'task' || task.type === 'group_reminder') && (!task.done || task.repeatDaily)) {
        if (!task.reminder) continue;

        const reminderTime = new Date(task.reminder).getTime();
        if (isNaN(reminderTime)) {
          console.warn('[ChatOps Ext] Invalid reminder date format for task:', task.id, task.reminder);
          continue;
        }

        if (task.taskCategory === 'group_reminder' || task.type === 'group_reminder') {
          if (reminderTime <= now) {
            if (task.repeatDaily) {
              // Daily reminders: if past due, mark for today and reschedule to next occurrence without firing past message
              const todayStr = new Date().toISOString().slice(0, 10);
              console.log('[ChatOps Ext] Startup: Past daily group reminder — rescheduling to next occurrence:', task.id);
              task.lastFiredDate = todayStr;
              await rescheduleToNextDailyOccurrence(task, memos);
              updated = true;
            } else {
              // One-time reminder: if past due, mark as done without firing past message
              if (!task.done) {
                console.log('[ChatOps Ext] Startup: Past one-time group reminder skipped (overdue):', task.id);
                task.done = true;
                task.doneAt = Date.now();
                updated = true;
              }
            }
            continue;
          } else {
            chrome.alarms.create(task.id, { when: reminderTime });
            console.log('[ChatOps Ext] Startup: Scheduled future group reminder:', task.id, 'at', task.reminder);
          }
        } else if (task.repeatDaily) {
          // If the scheduled time is in the past, reschedule to the next valid daily occurrence
          if (reminderTime <= now) {
            // Extract HH:mm
            const timeMatch = task.reminder.match(/(\d{2}):(\d{2})$/);
            let nextTime = new Date();
            if (timeMatch) {
              nextTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
              while (nextTime.getTime() <= now) {
                nextTime.setDate(nextTime.getDate() + 1);
              }
            } else {
              nextTime = new Date(now + 24 * 60 * 60 * 1000);
            }
            task.reminder = formatDateTime(nextTime);
            // Since we are moving to a future occurrence, reset the completion state
            task.done = false;
            task.doneAt = null;
            if (task.checklist) {
              task.checklist.forEach(item => {
                item.done = false;
              });
            }
            chrome.alarms.create(task.id, { when: nextTime.getTime() });
            console.log('[ChatOps Ext] Startup: Rescheduled past daily task & reset done status:', task.id, 'to', task.reminder);
            updated = true;
          } else {
            // Future reminder, schedule it
            chrome.alarms.create(task.id, { when: reminderTime });
            console.log('[ChatOps Ext] Startup: Scheduled future daily task:', task.id, 'at', task.reminder);
          }
        } else {
          // One-time task
          if (reminderTime > now) {
            chrome.alarms.create(task.id, { when: reminderTime });
            console.log('[ChatOps Ext] Startup: Scheduled future task:', task.id, 'at', task.reminder);
          } else {
            console.log('[ChatOps Ext] Startup: Skipped past one-time task (retaining as pending):', task.id, 'at', task.reminder);
          }
        }
      }
    }

    if (updated) {
      await chrome.storage.local.set({ [STORAGE_KEYS.MEMOS]: memos });
    }
  } catch (err) {
    console.error('[ChatOps Ext] Error in syncTaskAlarms:', err);
  } finally {
    _syncInProgress = false;
  }
}
