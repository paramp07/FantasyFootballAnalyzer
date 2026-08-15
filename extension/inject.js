// MAIN-world extractor for the ESPN draft room. Three independent strategies,
// most-reliable first; whichever yields picks wins. Snapshots are posted to
// the isolated-world bridge (content.js) every 2s.
//
// Strategy A: tee the draft WebSocket (runs at document_start so we catch the
//             connection) and accumulate SELECTED/pick events.
// Strategy B: tee fetch() responses for draft/league API payloads with picks.
// Strategy C: parse the Pick History / draft board DOM as a fallback.

;(() => {
  const state = {
    wsPicks: new Map(), // overall -> pick
    apiPicks: new Map(),
    domPicks: new Map(), // overall -> pick, from the Pick History grid
    // ⭐ Rail entries keyed by ROUND:PICK-IN-ROUND, which is what ESPN actually
    // prints — not by overall, which we have to DERIVE from league size.
    //
    // Two bugs die here. (1) `railPicks` used to bail out entirely when league
    // size wasn't known yet, and the rail scrolls, so those picks were gone for
    // good — a silent drop during the exact window when settings are still
    // being read. (2) If league size is first misread and later corrected, every
    // overall derived from the wrong value stayed wrong forever. Keeping the raw
    // reading and deriving on demand means a corrected league size retro-heals
    // the whole board, the same way Yahoo's retro-resolution does.
    rawRail: new Map(), // "round:pickInRound" -> raw entry
    // Overalls the BACKEND says it never received, echoed back on each push.
    // Whether we have them too is the whole diagnosis: if we do, the loss is in
    // push/ingest; if we don't, the scrape missed them.
    backendGaps: [],
    settings: {
      teams: null,
      rounds: null,
      my_slot: null,
      scoring: 'ppr',
      autopick: null, // null = unreadable; never render "unknown" as "off"
      clock_seconds: null,
      draft_type: 'snake',
    },
  }

  // ---------- Strategy A: WebSocket tee ----------
  const RealWS = window.WebSocket
  window.WebSocket = function (...args) {
    const ws = new RealWS(...args)
    try {
      ws.addEventListener('message', (event) => {
        try {
          handleSocketPayload(event.data)
        } catch {
          /* non-JSON frames are fine */
        }
      })
    } catch {
      /* never break the page */
    }
    return ws
  }
  window.WebSocket.prototype = RealWS.prototype
  Object.assign(window.WebSocket, RealWS)

  function handleSocketPayload(data) {
    if (typeof data !== 'string') return
    // ESPN draft frames are JSON (sometimes prefixed) — try to find an object
    const start = data.indexOf('{')
    if (start === -1) return
    const msg = JSON.parse(data.slice(start))
    scanObjectForPicks(msg, state.wsPicks)
  }

  // ---------- Strategy B: fetch tee ----------
  const realFetch = window.fetch
  window.fetch = async function (...args) {
    const resp = await realFetch.apply(this, args)
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || ''
      if (/lm-api|fantasy\.espn\.com\/apis/.test(url)) {
        resp
          .clone()
          .json()
          .then((body) => scanObjectForPicks(body, state.apiPicks))
          .catch(() => {})
      }
    } catch {
      /* never break the page */
    }
    return resp
  }

  // Recursively hunt for pick-shaped objects in any payload
  function scanObjectForPicks(obj, target, depth = 0) {
    if (!obj || typeof obj !== 'object' || depth > 8) return
    if (Array.isArray(obj)) {
      for (const item of obj) scanObjectForPicks(item, target, depth + 1)
      return
    }
    const overall = obj.overallPickNumber ?? obj.overallSelection ?? obj.pickNumber
    const playerId = obj.playerId ?? obj.player?.id
    if (overall && playerId && overall > 0) {
      target.set(Number(overall), {
        overall: Number(overall),
        espn_player_id: Number(playerId),
        player_name: obj.player?.fullName ?? obj.playerName ?? null,
        position: null,
      })
    }
    if (obj.settings) {
      const size = obj.settings.size ?? obj.settings.leagueSize
      if (size) state.settings.teams = Number(size)
    }
    for (const key of Object.keys(obj)) scanObjectForPicks(obj[key], target, depth + 1)
  }

  // ---------- Strategy C: DOM scrape of the Pick History grid ----------
  // Verified live (2026 draft room): rows are virtualized FixedDataTable rows
  //   .fixedDataTableRowLayout_rowWrapper
  // whose text reads "<pick> <Player Name> <TEAM> <POS> <Team Name> ...".
  // The headshot URL carries the ESPN player id, which is what our backend
  // crosswalk keys on — far more reliable than name matching.
  const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'D/ST', 'DST']

  function domPicks() {
    const picks = []
    // ⚠️ CRITICAL: ESPN uses .fixedDataTableRowLayout_rowWrapper for BOTH the
    // Pick History grid AND the available-players list. The players list's
    // first column is RANK, not pick number — scraping it invents picks
    // (measured live: "rank 28 Chris Olave" became "pick 28"). Only accept
    // rows that are NOT inside a players-table.
    document.querySelectorAll('.fixedDataTableRowLayout_rowWrapper').forEach((row) => {
      if (row.closest('.players-table, [class*="players-table"]')) return
      if (row.querySelector('button, [class*="queue"]')) return // QUEUE/DRAFT buttons = player list
      const text = (row.innerText || '').replace(/\s+/g, ' ').trim()
      const m = text.match(/^(\d{1,3})\s+(.+)$/)
      if (!m) return
      const overall = Number(m[1])
      if (!overall || overall > 400) return

      const img = row.querySelector('img[src*="headshots"]')?.src || ''
      const espnId = (img.match(/full\/(\d+)\.png/) || [])[1]

      // "Jaxon Smith-Njigba SEA WR Tim's Top Team 359.9 326.8 5"
      const rest = m[2]
      let name = rest
      let position = null
      let proTeam = null
      const posMatch = rest.match(/^(.+?)\s+([A-Z]{2,3})\s+(QB|RB|WR|TE|K|D\/ST|DST)\b/)
      if (posMatch) {
        name = posMatch[1].trim()
        proTeam = posMatch[2]
        position = posMatch[3] === 'D/ST' ? 'DEF' : posMatch[3]
      } else {
        const dstMatch = rest.match(/^(.+?D\/ST)\b/)
        if (dstMatch) {
          name = dstMatch[1].trim()
          position = 'DEF'
        }
      }
      // strip an injury/news tag glued to the name (e.g. "Jahmyr Gibbs Q")
      name = name.replace(/\s+(Q|O|IR|D|SSPD|P)$/, '').trim()

      picks.push({
        overall,
        espn_player_id: espnId ? Number(espnId) : null,
        player_name: name,
        position,
        pro_team: proTeam,
      })
    })
    // The grid is virtualized (only visible rows exist), so merge into a
    // running map rather than replacing — we keep every pick we've ever seen.
    for (const p of picks) state.domPicks.set(p.overall, p)
    return [...state.domPicks.values()]
  }

  // ⭐ PRIMARY SOURCE: the right-rail pick feed. Unlike the Pick History grid
  // it is always rendered regardless of which tab the user has open, and each
  // entry carries round, pick-in-round, the ESPN player id (headshot URL),
  // position and pro team:
  //   "Bijan Robinson / ATL RB  R1, P1 - Jake's Finest Team"
  function railPicks() {
    document
      .querySelectorAll('[class*="pick-message"], [class*="pickMessage"]')
      .forEach((el) => {
        // innerText needs layout, and a throttled background tab is precisely
        // the case this path exists for — fall back to textContent, which never
        // does. Whitespace is normalised below either way.
        const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()
        const rp = text.match(/R(\d+),\s*P(\d+)/i)
        if (!rp) return
        const round = Number(rp[1])
        const pickInRound = Number(rp[2])
        // Round+pick is ESPN's own numbering and needs nothing from us. Record
        // it whether or not league size is known yet; the overall is derived
        // later, and re-derived if league size is ever corrected.
        const key = `${round}:${pickInRound}`
        if (state.rawRail.has(key)) return // already parsed; feed renders duplicates

        const img = el.querySelector('img[src*="headshots"]')?.src || ''
        const espnId = (img.match(/full\/(\d+)\.png/) || [])[1]
        // "Name / TEAM POS  R1, P1 - Team Name"
        const m = text.match(/^(.+?)\s*\/\s*([A-Z]{2,3})\s+(QB|RB|WR|TE|K|D\/ST|DST)\b/)
        state.rawRail.set(key, {
          round,
          pickInRound,
          espn_player_id: espnId ? Number(espnId) : null,
          player_name: m ? m[1].trim() : text.split('/')[0].trim(),
          position: m ? (m[3] === 'D/ST' ? 'DEF' : m[3]) : null,
          pro_team: m ? m[2] : null,
        })
      })
  }

  /** Rail entries as picks, with the overall derived from the CURRENT league
   *  size. Recomputed every snapshot rather than cached, so a league size that
   *  arrives late — or arrives wrong and is corrected — fixes every rail pick
   *  at once instead of leaving a board built on a stale number. */
  function railAsPicks() {
    const teams = state.settings.teams
    if (!teams) return []
    const out = new Map()
    for (const r of state.rawRail.values()) {
      out.set((r.round - 1) * teams + r.pickInRound, {
        overall: (r.round - 1) * teams + r.pickInRound,
        espn_player_id: r.espn_player_id,
        player_name: r.player_name,
        position: r.position,
        pro_team: r.pro_team,
      })
    }
    return [...out.values()]
  }

  // League size / rounds / my slot, read from the draft-room chrome.
  // Verified against the live 2026 room; every value has a fallback because
  // ESPN reshuffles this markup between seasons.
  function readSettings() {
    // Teams — three independent sources, most specific first:
    //  1. header title: "Pro 12-Team H2H Points PPR Mock"
    //  2. the roster dropdown (exactly one <option> per team)
    //  3. leave whatever we already had
    const headerText = document.querySelector('[class*="draft-header"]')?.innerText || document.title
    const headerTeams = (headerText.match(/(\d{1,2})-Team/i) || [])[1]
    if (headerTeams) {
      state.settings.teams = Number(headerTeams)
    } else {
      // NOTE: querySelectorAll('.draft-column select option') spans MULTIPLE
      // selects (measured 59 in a 12-team room) — always scope to one select.
      const rosterSelect = document.querySelector('.draft-column select')
      if (rosterSelect && rosterSelect.options.length > 1) {
        state.settings.teams = rosterSelect.options.length
      }
    }

    // Rounds — "RND 1 OF 16", or infer from the roster limit ("0/16 Players")
    const rnd = (document.body.innerText.match(/RND\s*\d+\s*OF\s*(\d+)/i) || [])[1]
    if (rnd) {
      state.settings.rounds = Number(rnd)
    } else {
      const limit = (document.body.innerText.match(/\d+\s*\/\s*(\d+)\s*Players/i) || [])[1]
      if (limit) state.settings.rounds = Number(limit)
    }

    // Scoring — read from the room title/settings text.
    //
    // ⚠️ ORDER IS LOAD-BEARING. ESPN labels a standard room "No Points-Per-
    // Reception", which CONTAINS the word Reception — so a naive /ppr|points
    // per reception/ test marks a standard league as PPR and every projection
    // on the board is then wrong by ~50 points per WR. Negation must be
    // checked before the positive match.
    const scoringText = `${headerText} ${document.body.innerText.slice(0, 4000)}`
    if (/half[\s-]?ppr|0\.5\s*ppr/i.test(scoringText)) {
      state.settings.scoring = 'half_ppr'
    } else if (/no\s*[-\s]?points?[-\s]?per[-\s]?reception|non[-\s]?ppr|no\s+ppr/i.test(scoringText)) {
      state.settings.scoring = 'std'
    } else if (/\bppr\b|points[-\s]?per[-\s]?reception/i.test(scoringText)) {
      state.settings.scoring = 'ppr'
    } else if (/standard/i.test(scoringText)) {
      state.settings.scoring = 'std'
    }

    // My slot — ".own-pick" marks our seat in the pick train. The train shows
    // upcoming picks, so any of our picks resolves the same slot via snake math.
    const own = document.querySelector('.pick-component.own-pick')
    const teams = state.settings.teams
    if (own && teams) {
      const n = (own.innerText.match(/PICK\s*(\d+)/i) || [])[1]
      if (n) {
        const overall = Number(n)
        const round = Math.ceil(overall / teams)
        const idx = overall - (round - 1) * teams
        state.settings.my_slot = round % 2 === 1 ? idx : teams - idx + 1
      }
    }

    state.settings.autopick = debounceAutopick(readAutopick())
    state.settings.clock_seconds = readClock()
    state.settings.draft_type = readDraftType()
  }

  // Snake vs auction. Everything downstream — slot math, run risk, tiers, the
  // whole board — assumes snake, so an auction room must be REFUSED loudly
  // rather than silently rendered as a nonsense snake board.
  //
  // Found live 2026-07-31: joined a "Salary Cap" mock by mistake and the app
  // cheerfully reported teams=12 rounds=16 slot=1 and produced a full board.
  // Nothing said it was wrong. On draft night that is a lost draft.
  function readDraftType() {
    const header = document.querySelector('[class*="draft-header"]')?.innerText || ''
    const body = document.body.innerText || ''
    if (/salary\s*cap|auction/i.test(header + ' ' + document.title)) return 'auction'
    // Budget columns + nomination language are the unambiguous auction tells.
    if (/\bnominat/i.test(body) && /\$\s?\d{2,3}/.test(body)) return 'auction'
    return 'snake'
  }

  // Autopick races the council and always wins — it fires the instant we're on
  // the clock, while a verdict takes ~25s. We can't turn it off for the user
  // (that would be automating their ESPN account), but we CAN tell them it's on.
  // Returns null, not false, when unreadable — "we don't know" must not render
  // as "you're safe".
  function readAutopick() {
    // ESPN tags every UPCOMING pick in the train with `autopick` when that
    // team is on auto — ours and everyone else's. Verified live 2026-07-31:
    //   "PICK 61 AUTO Jon's Scary Team"  -> .pick-component.autopick
    //   "PICK 62 Tim's Talented Team"    -> .pick-component.own-pick (no autopick)
    //
    // ⚠️ TRI-STATE, and the false branch is the important one. Returning null
    // for "off" made the reading STICKY: the backend only overwrites on a
    // non-null value, so once we saw true it could never be cleared, and the
    // war room kept warning about autopick long after the user turned it off.
    // A warning that stays on after you fix the thing is worse than no warning.
    //
    // If our own upcoming picks are on screen we can answer definitively:
    // any of them carrying `autopick` means on, none means OFF. Only when the
    // train has no pick of ours at all is the answer genuinely unknown.
    const mine = document.querySelectorAll('.pick-component.own-pick')
    if (mine.length) {
      return [...mine].some((el) => el.classList.contains('autopick'))
    }
    // ⚠️ DO NOT promote this above the pick-train read. There IS a real
    // "Autopick" switch in the Pick Queue header (`.autoPick-container`), but
    // measured live 2026-07-31 its input reported `checked: true` while the
    // switch was visibly OFF and the user had definitely disabled it. ESPN's
    // checkbox semantics here are inverted or otherwise not what they look
    // like, so trusting it would resurrect the false-positive warning. The
    // pick train agreed with both the screen and the user; this does not.
    const toggle = document.querySelector(
      '[class*="autopick"] input[type="checkbox"], input[type="checkbox"][class*="autopick"]'
    )
    if (toggle) return Boolean(toggle.checked)
    const m = document.body.innerText.match(/AUTOPICK\s*[:\-]?\s*(ON|OFF|ENABLED|DISABLED)/i)
    if (m) return /ON|ENABLED/i.test(m[1])
    return null // genuinely unreadable — must not render as "you're safe"
  }

  // Autopick flaps: ESPN briefly tags our own pick component while rendering
  // the "your autopick would be X" preview as we come on the clock, so a raw
  // read spikes true for ~2s every turn. Measured four times in the 2026-07-31
  // mock, each clearing itself within seconds.
  //
  // Require the same answer twice in a row before reporting a CHANGE. A banner
  // that blinks on and off teaches the user to ignore it, which costs us the
  // one warning that matters — the same lesson as the false sync alarm.
  let apLast = null
  let apStable = null
  function debounceAutopick(reading) {
    const prev = apLast
    apLast = reading
    if (reading === prev) apStable = reading
    return apStable
  }

  // Seconds left on the current pick. Lets the war room show a timer and drop
  // the council to fast mode when there isn't time for the full debate.
  function readClock() {
    // ⭐ The real ESPN clock (verified live 2026-07-31): each DIGIT is its own
    // element, `.clock__digit`, inside a `.clock__digits` container — so
    // "00:29" is four separate nodes reading 0,0,2,9 and there is NO node whose
    // text is "00:29". Every mm:ss selector and regex therefore found nothing,
    // the clock read as unknown, and fast mode ran on every single pick —
    // silently downgrading the 4-seat council to a single advisor all draft.
    const box = document.querySelector('.clock__digits')
    if (box) {
      const digits = [...box.querySelectorAll('.clock__digit')]
        .map((d) => (d.innerText || '').trim())
        .join('')
      if (/^\d{3,4}$/.test(digits)) {
        return Number(digits.slice(0, -2)) * 60 + Number(digits.slice(-2))
      }
    }
    const el = document.querySelector('[class*="time-remaining"], [class*="timeRemaining"], [class*="draft-clock"]')
    const text = (el?.innerText || '').trim()
    const mmss = text.match(/(\d{1,2}):(\d{2})/)
    if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2])
    // Some layouts render a bare seconds count in the final minute.
    const bare = text.match(/^(\d{1,3})\s*s?$/i)
    if (bare) return Number(bare[1])
    // Fallback: the room prints its countdown in plain text, e.g.
    // "DRAFTING IN 00:18" pre-draft and a mm:ss pick clock once live.
    const inline = (document.body.innerText || '').match(
      /(?:ON THE CLOCK|DRAFTING IN|TIME LEFT|TIME REMAINING)[^\d]{0,12}(\d{1,2}):(\d{2})/i
    )
    return inline ? Number(inline[1]) * 60 + Number(inline[2]) : null
  }

  // ---------- Capture: event-driven, because timers stop ----------
  //
  // ⭐ THE ESPN PICK-LOSS FIX. Everything scraped accumulates in Maps that are
  // never cleared, so a pick is lost only if it was in the DOM at no instant we
  // looked. The 2026-08-01 mock lost picks 62-66 — a CONTIGUOUS run, which
  // rules out undersampling (that scatters) and means a window with no reads at
  // all. Modelled: ~20s of blindness at 2s/pick, which is under the 30s
  // stale-sync threshold, so nothing on screen could have said so.
  //
  // Two things produce a window like that, and both were live in this file:
  //
  //   1. `setInterval` is throttled in a BACKGROUND tab — >=1s, and once a
  //      minute after five minutes. Our own war room is a separate tab, so a
  //      backgrounded draft room is the NORMAL case here, not the exception.
  //   2. `railPicks` returned nothing whenever league size was momentarily
  //      unreadable, and the rail scrolls, so that window was gone for good.
  //
  // A MutationObserver is immune to both: it is not a timer, and it now records
  // ESPN's own round+pick without needing league size. Emission is event-driven
  // for the same reason — an observer that captures a pick a throttled timer
  // never ships has fixed nothing. Intervals remain underneath as a floor.
  const CAPTURE_MS = 400
  const EMIT_FLOOR_MS = 500
  let railObserver = null
  let lastEmitAt = 0
  let lastRailSize = 0

  function capture() {
    readSettings()
    railPicks()
    // A newly rendered pick ships immediately rather than waiting for a timer
    // that may be throttled. Floor is checked against the clock, not scheduled,
    // so it survives throttling too.
    if (state.rawRail.size !== lastRailSize && Date.now() - lastEmitAt >= EMIT_FLOOR_MS) {
      lastRailSize = state.rawRail.size
      emit()
    }
  }

  // Observe the rail feed's own container, not the whole document: a draft room
  // mutates constantly (the clock alone ticks every second), so a document-wide
  // observer would fire on everything and buy nothing over a plain interval.
  // The container appears only once the first pick lands, and ESPN may replace
  // it, so re-attachment is checked every tick rather than assumed.
  function attachRailObserver() {
    const container = document.querySelector(
      '[class*="pick-message"], [class*="pickMessage"]'
    )?.parentElement
    if (!container || container === railObserver?.__target) return
    railObserver?.disconnect()
    railObserver = new MutationObserver(capture)
    railObserver.__target = container
    railObserver.observe(container, { childList: true, subtree: true })
  }

  setInterval(() => {
    capture()
    attachRailObserver()
  }, CAPTURE_MS)

  // Heartbeat: a full read (including the expensive grid scan) and an
  // unconditional emit, so a quiet draft still proves the extension is alive.
  setInterval(emit, 2000)

  // ---------- Snapshot ----------
  function emit() {
    lastEmitAt = Date.now()
    const grid = domPicks() // expensive (whole-table scan)
    // Rail and grid are both partial views of the same board, so merge rather
    // than choosing: the rail is always rendered but short, the grid is long but
    // only exists on a tab the user may never open.
    const merged = new Map()
    for (const p of railAsPicks()) merged.set(p.overall, p)
    for (const p of grid) merged.set(p.overall, p)
    const scraped = [...merged.values()]
    // Prefer structured sources when available; DOM is the proven fallback.
    const source = state.wsPicks.size >= scraped.length
      ? state.wsPicks
      : state.apiPicks.size >= scraped.length
        ? state.apiPicks
        : null
    const picks = source ? [...source.values()] : scraped
    reportGaps(picks)
    if (!picks.length && !state.settings.teams) return
    postSnapshot(picks)
  }

  function postSnapshot(picks) {
    window.postMessage(
      {
        source: 'gridiron-espn-sync',
        snapshot: {
          picks: picks.sort((a, b) => a.overall - b.overall),
          teams: state.settings.teams || 12,
          rounds: state.settings.rounds || 16,
          my_slot: state.settings.my_slot || 1,
          scoring: state.settings.scoring,
          autopick: state.settings.autopick ?? null,
          clock_seconds: state.settings.clock_seconds ?? null,
          draft_type: state.settings.draft_type || 'snake',
          // ESPN's own league+team, straight from the URL. The backend derives a
          // deterministic session id from this, so reloading the draft tab
          // re-attaches instead of minting a duplicate — Yahoo got this fix on
          // 2026-08-01 and ESPN did not, which left NINETEEN sessions alive for
          // one draft. league+team, not league alone: two people drafting in the
          // same league on one machine are genuinely different sessions.
          external_id: espnExternalId(),
          // The league's REAL lineup + scoring, read from the user's own
          // session. Null when unreadable — the backend then keeps its
          // fallback and the UI says the slots are assumed.
          espn_settings: leagueSettings,
        },
      },
      '*'
    )
  }

  // The backend echoes back every overall it never received. Two very different
  // failures look identical in the war room, and this is what tells them apart:
  // if WE have the pick, the loss is downstream (push, ingest, merge); if we
  // don't, the scrape genuinely missed it and no amount of re-pushing helps.
  // Logged rather than silently retried, because a full snapshot goes up every
  // 2s already — anything we hold is being re-sent continuously, so a gap that
  // persists is information, not something to retry harder.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'gridiron-espn-gaps') return
    state.backendGaps = event.data.gaps || []
  })

  let lastGapReport = ''
  function reportGaps(picks) {
    if (!state.backendGaps.length) return
    const ours = new Set(picks.map((p) => p.overall))
    const held = state.backendGaps.filter((n) => ours.has(n))
    const lost = state.backendGaps.filter((n) => !ours.has(n))
    const line = `${held.join(',')}|${lost.join(',')}`
    if (line === lastGapReport) return // don't spam a stable hole every 2s
    lastGapReport = line
    // console.LOG, not warn. Chrome files every content-script console.warn
    // under "Errors" on the extensions page, so a diagnostic working exactly as
    // designed reads as a crash — and this project's rule is that a false alarm
    // spends the credibility of the real one. Gaps have a proper home already:
    // the amber banner in the war room, with a button that fixes them.
    if (held.length) {
      console.log('[gridiron] backend missing picks WE HAVE (re-pushing):', held)
    }
    if (lost.length) {
      console.log('[gridiron] picks the scrape never saw:', lost,
        '— press "Recover" in the war room, or enter them by hand')
    }
  }

  // ---------- Pick recovery from the roster panel ----------
  //
  // ESPN has no equivalent of Yahoo's `P|` history frame and its server-side API
  // is empty mid-draft, so a page refresh loses whatever landed during it — for
  // good. The room's ONE complete record of who has been drafted is the roster
  // panel, and it shows a single team at a time behind a team <select>.
  //
  // So we cycle it. Deliberately ONLY when the user has asked (the backend sets
  // the flag from a war-room button): this moves their view for about a second,
  // and doing that unannounced while someone is on the clock is exactly the kind
  // of surprise this project refuses to ship.
  const ROSTER_SETTLE_MS = 140

  function readVisibleRoster() {
    const mod =
      document.querySelector('.roster-module') ||
      document.querySelector('[class*="roster w-100"]')
    if (!mod) return []
    const out = []
    // ⭐ Read the TABLE, not the text. The panel is a real <table> whose rows
    // carry three cells — POS / PLAYER / BYE — and innerText puts every cell on
    // its own line, so any line-based parse sees "QB", "Empty", "-" as three
    // separate rows and matches nothing.
    //
    // The first version of this WAS line-based and shipped green: the test
    // fixture had been built by hand from an innerText dump I had already
    // whitespace-collapsed, so it encoded my own transformation rather than
    // ESPN's markup. It recovered 0 picks live while every test passed. A
    // fixture derived from data you already transformed is not a capture.
    for (const tr of mod.querySelectorAll('tr')) {
      const cells = [...tr.querySelectorAll('td,th')].map((c) =>
        (c.innerText || c.textContent || '').replace(/\s+/g, ' ').trim()
      )
      if (cells.length < 3) continue
      const [slotRaw, name, bye] = cells
      if (!name || /^Empty$/i.test(name) || /^PLAYER$/i.test(name)) continue
      // A bench row names its own position: "D. Moore (WR)".
      const posInName = name.match(/\((QB|RB|WR|TE|K|D\/ST)\)\s*$/i)
      const slot = (slotRaw || '').toUpperCase()
      const position = posInName
        ? posInName[1].toUpperCase()
        : ['FLEX', 'BE', 'BENCH', 'IR'].includes(slot)
          ? null
          : slot || null
      out.push({
        name,
        position,
        bye_week: bye === '-' ? null : Number(bye) || null,
      })
    }
    return out
  }

  async function readAllRosters() {
    const select = document.querySelector('.roster__dropdown select')
    if (!select) return [{ team_name: null, players: readVisibleRoster() }]
    const original = select.selectedIndex
    const rosters = []
    try {
      for (let i = 0; i < select.options.length; i++) {
        select.selectedIndex = i
        select.dispatchEvent(new Event('change', { bubbles: true }))
        await new Promise((r) => setTimeout(r, ROSTER_SETTLE_MS))
        rosters.push({
          team_name: (select.options[i].text || '').trim(),
          players: readVisibleRoster(),
        })
      }
    } finally {
      // ALWAYS put their view back, including if a read throws halfway.
      select.selectedIndex = original
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return rosters
  }

  let recovering = false
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'gridiron-espn-recover') return
    if (recovering) return
    recovering = true
    try {
      const rosters = await readAllRosters()
      const filled = rosters.reduce((n, r) => n + r.players.length, 0)
      console.log(`[gridiron] read ${rosters.length} rosters, ${filled} players`)
      window.postMessage({ source: 'gridiron-espn-rosters', rosters }, '*')
    } catch (e) {
      console.log('[gridiron] roster read failed:', e)
    } finally {
      recovering = false
    }
  })

  console.log('[gridiron] ESPN draft extractor armed (ws+fetch+dom)')

  // A stable identity for THIS drafter in THIS league, read from the room URL
  // (…/draft?leagueId=596671507&seasonId=2026&teamId=2). Null when either part
  // is missing, which falls the backend back to a random id rather than letting
  // two different drafts collide on a half-known key.
  // ⭐ THE LEAGUE'S REAL LINEUP AND SCORING, WITHOUT ASKING FOR COOKIES.
  //
  // ESPN's draft room never shows the lineup settings, so a superflex league
  // was ranked as 1-QB and a PPR league as whatever the header said. The
  // backend could read them with `espn_s2`+`SWID` on file — but pasting
  // cookies is a barrier most users will never cross, and the whole point of
  // shipping this is that it works for people who are not us.
  //
  // Measured 2026-08-03: `lm-api-reads.fantasy.espn.com` answers a CREDENTIALED
  // cross-origin fetch from an ESPN page (ESPN reflects the origin with
  // access-control-allow-credentials), so the user's own already-authenticated
  // browser can read it with no credential handled by us at all — the same
  // posture as teeing the draft socket.
  //
  // Non-fatal by design: a private league, a logged-out session or an ESPN
  // change leaves `roster_slots` null, and the backend keeps its fallback and
  // says the slots are assumed. Read ONCE per room, not per push.
  let leagueSettings = null
  let leagueSettingsTried = false

  async function readLeagueSettings() {
    if (leagueSettingsTried) return leagueSettings
    leagueSettingsTried = true
    try {
      const q = new URLSearchParams(location.search)
      const leagueId = q.get('leagueId')
      const season = q.get('seasonId') || new Date().getFullYear()
      if (!leagueId) return null
      const url =
        `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}` +
        `/segments/0/leagues/${leagueId}?view=mSettings`
      const r = await fetch(url, { credentials: 'include' })
      if (!r.ok) return null
      const j = await r.json()
      const counts = j?.settings?.rosterSettings?.lineupSlotCounts || null
      const items = j?.settings?.scoringSettings?.scoringItems || []
      const rec = items.find((x) => x.statId === 53)
      leagueSettings = {
        lineup_slot_counts: counts,
        reception_points: rec ? rec.points : null,
      }
      console.log('[gridiron] read ESPN league settings from the user\'s own session',
                  leagueSettings)
    } catch {
      leagueSettings = null // never break the draft over a settings read
    }
    return leagueSettings
  }
  readLeagueSettings()

  function espnExternalId() {
    try {
      const q = new URLSearchParams(location.search)
      const league = q.get('leagueId')
      const team = q.get('teamId')
      return league && team ? `${league}-${team}` : null
    } catch {
      return null
    }
  }
})()
