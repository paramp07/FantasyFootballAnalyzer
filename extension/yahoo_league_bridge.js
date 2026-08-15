// Isolated-world bridge for the Yahoo league reader.
//
// The reader runs in the MAIN world so its same-origin fetch carries the
// user's session. It cannot reach the backend (Yahoo's CSP blocks a page-
// context fetch to localhost — the lesson that created background.js), so
// this bridge relays: it polls the backend for a pending request, asks the
// reader to do the read, and posts the result back through the worker.
;(() => {
  const POLL_MS = 4000
  let busy = false

  // The relay contract is background.js's, not one invented here: `kind:
  // 'relay'`, and lastError must be read or Chrome logs an unchecked-error
  // warning and the promise never settles. Copied from content.js deliberately
  // — guessing this shape is what made the first build silently do nothing.
  function relay(method, path, body) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ kind: 'relay', method, path, body }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message })
        } else {
          resolve(res || { ok: false, status: 0 })
        }
      })
    })
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.source !== 'gridiron-yahoo-league-rosters') return
    const { rows, settings } = e.data
    if (!rows?.length) {
      busy = false
      return
    }
    const pending = window.__gridironPendingLeague
    if (!pending) {
      busy = false
      return
    }
    const res = await relay('POST', `/api/leagues/${pending}/yahoo-rosters`, {
      rows,
      settings: settings || undefined,
    })
    console.log('[gridiron] pushed', rows.length, 'rostered players ->', res?.ok ? 'ok' : res)
    window.__gridironPendingLeague = null
    busy = false
  })

  // The backend tells us WHICH league wants a read; the user asked for it in
  // the war room. Never self-initiated — reading someone's league unprompted
  // is exactly the surprise the ESPN recovery button was designed to avoid.
  async function poll() {
    if (busy) return
    const res = await relay('GET', '/api/leagues/yahoo-read-request', null)
    const req = res?.data
    if (!req?.league_id || !req?.platform_league_id) return
    busy = true
    window.__gridironPendingLeague = req.league_id
    window.postMessage(
      { source: 'gridiron-yahoo-read-league', leagueId: req.platform_league_id },
      '*',
    )
  }

  setInterval(() => poll().catch(() => { busy = false }), POLL_MS)
  console.log('[gridiron] Yahoo league bridge ready')
})()
