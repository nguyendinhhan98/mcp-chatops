# AGENTS.md — Hướng Dẫn Cho AI Agent

> Tài liệu này dành cho **AI agents** (Copilot, Cursor, Antigravity, v.v.) khi làm việc với codebase **ChatOps++**.
> Đọc kỹ trước khi thực hiện bất kỳ thay đổi nào.

---

## 1. Tổng Quan Dự Án

**ChatOps++** là một Chrome Extension (Manifest V3) tăng cường trải nghiệm sử dụng Mattermost tại địa chỉ `https://chat.runsystem.vn`. Extension thêm nhiều tính năng nâng cao như:

- 🎯 **Tasks** — Tạo task từ bất kỳ tin nhắn nào, set reminder bằng Chrome Alarms
- 📒 **Notes/Memos** — Ghi chú nhanh phân category
- 📢 **Group Reminders** — Lên lịch gửi tin tự động gửi tin nhắn đến Mattermost channel chỉ định
- 🔍 **Search** — Tìm kiếm posts nâng cao qua Sidepanel hoặc click icon 🔍 trên header để mở Modal trực tiếp
- 🔔 **Mentions** — Quét mentions bị bỏ lỡ qua Sidepanel hoặc click icon 🔔 trên header để mở Modal trực tiếp
- 🖼️ **Image Picker** — Thư viện ảnh tùy chỉnh + Giphy integration + image editor
- 📒 **Quick Template Picker, Task Creator, Group Reminder Creator & Google Meet Creator** — Chèn nhanh mẫu ghi chú (nút 📒), tạo công việc (nút 🎯), lên lịch gửi tin (nút 📢) hoặc tạo phòng họp Google Meet (nút 📹) trực tiếp từ ô chat
- 🔥 **Quick Reactions** — Spam react, clone reactions, undo reactions
- ⚙️ **Settings** — Cấu hình toàn diện (theme, notifications, emojis, v.v.)

---

## 2. Cấu Trúc Thư Mục

```
chatops_mcp/
└── chrome-extension/
    ├── manifest.json              # MV3 manifest
    ├── package.json               # Metadata
    ├── icons/                     # Icon 16/48/128px
    ├── docs/                      # Tài liệu hệ thống (thư mục này)
    │
    ├── content/                   # Content Scripts (chạy trên trang Mattermost)
    │   ├── loader.js              # Entry: dynamic import content.js như ESM
    │   ├── inject.js              # Main-world script: đọc React Fiber/Redux
    │   ├── content.js             # Core UI injection (~4800 dòng)
    │   └── content.css            # Styles cho injected UI
    │
    ├── sidepanel/                 # Side Panel UI
    │   ├── sidepanel.html         # HTML layout chính (~119KB)
    │   ├── sidepanel.js           # Orchestrator: khởi tạo, điều hướng tabs
    │   ├── sidepanel.css          # Styles side panel
    │   ├── state.js               # In-memory state (user, team, config)
    │   ├── persistence.js         # Lưu/khôi phục UI state vào localStorage
    │   ├── autocomplete.js        # Component autocomplete (user, channel)
    │   ├── multiselect.js         # Component chọn nhiều items (channel filter)
    │   ├── tour.js                # Onboarding flow (22 bước)
    │   ├── flatpickr.js           # Date picker library (bundled)
    │   ├── flatpickr.css          # Date picker styles
    │   ├── polyfill.js            # Browser polyfills
    │   └── tabs/
    │       ├── tasks.tab.js       # Tab Tasks (~1186 dòng)
    │       ├── reminders.tab.js   # Tab Group Reminders (~450 dòng)
    │       ├── memo.tab.js        # Tab Notes/Memos (~800 dòng)
    │       ├── mentions.tab.js    # Tab Mentions (~881 dòng)
    │       ├── search.tab.js      # Tab Search (~585 dòng)
    │       └── settings.tab.js    # Tab Settings (~3571 dòng)
    │
    └── src/                       # Shared Logic (ESM modules)
        ├── background.js          # Service Worker entry (~660 dòng)
        ├── constants.js           # Tất cả enums, constants, config
        ├── lang.js                # i18n system (~1721 dòng, vi + en)
        ├── background/
        │   ├── alarms.js          # Xử lý Chrome Alarms (task reminders)
        │   ├── cookie-sync.js     # Auto-sync Mattermost auth cookies
        │   └── panel-manager.js   # Quản lý native/PWA side panel
        ├── api/
        │   ├── index.js           # Barrel export
        │   ├── client.js          # HTTP client (auth, headers)
        │   ├── channels.js        # Channels API
        │   ├── posts.js           # Posts API
        │   ├── teams.js           # Teams API
        │   ├── users.js           # Users API
        │   └── emojis.js          # Custom Emojis API
        └── utils/
            ├── index.js           # Barrel: date + formatter + ui + channels
            ├── date.js            # Format/parse ngày giờ
            ├── formatter.js       # Render HTML, keyword highlight
            ├── ui.js              # Toast, loading, error states, flatpickr init
            ├── channels.js        # Enrich/filter DM channels
            ├── imageConverter.js  # Universal image format converter
            ├── webpToGif.js       # WebP → GIF/PNG (legacy)
            └── gifenc.js          # GIF encoder library (bundled, minified)
```

