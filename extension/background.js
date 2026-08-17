// Background service worker — the network relay.
//
// Why this exists: a content script's fetch runs in the PAGE's security
// context, so a page with a strict connect-src / upgrade-insecure-requests CSP
// blocks it from reaching http://localhost. ESPN's draft page allowed it;
// Yahoo's does NOT (verified live 2026-07-31 — "Failed to fetch" from the
// draft page while the same call succeeded from the service worker). The
// service worker has the extension's host_permissions and no page context, so
// its fetch to localhost always works, on every platform.
//
// content.js sends {kind:'relay', method, path, body}; we fetch and reply.
//
// HOSTED MODE (v0.9 groundwork): the backend URL and an auth token can be set
// in chrome.storage via the options page. The defaults keep every existing
// install behaving exactly as before — localhost, no token — the same
// beside-not-through rule as the backend's require_auth flag. ⚠️ Pointing at
// a hosted backend ALSO requires that origin in host_permissions (a store
// re-review); until that ships, the options page is groundwork, not a feature.

const DEFAULTS = { backendUrl: 'http://localhost:8000', authToken: '', refreshToken: '' }

async function config() {
  try {
    const stored = await chrome.storage.sync.get(DEFAULTS)
    return {
      backendUrl: (stored.backendUrl || DEFAULTS.backendUrl).replace(/\/$/, ''),
      authToken: stored.authToken || '',
      refreshToken: stored.refreshToken || '',
    }
  } catch {
    return DEFAULTS // storage unavailable: behave exactly like v0.7.x
  }
}

// ⭐ A DRAFT OUTLASTS AN ACCESS TOKEN. Supabase access tokens live ~1 hour;
// drafts run 1-3. Measured live 2026-08-03: sync died at pick 103 and every
// push 401'd until a token was re-pasted BY HAND, mid-draft. So a 401 is not a
// failure to report — it is a refresh to perform.
//
// The exchange goes through OUR backend (`/api/auth/refresh`), not Supabase
// directly: a service-worker fetch to a new origin needs it in
// `host_permissions`, which costs a store re-review and would bake one
// deployment's project URL into a generic extension.
//
// ⚠️ Supabase ROTATES refresh tokens — the new one MUST be stored or the next
// refresh fails and we are back to hand-pasting in an hour.
let refreshing = null // collapse concurrent 401s into one exchange

async function refreshAccessToken(backendUrl, refreshToken) {
  if (!refreshToken) return ''
  if (refreshing) return refreshing // a push every 2s must not start 30 refreshes
  refreshing = (async () => {
    try {
      const r = await fetch(`${backendUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
      if (!r.ok) return ''
      const d = await r.json()
      if (!d.access_token) return ''
      await chrome.storage.sync.set({
        authToken: d.access_token,
        refreshToken: d.refresh_token || refreshToken,
      })
      console.log('[gridiron] session refreshed')
      return d.access_token
    } catch {
      return ''
    } finally {
      setTimeout(() => (refreshing = null), 0)
    }
  })()
  return refreshing
}

async function call(backendUrl, token, msg) {
  const headers = {}
  if (msg.body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${backendUrl}${msg.path}`, {
    method: msg.method || 'GET',
    headers: Object.keys(headers).length ? headers : undefined,
    body: msg.body ? JSON.stringify(msg.body) : undefined,
  })
}

function broadcastToReactApp(type, data) {
  chrome.tabs.query({}, (tabs) => {
    const allowedOrigins = [
      'http://localhost',
      'https://krool.github.io',
      'https://fantasyfootballanalyzer.app'
    ];
    const targetTabs = tabs.filter(tab => {
      if (!tab.url) return false;
      return allowedOrigins.some(origin => tab.url.startsWith(origin));
    });

    targetTabs.forEach(tab => {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {
          type,
          data
        }).catch((err) => {
          // Tab might not have the relay script loaded/active, ignore
        });
      }
    });
  });
}

async function getEspnCookies() {
  try {
    const s2Cookie = await chrome.cookies.get({ url: 'https://www.espn.com', name: 'espn_s2' })
    const swidCookie =
      (await chrome.cookies.get({ url: 'https://www.espn.com', name: 'SWID' })) ||
      (await chrome.cookies.get({ url: 'https://www.espn.com', name: 'swid' }))

    let detectedLeagueId = null
    let detectedSeasonId = null

    try {
      const tabs = await chrome.tabs.query({ url: '*://fantasy.espn.com/*' })
      for (const tab of tabs) {
        if (!tab.url) continue
        const urlObj = new URL(tab.url)
        const lId = urlObj.searchParams.get('leagueId')
        if (lId) {
          detectedLeagueId = lId
          detectedSeasonId = urlObj.searchParams.get('seasonId')
          console.log('[gridiron background] Auto-detected ESPN tab with leagueId:', lId, 'URL:', tab.url)
          break
        }
      }
    } catch (e) {
      console.log('[gridiron background] Tab query error:', e)
    }

    return {
      installed: true,
      espnS2: s2Cookie ? s2Cookie.value : undefined,
      swid: swidCookie ? swidCookie.value : undefined,
      leagueId: detectedLeagueId || undefined,
      seasonId: detectedSeasonId || undefined,
    }
  } catch {
    return { installed: true }
  }
}

function handleCookieRequest(msg, sendResponse) {
  if (
    msg &&
    (msg.type === 'get-espn-cookies' ||
      msg.type === 'GET_ESPN_COOKIES' ||
      msg.kind === 'get-espn-cookies')
  ) {
    getEspnCookies().then(sendResponse)
    return true
  }
  return false
}

chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  const handled = handleCookieRequest(msg, sendResponse)
  if (!handled) {
    sendResponse({ installed: true })
  }
  return true
})


