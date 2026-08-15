// Isolated-world bridge: receives draft snapshots from inject.js (MAIN world)
// and relays them to the local Gridiron Copilot backend. Nothing leaves the
// machine — localhost only.

// Which door this page feeds. Same relay, explicitly different platforms —
// the backend keeps their id namespaces separate (separation rule).
const PLATFORM = location.host.includes('yahoo') ? 'yahoo_live' : 'espn_live'
let sessionId = null
let creating = false
let lastPushedCount = -1
let lastSnapshot = null
let lastPushAt = 0
// A fresh page load means our autopick reading starts over. Without telling the
// backend, it keeps presenting the PRE-refresh value as truth — observed live
// 2026-08-01: Autodraft off in Yahoo, war room stuck on "Autopick is ON" after
// a refresh (Yahoo's A| frame is connect-only; a refresh re-sends nothing).
// Unknown and a real value must never be the same value: the first push resets
// the backend to unknown, and a real reading (A| frame, 5|/6| toggle, or ESPN's
// DOM read) repopulates it.
let firstPushAfterLoad = true
// Re-push an unchanged snapshot this often so the backend's sync heartbeat can
// tell "quiet draft" apart from "extension died". Must stay well under the
// backend's 30s stale threshold.
const HEARTBEAT_MS = 10000

// Backend calls go through the background service worker, not a direct fetch,
// because the page's CSP can block a content-script fetch to localhost (Yahoo
// does; ESPN didn't). The worker has no page context and always reaches it.
function relay(method, path, body) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ kind: 'relay', method, path, body }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message })
        } else {
          resolve(res || { ok: false, status: 0 })
        }
      })
    } catch (e) {
      resolve({ ok: false, status: 0, error: e.message })
    }
  })
}

async function ensureSession(snapshot) {
  if (sessionId || creating) return
  creating = true
  try {
    const res = await relay('POST', '/api/espn/draft/session', {
      teams: snapshot.teams,
      rounds: snapshot.rounds,
      scoring: snapshot.scoring || 'ppr',
      my_slot: snapshot.my_slot,
      platform: PLATFORM,
      // The platform's own stable draft id, if the injector supplies one (Yahoo
      // does). Lets a reload re-attach to the same backend session instead of
      // creating a duplicate — the fix for a forward-only socket losing its
      // early picks on refresh.
      external_id: snapshot.external_id || null,
      // ESPN only: the league's real lineup slots and reception scoring, read
      // from the user's own authenticated session. Null when unreadable, so
      // the backend keeps its documented fallback instead of a wrong guess.
      espn_settings: snapshot.espn_settings || null,
    })
    if (res.ok && res.data) {
      sessionId = res.data.session_id
      console.log('[gridiron] session created:', sessionId)
    } else {
      console.log('[gridiron] backend unreachable (is the app running?)', res.error || res.status)
    }
  } finally {
    creating = false
  }
}

async function pushPicks(snapshot) {
  if (!sessionId) return
  // Compare content, not just count: a corrected pick (same length, different
  // player) must still be pushed. Snapshots are idempotent, so re-sending is free.
  // The clock is exempt from the dedupe — it changes every tick and a stale
  // timer is worse than no timer, so a readable clock means push every time.
  //
  // HEARTBEAT: we must also push when NOTHING has changed, at least every
  // HEARTBEAT_MS. Otherwise a quiet stretch (pre-draft, or a long think by
  // another manager) looks identical to a dead extension, and the war room
  // raises a red "sync stopped" banner while sync is perfectly healthy.
  // Caught live 2026-07-31: session created, nothing changed, stale after 30s.
  // A false alarm is expensive here — it teaches the user to ignore the banner
  // that exists to save them.
  const fingerprint = JSON.stringify([
    snapshot.picks, snapshot.autopick, snapshot.my_slot_confirmed, snapshot.feed_connected,
  ])
  const quiet = fingerprint === lastSnapshot && snapshot.clock_seconds == null
  if (quiet && Date.now() - lastPushAt < HEARTBEAT_MS) return
  const res = await relay('POST', `/api/espn/draft/${sessionId}/picks`, {
    picks: snapshot.picks,
    autopick: snapshot.autopick ?? null,
    autopick_reset: firstPushAfterLoad,
    clock_seconds: snapshot.clock_seconds ?? null,
    // Yahoo only: the draft slot once PROVEN from the draft order. The room
    // URL carries the team id, which a randomised order makes a different
    // number (2026-08-02, live). Null until proven — never a second guess.
    my_slot_confirmed: snapshot.my_slot_confirmed ?? null,
    // Yahoo only: whether the draft-room socket is actually open. A heartbeat
    // proves the extension is alive, not that the feed is.
    feed_connected: snapshot.feed_connected ?? null,
  })
  if (res.ok) {
    // Tell the injector which overalls the backend never got. It knows whether
    // it has them, which is the whole diagnosis — see reportGaps in inject.js.
    if (res.data?.gaps?.length) {
      window.postMessage({ source: 'gridiron-espn-gaps', gaps: res.data.gaps }, '*')
    }
    // The user pressed "recover" in the war room. Ask the injector to cycle the
    // roster panel — never on our own initiative, since it moves their view.
    if (res.data?.recover) {
      window.postMessage({ source: 'gridiron-espn-recover' }, '*')
    }
    firstPushAfterLoad = false
    lastPushedCount = snapshot.picks.length
    lastSnapshot = fingerprint
    lastPushAt = Date.now()
    return
  }
  // 404 = the backend forgot this session (in-memory; a restart wipes them).
  // Drop the id and rebuild next tick, or sync dies silently.
  if (res.status === 404) {
    console.log('[gridiron] session', sessionId, 'is gone — recreating')
    sessionId = null
    lastPushedCount = -1
    lastSnapshot = null
    lastPushAt = 0
  }
}

