# Contributing Guide — ChatOps++

> Hướng dẫn đóng góp code cho dự án ChatOps++ Chrome Extension.

---

## 1. Chuẩn Bị Môi Trường

### Yêu Cầu

- **Chrome** / Chromium browser (phiên bản mới nhất)
- **Node.js** (không bắt buộc — không có build step)
- **Git**

### Load Extension (Development)

1. Mở Chrome, vào `chrome://extensions`
2. Bật **Developer mode** (toggle góc trên phải)
3. Click **"Load unpacked"**
4. Chọn thư mục: `.../chatops_mcp/chrome-extension/`

### Reload Sau Khi Sửa Code

| Loại thay đổi | Cách reload |
|---|---|
| `content.js`, `content.css` | Reload trang Mattermost (Ctrl+R) |
| `sidepanel/*.js`, `sidepanel/*.html` | Click icon extension để close panel → open lại |
| `src/background.js`, `src/background/*` | `chrome://extensions` → "↺ Reload" trên ChatOps++ |
| `manifest.json` | "↺ Reload" + reload trang |
| `src/constants.js`, `src/lang.js`, `src/api/*` | Tùy theo file được dùng ở đâu |

**Tip:** Loader.js thêm `?t=Date.now()` cache-buster nên `content.js` sẽ luôn được reload.

---

## 2. Cấu Trúc & Coding Standards

### File Organization

```
Mỗi tính năng lớn → file riêng trong tabs/
Shared logic     → src/utils/ hoặc src/api/
Constants        → src/constants.js (MỌI constant đều phải ở đây)
Strings UI       → src/lang.js (MỌI text hiển thị)
```

### Naming Conventions

```js
// Variables: camelCase
const myVariableName = ...

// Constants: UPPER_SNAKE_CASE
const MAX_ITEMS = 20;

// Functions: camelCase động từ
function loadTasks() { ... }
function renderTaskCard(task) { ... }
function handleDeleteClick(e) { ... }

// CSS classes: kebab-case với prefix chatops-
.chatops-action-group
.chatops-task-card
.chatops-quick-note-btn

// HTML IDs: kebab-case với prefix chatops-
#chatops-panel-btn
#chatops-toast-container
```

### JavaScript Style

```js
// ✅ Dùng const/let, không dùng var
const url = getUrl();
let count = 0;

// ✅ Arrow functions cho callbacks ngắn
items.forEach(item => processItem(item));

// ✅ Async/await thay vì Promise chain
const result = await someAsyncFn();

// ✅ Destructuring
const { id, name, type } = channel;

// ✅ Template literals
const msg = `Found ${count} items in ${channel.name}`;

// ✅ Optional chaining
const name = user?.profile?.first_name;

// ✅ Nullish coalescing
const url = config?.chatopsUrl ?? DEFAULT_URL;
```

### CSS Variables Pattern

Tất cả màu sắc và spacing PHẢI dùng CSS variables để hỗ trợ theming:

```css
/* ✅ Đúng */
.chatops-btn {
  background-color: var(--chatops-accent);
  color: var(--chatops-accent-text);
  padding: var(--chatops-padding);
}

/* ❌ Sai */
.chatops-btn {
  background-color: #5865f2;
  color: white;
  padding: 14px;
}
```

**CSS Variables được define bởi `applyThemeToDOM()`:**
- `--chatops-accent` — Màu chính
- `--chatops-accent-text` — Text trên accent background
- `--chatops-header` — Màu header
- `--chatops-nav` — Màu nav sidebar
- `--chatops-padding` — App padding
- `--chatops-tab-text` — Tab text color

---

## 3. Quy Tắc Bắt Buộc

### Rule 1: I18n Cho Mọi String UI

```js
// ❌ Hardcode string
button.textContent = 'Save';
element.title = 'Delete this item';

// ✅ Dùng language object
button.textContent = language.save;
element.title = language.deleteTooltip;
```

Khi thêm string mới:
1. Thêm key vào `const en = { ... }` trong `lang.js`
2. Thêm key vào `const vi = { ... }` trong `lang.js`
3. Dùng `language.yourKey` trong code

### Rule 2: Dùng MESSAGE_TYPES Constants

```js
// ❌ Hardcode string
chrome.runtime.sendMessage({ type: 'SPAM_REACTIONS' });

// ✅ Dùng constant
import { MESSAGE_TYPES } from '../src/constants.js';
chrome.runtime.sendMessage({ type: MESSAGE_TYPES.SPAM_POST_REACTIONS });
```

