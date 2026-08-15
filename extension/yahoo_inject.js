// MAIN-world extractor for the Yahoo draft room.
//
// Yahoo turned out to be the CLEANEST of the three platforms: the draft room
// runs a compact pipe-protocol WebSocket that carries everything, so there is
// NO DOM scraping at all (and none of the players-list-vs-pick-history trap
// that bit ESPN). Decoded live 2026-07-31 and verified against the crosswalk:
//
//   0|<overall>|<yahooPlayerId>|<teamId>|<slot>|<flag>   THE PICK
//   D|<overall>|<teamOnClock>|<clockSeconds>             turn advance
//   C|<seconds>                                          clock tick (live!)
//   A|<team>=<0|1>|...                                   autopick per team
//   R|<slot>|<slot>|...                                  full snake order
//   H|S|...  J|<t>  L|<t>  P|...  Q  w|...  G|...  g|...  setup / grades (ignored)
//
// Everything else (draft id, our slot) is in the URL path:
//   /draftclient/f1/<draftId>/<ourSlot>
//
// We tee the user's OWN already-open socket - read-only, their session, no
// token handled, no auth question. Snapshots go to content.js exactly like the
// ESPN door; the backend resolves yahoo ids via resolve_yahoo (separation
// rule: an explicitly-named yahoo_player_id, never a generic id).