const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('gridiron_live_sync') : null;

if (broadcastChannel) {
  setInterval(() => {
    const payload = {
      type: 'GRIDIRON_HEARTBEAT',
      data: {
        timestamp: Date.now(),
        platform: PLATFORM,
        sessionId: sessionId || null,
        pickCount: lastPushedCount >= 0 ? lastPushedCount : 0,
      },
    };
    try {
      broadcastChannel.postMessage(payload);
    } catch {
      // Ignore channel errors
    }
  }, 3000);
}


window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const msg = event.data
  if (!msg) return
  if (msg.source === 'gridiron-espn-sync') {
    const payload = {
      type: 'DRAFT_PICKS_UPDATE',
      data: {
        picks: msg.snapshot.picks || [],
        teams: msg.snapshot.teams,
        draft_type: msg.snapshot.draft_type || 'snake',
        platform: PLATFORM,
      },
    };
    if (broadcastChannel && msg.snapshot) {
      try {
        broadcastChannel.postMessage(payload);
      } catch (e) {
        console.warn('[gridiron] BroadcastChannel error:', e);
      }
    }
    ensureSession(msg.snapshot).then(() => pushPicks(msg.snapshot))
    return
  }

  if (msg.source === 'gridiron-espn-rosters' && sessionId) {
    relay('POST', `/api/espn/draft/${sessionId}/rosters`, msg.rosters).then((res) => {
      if (res.ok) {
        console.log('[gridiron] recovery:', res.data)
      } else {
        console.log('[gridiron] recovery push failed', res.status, res.error)
      }
    })
  }
})


// Inject "OPEN FFA" button into ESPN draft board header (next to "Draft Help")
function injectGridironButton() {
  if (document.getElementById('gridiron-copilot-btn')) return;

  const candidateElements = Array.from(
    document.querySelectorAll('a[href*="support.espn.com"], a.icon-wrapper, .draft-header-icon')
  );
  
  let targetElement = candidateElements.find(el => (el.textContent || '').includes('Draft Help'));
  if (!targetElement && candidateElements.length > 0) {
    targetElement = candidateElements[0].closest('a') || candidateElements[0];
  }

  if (!targetElement) return;

  const btn = document.createElement('a');
  btn.id = 'gridiron-copilot-btn';
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.style.cssText = 'text-decoration: none; display: inline-flex; align-items: center; margin-right: 10px; vertical-align: middle; cursor: pointer; position: relative;';

  btn.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 5px; font-weight: 800; font-family: ui-monospace, SFMono-Regular, monospace; color: #d6ff2e; background: #0f172a; border: 1px solid #1e293b; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.4); font-size: 11px; letter-spacing: 0.05em; transition: all 0.2s; line-height: 1.2;">
      <span id="ffa-ws-dot" style="width: 6px; height: 6px; border-radius: 50%; background: #d6ff2e; display: inline-block;"></span>
      OPEN FFA
    </span>
    <span id="ffa-tooltip" style="visibility: hidden; opacity: 0; position: absolute; top: 125%; left: 50%; transform: translateX(-50%); background: #0b130e; color: #d6ff2e; border: 1px solid #1a2a20; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-family: ui-monospace, monospace; white-space: nowrap; transition: opacity 0.2s, visibility 0.2s; pointer-events: none; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
      WebSocket: Checking...
    </span>
  `;

  btn.addEventListener('mouseenter', () => {
    const tooltip = document.getElementById('ffa-tooltip');
    if (tooltip) {
      tooltip.style.visibility = 'visible';
      tooltip.style.opacity = '1';
    }
    try {
      chrome.runtime.sendMessage({ kind: 'ws-status' }, (res) => {
        if (tooltip) {
          const connected = res && res.connected;
          tooltip.textContent = `WebSocket: ${connected ? 'CONNECTED' : 'DISCONNECTED'}`;
          tooltip.style.color = connected ? '#d6ff2e' : '#ff5d5d';
        }
      });
    } catch {
      if (tooltip) tooltip.textContent = 'WebSocket: DISCONNECTED';
    }
  });

  btn.addEventListener('mouseleave', () => {
    const tooltip = document.getElementById('ffa-tooltip');
    if (tooltip) {
      tooltip.style.visibility = 'hidden';
      tooltip.style.opacity = '0';
    }
  });

  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get({ appUrl: 'http://localhost:5173' }, (cfg) => {
        btn.href = (cfg?.appUrl || 'http://localhost:5173').replace(/\/$/, '');
      });
    } else {
      btn.href = 'http://localhost:5173';
    }
  } catch {
    btn.href = 'http://localhost:5173';
  }

  // Find the leftmost header icon/button in that container so we sit to the left of ALL header tools (Sound, Help, Settings)
  const headerContainer = targetElement.closest('.draft-header-tools, .header-right, nav, div') || targetElement.parentNode;
  let leftmostElement = targetElement;

  if (headerContainer) {
    const siblings = Array.from(headerContainer.querySelectorAll('a, button, .icon-wrapper, .draft-header-icon'));
    if (siblings.length > 0) {
      leftmostElement = siblings[0].closest('a, button') || siblings[0];
    }
  }

  if (leftmostElement && leftmostElement.parentNode) {
    leftmostElement.parentNode.insertBefore(btn, leftmostElement);
  } else {
    targetElement.before(btn);
  }
}

setInterval(injectGridironButton, 1500);

console.log('[gridiron] FFA Helper bridge loaded')