---

## 3. Kiến Trúc Tổng Quan

```
┌─────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                          │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  Service Worker │    │         Side Panel UI            │ │
│  │  (background)   │    │                                  │ │
│  │                 │    │  sidepanel.js (Orchestrator)     │ │
│  │  background.js  │    │  ├── state.js                    │ │
│  │  ├── alarms.js  │◄───┤  ├── tabs/tasks.tab.js           │ │
│  │  ├── cookie-    │    │  ├── tabs/memo.tab.js             │ │
│  │  │   sync.js   │    │  ├── tabs/mentions.tab.js         │ │
│  │  ├── panel-     │    │  ├── tabs/search.tab.js           │ │
│  │  │   manager.js│    │  └── tabs/settings.tab.js         │ │
│  │  └── api/       │    └─────────────────────────────────┘ │
│  │      ├── users  │                    │                    │
│  │      ├── posts  │    ┌───────────────▼─────────────────┐ │
│  │      ├── channels    │       Content Scripts            │ │
│  │      ├── teams  │    │   (chạy trên chat.runsystem.vn)  │ │
│  │      └── emojis │    │  loader.js → content.js (ESM)    │ │
│  └─────────────────┘    │  ├── inject.js (main world)      │ │
│           │              │  │   └── React Fiber bridge      │ │
│           │              │  ├── MutationObserver            │ │
│           │              │  ├── Quick Actions Buttons       │ │
│           │              │  ├── Image Picker + Editor       │ │
│           │              │  ├── Quick Note/Task Popover     │ │
│           │              │  └── PWA Panel (iframe fallback) │ │
│           └──────────────┘                                  │
│                   chrome.runtime.sendMessage()              │
│                   chrome.storage.local                      │
└─────────────────────────────────────────────────────────────┘
           │
            ▼ External APIs
  ┌────────────────────────────────────┐
  │  Mattermost API (chat.runsystem.vn/api/v4)              │
  │  Giphy API                                               │
  └──────────────────────────────────────────────────────────┘
```

---

## 4. Message Types (IPC)

Communication giữa các components dùng `chrome.runtime.sendMessage()`. Toàn bộ message types được định nghĩa trong `src/constants.js` (key `MESSAGE_TYPES`):

