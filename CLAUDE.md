# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

ChatOps++ is a Chrome/Edge/Opera Manifest V3 extension for Mattermost at `https://chat.runsystem.vn`. It is a no-bundler, vanilla JavaScript ESM application. The extension adds tasks and reminders, notes, advanced search, mention tracking, image/Giphy tools, quick reactions, settings, and a Kanban overlay.

The main runtime surfaces are:

- **Service worker**: `chrome-extension/src/background.js` handles runtime messages, Mattermost API access, cookie synchronization, alarms, notifications, side-panel management, and Google Meet/Kanban-related browser actions.
- **Content scripts**: `chrome-extension/content/loader.js` loads `content.js` on Mattermost pages. `content.js` injects UI and quick actions into Mattermost, observes DOM changes, and communicates with the service worker. `inject.js` runs in the page's main world to bridge Mattermost's React/Redux internals where needed.
- **Side panel**: `chrome-extension/sidepanel/sidepanel.html` and `sidepanel.js` provide the extension UI. Feature-specific behavior is split into `sidepanel/tabs/*.tab.js`; shared panel state and persistence live in `state.js` and `persistence.js`.
- **Shared modules**: `src/constants.js` contains message/storage constants, `src/lang.js` contains Vietnamese and English UI strings, `src/api/` wraps Mattermost endpoints, and `src/utils/` contains formatting, date, UI, channel, and image helpers.
- **Kanban overlay**: `chrome-extension/kanban/` is a separately rendered overlay UI backed by its own `kanban.js`, `api.js`, and drag/drop code. It is exposed through the extension manifest and toggled through runtime messaging.

The extension is loaded unpacked from `chrome-extension/`. There is no compile or bundle step; files referenced by `manifest.json` must remain directly runnable in the browser.

## Common commands

Run commands from `chrome-extension/` unless noted otherwise:

```bash
cd chrome-extension
npm install       # Usually unnecessary: package.json has no runtime dependencies
npm run lint      # Currently only prints that no linter is configured
npm run icons     # Placeholder reminder for icon files
```

There is currently no configured build command or automated test suite. The primary development verification is manual browser testing:

1. Open `chrome://extensions` and enable Developer mode.
2. Load or reload the unpacked `chrome-extension/` directory.
3. Use the reload procedure appropriate to the changed surface:
   - content files: reload the Mattermost page;
   - side-panel files: close and reopen the side panel;
   - service-worker/background files or `manifest.json`: click the extension Reload button, then reload the page.

There is no single-test command at present. For debugging, inspect the service worker from `chrome://extensions`, inspect the side panel directly, and use the Mattermost page DevTools console for content-script logs (normally prefixed `[ChatOps++]`).

## Implementation rules that matter

- Use `MESSAGE_TYPES` and `STORAGE_KEYS` from `src/constants.js`; do not introduce hard-coded runtime message or storage key strings.
- Route Mattermost API calls through `src/api/client.js` and the API modules. Content scripts must message the background worker rather than calling Mattermost APIs directly. Side-panel code may use the API layer in the extension context.
- Async `chrome.runtime.onMessage` handlers must return `true` while using `sendResponse`. Check `chrome.runtime.lastError` after runtime API calls.
- Add every user-visible string to both language dictionaries in `src/lang.js` and use the `language` object. Do not cache individual translated values across language changes.
- Content-script DOM mutations that can trigger the `MutationObserver` must be wrapped with `runWithObserverDisabled()` to prevent reinjection loops.
- Escape user-controlled content before inserting it into HTML. Do not use remote scripts, `eval`, or dynamic code execution.
- Read/write settings through the existing settings helpers (`getSettings()` in the side panel and the content script's cached settings in hot paths). Preserve the existing storage merge behavior.
- Keep all extension code compatible with Manifest V3 and direct browser ESM loading. Do not add imports from `node_modules` unless the dependency is bundled into the extension first.
- When changing a feature, update the related Markdown documentation required by `AGENTS.md` (including `README.md`, `PRIVACY_POLICY.md`, and relevant `.agents/docs/` files).

## Adding or changing features

- **New message flow**: add a constant in `src/constants.js`, handle it in `src/background.js`, then send it from content/side-panel code.
- **New setting**: add its default in `sidepanel/tabs/settings.tab.js`, add controls in `sidepanel/sidepanel.html`, wire events in `settings.tab.js`, and consume it through the existing settings access pattern.
- **New side-panel tab**: create a tab module with the existing setup/reset contract, add its panel markup, register it in `sidepanel.js`, add its tab key to `src/constants.js`, and add translations.
- **New API endpoint**: add it to the appropriate module in `src/api/`, export it from `src/api/index.js`, and invoke it through the background message flow when the caller is a content script.

For the detailed message catalog, storage schema, component-specific workflows, and coding examples, consult `AGENTS.md` and the focused documents under `.agents/docs/` before making non-trivial changes.
