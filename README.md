# 🏈 Fantasy Football Analyzer (FFA) — Live Draft Assistant & Analyzer

> **Version 0.9.2** — Modern, high-performance fantasy football draft analyzer and injected live ESPN draft overlay widget.

---

## ⚡ Overview

**Fantasy Football Analyzer (FFA)** provides real-time, pick-by-pick draft intelligence, value over replacement (VOR) analytics, tier drop warnings, and interactive medical injury analysis.

It functions as both a **standalone web application** and an **injected Chrome Extension widget (`FFA - Helper`)** that runs directly on top of active ESPN draft rooms with zero manual input required.

---

## 🔥 Key Features

### 1. Injected ESPN Draft Assistant Overlay (Extension v0.9.2)
- 🎯 **Injected Directly into ESPN**: Floating, draggable, and minimizable overlay widget running directly inside ESPN draft rooms (`https://fantasy.espn.com/football/*draft*`).
- 🟢 **Live Sync Status Dot Indicator**:
  - 🟡 **Loading / Connecting**: Fetching ESPN league details or connecting to draft feed.
  - 🟢 **Synced (Flashing Green)**: Active, real-time synchronization with live ESPN draft picks.
  - 🔴 **Offline (Red)**: Warning state if draft feed disconnects.
- 🩸 **Interactive Doctor Injury Hover Cards**:
  - Hovering/clicking red `Q` / `OUT` / `IR` tags opens a popover card with medical analysis, concern level (`LOW`, `MILD`, `MEDIUM`, `HIGH`), typical recovery time, expected return, and reinjury rate.
- 🎨 **Unified Design System**:
  - *Fraunces* serif italic player typography.
  - *PosBadge* left vertical accent bar and position color coding.
  - 14px NFL Team Logo images from Sleeper CDN.
  - Deep `#0e1117` ink black background with dashed grid lines and hidden scrollbars.
- 🔒 **Automatic Cookie Authentication**:
  - Parses `leagueId`, `seasonId`, `teamId`, and `memberId` from ESPN URL query parameters.
  - Queries ESPN's credentialed API using active browser cookies (`espn_s2`, `SWID`) to auto-load rosters and teams.

### 2. Season Draft Board View
- 📋 **Chronological Snake Flow**: View historical season drafts organized in exact 1st Round order (`1.01`, `1.02`, `1.03`...) with snake turn direction indicators (`→`, `←`, `↓`).
- 🧹 **Clean Interface**: Completely scrollbar-free design across all browsers.

### 3. Smart Pick Recommendation Engine
- 🚀 **VOR & Roster Need Calculations**: Recommends optimal picks based on positional scarcity, tier drop-offs, and roster starting requirements.

### 4. FLOCK & Custom Rankings Importer
- 📊 **Custom CSV Import**: Load custom rankings or FLOCK rankings (`Overall,Player,Position,Tier`) with instant validation.

---

## 🛠️ Installation & Setup

### Running the Web Application
```bash
# Install dependencies
npm install

# Start local dev server
npm run dev

# (Optional) Start WebSocket relay server for extension-to-app sync
npm run ws:relay
```

### Installing the Chrome Extension (`FFA - Helper` v0.9.2)
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked** and select the `/extension` directory from this project.
4. Navigate to any ESPN draft or mock draft (`https://fantasy.espn.com/football/draft...`).
5. The FFA Assistant widget will initialize in the bottom-right corner (minimized by default). Click `+` to expand!

---

## 📁 Repository Structure

```
├── extension/                   # Chrome Extension (v0.9.2)
│   ├── manifest.json            # Extension manifest (MV3)
│   ├── ffa_data.js              # Bundled 2026 player rankings & injury database
│   ├── injected_assistant.js    # Injected overlay logic & ESPN cookie auth
│   ├── injected_assistant.css   # Dark ink theme, PosBadges & typography
│   ├── inject.js                # ESPN WebSocket & fetch API extractor
│   └── content.js               # Isolated content script bridge
├── src/                         # React 19 Frontend Web Application
│   ├── components/              # SeasonDraftBoard, InjuryTagWithCard, PosBadge
│   ├── data/                    # draftPool.2026.json, player_injury.csv
│   ├── pages/                   # DraftPage, DraftRoomPage, RankingsPage
│   ├── utils/                   # playerNames, injuryData, snakeOrder
│   └── hooks/                   # useLiveDraftSync, useSuggestedPicks
└── scripts/                     # Build & conversion scripts
    └── buildExtensionBundle.ts  # Packages pool & injury data for extension
```

---

## 📜 License & Maintenance

Maintained under SOLID principles, clean code standards, and maintainability-first guidelines.