| Message Type | Từ | Đến | Mục đích |
|---|---|---|---|
| `OPEN_SIDE_PANEL` | content | background | Mở side panel |
| `TOGGLE_SIDE_PANEL` | content | background | Toggle side panel |
| `SIDE_PANEL_STATE` | sidepanel | background | Cập nhật trạng thái panel |
| `SWITCH_TAB` | background | sidepanel | Chuyển tab trong panel |
| `MEMO_UPDATED` | content | background | Thông báo memos đã thay đổi |
| `SET_TASK_ALARM` | content/sidepanel | background | Tạo Chrome Alarm cho task |
| `MARK_TASK_DONE` | content/sidepanel | background | Đánh dấu task hoàn thành |
| `SKIP_TASK_DAILY` | content | background | Bỏ qua task hôm nay (daily repeat) |
| `SPAM_POST_REACTIONS` | content | background | React nhiều emoji vào post |
| `RETRACT_POST_REACTIONS` | content | background | Xóa tất cả reactions của mình |
| `CLONE_POST_REACTIONS` | content | background | Copy reactions từ post sang post khác |
| `DELETE_POST` | content | background | Xóa post |
| `GET_POST_THREAD` | content | background | Lấy toàn bộ thread |
| `GET_CHANNEL_FILES` | content | background | Lấy toàn bộ files/ảnh trong channel |
| `RESOLVE_DISPLAY_NAME` | content | background | Resolve display name → username |
| `RESOLVE_USER_ID` | content | background | Resolve userId → username |
| `SHOW_REMINDER` | background | content | Hiển thị reminder banner |
| `CHECK_MENTIONS_NOW` | sidepanel | background | Trigger check mentions ngay |
| `SYNC_COOKIES_NOW` | sidepanel | background | Force sync cookies |
| `TOGGLE_PWA_SIDE_PANEL` | background | content | Toggle PWA iframe panel |
| `OPEN_QUICK_NOTE_FROM_CONTEXT_MENU` | background | content | Mở quick note từ context menu |
| `SHOW_HOVER_DEMO` | sidepanel | content | Demo hover buttons |
| `APP_LANG_CHANGED` | sidepanel | content | Reload ngôn ngữ |
| `SHOW_TOAST` | background/sidepanel | content | Hiện toast trên trang |
| `INSERT_TEXT_TO_CHAT` | sidepanel | content | Chèn văn bản/hình ảnh vào khung chat Mattermost |
| `GET_MY_TEAMS` | content | background | Lấy danh sách các workspace teams |
| `GET_MY_CHANNELS` | content | background | Lấy danh sách các public/private/DM channels theo team |
| `CREATE_GOOGLE_MEET` | content | background | Yêu cầu background worker khởi tạo tab Google Meet mới và lắng nghe URL thật |
| `GOOGLE_MEET_CREATED` | background | content | Trả về link Google Meet thật đã được tạo thành công để chèn vào chatbox |

---

## 5. Storage Schema

Tất cả data được lưu trong `chrome.storage.local`. Keys được định nghĩa trong `STORAGE_KEYS`:

```js
// Cấu hình chính
chrome.storage.local['chatops_config'] = {
  chatopsUrl: 'https://chat.runsystem.vn',
  cookie: 'MMAUTHTOKEN=xxx',
  csrf: 'MMCSRF=xxx',
  teamName: 'dn'
}

// State hiện tại
chrome.storage.local['chatops_state'] = { ... }

// Team đang active
chrome.storage.local['current_team'] = 'dn'

// Tất cả tasks + memos (SHARED array)
chrome.storage.local['chatops_memos'] = [
  {
    id: 'uuid',
    type: 'task',           // 'task' | 'memo'
    postId: 'abc123',       // optional - linked Mattermost post
    postText: 'message...',
    title: 'Task title',
    note: 'Extra note',
    category: 'work',
    createdAt: 1234567890,
    done: false,
    doneAt: null,
    reminder: 1234567890,   // Unix timestamp ms
    repeatDaily: false,
    status: 'pending',
    teamName: 'dn',
    checklist: [],          // only for type='checklist'
    targetChannelId: 'id',  // only for type='group_reminder'
    targetChannelName: 'name',
    mentionTarget: 'all',   // 'all' | 'here' | 'users'
    mentionUsers: '@user1'
  }
]

// Settings object
chrome.storage.local['chatops_settings'] = {
  // Theme
  accentColor: '#5865f2',
  accentTextColor: '#ffffff',
  headerColor: '#1e1f22',
  navColor: '#2b2d31',
  appPadding: 14,
  tabTextColor: '#ffffff',
  // Tabs
  promotedTabs: ['tasks', 'search'],
  demotedTabs: ['mentions', 'memo'],
  hiddenTabs: [],
  tabOrder: ['tasks', 'search', 'mentions', 'memo'],
  // Floating buttons
  floatingButtons: {
    quickNote: true, quickTask: true, spamReactions: true,
    reactAlong: true, imagePicker: true, templatePicker: true,
    quickReply: true, quickCopy: true, groupReminder: true,
    quickMeet: true
  },
  },
  // Notifications
  notificationType: 'both',         // 'in-page' | 'system' | 'both'
  notificationPosition: 'top-right',
  notificationAnimation: 'slide',
  notificationSize: 'medium',
  snoozeMinutes: 5,
  // Reactions
  spamEmojis: [],
  reactionGroups: {},
  activeReactionGroupId: null,
  // Categories
  memoCategories: [],
  // Cleanup
  autoCleanupDays: 30,
  // Language
  app_lang: 'vi',
  // Other
  giphyApiKey: '',
  quickDelete: false,
  customButtonsPosition: 'before',
  memeEnabled: true
}

// Custom images library
chrome.storage.local['custom_memes'] = [
  { src: 'data:image/...', name: 'filename.png' }
]

// Sidepanel tab state
chrome.storage.local['sidepanel_tab'] = 'tasks'

// Button position (floating btn)
chrome.storage.local['btn_position'] = { top: '...', left: '...' }
```