### Rule 3: Return True Cho Async Message Handlers

```js
// ❌ Thiếu return true → sendResponse sẽ fail
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  const result = await someAsyncFn();
  sendResponse(result);
});

// ✅ return true để giữ channel mở
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  someAsyncFn().then(result => sendResponse(result));
  return true; // QUAN TRỌNG
});
```

### Rule 4: Escape HTML Khi Render User Content

```js
// ❌ XSS vulnerability
element.innerHTML = `<div>${userContent}</div>`;

// ✅ Escape trước
import { escapeHtml } from '../src/utils/formatter.js';
element.innerHTML = `<div>${escapeHtml(userContent)}</div>`;
```

### Rule 5: runWithObserverDisabled Khi Mutate DOM

```js
// ❌ Sẽ trigger observer loop
post.appendChild(actionGroup);

// ✅ Disable observer trong khi mutate
runWithObserverDisabled(() => {
  post.appendChild(actionGroup);
});
```

### Rule 6: Không Gọi API Từ Content Scripts

```js
// ❌ Content script không nên gọi Mattermost API trực tiếp
// (credentials không available, CORS issues có thể xảy ra)
const users = await searchUsers('john'); // ← Sai

// ✅ Gửi message tới background
chrome.runtime.sendMessage({
  type: MESSAGE_TYPES.RESOLVE_DISPLAY_NAME,
  displayName: 'John Doe'
}, (response) => {
  const { username } = response;
});
```

> **Ngoại lệ:** Sidepanel tabs CÓ THỂ import và gọi API trực tiếp vì chúng chạy trong context extension (có credentials từ storage).

---

## 4. Thêm Tính Năng Mới

### Thêm Quick Action Button

1. **Thêm setting toggle** trong `settings.tab.js`:
```js
// DEFAULT_SETTINGS
floatingButtons: {
  yourNewFeature: true  // ← Thêm vào đây
}
```

2. **Thêm UI checkbox** trong `sidepanel.html`:
```html
<label>
  <input type="checkbox" id="btn-your-new-feature">
  <span data-i18n="yourNewFeature"></span>
</label>
```

3. **Bind event** trong `settings.tab.js` → `setup()`:
```js
document.getElementById('btn-your-new-feature').addEventListener('change', e => {
  updateSettings({ floatingButtons: { yourNewFeature: e.target.checked } });
});
```

4. **Thêm button** trong `content.js` → `injectQuickNoteButtons()`:
```js
if (settings.floatingButtons?.yourNewFeature !== false) {
  const btn = document.createElement('button');
  btn.className = 'chatops-quick-note-btn chatops-your-new-btn';
  btn.title = language.yourNewFeatureTooltip;
  btn.textContent = '🆕';
  btn.addEventListener('click', () => {
    handleYourNewFeature(postEl);
  });
  buttons.push({ el: btn, order: 9 }); // order xác định vị trí
}
```

5. **Thêm i18n strings**:
```js
// lang.js → en
yourNewFeature: 'New Feature',
yourNewFeatureTooltip: 'Do something new',

// lang.js → vi
yourNewFeature: 'Tính năng mới',
yourNewFeatureTooltip: 'Làm điều gì đó mới',
```

### Thêm Tab Mới

1. **Tạo file** `sidepanel/tabs/newtab.tab.js`:
```js
import { language } from '../../src/lang.js';
import { showLoading, showError } from '../../src/utils/index.js';

let _state = null;

export async function setup(state) {
  _state = state;
  // Bind event listeners
  document.getElementById('your-tab-btn').addEventListener('click', handleClick);
  // Initial load
  await load();
}

export async function reset() {
  // Called khi user switch away từ tab này (optional)
}

async function load() {
  // Load data và render
}
```

2. **Thêm HTML panel** trong `sidepanel.html`:
```html
<div id="panel-newtab" class="tab-panel" style="display:none">
  <!-- Content -->
</div>
```

3. **Thêm nav button** trong `sidepanel.html`:
```html
<button id="tab-newtab" class="tab-btn" data-tab="newtab">
  <span data-i18n="newTabLabel"></span>
</button>
```

4. **Import và register** trong `sidepanel.js`:
```js
import * as newTab from './tabs/newtab.tab.js';

// Trong init():
await newTab.setup(state);
```

