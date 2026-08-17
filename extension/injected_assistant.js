// FFA Injected Draft Assistant for ESPN
;(() => {
  if (window.__ffaAssistantInjected) return;

  // Only run on draft or mock draft pages
  function isDraftPage() {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    const isMatch = (
      path.includes('/draft') ||
      path.includes('/mock') ||
      search.includes('leagueid=') ||
      document.querySelector('.draft-room') !== null ||
      document.querySelector('[class*="draft"]') !== null
    );
    console.log('[FFA Assistant] Context check -> path:', path, '| search:', search, '| isMatch:', isMatch);
    return isMatch;
  }

  if (!isDraftPage()) {
    console.log('[FFA Assistant] Not an ESPN draft page. Injected overlay dormant.');
    return;
  }

  window.__ffaAssistantInjected = true;
  console.log('[FFA Assistant] Initializing injected overlay on ESPN Draft Room...');

  // State
  let activeTab = 'available'; // 'available' | 'recommended' | 'roster'
  let activePos = 'ALL';
  let searchQuery = '';

  // Default MINIMIZED (true) unless user explicitly saved 'false' in localStorage
  const savedMin = localStorage.getItem('ffa_assistant_minimized');
  let isMinimized = savedMin === null ? true : savedMin === 'true';

  let activeInjuryPopover = null;

  // Sync status tracking
  let syncStatus = 'loading'; // 'loading' | 'synced' | 'offline'
  let lastMessageTime = 0;

  // Track drafted players
  const draftedPlayerKeys = new Set();
  const draftedIds = new Set();
  let mySlot = null;
  let teamsData = [];
  let picksData = [];

  // Pos Helpers
  const FLEX_POS = new Set(['RB', 'WR', 'TE']);

  function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function getMatchKey(name, pos) {
    const cleanPos = (pos || '').toUpperCase();
    const basePos = (cleanPos === 'DEF' || cleanPos === 'D/ST') ? 'DST' : cleanPos;
    return `${normalizeName(name)}|${basePos}`;
  }

  function updateSyncStatus(status, customTitle) {
    syncStatus = status;
    const dot = document.getElementById('ffa-sync-dot');
    if (!dot) return;

    dot.className = `ffa-sync-dot ffa-sync-${status}`;
    if (status === 'synced') {
      dot.title = customTitle || 'Live sync active · Synchronized with ESPN draft room';
    } else if (status === 'loading') {
      dot.title = customTitle || 'Connecting to ESPN draft feed...';
    } else {
      dot.title = customTitle || 'Sync offline · Waiting for ESPN draft room message';
    }
    console.log('[FFA Assistant] Sync status updated ->', status, '| Title:', dot.title);
  }

  // Health check timer for sync status
  setInterval(() => {
    if (syncStatus === 'synced' && lastMessageTime > 0 && Date.now() - lastMessageTime > 15000) {
      console.log('[FFA Assistant] No live message received in 15 seconds. Transitioning status to offline.');
      updateSyncStatus('offline', 'Sync offline · No snapshot received in 15 seconds');
    }
  }, 4000);

  function isPlayerDrafted(p) {
    if (
      (p.id && draftedIds.has(String(p.id))) ||
      (p.espnId && draftedIds.has(String(p.espnId))) ||
      (p.sleeperId && draftedIds.has(String(p.sleeperId)))
    ) {
      return true;
    }
    const k1 = getMatchKey(p.name, p.pos);
    const k2 = normalizeName(p.name);
    if (draftedPlayerKeys.has(k1) || draftedPlayerKeys.has(k2)) {
      return true;
    }
    if (p.pos === 'DST' || p.pos === 'DEF') {
      const pClean = normalizeName(p.name).replace(/(dst|defense|def)/gi, '');
      for (const key of draftedPlayerKeys) {
        const keyClean = key.replace(/(dst|defense|def)/gi, '');
        if (keyClean && pClean && (keyClean.includes(pClean) || pClean.includes(keyClean))) {
          return true;
        }
      }
    }
    return false;
  }

  // Lookup injury data
  function getInjuryDetail(player) {
    const injuries = window.FFA_INJURY_DATA || [];
    if (!injuries.length) return null;

    if (player.sleeperId) {
      const match = injuries.find(i => i.sleeperId === String(player.sleeperId));
      if (match) return match;
    }
    const key = normalizeName(player.name);
    return injuries.find(i => normalizeName(i.playerName) === key) || null;
  }

  // Auto Load ESPN League Data using URL parameters & Browser Session Cookies
  async function autoLoadESPNLeague() {
    try {
      updateSyncStatus('loading', 'Connecting to ESPN draft feed...');

      const q = new URLSearchParams(window.location.search);
      const leagueId = q.get('leagueId');
      const seasonId = q.get('seasonId') || new Date().getFullYear();
      const myTeamId = q.get('teamId');

      console.log('[FFA Assistant] URL Params parsed -> leagueId:', leagueId, '| seasonId:', seasonId, '| teamId:', myTeamId);

      if (myTeamId) mySlot = Number(myTeamId);

      if (!leagueId) {
        console.log('[FFA Assistant] No leagueId found in URL search params. Waiting for live inject messages...');
        return;
      }

      console.log(`[FFA Assistant] Auto-fetching ESPN League #${leagueId} (Season ${seasonId}) with browser cookies...`);

      const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${seasonId}/segments/0/leagues/${leagueId}?view=mRoster&view=mSettings&view=mTeam&view=mDraftDetail`;

      const resp = await fetch(url, { credentials: 'include' });
      console.log('[FFA Assistant] ESPN lm-api-reads HTTP response status:', resp.status);

      if (!resp.ok) {
        updateSyncStatus('offline', 'Failed to fetch league data from ESPN');
        return;
      }

      const data = await resp.json();
      console.log('[FFA Assistant] ESPN League API data received:', data);

      if (!data) return;

      if (Array.isArray(data.teams)) {
        teamsData = data.teams.map(t => ({
          id: t.id,
          slot: t.id,
          name: t.location && t.nickname ? `${t.location} ${t.nickname}` : t.name || `Team ${t.id}`,
          abbrev: t.abbrev,
        }));

        data.teams.forEach(t => {
          if (t.roster && Array.isArray(t.roster.entries)) {
            t.roster.entries.forEach(entry => {
              const pid = entry.playerId || entry.playerPoolEntry?.player?.id;
              if (pid) draftedIds.add(String(pid));
              const pName = entry.playerPoolEntry?.player?.fullName;
              const pPos = entry.playerPoolEntry?.player?.defaultPositionId;
              if (pName) {
                draftedPlayerKeys.add(normalizeName(pName));
                draftedPlayerKeys.add(getMatchKey(pName, pPos));
              }
            });
          }
        });
      }

      if (data.draftDetail && Array.isArray(data.draftDetail.picks)) {
        data.draftDetail.picks.forEach(pick => {
          if (pick.playerId) draftedIds.add(String(pick.playerId));
        });
      }

      console.log(`[FFA Assistant] ESPN League #${leagueId} loaded successfully with ${draftedIds.size} drafted player IDs.`);
      updateSyncStatus('synced', 'Live sync active · ESPN League loaded');
      renderContent();
    } catch (err) {
      console.log('[FFA Assistant] League auto-load error:', err);
    }
  }

  // Connect to WebSocket relay server fallback if running
  function connectWebSocketRelay() {
    try {
      console.log('[FFA Assistant] Attempting connection to WebSocket relay (ws://localhost:8000/ws)...');
      const ws = new WebSocket('ws://localhost:8000/ws');

      ws.onopen = () => {
        console.log('[FFA Assistant] Connected to WebSocket relay server!');
        lastMessageTime = Date.now();
        updateSyncStatus('synced', 'Live sync active · Connected to WebSocket relay');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('[FFA Assistant] WebSocket message received:', msg);
          if (msg.type === 'picks_update' || msg.picks) {
            const picks = msg.picks || msg.payload?.picks || [];
            picks.forEach(pick => {
              const id = pick.player_id || pick.playerId || pick.id;
              if (id) draftedIds.add(String(id));
              const name = pick.player_name || pick.playerName || pick.name;
              const pos = pick.position || pick.pos;
              if (name) {
                draftedPlayerKeys.add(getMatchKey(name, pos));
                draftedPlayerKeys.add(normalizeName(name));
              }
            });
            lastMessageTime = Date.now();
            updateSyncStatus('synced', 'Live sync active · Pick update received');
            renderContent();
          }
        } catch (e) {
          console.log('[FFA Assistant] WebSocket parse error:', e);
        }
      };

      ws.onerror = (err) => {
        console.log('[FFA Assistant] WebSocket relay not active (ignoring):', err);
      };

      ws.onclose = () => {
        console.log('[FFA Assistant] WebSocket relay disconnected.');
      };
    } catch (err) {
      console.log('[FFA Assistant] WebSocket init error:', err);
    }
  }

  // Inject DOM Widget Box
  function injectWidget() {
    if (document.getElementById('ffa-assistant-overlay')) return;

    console.log('[FFA Assistant] Injecting DOM overlay box...');

    const box = document.createElement('div');
    box.id = 'ffa-assistant-overlay';
    box.className = `ffa-assistant-box ${isMinimized ? 'ffa-minimized' : ''}`;

    const savedPos = localStorage.getItem('ffa_assistant_pos');
    if (savedPos) {
      try {
        const { top, left } = JSON.parse(savedPos);
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        box.style.bottom = 'auto';
        box.style.right = 'auto';
      } catch (e) {
        /* fallback to CSS bottom-right */
      }
    }

    box.innerHTML = `
      <div class="ffa-header" id="ffa-assistant-header">
        <div class="ffa-header-title">
          <span class="ffa-sync-dot ffa-sync-loading" id="ffa-sync-dot" title="Connecting to ESPN draft feed..."></span>
          <span class="ffa-logo-badge">FFA</span>
          <span>DRAFT ASSISTANT</span>
        </div>
        <div class="ffa-header-controls">
          <button class="ffa-btn-icon" id="ffa-btn-minimize" title="${isMinimized ? 'Expand' : 'Minimize'}">${isMinimized ? '+' : '—'}</button>
        </div>
      </div>

      <div class="ffa-tabs">
        <button class="ffa-tab-btn ${activeTab === 'available' ? 'ffa-active' : ''}" data-tab="available">TIERS & AVAILABLE</button>
        <button class="ffa-tab-btn ${activeTab === 'recommended' ? 'ffa-active' : ''}" data-tab="recommended">RECOMMENDED</button>
        <button class="ffa-tab-btn ${activeTab === 'roster' ? 'ffa-active' : ''}" data-tab="roster">MY TEAM</button>
      </div>

      <div class="ffa-content" id="ffa-assistant-content">
        <!-- Rendered dynamically -->
      </div>
    `;

    document.body.appendChild(box);

    setupDrag(box);

    const minimizeBtn = box.querySelector('#ffa-btn-minimize');
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      localStorage.setItem('ffa_assistant_minimized', String(isMinimized));
      box.classList.toggle('ffa-minimized', isMinimized);
      minimizeBtn.textContent = isMinimized ? '+' : '—';
      minimizeBtn.title = isMinimized ? 'Expand' : 'Minimize';
      console.log('[FFA Assistant] Minimize toggled -> isMinimized:', isMinimized);
    });

    box.querySelectorAll('.ffa-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        box.querySelectorAll('.ffa-tab-btn').forEach(b => b.classList.toggle('ffa-active', b.dataset.tab === activeTab));
        renderContent();
      });
    });

    updateSyncStatus(syncStatus);
    renderContent();
  }

  // Drag handler
  function setupDrag(box) {
    const header = box.querySelector('#ffa-assistant-header');
    let isDragging = false;
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ffa-btn-icon')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = box.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      box.style.bottom = 'auto';
      box.style.right = 'auto';
      box.style.left = `${initialLeft}px`;
      box.style.top = `${initialTop}px`;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(0, Math.min(window.innerWidth - box.offsetWidth, initialLeft + dx));
      const newTop = Math.max(0, Math.min(window.innerHeight - box.offsetHeight, initialTop + dy));

      box.style.left = `${newLeft}px`;
      box.style.top = `${newTop}px`;
    }

    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);

      const rect = box.getBoundingClientRect();
      localStorage.setItem('ffa_assistant_pos', JSON.stringify({ top: rect.top, left: rect.left }));
    }
  }

  // Main Content Renderer
  function renderContent() {
    const content = document.getElementById('ffa-assistant-content');
    if (!content) return;

    if (activeTab === 'available') {
      renderAvailableTab(content);
    } else if (activeTab === 'recommended') {
      renderRecommendedTab(content);
    } else if (activeTab === 'roster') {
      renderRosterTab(content);
    }
  }

  // Available Players & Tiers Tab
  function renderAvailableTab(container) {
    const pool = window.FFA_DRAFT_POOL || [];

    let available = pool.filter(p => !isPlayerDrafted(p));

    if (activePos !== 'ALL') {
      if (activePos === 'FLEX') {
        available = available.filter(p => FLEX_POS.has(p.pos));
      } else {
        available = available.filter(p => p.pos === activePos);
      }
    }

    if (searchQuery.trim()) {
      const q = normalizeName(searchQuery);
      available = available.filter(p => normalizeName(p.name).includes(q) || (p.team && p.team.toLowerCase().includes(q)));
    }

    const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DST'];

    container.innerHTML = `
      <div class="ffa-filter-bar">
        ${positions.map(pos => `
          <button class="ffa-pos-chip ${activePos === pos ? 'ffa-active' : ''}" data-pos="${pos}">${pos}</button>
        `).join('')}
      </div>
      <div class="ffa-search-box">
        <input type="text" class="ffa-search-input" placeholder="Search available players..." value="${searchQuery}" id="ffa-search-input" />
      </div>
      <div class="ffa-player-list" id="ffa-player-list">
        <!-- Players -->
      </div>
    `;

    container.querySelectorAll('.ffa-pos-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activePos = chip.dataset.pos;
        renderContent();
      });
    });

    const searchInput = container.querySelector('#ffa-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderPlayerList(container.querySelector('#ffa-player-list'), available);
    });

    renderPlayerList(container.querySelector('#ffa-player-list'), available);
  }

  // Render Grouped Player List with Tiers & Injury Tags
  function renderPlayerList(listContainer, players) {
    if (!players.length) {
      listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--ffa-bone-dim); font-size: 11px;">No available players match filters.</div>`;
      return;
    }

    const tiers = new Map();
    players.forEach(p => {
      const t = p.tier || 1;
      if (!tiers.has(t)) tiers.set(t, []);
      tiers.get(t).push(p);
    });

    let html = '';
    const sortedTiers = Array.from(tiers.keys()).sort((a, b) => a - b);

    sortedTiers.forEach(tierNum => {
      const tierPlayers = tiers.get(tierNum);
      html += `
        <div class="ffa-tier-header">
          <span>TIER ${tierNum}</span>
          <span style="color: var(--ffa-bone-dim); font-weight: 400;">${tierPlayers.length} AVAILABLE</span>
        </div>
      `;

      tierPlayers.forEach((p, idx) => {
        const isLastInTier = idx === tierPlayers.length - 1;
        const injury = getInjuryDetail(p);

        html += `
          <div class="ffa-player-row" data-id="${p.id}">
            <div class="ffa-player-left">
              <span class="ffa-rank-num">#${p.overallRank}</span>
              <span class="ffa-pos-badge ffa-pos-${p.pos}">${p.pos}${p.posRank || ''}</span>
              <div class="ffa-player-info">
                <div class="ffa-player-name-row">
                  <span class="ffa-player-name" title="${p.name}">${p.name}</span>
                  ${isLastInTier ? `<span class="ffa-tier-break-tag">LAST IN TIER</span>` : ''}
                  ${injury ? `<span class="ffa-injury-tag" data-injury-id="${p.id}">Q</span>` : ''}
                </div>
                <span class="ffa-player-sub">${p.team || 'FA'} · Bye ${p.bye ?? '-'}</span>
              </div>
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--ffa-bone-dim);">
              ${p.adp ? `ADP ${Math.round(p.adp)}` : ''}
            </div>
          </div>
        `;
      });
    });

    listContainer.innerHTML = html;

    listContainer.querySelectorAll('.ffa-injury-tag').forEach(tag => {
      tag.addEventListener('mouseenter', (e) => {
        const playerId = tag.dataset.injuryId;
        const player = players.find(p => p.id === playerId);
        const injury = getInjuryDetail(player);
        if (injury) {
          showInjuryPopover(e.target, player, injury);
        }
      });

      tag.addEventListener('mouseleave', () => {
        hideInjuryPopover();
      });
    });
  }

  // Show Interactive Injury Hover Card
  function showInjuryPopover(targetElem, player, injury) {
    hideInjuryPopover();

    const pop = document.createElement('div');
    pop.className = 'ffa-injury-popover';

    const concernClass = `ffa-concern-${injury.concernLevel || 'low'}`;

    pop.innerHTML = `
      <div class="ffa-popover-header">
        <span>${player.name} (${player.pos})</span>
        <span class="ffa-concern-badge ${concernClass}">${(injury.concernLevel || 'LOW').toUpperCase()} CONCERN</span>
      </div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: var(--ffa-blood-text); margin-bottom: 8px;">
        ${injury.injuryName}
      </div>
      <div class="ffa-popover-grid">
        <div>
          <span class="ffa-popover-label">Typical Recovery:</span>
          <div class="ffa-popover-val">${injury.typicalRecovery || 'N/A'}</div>
        </div>
        <div>
          <span class="ffa-popover-label">Expected Return:</span>
          <div class="ffa-popover-val">${injury.expectedReturn || 'N/A'}</div>
        </div>
        <div>
          <span class="ffa-popover-label">Reinjury Rate:</span>
          <div class="ffa-popover-val">${injury.reinjuryRate || 'N/A'}</div>
        </div>
        <div>
          <span class="ffa-popover-label">Injury Date:</span>
          <div class="ffa-popover-val">${injury.injuryDate || 'N/A'}</div>
        </div>
      </div>
      ${injury.doctorNotes ? `
        <div class="ffa-popover-notes">
          <strong>Doctor Notes:</strong> ${injury.doctorNotes}
        </div>
      ` : ''}
    `;

    document.body.appendChild(pop);
    activeInjuryPopover = pop;

    const rect = targetElem.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();

    let top = rect.top - popRect.height - 8;
    if (top < 10) {
      top = rect.bottom + 8;
    }
    let left = Math.max(10, Math.min(window.innerWidth - popRect.width - 10, rect.left - 100));

    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  function hideInjuryPopover() {
    if (activeInjuryPopover) {
      activeInjuryPopover.remove();
      activeInjuryPopover = null;
    }
  }

  // Recommended Picks Tab
  function renderRecommendedTab(container) {
    const pool = window.FFA_DRAFT_POOL || [];
    const available = pool.filter(p => !isPlayerDrafted(p));

    const topRecs = available.slice(0, 5);

    container.innerHTML = `
      <div class="ffa-rec-list">
        <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; color: var(--ffa-lime); margin-bottom: 4px;">
          TOP RECOMMENDED PICKS FOR YOUR ROSTER
        </div>
        ${topRecs.map((p, idx) => {
          const injury = getInjuryDetail(p);
          return `
            <div class="ffa-rec-card">
              <div class="ffa-rec-header">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span class="ffa-pos-badge ffa-pos-${p.pos}">${p.pos}${p.posRank || ''}</span>
                  <span style="font-weight: 800; font-size: 13px;">${p.name}</span>
                  ${injury ? `<span class="ffa-injury-tag">Q</span>` : ''}
                </div>
                <span style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ffa-lime); font-weight: 700;">#${idx + 1} REC</span>
              </div>
              <div class="ffa-rec-reason">
                ${p.team || 'FA'} · Tier ${p.tier || 1} · ${p.adp ? `ADP ${Math.round(p.adp)}` : 'Top Value'}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // My Team & Roster Tab
  function renderRosterTab(container) {
    container.innerHTML = `
      <div class="ffa-roster-view">
        <div class="ffa-roster-group">
          <div class="ffa-roster-title">MY DRAFTED ROSTER</div>
          <div class="ffa-roster-item">
            <span style="color: var(--ffa-bone-dim);">Picks Made:</span>
            <span style="font-weight: 700;">${picksData.filter(p => p.slot === mySlot).length} Picks</span>
          </div>
          <div class="ffa-roster-item">
            <span style="color: var(--ffa-bone-dim);">Draft Position:</span>
            <span style="font-weight: 700;">Slot ${mySlot || 'Auto'}</span>
          </div>
        </div>

        <div class="ffa-roster-group">
          <div class="ffa-roster-title">LEAGUE TEAMS</div>
          ${(teamsData || []).map(t => `
            <div class="ffa-roster-item">
              <span>${t.name || `Team ${t.slot}`}</span>
              <span style="color: var(--ffa-bone-dim); font-size: 10px;">${picksData.filter(p => p.slot === t.slot).length} picks</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Receive Live Messages from ESPN Injector (inject.js)
  window.addEventListener('message', (event) => {
    if (!event.data) return;

    const src = event.data.source;
    if (src !== 'gridiron-espn-sync' && src !== 'gridiron-espn') return;

    console.log('[FFA Assistant] Window message event received:', src, event.data);

    lastMessageTime = Date.now();
    updateSyncStatus('synced', 'Live sync active · Synchronized with ESPN draft room');

    const payload = event.data.snapshot || event.data.payload;
    if (!payload) return;

    if (payload.my_slot) mySlot = payload.my_slot;
    if (Array.isArray(payload.teams) && payload.teams.length) teamsData = payload.teams;

    if (Array.isArray(payload.picks)) {
      picksData = payload.picks;
      console.log(`[FFA Assistant] Received ${payload.picks.length} picks from snapshot.`);

      payload.picks.forEach(pick => {
        const id = pick.player_id || pick.playerId || pick.id;
        if (id) draftedIds.add(String(id));
        const name = pick.player_name || pick.playerName || pick.name;
        const pos = pick.position || pick.pos;
        if (name) {
          draftedPlayerKeys.add(getMatchKey(name, pos));
          draftedPlayerKeys.add(normalizeName(name));
        }
      });
      renderContent();
    }
  });

  // Auto Load ESPN League data on startup
  autoLoadESPNLeague();

  // Connect WebSocket relay fallback
  connectWebSocketRelay();

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWidget);
  } else {
    injectWidget();
  }
})();