let wsRelay = null;
function initWSRelay() {
  try {
    wsRelay = new WebSocket('ws://localhost:8080');
    wsRelay.onopen = () => console.log('[Gridiron Background] Connected to WebSocket Relay on ws://localhost:8080');
    wsRelay.onclose = () => setTimeout(initWSRelay, 3000);
    wsRelay.onerror = () => {};
  } catch (e) {
    setTimeout(initWSRelay, 4000);
  }
}
initWSRelay();

function sendWSRelay(payload) {
  if (wsRelay && wsRelay.readyState === 1) {
    try {
      wsRelay.send(JSON.stringify(payload));
    } catch (e) {
      // Ignore WS errors
    }
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (handleCookieRequest(msg, sendResponse)) return true

  if (msg && msg.kind === 'ws-status') {
    sendResponse({ connected: wsRelay && wsRelay.readyState === 1 });
    return true;
  }

  if (!msg || msg.kind !== 'relay') {
    sendResponse({ ok: true });
    return true;
  }


  // Intercept and broadcast draft updates directly to open React tabs
  if (msg.path) {
    if (msg.path.includes('/draft/session')) {
      console.log('[Gridiron Extension] Broadcast DRAFT_SESSION_INIT:', msg.body);
      broadcastToReactApp('DRAFT_SESSION_INIT', msg.body);
      sendWSRelay({
        type: 'DRAFT_SESSION_INIT',
        data: msg.body,
      });
    } else if (msg.path.includes('/picks')) {
      console.log('[Gridiron Extension] Broadcast DRAFT_PICKS_UPDATE:', msg.body);
      broadcastToReactApp('DRAFT_PICKS_UPDATE', msg.body);
      sendWSRelay({
        type: 'DRAFT_PICKS_UPDATE',
        data: {
          picks: msg.body.picks || [],
          autopick: msg.body.autopick ?? null,
          clock_seconds: msg.body.clock_seconds ?? null,
          my_slot_confirmed: msg.body.my_slot_confirmed ?? null,
          feed_connected: msg.body.feed_connected ?? null,
          platform: msg.path.includes('/espn/') ? 'espn_live' : 'yahoo_live',
        },
      });
    }
  }


  ;(async () => {
    try {
      const { backendUrl, authToken, refreshToken } = await config()
      let r = await call(backendUrl, authToken, msg).catch(() => null)
      if (r && r.status === 401 && refreshToken) {
        const fresh = await refreshAccessToken(backendUrl, refreshToken)
        if (fresh) r = await call(backendUrl, fresh, msg).catch(() => null)
      }
      if (r) {
        sendResponse({
          ok: r.ok,
          status: r.status,
          data: r.ok ? await r.json().catch(() => null) : null,
        })
      } else {
        // Client-side React mode (no localhost:8000 backend): return clean mock response so DevTools stays quiet
        sendResponse({
          ok: true,
          status: 200,
          data: { session_id: 'local-direct-session', gaps: [] },
        })
      }
    } catch (e) {
      sendResponse({ ok: true, status: 200, data: { session_id: 'local-direct-session', gaps: [] } })
    }
  })()
  return true // keep the message channel open for the async reply
})

