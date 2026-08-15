// Named, reusable Draft Room setting profiles, persisted in localStorage so a
// user can save "my dynasty superflex league" once and load it into any new
// mock without re-entering scoring, roster, and format every time. Follows the
// draftRoomCache.ts idiom: versioned key, defensive try/catch.
//
// A preset deliberately captures only league-shape settings, never the teams,
// keepers, or "me" selection: those are specific to a loaded league and would
// be wrong to carry between leagues.

import type { DraftRoomConfig } from '@/types/draft';
import { logger } from '@/utils/logger';

const KEY = 'ffa:draftpresets:v1';
const MAX_PRESETS = 12;

export type PresetSettings = Pick<
  DraftRoomConfig,
  | 'draftType'
  | 'leagueType'
  | 'dynastyMode'
  | 'snakeFormat'
  | 'scoring'
  | 'tePremium'
  | 'sixPtPassTd'
  | 'rosterSlots'
  | 'budget'
  | 'keepersPerTeam'
  | 'keeperEscalation'
  | 'teams'
  | 'myTeamId'
>;

export interface DraftPreset {
  name: string;
  savedAt: number;
  settings: PresetSettings;
}

const PRESET_KEYS: Array<keyof PresetSettings> = [
  'draftType',
  'leagueType',
  'dynastyMode',
  'snakeFormat',
  'scoring',
  'tePremium',
  'sixPtPassTd',
  'rosterSlots',
  'budget',
  'keepersPerTeam',
  'keeperEscalation',
  'teams',
  'myTeamId',
];

// Pull just the preset-relevant fields out of a full config.
export function settingsFromConfig(config: DraftRoomConfig): PresetSettings {
  const out = {} as PresetSettings;
  for (const key of PRESET_KEYS) {
    const value = config[key];
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export function loadPresets(): DraftPreset[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as DraftPreset[];
    if (!Array.isArray(list)) return [];
    return list.filter(p => p && typeof p.name === 'string' && p.settings);
  } catch (err) {
    logger.warn('[draftPresets] Failed to read presets:', err);
    return [];
  }
}

function write(list: DraftPreset[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_PRESETS)));
  } catch (err) {
    logger.warn('[draftPresets] Failed to write presets:', err);
  }
}

// Save (or overwrite a same-named) preset; newest first.
export function savePreset(name: string, settings: PresetSettings): DraftPreset[] {
  const trimmed = name.trim();
  if (!trimmed) return loadPresets();
  const entry: DraftPreset = { name: trimmed, savedAt: Date.now(), settings };
  const rest = loadPresets().filter(p => p.name !== trimmed);
  const next = [entry, ...rest];
  write(next);
  return next;
}

export function deletePreset(name: string): DraftPreset[] {
  const next = loadPresets().filter(p => p.name !== name);
  write(next);
  return next;
}

/**
 * Downloads a single draft preset as a JSON file.
 */
export function exportPresetJSON(preset: DraftPreset): void {
  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_')}_draft_preset.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Downloads all saved draft presets as a JSON file.
 */
export function exportAllPresetsJSON(): void {
  const presets = loadPresets();
  if (presets.length === 0) return;
  const json = JSON.stringify(presets, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ffa_draft_presets.json';
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an imported JSON string containing draft preset(s).
 * Accepts either a single DraftPreset object or an array of DraftPreset objects.
 */
export function importPresetsFromJSON(jsonString: string): DraftPreset[] {
  const parsed = JSON.parse(jsonString);
  const rawList: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'presets' in parsed && Array.isArray((parsed as Record<string, unknown>).presets)
      ? (parsed as Record<string, unknown>).presets as unknown[]
      : [parsed];

  let currentList = loadPresets();

  for (const item of rawList) {
    if (
      item &&
      typeof item === 'object' &&
      'name' in item &&
      typeof (item as Record<string, unknown>).name === 'string' &&
      'settings' in item &&
      (item as Record<string, unknown>).settings &&
      typeof (item as Record<string, unknown>).settings === 'object'
    ) {
      const preset = item as DraftPreset;
      currentList = savePreset(preset.name, preset.settings);
    }
  }

  return currentList;
}

