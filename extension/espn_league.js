// ESPN LEAGUE reader — cookie-free League Home.
//
// The backend can read ESPN with `espn_s2`+`SWID` on file, and that is how the
// app worked for weeks. But pasting cookies out of DevTools is a barrier most
// people will never cross, and this ships to strangers — so for anyone who has
// configured nothing, League Home simply did not exist.
//
// Measured 2026-08-03: `lm-api-reads.fantasy.espn.com` answers a CREDENTIALED
// cross-origin fetch from an ESPN page (ESPN reflects the origin with
// access-control-allow-credentials, and the cookies are same-site). So the
// user's own already-authenticated browser reads their own league, and we
// handle no credential at all — the same posture as teeing the draft socket.
//
// We relay the RAW payload: the backend keeps using its existing, tested
// `parse_league`, so there is no second parser to drift.
;(() => {
  const POLL_MS = 4000
  let busy = false

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

  // ⚠️ This is a CROSS-ORIGIN request from an ISOLATED-world content script,
  // which Chrome blocks unless the host is declared in `host_permissions`
  // (`https://lm-api-reads.fantasy.espn.com/*`). The recon that proved ESPN
  // answers a credentialed fetch ran in the PAGE world, where no permission is
  // required — so the gap would not have surfaced until a user tried it.
  // Caught by reading the manifest against this line, not by the failure.
  async function readLeague(leagueId, season) {
    const url =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}` +
      `/segments/0/leagues/${leagueId}` +
      '?view=mSettings&view=mTeam&view=mRoster'
    const r = await fetch(url, { credentials: 'include' })
    if (!r.ok) throw new Error(`ESPN answered ${r.status}`)
    return r.json()
  }

  // Never self-initiated: the backend only advertises a read the user asked
  // for in the war room, and the request expires. Reading someone's league
  // because a tab happens to be open is the surprise this app refuses.
  async function poll() {
    if (busy) return
    const res = await relay('GET', '/api/leagues/espn-read-request', null)
    const req = res?.data
    if (!req?.league_id || !req?.platform_league_id) return
    busy = true
    try {
      const raw = await readLeague(req.platform_league_id, req.season || new Date().getFullYear())
      const out = await relay('POST', `/api/leagues/${req.league_id}/espn-rosters`, { raw })
      console.log('[gridiron] pushed the ESPN league ->', out?.ok ? 'ok' : out)
    } catch (e) {
      // A private league, a logged-out session, or an ESPN change. Say so in
      // the console and let the request expire rather than retrying forever.
      console.warn('[gridiron] could not read the ESPN league:', e.message)
    } finally {
      busy = false
    }
  }

  setInterval(() => poll().catch(() => { busy = false }), POLL_MS)
  console.log('[gridiron] ESPN league reader ready')
})()
