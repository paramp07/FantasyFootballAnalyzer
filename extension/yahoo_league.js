// Yahoo LEAGUE reader — the refresh Yahoo's API cannot give us.
//
// The OAuth application is still pending and every public URL is closed
// (403/404 against a real league, proven 2026-08-02). But the answer was in
// the user's own browser the whole time: the league's player pages carry
// `data-ys-playerid` — the SAME id namespace the draft socket sends, which
// `resolve_yahoo` already chains through (yahoo_id → stats_id → DEF table) —
// alongside a "Roster Status" column naming the owning team.
//
// Posture, identical to the ESPN cookie path: the user's own session, their
// own league, read-only, nothing authenticated by us. We never touch cookies
// and never write to Yahoo.
//
// Same-origin `fetch` from this content script carries the session, so ONE
// click reads every page — the user is never navigated away from what they
// were looking at (the surprise rule the ESPN recovery button also follows).
;(() => {
  const PAGE_SIZE = 25 // Yahoo's `count` is an OFFSET, not a page length
  // 500 rows. The biggest realistic league (16 teams x 18 spots) is 288, and
  // the loop stops as soon as a page adds nothing — so this is a backstop, not
  // a budget. It was 300, which a very large league could have silently
  // truncated: a roster cut short makes its holders read as free agents.
  const MAX_PAGES = 20

  // Everything in this file parses a FETCHED document, which is never
  // rendered — so `textContent` throughout. `innerText` degrades to roughly
  // the same thing on an unrendered node, and depending on that distinction is
  // precisely what made readSettings() silently return zero roster slots.
  //
  // ⭐ Find the owner column by its HEADER, never by position.
  // The first cut sliced tds[2..6] and picked the first non-numeric cell,
  // which happens to work on THIS league's stat layout and would quietly pick
  // the wrong cell on a league showing different columns (Yahoo's player table
  // varies by scoring type). Verified live: the second header row carries
  // "Roster Status" and its index matches the owner cell exactly.
  function ownerIndex(doc) {
    for (const tr of doc.querySelectorAll('table thead tr')) {
      const ths = [...tr.querySelectorAll('th')]
      const i = ths.findIndex((th) => /roster\s*status/i.test(th.textContent || ''))
      if (i >= 0) return i
    }
    return -1
  }

  function parseRows(doc) {
    const out = []
    const idx = ownerIndex(doc)
    for (const tr of doc.querySelectorAll('table tbody tr')) {
      const el = tr.querySelector('[data-ys-playerid]')
      if (!el) continue
      const id = el.getAttribute('data-ys-playerid')
      const tds = [...tr.querySelectorAll('td')]
      let owner = null
      if (idx >= 0 && tds[idx]) {
        owner = (tds[idx].textContent || '').trim().replace(/\s+/g, ' ')
      }
      if (!owner) {
        // Header missing (a layout we have not seen): fall back to the
        // shape-based guess rather than dropping the whole read, but a cell
        // that looks like a stat or a kickoff time is never an owner.
        owner = tds.slice(2, 6)
          .map((td) => (td.textContent || '').trim().replace(/\s+/g, ' '))
          .find((t) => t && !/^[\d.,%-]+$/.test(t) && t.length < 60 &&
                       !/\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/.test(t))
      }
      // "FA"/"W (Aug 5)" mean nobody owns him — status=T should not return
      // those, but a filter that silently changed must not invent a team.
      if (!owner || /^(FA|W \(|Waivers)/i.test(owner)) continue
      if (id) out.push({ yahoo_id: String(id), owner })
    }
    return out
  }

  async function readAllRosters(leagueId) {
    const seen = new Map()
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = `/f1/${leagueId}/players?status=T&pos=O&sort=AR&count=${page * PAGE_SIZE}`
      let html
      try {
        html = await fetch(url, { credentials: 'same-origin' }).then((r) => r.text())
      } catch {
        break // a failed page must not discard the pages that worked
      }
      const rows = parseRows(new DOMParser().parseFromString(html, 'text/html'))
      const before = seen.size
      for (const r of rows) seen.set(r.yahoo_id, r)
      // Yahoo repeats the last page forever past the end; stop when a page
      // adds nothing rather than trusting a row count.
      if (seen.size === before) break
    }
    // Kickers and defenses live under a different position filter.
    for (const pos of ['K', 'DEF']) {
      try {
        const html = await fetch(
          `/f1/${leagueId}/players?status=T&pos=${pos}&sort=AR&count=0`,
          { credentials: 'same-origin' },
        ).then((r) => r.text())
        for (const r of parseRows(new DOMParser().parseFromString(html, 'text/html'))) {
          seen.set(r.yahoo_id, r)
        }
      } catch {
        /* partial is better than nothing; the backend reports what resolved */
      }
    }
    return [...seen.values()]
  }

  // ⭐ Scoring and roster slots decide how every player is RANKED, and Yahoo's
  // socket carries neither — so a league sat on `std` + standard slots no
  // matter what it actually was. Live 2026-08-03: the real league is HALF-PPR
  // ("Receptions 0.5") and had been ranked as standard for an entire draft.
  //
  // We report only what the page SAYS; every judgement about what it means is
  // made server-side, where it can be tested without a browser.
  async function readSettings(leagueId) {
    let doc
    try {
      const html = await fetch(`/f1/${leagueId}/settings`, { credentials: 'same-origin' })
        .then((r) => r.text())
      doc = new DOMParser().parseFromString(html, 'text/html')
    } catch {
      return null // settings are a bonus; never fail the roster read over them
    }
    const out = { reception_points: null, roster_positions: [] }
    // ⛔ innerText NEEDS LAYOUT, and a DOMParser document is never rendered —
    // so it returns nothing here and textContent has no newlines to anchor on.
    // This project already learned that on ESPN's rail; the first cut of this
    // function repeated it and silently read zero roster slots. Read the
    // STRUCTURE (rows and cells), which survives having no layout at all.
    const cellText = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()

    for (const tr of doc.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('td, th')].map(cellText)
      if (!cells.length) continue

      // "Roster Positions: QB, WR, WR, RB, RB, TE, W/R/T, K, DEF, BN, ..., IR"
      // — the label and the value may share a cell or be split across two.
      const joined = cells.join(' ')
      const pos = joined.match(/Roster Positions:?\s*(.+)$/i)
      if (pos && !out.roster_positions.length) {
        out.roster_positions = pos[1]
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t && t.length <= 8) // a sentence is not a slot
      }

      // The scoring table's Receptions row, read from the ROW so a stray "0.5"
      // elsewhere on the page can never be mistaken for it.
      if (out.reception_points === null && cells.length >= 2 && /^receptions?$/i.test(cells[0])) {
        const v = cells.find((c, i) => i > 0 && /^-?\d+(\.\d+)?$/.test(c))
        if (v !== undefined) out.reception_points = v
      }
    }
    return out
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window || e.data?.source !== 'gridiron-yahoo-read-league') return
    const leagueId = String(e.data.leagueId || '')
    if (!/^\d+$/.test(leagueId)) return
    const rows = await readAllRosters(leagueId)
    const settings = await readSettings(leagueId)
    console.log('[gridiron] read', rows.length, 'rostered players from the Yahoo league',
                settings ? `· settings: rec=${settings.reception_points} slots=${settings.roster_positions.length}` : '· settings unreadable')
    window.postMessage(
      { source: 'gridiron-yahoo-league-rosters', leagueId, rows, settings },
      '*',
    )
  })

  console.log('[gridiron] Yahoo league reader ready')
})()
