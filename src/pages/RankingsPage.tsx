import { Fragment, useDeferredValue, useMemo, useState, useEffect } from 'react';
import { Pencil, Check, Trash2, Download, X, Save } from 'lucide-react';
import { POOL, applyActivePreset } from '@/data/draftPool';
import { NflTeamLabel, PosBadge, CustomRankingsModal } from '@/components';
import {
  getSavedPresets,
  savePresets,
  getActivePresetId,
  setActivePresetId,
  cleanTiers,
  type CustomRankingPreset,
  clearCustomRankings,
  isDuplicateRankings,
  nextPresetName,
  renamePreset,
} from '@/utils/customRankings';
import { injuryAbbrev, injuryTitle } from '@/utils/injury';
import type { League, Platform } from '@/types';
import type { PoolPlayer } from '@/types/draft';
import { GUEST_TEAM_OPTIONS, type GuestScoring, type GuestSettings } from '@/utils/guestLeague';
import { DEFAULT_BUDGET, DEFAULT_ROSTER_SLOTS } from '@/hooks/useDraftRoom';
import { useSounds } from '@/hooks/useSounds';
import { useTargets } from '@/hooks/useTargets';
import { useYahooValues } from '@/hooks/useYahooValues';
import { consensusAvg, platformDelta, platformRankSource, sleeperAdpFor } from '@/utils/consensus';
import { FLEX_POSITIONS, labelForPos } from '@/data/rankingsVariants';
import { draftableSlotCount } from '@/utils/draftEngine';
import { normalizeName } from '@/utils/playerNames';
import { draftValues, vorConfigFor } from '@/utils/projectionValues';
import styles from './RankingsPage.module.css';

const POSITIONS = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DST'];
// FLEX_POSITIONS and the long-form position labels live in
// @/data/rankingsVariants (the single source the routes and prerender share).
const MAX_ROWS = 300;

type SortKey =
  | 'avg'
  | 'delta'
  | 'rank'
  | 'espnAdp'
  | 'sleeperAdp'
  | 'fpValue'
  | 'espnValue'
  | 'yahooValue';

// Per-site columns swap with the view: snake shows each site's ADP, auction
// shows each site's dollars. Sorts on a hidden column fall back to consensus.
type ViewTab = 'snake' | 'auction';
const SNAKE_ONLY_SORTS: SortKey[] = ['espnAdp', 'sleeperAdp'];
const AUCTION_ONLY_SORTS: SortKey[] = ['fpValue', 'espnValue', 'yahooValue'];

// Each column's natural first-click order: ranks and ADPs read best low to
// high, deltas and dollars high to low. A second click on the same header
// reverses it.
const DESC_FIRST: SortKey[] = ['delta', 'fpValue', 'espnValue', 'yahooValue'];

interface RankingsPageProps {
  league: League;
  // Present only in guest mode: lets the settings bar edit the synthetic
  // league (scoring, teams, delta lens) so the board reprices live.
  onUpdateGuest?: (patch: Partial<GuestSettings>) => void;
  // Set by the per-position landing routes (/rankings/qb etc.) so the page
  // opens pre-filtered to one position and titles itself accordingly. The
  // crawler reads the prerendered position table; this keeps the live page
  // consistent with it instead of redirecting (which would read as a doorway).
  initialPos?: string;
}

