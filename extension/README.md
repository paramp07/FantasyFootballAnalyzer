# Gridiron Copilot — Draft Sync Extension

This directory contains the Chrome/Firefox MV3 extension that bridges the gap between active fantasy sports draft rooms (**ESPN** and **Yahoo**) and the **Gridiron Copilot** analyzer web application.

---

## Why it Exists

Modern draft clients (especially Yahoo) enforce strict **Content Security Policies (CSP)** that block content scripts or standard webpage scripts from sending outgoing network requests to external APIs or `localhost` servers. 

The extension bypasses these restrictions using a background service worker to relay updates, and reads active draft rooms using isolated-world script injection.

---

## How it Works

The extension operates across three layers: the webpage's main javascript context, the extension content script sandbox, and the extension's background service worker.

```
┌──────────────────────────────────────┐
│        ESPN/Yahoo Draft Room         │ (MAIN World)
│ ┌──────────────────────────────────┐ │
│ │ inject.js / yahoo_inject.js      │ │ - Intercepts WebSockets/fetch requests
│ └─────────────────┬────────────────┘ │ - Parses DOM as a fallback
└───────────────────┼──────────────────┘
                    │ window.postMessage()
┌───────────────────▼──────────────────┐
│             content.js               │ (Isolated Content Script)
│ - Manages draft sync sessions        │
└───────────────────┬──────────────────┘
                    │ chrome.runtime.sendMessage()
┌───────────────────▼──────────────────┐
│           background.js              │ (Extension Service Worker)
│ - Bypasses page CSP (fetches API)    │ - Broadcasts picks to open React tabs
└─────────┬──────────────────┬─────────┘
          │ HTTP Request     │ chrome.tabs.sendMessage()
┌─────────▼─────────┐      ┌─▼──────────────────┐
│    Backend API    │      │    relay.js        │ (React App Tab Context)
│  (localhost/prod) │      │ - Fires custom DOM │
└───────────────────┘      │   event to React   │
                           └────────────────────┘
```

### 1. Injected Scripts (`inject.js` & `yahoo_inject.js`)
* Runs in the webpage's `MAIN` execution context at `document_start` so it can intercept connections before they initialize.
* **WebSocket Teeing:** Overrides the global `window.WebSocket` constructor to read incoming JSON frames containing draft actions.
* **Fetch Interception:** Overrides `window.fetch` to capture settings/rosters loaded from private API endpoints.
* **DOM Scraping (Fallback):** Scrapes active table elements (like ESPN's `.fixedDataTableRowLayout_rowWrapper`). It reads player headshot image URLs to resolve exact ESPN Player IDs instead of relying on fragile name matching.

### 2. The Isolated Bridge (`content.js`)
* Receives raw snapshot updates from the page context via `window.postMessage`.
* Handles session management: checks if a session exists, initializes a new session on `/api/espn/draft/session` if needed, and pushes updates periodically (every 2 seconds) to `/api/espn/draft/{sessionId}/picks`.

### 3. Background Service Worker (`background.js`)
* Receives messages from `content.js` and performs the actual fetch requests. Because it is a service worker, it executes requests in the extension context and is entirely bypasses the host page's CSP limitations.
* Automatically refreshes Supabase auth sessions mid-draft if the backend returns a `401 Unauthorized` response.
* Queries open browser tabs to detect if the React app is active, and sends a tab message with draft updates down to the matching tab.

### 4. App Relay (`content-scripts/relay.js`)
* Injected into the React app domains (e.g. `localhost:5173`, `fantasyfootballanalyzer.app`).
* Receives tab messages from `background.js` and dispatches standard DOM events (`DRAFT_PICKS_UPDATE`), which the React app's `useLiveDraftSync.ts` hook listens to for real-time state synchronization.

---

## Local Development & Installation

### Chrome / Edge / Brave
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select this `extension/` directory.
4. Copy the extension ID shown on the loaded card and add it to your local environment file:
   ```env
   VITE_ESPN_EXTENSION_ID=your_extension_id_here
   ```
5. Reload your local React app (`npm run dev`). The "Auto-fill from extension" button will now appear on the ESPN setup page.

### Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...** and select the `manifest.json` file inside the `extension/` directory.

---

## Security Model
* **Scope Limits:** The extension only asks for host permissions matching `*.espn.com`, `*.go.com`, and `*.fantasysports.yahoo.com` to query cookies or interact with drafts. It cannot read data from other domains.
* **Secure Origins:** Cookie auto-fill data is only shared with trusted origins defined in `manifest.json` under `externally_connectable` (localhost, Krool's github pages, and the production domain).