**Cloud sync** (`chrome.storage.sync`): Memos được backup theo từng item với key `sync_memo_{id}` để bypass giới hạn 8KB/item.

---

## 6. Patterns & Conventions

### 6.1 Message Passing Pattern
```js
// Gửi từ content/sidepanel → background
chrome.runtime.sendMessage({
  type: MESSAGE_TYPES.SOME_ACTION,
  payload: { ... }
}, (response) => {
  if (chrome.runtime.lastError) { /* handle error */ }
  // use response
});

// Background nhận và xử lý
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MESSAGE_TYPES.SOME_ACTION) {
    // async handler
    handleSomeAction(message.payload, sendResponse);
    return true; // QUAN TRỌNG: return true để giữ channel mở cho async
  }
});
```

### 6.2 Storage Pattern
```js
// Đọc
const { chatops_settings: settings } = await chrome.storage.local.get('chatops_settings');

// Ghi (merge)
const existing = (await chrome.storage.local.get('chatops_settings'))?.chatops_settings || {};
await chrome.storage.local.set({ chatops_settings: { ...existing, ...partial } });
```

### 6.3 Internationalization Pattern
```js
// ĐÚNG: Import language object một lần, luôn có giá trị mới
import { language } from '../src/lang.js';
element.textContent = language.someKey; // luôn phản ánh ngôn ngữ hiện tại

// SAI: Lưu giá trị vào biến (sẽ bị stale sau khi đổi ngôn ngữ)
const label = language.someKey; // ❌ stale reference
```

### 6.4 MutationObserver Guard Pattern (trong content.js)
```js
// Khi inject button vào DOM, PHẢI disable observer trước
runWithObserverDisabled(() => {
  element.appendChild(newButton);
});
// Nếu không: observer sẽ detect DOM change → re-inject → vòng lặp vô hạn
```

### 6.5 React Textarea Insert Pattern
```js
// KHÔNG dùng: textarea.value = text (React sẽ ignore)
// ĐÚNG: dùng native setter + dispatch events
const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype, 'value'
).set;
nativeInputValueSetter.call(textarea, text);
textarea.dispatchEvent(new Event('input', { bubbles: true }));
textarea.dispatchEvent(new Event('change', { bubbles: true }));
```

### 6.6 API Call Pattern
```js
// Tất cả API calls đều qua src/api/client.js
// client.js tự động đọc credentials từ chrome.storage
import { request } from './client.js';

export async function someApiCall(params) {
  return request('/some/endpoint', {
    method: 'POST',
    body: JSON.stringify(params)
  });
}
```

### 6.7 Settings Access Pattern
```js
// Trong sidepanel: dùng getSettings() từ settings.tab.js
import { getSettings } from './tabs/settings.tab.js';
const settings = await getSettings();

// Trong content.js: dùng cachedSettings (được load khi khởi tạo)
// Không gọi chrome.storage trực tiếp trong hot paths
```

---

## 7. Quy Tắc Quan Trọng Khi Sửa Code

### ✅ PHẢI làm:
1. **Thêm i18n** cho mọi string hiển thị ra UI — thêm key vào cả `en` và `vi` trong `lang.js`, sau đó dùng `language.yourKey`.
2. **Dùng `MESSAGE_TYPES` constants** khi gửi/nhận messages — không hardcode string.
3. **Dùng `STORAGE_KEYS` constants** khi đọc/ghi storage.
4. **Return `true`** trong `onMessage` listener khi handler là async.
5. **Wrap DOM mutations** trong `runWithObserverDisabled()` khi đang trong content.js.
6. **Check `chrome.runtime.lastError`** sau mỗi API call tới chrome.runtime.
7. **Guard observer disconnect**: `if (!chrome.runtime?.id) { observer.disconnect(); return; }` khi extension bị reload.
8. **Cập nhật tài liệu (Markdown) khi thay đổi chức năng**: Mỗi khi thêm, sửa hoặc xóa bất kỳ tính năng/chức năng nào trong codebase, PHẢI cập nhật ngay lập tức tất cả các tệp tài liệu markdown liên quan (bao gồm `AGENTS.md`, `README.md`, `PRIVACY_POLICY.md` và các tệp tài liệu trong `.agents/docs/`). Đảm bảo thông tin tài liệu luôn khớp 100% với code thực tế.