;(() => {
  const path = location.pathname.match(/draftclient\/f1\/(\d+)\/(\d+)/)
  const DRAFT_ID = path ? path[1] : null
  // ⭐ The trailing URL number is our TEAM id, NOT our draft slot. They are
  // identical in every mock draft (teams join in draft order) and DIFFER in a
  // real league with a randomised order — live 2026-08-02, team 5 drafted at
  // slot 6, so another manager's pick sat on the user's roster and every
  // "your turn" calculation was one pick out. Kept as the provisional slot
  // because a board needs one, but replaced the moment the socket proves the
  // real value: 0|/P| frames carry the team id per pick, so the first pick our
  // team makes tells us our slot exactly.
  const MY_TEAM_ID = path ? Number(path[2]) : null
  const MY_SLOT = MY_TEAM_ID

  const state = {
    picks: new Map(), // overall -> { overall, yahoo_player_id, slot, team_id }
    mySlotConfirmed: null, // derived from OUR team's first pick; null until proven
    feedOpen: null, // socket state: null = never connected, false = dead
    names: new Map(), // yahooId -> { name, position } from Yahoo's own API
    teams: null,
    rounds: null,
    clock: null,
    autopick: null, // our team's flag, or null if not yet seen
    currentPick: null,
  }

  // Yahoo's socket sends an id but NO name. The id→name map is filled from the
  // socket's own O|draft-labels frames (see handleFrame) — Yahoo naming its own
  // players. (A window.fetch tee of the pub-api was tried first and never fired;
  // the room doesn't fetch its player list that way. Removed 2026-08-01 —
  // resolution is now stats_id + DEF table server-side, plus these O-frames.)

  const RealWS = window.WebSocket
  window.WebSocket = function (...args) {
    const ws = new RealWS(...args)
    try {
      ws.addEventListener('message', (event) => {
        state.feedOpen = true
        try {
          handleFrame(event.data)
        } catch {
          /* one bad frame must never break the page */
        }
      })
      ws.addEventListener('open', () => { state.feedOpen = true })
      // ⭐ A DEAD SOCKET MUST NOT LOOK LIKE A LIVE ONE.
      // Live 2026-08-02: the laptop slept mid-draft, Yahoo's socket errored out
      // ("Error connecting to draft server") and never reconnected — while the
      // extension kept re-pushing its frozen 128-pick snapshot every 10s as a
      // heartbeat. Sync read healthy, the draft finished without us, and 22
      // picks were lost permanently. The heartbeat proves the EXTENSION is
      // alive; it says nothing about the FEED. Now the snapshot carries the
      // socket's own state, so the war room can tell the user to reload.
      ws.addEventListener('close', () => { state.feedOpen = false })
      ws.addEventListener('error', () => { state.feedOpen = false })
    } catch {
      /* never break the page */
    }
    return ws
  }
  window.WebSocket.prototype = RealWS.prototype
  Object.assign(window.WebSocket, RealWS)

  // Yahoo positions/slots → our canonical set.
  function normPos(p) {
    if (!p) return null
    const u = String(p).toUpperCase()
    if (u === 'DEF' || u === 'DST' || u === 'D/ST') return 'DEF'
    if (['QB', 'RB', 'WR', 'TE', 'K'].includes(u)) return u
    return null // flex slots (W/R/T) tell us nothing about the actual position
  }
  function slotToPos(slot) {
    // The socket's slot field is the ROSTER slot filled, not always the position
    // (W/R/T is a flex). Only trust it when it's a real position.
    return normPos(slot)
  }

  const _seenTags = new Set()
  // Snake math, the extension's half: which draft slot made this overall pick.
  function slotForOverall(overall, teams) {
    const round = Math.ceil(overall / teams)
    const idx = overall - (round - 1) * teams // 1..teams within the round
    return round % 2 === 1 ? idx : teams - idx + 1
  }

  // Our real draft slot, PROVEN rather than assumed: find any pick our team
  // made and read the slot off snake math. Needs the team count, which arrives
  // with R| (or the max team id seen). Sets state.mySlotConfirmed once, and
  // only from evidence — an unproven slot stays null so the backend keeps its
  // provisional value instead of being handed a second guess.
  function deriveMySlot() {
    if (state.mySlotConfirmed || !MY_TEAM_ID) return
    const teams = state.teams
    if (!teams) return
    for (const p of state.picks.values()) {
      if (p.team_id === MY_TEAM_ID && p.overall > 0) {
        const slot = slotForOverall(p.overall, teams)
        if (slot >= 1 && slot <= teams) {
          state.mySlotConfirmed = slot
          if (slot !== MY_TEAM_ID) {
            console.log('[gridiron] draft slot is', slot, '- the room URL says team',
                        MY_TEAM_ID, '(randomised draft order)')
          }
        }
        return
      }
    }
  }

  function handleFrame(data) {
    if (typeof data !== 'string' || !data.length) return
    const parts = data.split('|')
    const tag = parts[0]
    // Log each never-before-seen frame tag once. The autopick toggle-off frame
    // is not the connect-time A frame; this surfaces whatever carries it so the
    // parser can be built from a real capture rather than a guess.
    const KNOWN = '0DCARHJLQPwGg56O'
    if (!KNOWN.includes(tag) || (tag === 'A' && _seenTags.has('A'))) {
      console.log('[gridiron-frame]', data.slice(0, 160))
    } else if (!_seenTags.has(tag)) {
      console.log('[gridiron-frame] first ' + tag + ':', data.slice(0, 120))
    }
    _seenTags.add(tag)

    if (tag === '0') {
      // 0|overall|yahooPlayerId|teamId|slot|flag  - THE PICK
      const overall = Number(parts[1])
      const yahooId = Number(parts[2])
      if (overall > 0 && yahooId > 0) {
        state.picks.set(overall, {
          overall, yahoo_player_id: yahooId, slot: parts[4] || null,
          team_id: Number(parts[3]) || null,
        })
        deriveMySlot()
      }
    } else if (tag === 'P') {
      // P|<overall>=<yahooPlayerId>,<teamId>,<flag>|...  - THE FULL PICK HISTORY,
      // replayed by Yahoo on every connect. This is the automatic backfill that
      // ends the socket's forward-only limitation: a mid-draft join, a tab
      // reload, or an extension reload now recovers every pick already made
      // instead of silently starting from "now" (a reload dropped 3 picks at bot
      // pace and 1 at human pace before this - each one a player who then read as
      // available forever). Captured in the very first recon dump and mis-filed
      // as setup noise for two days.
      //
      // Never overwrite a pick we already have: the 0| frames carry the roster
      // slot too, and this frame doesn't.
      for (let i = 1; i < parts.length; i++) {
        const eq = parts[i].indexOf('=')
        if (eq === -1) continue
        const overall = Number(parts[i].slice(0, eq))
        const csv = parts[i].slice(eq + 1).split(',')
        const yahooId = Number(csv[0])
        if (overall > 0 && yahooId > 0 && !state.picks.has(overall)) {
          state.picks.set(overall, {
            overall, yahoo_player_id: yahooId, slot: null,
            team_id: Number(csv[1]) || null,
          })
        }
      }
    } else if (tag === 'D') {
      // D|overall|teamOnClock|clock - a new pick is on the clock
      state.currentPick = Number(parts[1]) || state.currentPick
      if (parts[3] != null) state.clock = Number(parts[3])
    } else if (tag === 'C') {
      // C|seconds - live clock tick
      const s = Number(parts[1])
      if (!Number.isNaN(s)) state.clock = s
    } else if (tag === 'A') {
      // A|team=flag|... - CONNECT-ONLY, and we use it ONLY for the team count.
      //
      // Its per-slot flag is NOT a trustworthy reading of our own autopick:
      // observed live 2026-08-01 reporting 1 for our slot while Yahoo's Autodraft
      // button was visibly OFF, in a fresh draft where no toggle had happened.
      // Its real meaning is unconfirmed (bot-managed slot? queue enabled?), so per
      // the rule this project keeps relearning - "unknown" and "a real value" must
      // never be the same value - it must not produce a confident "Autopick is ON".
      //
      // Autopick therefore comes from the 5|/6| toggle frames (proven correct
      // live, both directions) or, failing any signal, the backend's behavioural
      // autopick_suspected inference - which is exactly how Sleeper works, since
      // it exposes no toggle at all. A missed warning degrades to the effect-based
      // catch; a false one trains the user to ignore the banner that saves them.
      if (state.teams == null) state.teams = parts.length - 1
    } else if (tag === '5' || tag === '6') {
      // Per-team autopick TOGGLE. The batch A frame is sent only at CONNECT, so a
      // mid-draft toggle rides these single-slot frames: 5|<slot> = autopick ON,
      // 6|<slot> = OFF. Decoded live 2026-08-01 — toggling on/off produced
      // 5,6,5,6 in lockstep with the switch. This is what fixes the latch: the
      // war room's "Autopick is ON" no longer sticks after you turn it off.
      // Filter to OUR slot; other teams' toggles are noise. (Polarity re-confirmed
      // every mock: turning it OFF must clear the warning within ~2s.)
      if (Number(parts[1]) === MY_SLOT) state.autopick = tag === '5'
    } else if (tag === 'R') {
      // R|slot|slot|... - the full snake order; length / teams = rounds
      const order = parts.slice(1).filter((x) => x !== '')
      if (state.teams == null && order.length) {
        state.teams = Math.max(...order.map(Number))
      }
      if (state.teams) state.rounds = Math.round(order.length / state.teams)
      deriveMySlot() // the team count is the missing half of the derivation
    } else if (tag === 'O') {
      // O|draft-labels|<n>|[{playerId,playerName,position,team,...}] - Yahoo's own
      // player labels. This is our id->name source: Yahoo sends DEFENSES as opaque
      // 100000+ ids the DynastyProcess crosswalk can't map (they aren't players),
      // so a drafted defense was invisible and the AI kept recommending one already
      // gone. These frames carry the real name ("Los Angeles Rams") which the
      // backend name-matches to our team-abbrev defense. Also backfills any other
      // id gap, straight from Yahoo. Self-healing: a later push re-resolves a pick
      // once its label arrives (ingest merges by overall).
      try {
        const start = data.indexOf('[')
        if (start !== -1) {
          for (const e of JSON.parse(data.slice(start))) {
            const id = Number(e.playerId ?? e.player_id)
            const nm = e.playerName || e.name
            if (id > 0 && typeof nm === 'string' && nm.length > 1) {
              state.names.set(id, { name: nm, position: e.position || null })
            }
          }
        }
      } catch {
        /* a malformed label frame must never break sync */
      }
    }
  }

  // Push a full snapshot every 2s - idempotent and self-healing, same contract
  // as the ESPN door. Wait until we know league size so a half-initialised
  // socket never produces a nonsense board.
  setInterval(() => {
    if (!DRAFT_ID || !MY_SLOT || !state.teams) return
    window.postMessage(
      {
        source: 'gridiron-espn-sync', // content.js decides platform from host
        snapshot: {
          picks: [...state.picks.values()]
            .sort((a, b) => a.overall - b.overall)
            .map((p) => {
              const meta = state.names.get(p.yahoo_player_id)
              return {
                overall: p.overall,
                yahoo_player_id: p.yahoo_player_id,
                // name/position let the backend name-match on a crosswalk miss.
                player_name: meta ? meta.name : null,
                position: normPos(meta?.position || slotToPos(p.slot)),
              }
            }),
          teams: state.teams,
          rounds: state.rounds || 15,
          my_slot: MY_SLOT,
          // Sent only once proven from the draft order; the backend prefers it
          // over the room URL's team id and corrects the session in place.
          my_slot_confirmed: state.mySlotConfirmed,
          // Is the draft-room socket actually alive? A frozen snapshot pushed
          // by a healthy extension is the "green light over a dead feed"
          // failure this project already named once.
          feed_connected: state.feedOpen,
          // Yahoo's OWN draft id (stable across reloads). The backend derives a
          // deterministic session id from it, so reloading the draft tab
          // re-attaches to the same session instead of spawning a duplicate that
          // — because the socket is forward-only — could never rebuild the picks
          // made before the reload. Observed live 2026-07-31.
          external_id: DRAFT_ID,
          // Yahoo's socket doesn't carry scoring; default to standard and let
          // the war room's scoring control correct it. (Known refinement.)
          scoring: 'std',
          autopick: state.autopick,
          clock_seconds: state.clock,
          draft_type: 'snake',
        },
      },
      '*'
    )
  }, 2000)

  console.log(
    '[gridiron] Yahoo draft sync armed - draft ' + DRAFT_ID + ', slot ' + MY_SLOT + ', socket-native'
  )
})()