// Read-only view of the bundled draft pool: every ranking source side by
// side, with no draft session required. Auto-sorted by the consensus average
// so the delta column surfaces where the user's platform disagrees.
export function RankingsPage({ league, onUpdateGuest, initialPos }: RankingsPageProps) {
  // Guests have no real league, so their draft shape is editable inline.
  const isGuest = !!league.isGuest && !!onUpdateGuest;
  // A valid per-position landing slug seeds the initial position filter (and so
  // the initial heading, which derives from the filter).
  const landingPos = initialPos && POSITIONS.includes(initialPos) ? initialPos : undefined;
  const [query, setQuery] = useState('');
  const [posFilter, setPosFilter] = useState(landingPos ?? 'ALL');
  const [presets, setPresets] = useState<CustomRankingPreset[]>(() => getSavedPresets());
  // Controlled state so switching presets re-renders the dropdown immediately.
  const [activePresetId, setActivePresetIdState] = useState<string | null>(() => getActivePresetId());
  // Inline preset edit state
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false);

  // Keep localStorage and React state in sync together.
  const switchPreset = (id: string | null) => {
    setActivePresetId(id);
    setActivePresetIdState(id);
  };

  const [sortBy, setSortBy] = useState<SortKey>(() => {
    return activePresetId ? 'rank' : 'avg';
  });
  const [modalOpen, setModalOpen] = useState(false);

  const [players, setPlayers] = useState(() => POOL.players);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggableTier, setDraggableTier] = useState<{ tier: number; startIndex: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tier: number } | null>(null);

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleAddTierAbove = (targetTier: number) => {
    const updated = players.map(p => {
      const isPos = posFilter && posFilter !== 'ALL';
      const getTier = (player: PoolPlayer) => isPos ? (player.posTiers?.[posFilter] ?? player.tier) : player.tier;
      const currentT = getTier(p);
      if (currentT >= targetTier) {
        if (isPos) {
          return {
            ...p,
            posTiers: {
              ...(p.posTiers ?? {}),
              [posFilter]: currentT + 1,
            },
          };
        } else {
          return { ...p, tier: p.tier + 1 };
        }
      }
      return p;
    });
    const cleaned = cleanTiers(updated, posFilter);
    setPlayers(cleaned);
    saveToActivePreset(cleaned);
  };

  const handleAddTierBelow = (targetTier: number) => {
    const updated = players.map(p => {
      const isPos = posFilter && posFilter !== 'ALL';
      const getTier = (player: PoolPlayer) => isPos ? (player.posTiers?.[posFilter] ?? player.tier) : player.tier;
      const currentT = getTier(p);
      if (currentT > targetTier) {
        if (isPos) {
          return {
            ...p,
            posTiers: {
              ...(p.posTiers ?? {}),
              [posFilter]: currentT + 1,
            },
          };
        } else {
          return { ...p, tier: p.tier + 1 };
        }
      }
      return p;
    });
    const cleaned = cleanTiers(updated, posFilter);
    setPlayers(cleaned);
    saveToActivePreset(cleaned);
  };

  const isDragEnabled = sortBy === 'rank' && query.trim() === '';

  const [sortRev, setSortRev] = useState(false);
  const { playFilter, playSort, playError } = useSounds();
  const { starred, avoided, cycle } = useTargets(POOL.season);

  const isAuction = league.draftType === 'auction';
  const [viewTab, setViewTab] = useState<ViewTab>(isAuction ? 'auction' : 'snake');
  const auctionView = viewTab === 'auction';
  const colSpanCount = (auctionView ? 11 : 10) + (isDragEnabled ? 1 : 0);
  const scoring = league.scoringType;
  // Superflex leagues read Sleeper's 2QB ADP market (QBs go far earlier), so
  // the board's ADP column, sort, and delta match the mock AI's behavior.
  const superflex = (league.rosterSlots?.SUPERFLEX ?? 0) > 0;
  // Hide a position chip when the league rosters no slot that can play it.
  // Leagues without rosterSlots (and guests) fall back to the default slots,
  // which cover every position. A flex spot keeps RB/WR/TE alive without a
  // dedicated starter; superflex keeps QB alive.
  const positions = useMemo(() => {
    const slots = league.rosterSlots ?? DEFAULT_ROSTER_SLOTS;
    const hasFlex = slots.FLEX > 0 || slots.SUPERFLEX > 0;
    const playable = (pos: string) => {
      switch (pos) {
        case 'QB':
          return slots.QB > 0 || slots.SUPERFLEX > 0;
        case 'RB':
        case 'WR':
        case 'TE':
          return slots[pos] > 0 || hasFlex;
        case 'FLEX':
          return hasFlex;
        case 'K':
          return slots.K > 0;
        case 'DST':
          return slots.DST > 0;
        default:
          return true; // ALL
      }
    };
    return POSITIONS.filter(playable);
  }, [league.rosterSlots]);
  const source = platformRankSource(league.platform, scoring, superflex);
  const yahoo = useYahooValues(POOL);

  // Same league shape the Draft Room setup starts from, so the $ here matches
  // what the draft board will show (both go through draftValues).
  const valueLeague = useMemo(() => {
    const rosterSlots = league.rosterSlots ?? DEFAULT_ROSTER_SLOTS;
    return {
      // The platform's real auction budget when known (Sleeper/ESPN), so the
      // $ column matches what the Draft Room will open with.
      budget: league.auctionBudget ?? DEFAULT_BUDGET,
      teams: league.teams.length || league.totalTeams || 12,
      rounds: draftableSlotCount(rosterSlots),
      rosterSlots,
      scoring: league.scoringType,
    };
  }, [league]);

  const scaledValues = useMemo(
    () =>
      draftValues(
        players,
        POOL.baseline,
        valueLeague,
        // Auto-detected TE premium prices TEs the same way the Draft Room does.
        vorConfigFor({ tePremium: (league.tePremiumPerReception ?? 0) > 0 }),
      ),
    [players, valueLeague, league.tePremiumPerReception],
  );

  const avgById = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of players) map.set(p.id, consensusAvg(p, scoring, superflex));
    return map;
  }, [players, scoring, superflex]);

  const setSort = (key: SortKey) => {
    playSort();
    if (key === sortBy) {
      setSortRev(r => !r);
    } else {
      setSortBy(key);
      setSortRev(false);
    }
  };

  // Switching views hides the columns the other view sorts by; a sort on a
  // hidden column would look like a frozen random order, so reset it.
  const setView = (tab: ViewTab) => {
    playFilter();
    setViewTab(tab);
    const hidden = tab === 'auction' ? SNAKE_ONLY_SORTS : AUCTION_ONLY_SORTS;
    if (hidden.includes(sortBy)) {
      setSortBy(tab === 'auction' ? 'fpValue' : 'avg');
      setSortRev(false);
    }
  };

  const saveToActivePreset = (cleanedPlayers: PoolPlayer[]) => {
    const customRankings = cleanedPlayers.map((p, index) => ({
      name: p.name,
      rank: index + 1,
      pos: p.pos,
      id: p.id,
      tier: p.tier,
      posTiers: p.posTiers,
    }));

    if (activePresetId) {
      // Updating an existing preset — no duplicate check needed (overwrite).
      const updatedPresets = presets.map(p => {
        if (p.id === activePresetId) {
          return { ...p, rankings: customRankings, updatedAt: Date.now() };
        }
        return p;
      });
      savePresets(updatedPresets);
      setPresets(updatedPresets);
      applyActivePreset(activePresetId);
    } else {
      // Creating a new auto preset — reject if it's a duplicate of any existing preset
      if (isDuplicateRankings(customRankings, presets)) {
        playError();
        return;
      }
      
      // Also reject if it is a duplicate of the default Consensus rankings
      const defaultConsensusOrder = [...POOL.players].sort((a, b) => {
        const avgA = avgById.get(a.id) ?? a.overallRank;
        const avgB = avgById.get(b.id) ?? b.overallRank;
        return avgA - avgB || a.overallRank - b.overallRank;
      });
      const consensusIds = defaultConsensusOrder.map(p => p.id).join(',');
      const newIds = cleanedPlayers.map(p => p.id).join(',');
      if (consensusIds === newIds) {
        playError();
        return;
      }

      const name = nextPresetName(presets);
      const id = 'custom-' + Date.now();
      const newPreset = { id, name, rankings: customRankings, updatedAt: Date.now() };
      const updatedPresets = [...presets, newPreset];
      savePresets(updatedPresets);
      setPresets(updatedPresets);
      switchPreset(id);
      applyActivePreset(id);
      setSortBy('rank');
    }
  };

  const handleSaveCurrent = () => {
    // Sort all players in POOL.players based on current sortBy and sortRev settings
    const sorted = [...POOL.players];
    const avg = (p: PoolPlayer) => avgById.get(p.id) ?? p.overallRank;
    const stat = (p: PoolPlayer): number | undefined => {
      switch (sortBy) {
        case 'avg':
          return avg(p);
        case 'delta':
          return platformDelta(p, source, scoring, superflex);
        case 'rank':
          return superflex ? (p.overallRankSF ?? p.overallRank) : p.overallRank;
        case 'espnAdp':
          return p.espnAdp;
        case 'sleeperAdp':
          return sleeperAdpFor(p, scoring, superflex);
        case 'fpValue':
          return scaledValues.get(p.id) ?? 1;
        case 'espnValue':
          return p.espnValue;
        case 'yahooValue':
          return yahoo.costs?.get(p.id);
      }
    };
    const dir = (DESC_FIRST.includes(sortBy) ? -1 : 1) * (sortRev ? -1 : 1);

    sorted.sort((a, b) => {
      const sa = stat(a);
      const sb = stat(b);
      if (sa === undefined || sb === undefined) {
        if (sa === sb) return a.overallRank - b.overallRank;
        return sa === undefined ? 1 : -1;
      }
      return dir * (sa - sb) || a.overallRank - b.overallRank;
    });

    // Enforce tier monotonicity before saving
    const cleaned = cleanTiers(sorted);
    saveToActivePreset(cleaned);
    setPlayers(cleaned);
  };

  const handleDownloadPreset = () => {
    const preset = presets.find(p => p.id === activePresetId);
    if (!preset) return;
    const json = JSON.stringify(preset, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, hoveredIndex: number) => {
    e.preventDefault();
    if (draggableTier) {
      // Tier boundary is being dragged, allow drop on player rows
      return;
    }
    if (draggedIndex === null || draggedIndex === hoveredIndex) return;

    const draggedPlayer = visible[draggedIndex];
    const hoveredPlayer = visible[hoveredIndex];
    if (!draggedPlayer || !hoveredPlayer) return;

    const pDraggedIdx = players.findIndex(p => p.id === draggedPlayer.id);
    const pHoveredIdx = players.findIndex(p => p.id === hoveredPlayer.id);
    if (pDraggedIdx === -1 || pHoveredIdx === -1) return;

    const result = [...players];
    const isPos = posFilter && posFilter !== 'ALL';
    const targetTier = isPos
      ? (hoveredPlayer.posTiers?.[posFilter] ?? hoveredPlayer.tier)
      : hoveredPlayer.tier;

    const [removed] = result.splice(pDraggedIdx, 1);
    const updatedPlayer = { ...removed };
    if (isPos) {
      updatedPlayer.posTiers = {
        ...(updatedPlayer.posTiers ?? {}),
        [posFilter]: targetTier,
      };
    } else {
      updatedPlayer.tier = targetTier;
    }

    result.splice(pHoveredIdx, 0, updatedPlayer);

    // Update overallRank
    const updated = result.map((p, index) => {
      const newRank = index + 1;
      return {
        ...p,
        overallRank: newRank,
        overallRankSF: newRank,
      };
    });

    // Recalculate posRank
    const playersByPos = new Map<string, PoolPlayer[]>();
    updated.forEach(p => {
      const list = playersByPos.get(p.pos) || [];
      list.push(p);
      playersByPos.set(p.pos, list);
    });

    playersByPos.forEach((list) => {
      list.sort((a, b) => a.overallRank - b.overallRank);
      list.forEach((p, idx) => {
        p.posRank = idx + 1;
      });
    });

    setPlayers(updated);
    
    // Find the new dragged index in visible
    const newVisible = updated.filter(p => {
      const q = normalizeName(deferredQuery);
      const posMatch = posFilter === 'ALL' || (posFilter === 'FLEX' ? FLEX_POSITIONS.has(p.pos) : p.pos === posFilter);
      return posMatch && (q === '' || normalizeName(p.name).includes(q));
    });
    const newDraggedIdx = newVisible.findIndex(p => p.id === draggedPlayer.id);
    if (newDraggedIdx !== -1) {
      setDraggedIndex(newDraggedIdx);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);

    // Clean tiers to fix any drag discrepancies
    const cleaned = cleanTiers(players, posFilter);
    setPlayers(cleaned);

    // Save to local storage
    saveToActivePreset(cleaned);
  };

  const handleDrop = (e: React.DragEvent, hoveredIndex: number) => {
    if (draggableTier) {
      e.preventDefault();
      const isPos = posFilter && posFilter !== 'ALL';
      const oldPlayer = visible[draggableTier.startIndex];
      const targetPlayer = visible[hoveredIndex];
      if (!oldPlayer || !targetPlayer) return;

      const pOldIndex = players.findIndex(p => p.id === oldPlayer.id);
      const pTargetIndex = players.findIndex(p => p.id === targetPlayer.id);
      if (pOldIndex === -1 || pTargetIndex === -1) return;

      const K = draggableTier.tier;
      const updated = [...players];

      const setT = (p: PoolPlayer, t: number) => {
        if (isPos) {
          return {
            ...p,
            posTiers: {
              ...(p.posTiers ?? {}),
              [posFilter]: t,
            },
          };
        } else {
          return { ...p, tier: t };
        }
      };

      if (pTargetIndex < pOldIndex) {
        for (let idx = pTargetIndex; idx < pOldIndex; idx++) {
          updated[idx] = setT(updated[idx], K);
        }
      } else if (pTargetIndex > pOldIndex) {
        for (let idx = pOldIndex; idx < pTargetIndex; idx++) {
          updated[idx] = setT(updated[idx], K - 1);
        }
      }

      const cleaned = cleanTiers(updated, posFilter);
      setPlayers(cleaned);

      saveToActivePreset(cleaned);
      setDraggableTier(null);
    }
  };

  const deferredQuery = useDeferredValue(query);

  const rows = useMemo(() => {
    const q = normalizeName(deferredQuery);
    const filtered = players
      .filter(p =>
        posFilter === 'ALL' ||
        (posFilter === 'FLEX' ? FLEX_POSITIONS.has(p.pos) : p.pos === posFilter),
      )
      .filter(p => q === '' || normalizeName(p.name).includes(q));
    const avg = (p: PoolPlayer) => avgById.get(p.id) ?? p.overallRank;
    const stat = (p: PoolPlayer): number | undefined => {
      switch (sortBy) {
        case 'avg':
          return avg(p);
        case 'delta':
          return platformDelta(p, source, scoring, superflex);
        case 'rank':
          return superflex ? (p.overallRankSF ?? p.overallRank) : p.overallRank;
        case 'espnAdp':
          return p.espnAdp;
        case 'sleeperAdp':
          return sleeperAdpFor(p, scoring, superflex);
        case 'fpValue':
          return scaledValues.get(p.id) ?? 1;
        case 'espnValue':
          return p.espnValue;
        case 'yahooValue':
          return yahoo.costs?.get(p.id);
      }
    };
    const dir = (DESC_FIRST.includes(sortBy) ? -1 : 1) * (sortRev ? -1 : 1);
    // Players missing the sorted stat sink to the bottom in either
    // direction; ties break by FFA rank.
    filtered.sort((a, b) => {
      const sa = stat(a);
      const sb = stat(b);
      if (sa === undefined || sb === undefined) {
        if (sa === sb) return a.overallRank - b.overallRank;
        return sa === undefined ? 1 : -1;
      }
      return dir * (sa - sb) || a.overallRank - b.overallRank;
    });
    return filtered;
  }, [players, deferredQuery, posFilter, sortBy, sortRev, avgById, scaledValues, source, scoring, superflex, yahoo.costs]);

  const visible = rows.slice(0, MAX_ROWS);

  const sortableTh = (key: SortKey, label: string, title: string) => {
    const active = sortBy === key;
    const desc = DESC_FIRST.includes(key) !== sortRev;
    return (
      <th
        className={`${styles.num} ${styles.sortable} ${active ? styles.sorted : ''}`}
        onClick={() => setSort(key)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSort(key);
          }
        }}
        role="button"
        tabIndex={0}
        title={`${title}. ${active ? 'Click to reverse the order.' : 'Click to sort.'}`}
        aria-sort={active ? (desc ? 'descending' : 'ascending') : 'none'}
      >
        {label}
        {active && <span className={styles.sortArrow}>{desc ? '▼' : '▲'}</span>}
      </th>
    );
  };

  const updated = new Date(POOL.generatedAt);

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.header}>
          <h1 className={styles.title}>
            {posFilter !== 'ALL' ? `${labelForPos(posFilter)} Rankings` : 'Rankings'}
          </h1>
          <p className={styles.subtitle}>
            {isGuest ? 'Guest mode' : league.name} · {POOL.season} Draft Prep
          </p>
          {(league.scoringIsApproximate || league.hasIDP) && (
            <p className={styles.subtitle}>
              {league.scoringIsApproximate &&
                'Custom scoring — values priced as half-PPR, approximate. '}
              {league.hasIDP &&
                'IDP league — defensive players are not in this pool.'}
            </p>
          )}
        </div>

        <div className={styles.settingsBar}>
          {isGuest ? (
            <>
              <label className={styles.settingsControl}>
                Teams
                <select
                  className={styles.settingsSelect}
                  value={league.totalTeams}
                  onChange={e => { playFilter(); onUpdateGuest!({ totalTeams: Number(e.target.value) }); }}
                  title="League size. Scales auction dollar values."
                >
                  {GUEST_TEAM_OPTIONS.map(n => (
                    <option key={n} value={n}>{n} teams</option>
                  ))}
                </select>
              </label>
              <label className={styles.settingsControl}>
                Scoring
                <select
                  className={styles.settingsSelect}
                  value={league.scoringType}
                  onChange={e => { playFilter(); onUpdateGuest!({ scoringType: e.target.value as GuestScoring }); }}
                  title="Scoring format. Changes ADP, consensus, and values."
                >
                  <option value="standard">Standard</option>
                  <option value="half_ppr">Half PPR</option>
                  <option value="ppr">PPR</option>
                </select>
              </label>
              <label className={styles.settingsControl}>
                Compare vs
                <select
                  className={styles.settingsSelect}
                  value={league.platform}
                  onChange={e => { playFilter(); onUpdateGuest!({ platform: e.target.value as Platform }); }}
                  title="Which platform the delta column compares against"
                >
                  <option value="sleeper">Sleeper</option>
                  <option value="espn">ESPN</option>
                  <option value="yahoo">Yahoo</option>
                </select>
              </label>
              {auctionView && <span className={styles.settingsItem}>${valueLeague.budget} budget</span>}
              <span className={styles.settingsItem}>{valueLeague.rounds} spots</span>
            </>
          ) : (
            <>
              <span className={styles.settingsItem}>{valueLeague.teams} teams</span>
              {auctionView && <span className={styles.settingsItem}>${valueLeague.budget} budget</span>}
              <span className={styles.settingsItem}>{valueLeague.rounds} spots</span>
              <span className={styles.settingsItem}>{league.scoringType.replace('_', ' ')}</span>
            </>
          )}

          {/* Rankings Preset Custom Dropdown */}
          <div className={styles.settingsControl} style={{ margin: 0, position: 'relative' }}>
            Rankings Preset
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className={styles.settingsSelect}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                onClick={() => setPresetDropdownOpen(prev => !prev)}
                title="Switch rankings presets or upload new ones"
              >
                {activePresetId ? (presets.find(p => p.id === activePresetId)?.name ?? 'Custom Preset') : 'Consensus (Default)'}
                <span style={{ fontSize: '0.6rem' }}>▼</span>
              </button>

              {presetDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: 'var(--ink)',
                    border: '2px solid var(--bone)',
                    boxShadow: '4px 4px 0 var(--bone)',
                    zIndex: 100,
                    width: '100%',
                    minWidth: '220px',
                    maxWidth: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                  }}
                >
                  {/* Default Consensus Option */}
                  <div
                    onClick={() => {
                      playFilter();
                      switchPreset(null);
                      applyActivePreset(null);
                      setPlayers([...POOL.players]);
                      setSortBy('avg');
                      setPresetDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: !activePresetId ? 'var(--lime)' : 'var(--bone)',
                      fontWeight: !activePresetId ? 700 : 400,
                      background: !activePresetId ? 'rgba(214, 255, 46, 0.1)' : 'transparent',
                      borderBottom: '1px solid var(--bone-dim)',
                    }}
                  >
                    Consensus (Default)
                  </div>

                  {/* Custom Presets list with hover white Trash2 delete icon */}
                  {presets.map(p => (
                    <div
                      key={p.id}
                      className="preset-option-item"
                      onClick={() => {
                        playFilter();
                        switchPreset(p.id);
                        applyActivePreset(p.id);
                        setPlayers([...POOL.players]);
                        setSortBy('rank');
                        setPresetDropdownOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        color: activePresetId === p.id ? 'var(--lime)' : 'var(--bone)',
                        fontWeight: activePresetId === p.id ? 700 : 400,
                        background: activePresetId === p.id ? 'rgba(214, 255, 46, 0.1)' : 'transparent',
                        borderBottom: '1px solid rgba(255,255,255,0.08)',
                        position: 'relative',
                        gap: '8px',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                        {p.name}
                      </span>
                      <button
                        type="button"
                        className="preset-delete-x"
                        onClick={e => {
                          e.stopPropagation();
                          const nextPresets = presets.filter(item => item.id !== p.id);
                          savePresets(nextPresets);
                          setPresets(nextPresets);
                          if (activePresetId === p.id) {
                            switchPreset(null);
                            applyActivePreset(null);
                            setPlayers([...POOL.players]);
                            setSortBy('avg');
                          }
                        }}
                        title={`Delete preset "${p.name}"`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ffffff',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'none',
                          alignItems: 'center',
                        }}
                        aria-label={`Delete ${p.name}`}
                      >
                        <X size={14} style={{ color: '#ffffff' }} />
                      </button>
                    </div>
                  ))}

                  {/* Upload New Option */}
                  <div
                    onClick={() => {
                      playFilter();
                      setModalOpen(true);
                      setPresetDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--lime)',
                      fontWeight: 700,
                      borderTop: '1px solid var(--bone)',
                    }}
                  >
                    + Upload/Paste Custom...
                  </div>
                </div>
              )}
            </div>
          </div>

          <style>{`
            .preset-option-item:hover {
              background: rgba(255, 255, 255, 0.08) !important;
            }
            .preset-option-item:hover .preset-delete-x {
              display: inline-flex !important;
            }
          `}</style>

          {/* Inline preset rename / delete — appears only when a custom preset is active */}
          {activePresetId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
              {editingPresetId === activePresetId ? (
                <>
                  <input
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const updated = renamePreset(activePresetId, editingName);
                        setPresets(updated);
                        setEditingPresetId(null);
                      }
                      if (e.key === 'Escape') setEditingPresetId(null);
                    }}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: 'var(--text)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      width: '120px',
                    }}
                    autoFocus
                    aria-label="Rename preset"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = renamePreset(activePresetId, editingName);
                      setPresets(updated);
                      setEditingPresetId(null);
                    }}
                    title="Save name"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px', display: 'flex' }}
                    aria-label="Save preset name"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextPresets = presets.filter(p => p.id !== activePresetId);
                      savePresets(nextPresets);
                      setPresets(nextPresets);
                      switchPreset(null);
                      applyActivePreset(null);
                      setPlayers([...POOL.players]);
                      setSortBy('avg');
                      setEditingPresetId(null);
                    }}
                    title="Delete preset"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px', display: 'flex' }}
                    aria-label="Delete preset"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const preset = presets.find(p => p.id === activePresetId);
                    setEditingName(preset?.name ?? '');
                    setEditingPresetId(activePresetId);
                  }}
                  title="Rename or delete preset"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', padding: '2px', display: 'flex', opacity: 0.6 }}
                  aria-label="Edit preset"
                >
                  <Pencil size={14} />
                </button>
              )}
            </span>
          )}

          <button
            type="button"
            className={styles.settingsSelect}
            style={{ cursor: 'pointer', padding: '0.3rem 0.6rem', marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            onClick={handleSaveCurrent}
            title="Save the current board order as your custom rankings"
          >
            <Save size={13} style={{ color: '#ffffff' }} /> Save Current
          </button>
          {activePresetId && (
            <button
              type="button"
              className={styles.settingsSelect}
              onClick={handleDownloadPreset}
              title="Download current preset as JSON"
              style={{ cursor: 'pointer', padding: '0.3rem 0.6rem', display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}
              aria-label="Download preset"
            >
              <Download size={13} /> Download
            </button>
          )}
          {!isDragEnabled && (
            <span
              className={styles.settingsDim}
              style={{ marginLeft: '1rem', color: 'var(--lime)', border: '1px dashed var(--lime)', padding: '0.2rem 0.5rem' }}
              title="Sort by FFA RK and clear query/filters to enable manual drag and drop reordering"
            >
              💡 Sort by FFA RK to drag &amp; reorder
            </span>
          )}
          <span className={styles.settingsSpacer} />
          <span
            className={styles.settingsDim}
            title="Rankings refresh daily from FFA, ESPN, Yahoo, and Sleeper"
          >
            Updated {updated.toLocaleDateString()}
          </span>
          <button
            type="button"
            className={styles.resetButton}
            onClick={() => {
              if (window.confirm("Are you sure you want to clear your custom rankings and revert to the site's default rankings?")) {
                clearCustomRankings();
                window.location.reload();
              }
            }}
            title="Revert back to default rankings and discard custom rankings"
          >
            Reset
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={viewTab === 'snake' ? styles.tabOn : styles.tab}
            aria-pressed={viewTab === 'snake'}
            onClick={() => setView('snake')}
            title="Pick-position view: each site's ADP side by side"
          >
            Snake
          </button>
          <button
            type="button"
            className={viewTab === 'auction' ? styles.tabOn : styles.tab}
            aria-pressed={viewTab === 'auction'}
            onClick={() => setView('auction')}
            title="Dollar view: each site's auction price side by side"
          >
            Auction
          </button>
          {auctionView && (
            <span className={styles.yahooStatus} role="status">
              {yahoo.status === 'ready' &&
                `Yahoo prices on (${yahoo.costs?.size ?? 0} players matched)`}
              {yahoo.status === 'loading' && 'Loading Yahoo prices...'}
              {yahoo.status === 'unavailable' &&
                'Connect Yahoo (Y! in the header) to add real draft prices'}
              {yahoo.status === 'error' && 'Yahoo prices failed to load. Reconnect and reload.'}
            </span>
          )}
        </div>

        <div className={styles.controls}>
          <input
            className={styles.search}
            aria-label="Search players"
            placeholder="Search players..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className={styles.chips}>
            {positions.map(pos => (
              <button
                key={pos}
                type="button"
                className={posFilter === pos ? styles.chipOn : styles.chip}
                aria-pressed={posFilter === pos}
                onClick={() => {
                  playFilter();
                  setPosFilter(pos);
                }}
                title={
                  pos === 'ALL'
                    ? 'Show every position'
                    : pos === 'FLEX'
                      ? 'Show flex-eligible players (RB, WR, TE)'
                      : `Show only ${pos}s`
                }
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        <div className={`${styles.tableWrapper} scroll-x-hint`}>
          <table className={styles.table}>
            <thead>
              <tr>
                {isDragEnabled && (
                  <th
                    className={styles.dragHead}
                    aria-label="Drag to reorder"
                    title="Drag handles are active because you are sorted by FFA RK, with no queries or filters active."
                  />
                )}
                <th
                  className={styles.starCell}
                  aria-label="Target list"
                  title="Star players here; they get highlighted and boosted in the Draft Room"
                />
                {/* Player sits directly after the star: on a phone the stat
                    columns alone fill the viewport, so a name-last order left
                    every row anonymous until you scrolled sideways. */}
                <th
                  className={styles.playerHead}
                  title="Player name. R marks rookies; an injury tag shows current status"
                >
                  Player
                </th>
                {sortableTh(
                  'avg',
                  'AVG',
                  superflex
                    ? 'Consensus average of the FFA superflex rank and Sleeper superflex ADP'
                    : 'Consensus average of FFA rank, ESPN ADP, Yahoo ADP rank, and Sleeper ADP',
                )}
                {sortableTh('delta', `Δ ${source.label}`, source.describe)}
                {sortableTh(
                  'rank',
                  'FFA RK',
                  superflex
                    ? 'FFA superflex (2QB) consensus rank'
                    : 'FFA expert consensus rank',
                )}

                <th title="Position, with the player's rank at that position">Pos</th>
                <th title="NFL team">Team</th>
                <th
                  className={styles.num}
                  title="Bye week: the week this player's team does not play"
                >
                  Bye
                </th>
                {!auctionView && (
                  <>
                    {sortableTh('espnAdp', 'ESPN ADP', 'ESPN average draft position')}
                    {sortableTh(
                      'sleeperAdp',
                      'SLPR ADP',
                      superflex
                        ? 'Sleeper superflex average draft position (the 2QB market where available)'
                        : `Sleeper average draft position (${scoring.replace('_', ' ')} scoring)`,
                    )}
                  </>
                )}
                {auctionView && (
                  <>
                    {sortableTh(
                      'fpValue',
                      'FP $',
                      "FantasyPros value, scaled to this league's budget and size",
                    )}
                    {sortableTh(
                      'espnValue',
                      'ESPN $',
                      'Live ESPN auction market price (ESPN default league, unscaled)',
                    )}
                    {sortableTh(
                      'yahooValue',
                      'YHO $',
                      yahoo.status === 'ready'
                        ? 'Average price in real Yahoo auction drafts (unscaled)'
                        : 'Average price in real Yahoo auction drafts. Connect Yahoo in the header to load.',
                    )}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => {
                const avg = avgById.get(p.id) ?? p.overallRank;
                const delta = platformDelta(p, source, scoring, superflex);
                // In superflex the FFA RK column tracks the superflex rank so it
                // matches the delta and consensus (which use overallRankSF).
                const ffaRank = superflex ? (p.overallRankSF ?? p.overallRank) : p.overallRank;
                const isPos = posFilter && posFilter !== 'ALL';
                const getTier = (player: PoolPlayer) => isPos ? (player.posTiers?.[posFilter] ?? player.tier) : player.tier;
                const currentT = getTier(p);
                const prevTier = sortBy === 'rank' ? (i === 0 ? 0 : getTier(visible[i - 1])) : 0;
                const tierBreaks: number[] = [];
                if (sortBy === 'rank' && currentT > prevTier) {
                  for (let t = prevTier + 1; t <= currentT; t++) {
                    if (t > 0) tierBreaks.push(t);
                  }
                }
                return (
                  <Fragment key={p.id}>
                  {tierBreaks.map(t => (
                    <tr key={`tier-break-${t}`} className={styles.tierBreakRow}>
                      <td colSpan={colSpanCount}>
                        <span
                          className={`${styles.tierBreakText} ${
                            draggableTier?.tier === t ? styles.tierDraggableOn : ''
                          }`}
                          draggable={isDragEnabled}
                          onDragStart={(e) => {
                            setDraggableTier({ tier: t, startIndex: i });
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', `tier:${t}:${i}`);
                          }}
                          onDragEnd={() => {
                            setDraggableTier(null);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                              x: e.clientX,
                              y: e.clientY,
                              tier: t,
                            });
                          }}
                        >
                          TIER {t}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr
                    className={`${styles.row} ${draggedIndex === i ? styles.draggedRow : ''}`}
                    draggable={isDragEnabled}
                    onDragStart={(e) => handleDragStart(e, i)}
                    onDragOver={(e) => handleDragOver(e, i)}
                    onDragEnd={handleDragEnd}
                    onDrop={(e) => handleDrop(e, i)}
                  >
                    {isDragEnabled && (
                      <td className={styles.dragCell} title="Drag up/down to change rank">
                        ⋮⋮
                      </td>
                    )}
                    <td className={styles.starCell}>
                      <button
                        type="button"
                        className={
                          starred.has(p.id)
                            ? styles.starOn
                            : avoided.has(p.id)
                              ? styles.starAvoid
                              : styles.star
                        }
                        onClick={() => cycle(p.id)}
                        title={
                          starred.has(p.id)
                            ? 'Targeted. Click again to avoid, again to clear.'
                            : avoided.has(p.id)
                              ? 'Avoided. Click to clear.'
                              : 'Click to target this player for your draft'
                        }
                        aria-label={`Toggle target status for ${p.name}`}
                      >
                        {avoided.has(p.id) ? '✕' : '★'}
                      </button>
                    </td>
                    <td className={styles.player}>
                      <span className={styles.playerName}>{p.name}</span>
                      {p.rookie && <span className={styles.rookieTag} title="Rookie">R</span>}
                      {p.injuryStatus && (
                        <span className={styles.injuryTag} title={injuryTitle(p)}>
                          {injuryAbbrev(p.injuryStatus)}
                        </span>
                      )}
                    </td>
                    <td className={`${styles.num} ${styles.avg}`}>{avg.toFixed(1)}</td>
                    <td
                      className={`${styles.num} ${
                        delta !== undefined && delta >= 1
                          ? styles.deltaGood
                          : delta !== undefined && delta <= -1
                            ? styles.deltaBad
                            : styles.dim
                      }`}
                    >
                      {delta === undefined ? '-' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`}
                    </td>
                    <td className={`${styles.num} ${styles.dim}`}>{ffaRank}</td>

                    <td>
                      <PosBadge pos={p.pos} posRank={p.posRank} />
                    </td>
                    <td>
                      <NflTeamLabel team={p.team} />
                    </td>
                    <td className={`${styles.num} ${styles.dim}`}>{p.bye ?? '-'}</td>
                    {!auctionView && (
                      <>
                        <td className={`${styles.num} ${styles.dim}`}>{p.espnAdp ?? '-'}</td>
                        <td className={`${styles.num} ${styles.dim}`}>
                          {sleeperAdpFor(p, scoring, superflex) ?? '-'}
                        </td>
                      </>
                    )}
                    {auctionView && (
                      <>
                        <td className={`${styles.num} ${styles.value}`}>
                          ${scaledValues.get(p.id) ?? 1}
                        </td>
                        <td className={styles.num}>{p.espnValue ? `$${p.espnValue}` : '-'}</td>
                        <td className={styles.num}>
                          {yahoo.costs?.get(p.id) ? `$${yahoo.costs.get(p.id)}` : '-'}
                        </td>
                      </>
                    )}
                  </tr>
                  </Fragment>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={colSpanCount} className={styles.emptyRow}>
                    No players match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length > MAX_ROWS && (
            <div className={styles.truncated}>
              Showing {MAX_ROWS} of {rows.length}. Search or filter to narrow.
            </div>
          )}
        </div>
      </div>
      {modalOpen && (
        <CustomRankingsModal
          onClose={() => setModalOpen(false)}
          onApply={() => {
            setPresets(getSavedPresets());
            setPlayers([...POOL.players]);
            setSortBy('rank');
            setModalOpen(false);
          }}
        />
      )}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--ink)',
            border: '2px solid var(--bone)',
            boxShadow: '4px 4px 0 var(--bone)',
            zIndex: 1000,
            padding: '4px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            minWidth: '150px',
          }}
        >
          <div
            onClick={() => handleAddTierAbove(contextMenu.tier)}
            className={styles.contextMenuItem}
          >
            Add Tier Above
          </div>
          <div
            onClick={() => handleAddTierBelow(contextMenu.tier)}
            className={styles.contextMenuItem}
          >
            Add Tier Below
          </div>
        </div>
      )}
    </div>
  );
}
