import type { PoolPlayer } from '@/types/draft';
import { matchPlayer, normalizeName } from './playerNames';

export interface CustomRanking {
  name: string;
  rank: number;
  pos?: string;
  id?: string;
  tier?: number;
}

export const TEMPLATE_RANKINGS_CSV = `Overall,Player,Position,Team,Bye,Tier,Pos Rank,ADP
1,Ja'Marr Chase,WR,CIN,10,1,1,1.2
2,Bijan Robinson,RB,ATL,5,1,1,2.1
3,Josh Allen,QB,BUF,7,1,1,18.4
4,Sam LaPorta,TE,DET,5,2,1,25.6
5,Saquon Barkley,RB,PHI,5,1,2,5.1`;

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let insideQuote = false;
  let currentToken = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(currentToken.trim());
      currentToken = '';
    } else {
      currentToken += char;
    }
  }
  result.push(currentToken.trim());
  
  return result.map(cell => {
    if (cell.startsWith('"') && cell.endsWith('"')) {
      return cell.slice(1, -1).trim();
    }
    return cell;
  });
}

/**
 * Safely parses and validates a CSV string of custom rankings.
 */
export function validateCustomRankings(csvString: string): {
  valid: boolean;
  errors: string[];
  rankings?: CustomRanking[];
} {
  const errors: string[] = [];
  try {
    if (!csvString.trim()) {
      return { valid: false, errors: ['Input is empty.'] };
    }

    const lines = csvString.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      return { valid: false, errors: ['Input contains no rows.'] };
    }

    // Parse header row
    const headers = parseCSVLine(lines[0]);
    
    // Find column indexes
    const rankIdx = headers.findIndex(h => /^(overall|rank)$/i.test(h));
    const nameIdx = headers.findIndex(h => /^(player|name)$/i.test(h));
    const posIdx = headers.findIndex(h => /^(position|pos)$/i.test(h));
    const tierIdx = headers.findIndex(h => /^tier$/i.test(h));
    const idIdx = headers.findIndex(h => /^id$/i.test(h));

    if (rankIdx === -1 || nameIdx === -1) {
      return {
        valid: false,
        errors: ["Could not find required columns 'Overall' (or 'Rank') and 'Player' (or 'Name') in the header line."],
      };
    }

    const validated: CustomRanking[] = [];
    const seenNames = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const lineNum = i + 1; // 1-indexed for the user
      const cells = parseCSVLine(lines[i]);
      
      // If line is empty or cells is empty, skip
      if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
        continue;
      }

      // Check name
      const name = cells[nameIdx];
      if (!name || name.trim() === '') {
        errors.push(`Line ${lineNum}: Missing a valid player name.`);
        continue;
      }
      const cleanName = name.trim();

      // Check rank
      const rankStr = cells[rankIdx];
      const rank = rankStr ? parseInt(rankStr, 10) : NaN;
      if (isNaN(rank) || rank <= 0 || !Number.isInteger(rank)) {
        errors.push(`Line ${lineNum} ("${cleanName}"): Invalid "Overall" rank. Must be a positive integer.`);
        continue;
      }

      const key = cleanName.toLowerCase();
      seenNames.add(key);

      const rankingItem: CustomRanking = {
        name: cleanName,
        rank: rank,
      };

      // Optional position
      if (posIdx !== -1 && cells[posIdx]) {
        rankingItem.pos = cells[posIdx].trim().toUpperCase();
      }

      // Optional ID
      if (idIdx !== -1 && cells[idIdx]) {
        rankingItem.id = cells[idIdx].trim();
      }

      // Optional Tier
      if (tierIdx !== -1 && cells[tierIdx]) {
        const tierStr = cells[tierIdx].trim();
        if (tierStr !== '') {
          const tier = parseInt(tierStr, 10);
          if (!isNaN(tier) && tier >= 0 && Number.isInteger(tier)) {
            rankingItem.tier = tier;
          } else {
            errors.push(`Line ${lineNum} ("${cleanName}"): Invalid "Tier". Must be a non-negative integer.`);
            continue;
          }
        }
      }

      validated.push(rankingItem);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    return { valid: true, errors: [], rankings: validated };
  } catch (e: any) {
    return { valid: false, errors: [`Failed to parse CSV: ${e.message || 'Unknown error'}`] };
  }
}

