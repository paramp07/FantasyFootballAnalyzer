/**
 * ESPN Draft Content Script (ISOLATED world)
 *
 * Two responsibilities:
 *   1. Inject an "Open Board" button into the ESPN draft header.
 *   2. Listen for WebSocket pick events posted by espn-hook.js (MAIN world)
 *      and relay them to the background service worker, which broadcasts
 *      them to the Fantasy Football Analyzer React app.
 *
 * espn-hook.js runs in MAIN world and monkey-patches WebSocket. It intercepts
 * ESPN's draft socket messages and posts them via window.postMessage:
 *   - ESPN_PICK:  { siteTeamId, sitePlayerId, slotId }
 *   - ESPN_SOLD:  { siteTeamId, sitePlayerId, slotId, amount }
 *   - ESPN_INIT:  raw init data string
 *
 * This script collects those into an ordered picks array and sends
 * DRAFT_PICKS_UPDATE messages to background.js on every new pick.
 */
(function espnContentScript() {
  'use strict';

  const BUTTON_ID = 'ffa-open-board-btn';
  const POLL_INTERVAL_MS = 800;

  // ──────────────────────────────────────────────────
  // 1. Button Injection
  // ──────────────────────────────────────────────────

  function extractEspnParams() {
    const params = new URLSearchParams(window.location.search);
    const leagueId = params.get('leagueId');
    const season = params.get('seasonId') || String(new Date().getFullYear());
    return { leagueId, season };
  }

  function buildAnalyzerUrl(leagueId, season) {
    return `http://localhost:5173/draft-room?syncPlatform=espn&syncLeagueId=${leagueId}&syncSeason=${season}`;
  }

  function applyButtonStyles(btn) {
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#ffffff',
      border: '1px solid #84cc16',
      borderRadius: '6px',
      padding: '6px 14px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(132, 204, 22, 0.2)',
      transition: 'all 0.2s ease',
      height: '32px',
      minWidth: '120px',
      verticalAlign: 'middle',
      flexShrink: '0',
      marginLeft: '8px',
    });

    btn.addEventListener('mouseover', () => {
      btn.style.border = '1px solid #a3e635';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4), 0 0 12px rgba(163, 230, 53, 0.4)';
      btn.style.transform = 'scale(1.02)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.border = '1px solid #84cc16';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(132, 204, 22, 0.2)';
      btn.style.transform = 'scale(1)';
    });
  }

  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';

    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '8px', height: '8px',
      backgroundColor: '#84cc16', borderRadius: '50%',
      display: 'inline-block', flexShrink: '0',
    });

    const label = document.createElement('span');
    label.textContent = 'Open Board';

    btn.appendChild(dot);
    btn.appendChild(label);
    applyButtonStyles(btn);

    btn.addEventListener('click', () => {
      const { leagueId, season } = extractEspnParams();
      if (!leagueId) {
        alert('Could not find ESPN League ID in the URL.');
        return;
      }
      window.open(buildAnalyzerUrl(leagueId, season), '_blank');
    });

    return btn;
  }

  function injectButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const iconGroup = document.querySelector('.icon-group');
    if (!iconGroup) return;
    iconGroup.appendChild(createButton());
  }

  // ──────────────────────────────────────────────────
  // 2. WebSocket Pick Relay
  // ──────────────────────────────────────────────────

  // Accumulates picks in order. Each pick is stored as:
  //   { sitePlayerId, draftedBy (siteTeamId), pickNumber, isKeeper, winningBid? }
  const collectedPicks = [];

  /**
   * Broadcast all collected picks to the background service worker.
   * The background worker then relays them to all open Analyzer tabs.
   */
  function broadcastPicks() {
    const { leagueId, season } = extractEspnParams();
    if (!leagueId) return;

    const draftId = `${leagueId}-${season}`;

    chrome.runtime.sendMessage({
      type: 'DRAFT_PICKS_UPDATE',
      platform: 'espn',
      draftId: draftId,
      picks: collectedPicks.map((p, i) => ({
        sitePlayerId: p.sitePlayerId,
        draftedBy: p.draftedBy,
        pickNumber: i + 1,
        isKeeper: false,
        winningBid: p.winningBid,
      })),
    });
  }

  /**
   * Handle messages posted by espn-hook.js (MAIN world).
   * espn-hook.js posts ESPN WebSocket messages as window.postMessage events.
   */
  function handlePageMessage(event) {
    // Only accept messages from the same page
    if (event.source !== window || !event.data || typeof event.data.type !== 'string') return;

    const { type, data } = event.data;

    switch (type) {
      case 'ESPN_PICK': {
        // Snake draft pick: SELECTED <teamId> <playerId> <slotId>
        if (!data || !data.sitePlayerId || !data.siteTeamId) return;

        // Avoid duplicates: ESPN can re-send the same pick
        const alreadyExists = collectedPicks.some(
          p => p.sitePlayerId === data.sitePlayerId && p.draftedBy === data.siteTeamId
        );
        if (alreadyExists) return;

        collectedPicks.push({
          sitePlayerId: data.sitePlayerId,
          draftedBy: data.siteTeamId,
        });

        broadcastPicks();
        break;
      }

      case 'ESPN_SOLD': {
        // Auction sale: SOLD <teamId> <playerId> <slotId> <amount>
        if (!data || !data.sitePlayerId || !data.siteTeamId) return;

        const alreadySold = collectedPicks.some(
          p => p.sitePlayerId === data.sitePlayerId && p.draftedBy === data.siteTeamId
        );
        if (alreadySold) return;

        collectedPicks.push({
          sitePlayerId: data.sitePlayerId,
          draftedBy: data.siteTeamId,
          winningBid: data.amount ? Number(data.amount) : undefined,
        });

        broadcastPicks();
        break;
      }

      case 'ESPN_INIT': {
        // Draft initialization — the init data payload from ESPN.
        // We don't need to process this; the hook fires it once on connect.
        console.debug('[FFA Extension] ESPN draft init received');
        break;
      }

      default:
        break;
    }
  }

  // Start listening for WebSocket pick events from espn-hook.js
  window.addEventListener('message', handlePageMessage);

  // Start button injection polling
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setInterval(injectButton, POLL_INTERVAL_MS);
    });
  } else {
    setInterval(injectButton, POLL_INTERVAL_MS);
  }
})();
