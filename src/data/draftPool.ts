import poolJson from './draftPool.2026.json';
import type { DraftPoolFile } from '@/types/draft';
import {
  applyCustomRankingsToPool,
  getSavedPresets,
  getActivePresetId,
  migrateLegacyRankings,
} from '@/utils/customRankings';

const rawPool = poolJson as DraftPoolFile;

// Stable copy of original consensus rankings to reset or rebuild from
export const ORIGINAL_POOL_PLAYERS = [...rawPool.players];

export function applyActivePreset(presetId: string | null): void {
  if (!presetId) {
    // Reset to default
    rawPool.players = [...ORIGINAL_POOL_PLAYERS];
  } else {
    const presets = getSavedPresets();
    const activePreset = presets.find(p => p.id === presetId);
    if (activePreset) {
      const { updatedPlayers } = applyCustomRankingsToPool(ORIGINAL_POOL_PLAYERS, activePreset.rankings);
      rawPool.players = updatedPlayers;
    } else {
      rawPool.players = [...ORIGINAL_POOL_PLAYERS];
    }
  }
}

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    migrateLegacyRankings();
    const activeId = getActivePresetId();
    if (activeId) {
      applyActivePreset(activeId);
    }
  } catch (e) {
    console.error('Failed to load custom rankings preset:', e);
  }
}

export const POOL = rawPool;
