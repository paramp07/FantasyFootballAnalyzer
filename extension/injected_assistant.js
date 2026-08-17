// FFA Injected Draft Assistant for ESPN
;(() => {
  if (window.__ffaAssistantInjected) return;
  window.__ffaAssistantInjected = true;

  console.log('[FFA Assistant] Initializing injected overlay on ESPN...');

  // State
  let activeTab = 'available'; // 'available' | 'recommended' | 'roster'
  let activePos = 'ALL';
  let searchQuery = '';
  let isMinimized = localStorage.getItem('ffa_assistant_minimized') === 'true';
  let activeInjuryPopover = null;

  // Track drafted players
  const draftedPlayerKeys = new Set();
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

  // Inject DOM Widget
  function injectWidget() {
    if (document.getElementById('ffa-assistant-overlay')) return;

    const box = document.createElement('div');
    box.id = 'ffa-assistant-overlay';
    box.className = `ffa-assistant-box ${isMinimized ? 'ffa-minimized' : ''}`;

    // Saved position
    const savedPos = localStorage.getItem('ffa_assistant_pos');
    if (savedPos) {
      try {
        const { top, left } = JSON.parse(savedPos);
        box.style.top = `${top}px`;
        box.style.left = `${left}px`;
        box.style.bottom = 'auto';
        box.style.right = 'auto';
      } catch (e) {
        /* fallback to default CSS bottom/right */
      }
    }

    box.innerHTML = `
      <div class="ffa-header" id="ffa-assistant-header">
        <div class="ffa-header-title">
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

    // Setup drag logic
    setupDrag(box);

    // Setup event handlers
    const minimizeBtn = box.querySelector('#ffa-btn-minimize');
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isMinimized = !isMinimized;
      localStorage.setItem('ffa_assistant_minimized', String(isMinimized));
      box.classList.toggle('ffa-minimized', isMinimized);
      minimizeBtn.textContent = isMinimized ? '+' : '—';
      minimizeBtn.title = isMinimized ? 'Expand' : 'Minimize';
    });

    box.querySelectorAll('.ffa-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        box.querySelectorAll('.ffa-tab-btn').forEach(b => b.classList.toggle('ffa-active', b.dataset.tab === activeTab));
        renderContent();
      });
    });

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
    
    // Filter available players
    let available = pool.filter(p => {
      const k1 = getMatchKey(p.name, p.pos);
      const k2 = normalizeName(p.name);
      return !draftedPlayerKeys.has(k1) && !draftedPlayerKeys.has(k2);
    });

    // Position filter
    if (activePos !== 'ALL') {
      if (activePos === 'FLEX') {
        available = available.filter(p => FLEX_POS.has(p.pos));
      } else {
        available = available.filter(p => p.pos === activePos);
      }
    }

    // Search query filter
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

    // Bind filter clicks
    container.querySelectorAll('.ffa-pos-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activePos = chip.dataset.pos;
        renderContent();
      });
    });

    // Bind search input
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

    // Group players by tier
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

    // Attach injury tag hover events
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

    // Position popover above/below target
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
    const available = pool.filter(p => {
      const k1 = getMatchKey(p.name, p.pos);
      const k2 = normalizeName(p.name);
      return !draftedPlayerKeys.has(k1) && !draftedPlayerKeys.has(k2);
    });

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
    if (!event.data || event.data.source !== 'gridiron_espn') return;

    const payload = event.data.payload;
    if (!payload) return;

    if (payload.my_slot) mySlot = payload.my_slot;
    if (payload.teams) teamsData = payload.teams;

    if (Array.isArray(payload.picks)) {
      picksData = payload.picks;
      draftedPlayerKeys.clear();
      payload.picks.forEach(pick => {
        if (pick.player_name) {
          draftedPlayerKeys.add(getMatchKey(pick.player_name, pick.position));
          draftedPlayerKeys.add(normalizeName(pick.player_name));
        }
      });
      renderContent();
    }
  });

  // Inject when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectWidget);
  } else {
    injectWidget();
  }
})();