### ❌ KHÔNG làm:
1. Không import từ `node_modules` — Extension không có bundler. Chỉ dùng libraries đã được bundled vào `sidepanel/`.
2. Không dùng `document.write()` hay unsafe innerHTML với user input — luôn dùng `escapeHtml()`.
3. Không thêm `<script src="...">` remote URLs vào manifest — CSP sẽ block.
4. Không lưu sensitive data (password) vào storage.
5. Không gọi API Mattermost trực tiếp từ content script — phải qua background worker.
6. Không dùng `eval()` hay dynamic code execution.

---

## 8. Cách Thêm Tính Năng Mới

### Thêm Message Type Mới
1. Thêm constant vào `src/constants.js` → `MESSAGE_TYPES`
2. Xử lý trong `src/background.js` → `chrome.runtime.onMessage` listener
3. Gọi từ content/sidepanel với `chrome.runtime.sendMessage({ type: MESSAGE_TYPES.NEW_TYPE, ... })`

### Thêm Setting Mới
1. Thêm default value vào `DEFAULT_SETTINGS` trong `sidepanel/tabs/settings.tab.js`
2. Thêm UI controls trong `sidepanel/sidepanel.html`
3. Thêm event listener trong `settings.tab.js` → `setup()`
4. Dùng setting qua `getSettings()` ở nơi cần

### Thêm Tab Mới
1. Tạo file `sidepanel/tabs/newtab.tab.js` với export `setup(state)` và optional `reset()`
2. Thêm HTML panel trong `sidepanel/sidepanel.html`
3. Import và register trong `sidepanel/sidepanel.js`
4. Thêm tab key vào `TABS` constant trong `src/constants.js`
5. Thêm i18n key trong `lang.js`

### Thêm API Endpoint Mới
1. Thêm function vào file phù hợp trong `src/api/` (hoặc tạo file mới)
2. Export từ `src/api/index.js`
3. Gọi từ background handler (KHÔNG gọi trực tiếp từ content script)

### Thêm Quick Action Button Mới
1. Thêm setting vào `floatingButtons` trong `DEFAULT_SETTINGS`
2. Thêm UI toggle trong settings.tab.js
3. Thêm button creation logic trong `injectQuickNoteButtons()` trong `content.js`
4. Thêm handler logic
5. Thêm i18n strings

---

## 9. Debugging Tips

### Debug Content Scripts
```js
// content.js dùng prefix để phân biệt logs
console.log('[ChatOps++]', 'message');
```

### Debug Background
- Vào `chrome://extensions` → ChatOps++ → "Service Worker" → DevTools

### Debug Side Panel
- Right-click trong side panel → Inspect

### Debug Storage
```js
// Console trong any DevTools context
chrome.storage.local.get(null, console.log);
chrome.storage.local.clear(); // Reset toàn bộ
```

### Kiểm tra Message Flow
```js
// Trong background DevTools console
chrome.runtime.onMessage.addListener((msg, sender) => {
  console.log('[DEBUG]', msg.type, msg, sender);
});
```

---

## 10. Phiên Bản & Cập Nhật

- **Version**: 3.5.9 (trong `manifest.json` và `package.json`)
- Khi bump version: cập nhật **cả hai** file.
- Extension dùng **Manifest V3** — không dùng persistent background page, không dùng `chrome.extension.getBackgroundPage()`.

---

## 11. Tài Liệu Chi Tiết

| Tài liệu | Nội dung |
|---|---|
| [architecture.md](.agents/docs/architecture.md) | Kiến trúc hệ thống đầy đủ, luồng dữ liệu |
| [background.md](.agents/docs/background.md) | Service Worker, alarms, cookie sync, panel manager |
| [content-scripts.md](.agents/docs/content-scripts.md) | Content scripts, React bridge, DOM injection |
| [sidepanel.md](.agents/docs/sidepanel.md) | Side panel, tabs, state management |
| [api.md](.agents/docs/api.md) | API layer, HTTP client |
| [utils.md](.agents/docs/utils.md) | Utilities, i18n, image conversion |
| [contributing.md](.agents/docs/contributing.md) | Hướng dẫn đóng góp, coding standards |