5. **Thêm vào TABS constant** trong `src/constants.js`:
```js
TABS: {
  // existing...
  NEWTAB: 'newtab'
}
```

### Thêm API Endpoint Mới

1. **Tạo/sửa file** trong `src/api/`:
```js
// src/api/yourfeature.js
import { request } from './client.js';

export async function getYourData(params) {
  return request(`/your/endpoint?param=${params.value}`);
}

export async function createYourData(data) {
  return request('/your/endpoint', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

2. **Export** từ `src/api/index.js`:
```js
export * from './yourfeature.js';
```

3. **Thêm message handler** trong `src/background.js` (nếu cần gọi từ content script):
```js
case MESSAGE_TYPES.YOUR_FEATURE_ACTION: {
  try {
    const result = await getYourData(message.params);
    sendResponse({ success: true, data: result });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
  return true;
}
```

4. **Thêm MESSAGE_TYPE** trong `src/constants.js`:
```js
MESSAGE_TYPES: {
  // existing...
  YOUR_FEATURE_ACTION: 'YOUR_FEATURE_ACTION'
}
```

---

## 5. Testing

### Manual Testing Checklist

Sau khi thay đổi, kiểm tra:

- [ ] Extension load không có error trong console
- [ ] Tính năng hoạt động trên trang Mattermost
- [ ] Không có infinite loop trong MutationObserver
- [ ] Không có memory leak (sidebar buttons không bị duplicate)
- [ ] Settings được lưu và load đúng
- [ ] I18n: switch sang EN/VI vẫn hiển thị đúng
- [ ] PWA mode (nếu có) vẫn hoạt động

### Debugging Tools

```bash
# Check background script errors
chrome://extensions → ChatOps++ → "Service Worker" → Console

# Check content script errors
F12 trên trang Mattermost → Console → Filter "[ChatOps"

# Check storage
chrome://extensions → ChatOps++ → Service Worker Console:
chrome.storage.local.get(null, console.log)

# Force clear storage (reset)
chrome.storage.local.clear()
```

### Common Issues

| Triệu chứng | Nguyên nhân | Giải pháp |
|---|---|---|
| Buttons inject nhiều lần | Thiếu `data-chatops-injected` guard | Thêm check và setAttribute |
| Settings không lưu | Quên return true trong async handler | Thêm `return true` |
| Language không update | String cứng không dùng `language.key` | Dùng `language.key` |
| API call fail | Extension context invalidated | Check `chrome.runtime?.id` |
| Observer loop | Mutate DOM mà không disable observer | Dùng `runWithObserverDisabled()` |

---

## 6. Versioning

### Khi Nào Bump Version

- **Patch** (x.x.Z): Bug fix, small UI tweaks
- **Minor** (x.Y.0): New feature
- **Major** (X.0.0): Breaking changes, major overhaul

### Cách Bump Version

Cập nhật **cả 2** file:

```json
// manifest.json
{ "version": "3.6.0" }

// package.json
{ "version": "3.6.0" }
```

---

## 7. Git Workflow

```bash
# Tạo branch mới cho feature
git checkout -b feature/your-feature-name

# Commit với prefix rõ ràng
git commit -m "feat: add new button for X"
git commit -m "fix: prevent observer loop when injecting buttons"
git commit -m "docs: update AGENTS.md with new message types"
git commit -m "refactor: extract helper function from content.js"
git commit -m "style: fix alignment of action buttons"
git commit -m "chore: bump version to 3.6.0"
```

### Commit Prefixes

| Prefix | Khi nào dùng |
|---|---|
| `feat:` | Thêm tính năng mới |
| `fix:` | Fix bug |
| `docs:` | Chỉ sửa documentation |
| `refactor:` | Cải thiện code mà không thay đổi behavior |
| `style:` | CSS/formatting changes |
| `chore:` | Maintenance (version bump, config) |
| `perf:` | Performance improvements |

---

## 8. Tổng Kết

Khi làm việc với codebase này, luôn nhớ:

1. **Đọc `src/constants.js` trước** — Mọi constant đều ở đây
2. **Check `lang.js`** trước khi thêm text mới — Có thể đã tồn tại
3. **Test trên PWA mode** nếu thay đổi liên quan tới panel
4. **Dùng DevTools profiler** nếu thêm code vào MutationObserver callback
5. **Tham khảo [AGENTS.md](../../AGENTS.md)** cho patterns và conventions