/**
 * Matches custom rankings to the default draft pool, re-orders them,
 * and re-calculates position-based ranks.
 */
export function applyCustomRankingsToPool(
  players: PoolPlayer[],
  customRankings: CustomRanking[],
): {
  updatedPlayers: PoolPlayer[];
  warnings: string[];
  matchedCount: number;
} {
  const warnings: string[] = [];
  const poolById = new Map(players.map(p => [p.id, p]));

  // Build name index to speed up lookup and filter candidates
  const poolByName = new Map<string, PoolPlayer[]>();
  players.forEach(p => {
    const key = normalizeName(p.name);
    const list = poolByName.get(key) || [];
    list.push(p);
    poolByName.set(key, list);
  });

  const matchedPlayerIds = new Set<string>();
  const customRanksMap = new Map<string, number>();
  const customTiersMap = new Map<string, number>();

  customRankings.forEach(cr => {
    let matched: PoolPlayer | null = null;

    // 1. Try matching by ID first if provided
    if (cr.id && poolById.has(cr.id)) {
      matched = poolById.get(cr.id)!;
    } else {
      // 2. Try matching by name + position/team
      const key = normalizeName(cr.name);
      const candidates = poolByName.get(key) || [];
      if (candidates.length > 0) {
        matched = matchPlayer({ name: cr.name, pos: cr.pos }, candidates);
      }
    }

    if (matched) {
      if (matchedPlayerIds.has(matched.id)) {
        warnings.push(`Duplicate ranking for matched player "${matched.name}". Only the first rank will be applied.`);
      } else {
        matchedPlayerIds.add(matched.id);
        customRanksMap.set(matched.id, cr.rank);
        if (cr.tier !== undefined) {
          customTiersMap.set(matched.id, cr.tier);
        }
      }
    } else {
      const posSuffix = cr.pos ? ` (${cr.pos})` : '';
      warnings.push(`Could not match custom ranked player "${cr.name}"${posSuffix} to any player in the default draft pool.`);
    }
  });

  // Separate matched and unmatched players
  const matchedPlayers = players.filter(p => matchedPlayerIds.has(p.id));
  const unmatchedPlayers = players.filter(p => !matchedPlayerIds.has(p.id));

  // Sort matched players by custom rank, and tie-break on original overallRank
  matchedPlayers.sort((a, b) => {
    const rankA = customRanksMap.get(a.id)!;
    const rankB = customRanksMap.get(b.id)!;
    return rankA - rankB || a.overallRank - b.overallRank;
  });

  // Sort unmatched players by their original overallRank
  unmatchedPlayers.sort((a, b) => a.overallRank - b.overallRank);

  // Map custom tiers to matched players
  const matchedMapped = matchedPlayers.map(p => {
    const customTier = customTiersMap.get(p.id);
    return {
      ...p,
      tier: customTier !== undefined ? customTier : p.tier,
    };
  });

  // Clean up any tier discrepancies within the matched custom rankings
  const matchedCleaned = cleanTiers(matchedMapped);

  // Combine them: matched first, unmatched after
  const updatedPlayers = [...matchedCleaned, ...unmatchedPlayers].map((p, index) => {
    const newRank = index + 1;
    // Create a copy of the player to avoid side-effect mutations on the module JSON object
    return {
      ...p,
      overallRank: newRank,
      overallRankSF: newRank, // override superflex rank to align with custom ranking
    };
  });

  // Recalculate posRank for all players based on the new overall order
  const playersByPos = new Map<string, PoolPlayer[]>();
  updatedPlayers.forEach(p => {
    const list = playersByPos.get(p.pos) || [];
    list.push(p);
    playersByPos.set(p.pos, list);
  });

  playersByPos.forEach((list) => {
    // Sort position group by new overall rank
    list.sort((a, b) => a.overallRank - b.overallRank);
    list.forEach((p, idx) => {
      p.posRank = idx + 1;
    });
  });

  return {
    updatedPlayers,
    warnings,
    matchedCount: matchedPlayerIds.size,
  };
}

/**
 * Enforces tier monotonicity (non-decreasing tier numbers down the list)
 * for all players with a valid tier (> 0). Resolves tier discrepancies by
 * pulling players up to their surrounding better tiers (backward scan).
 */
export function cleanTiers(playersList: PoolPlayer[]): PoolPlayer[] {
  const result = [...playersList];
  if (result.length === 0) return result;

  // Find the last player with a valid tier > 0 to seed our minTier
  let minTier = 999;
  for (let i = result.length - 1; i >= 0; i--) {
    if (result[i].tier > 0) {
      minTier = result[i].tier;
      break;
    }
  }

  // Backward pass: enforce tier monotonicity for valid tiers
  for (let i = result.length - 1; i >= 0; i--) {
    const current = result[i].tier;
    if (current > 0) {
      if (current > minTier) {
        result[i] = { ...result[i], tier: minTier };
      } else {
        minTier = current;
      }
    }
  }
  return result;
}

const STORAGE_KEY = 'fantasy_football_analyzer_custom_rankings';

export function saveCustomRankings(rankings: CustomRanking[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rankings));
  }
}

export function getSavedCustomRankings(): CustomRanking[] | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved) as CustomRanking[];
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearCustomRankings(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export interface CustomRankingPreset {
  id: string;
  name: string;
  rankings: CustomRanking[];
  updatedAt: number;
}

const PRESETS_STORAGE_KEY = 'ffa_custom_ranking_presets';
const ACTIVE_PRESET_KEY = 'ffa_active_ranking_preset';

export function getSavedPresets(): CustomRankingPreset[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(PRESETS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CustomRankingPreset[];
  } catch {
    return [];
  }
}

export function savePresets(presets: CustomRankingPreset[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }
}

export function getActivePresetId(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(ACTIVE_PRESET_KEY);
}

export function setActivePresetId(id: string | null): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (id === null) {
      window.localStorage.removeItem(ACTIVE_PRESET_KEY);
    } else {
      window.localStorage.setItem(ACTIVE_PRESET_KEY, id);
    }
  }
}

export function migrateLegacyRankings(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const legacy = window.localStorage.getItem('fantasy_football_analyzer_custom_rankings');
  if (legacy) {
    try {
      const rankings = JSON.parse(legacy) as CustomRanking[];
      if (Array.isArray(rankings) && rankings.length > 0) {
        const presets = getSavedPresets();
        const id = 'legacy-import';
        if (!presets.some(p => p.id === id)) {
          presets.push({
            id,
            name: 'Imported Rankings',
            rankings,
            updatedAt: Date.now(),
          });
          savePresets(presets);
          setActivePresetId(id);
        }
      }
    } catch {
      // Ignore
    }
    window.localStorage.removeItem('fantasy_football_analyzer_custom_rankings');
  }
}

/**
 * Returns true if newRankings matches the ordering of any existing preset.
 * Compares by player id sequence — same IDs in same order means duplicate.
 */
export function isDuplicateRankings(
  newRankings: CustomRanking[],
  existingPresets: CustomRankingPreset[],
): boolean {
  const newIds = newRankings.map(r => r.id ?? r.name).join(',');
  return existingPresets.some(preset => {
    const existingIds = preset.rankings.map(r => r.id ?? r.name).join(',');
    return existingIds === newIds;
  });
}

/**
 * Returns the next available auto-generated preset name, e.g. "Preset #3"
 * when "Preset #1" and "Preset #2" already exist.
 */
export function nextPresetName(existingPresets: CustomRankingPreset[]): string {
  const used = new Set(existingPresets.map(p => p.name));
  let n = 1;
  while (used.has(`Preset #${n}`)) n++;
  return `Preset #${n}`;
}

/**
 * Renames a preset by id and persists.
 */
export function renamePreset(id: string, newName: string): CustomRankingPreset[] {
  const trimmed = newName.trim();
  if (!trimmed) return getSavedPresets();
  const updated = getSavedPresets().map(p =>
    p.id === id ? { ...p, name: trimmed } : p,
  );
  savePresets(updated);
  return updated;
}
