import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const poolPath = join(root, 'src', 'data', 'draftPool.2026.json');
const injuryCsvPath = join(root, 'src', 'data', 'player_injury.csv');
const outPath = join(root, 'extension', 'ffa_data.js');

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell.trim());
  return result;
}

function parseInjuryCSV(csvText: string) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const sleeperIdIdx = headers.findIndex(h => h.includes('sleeper id') || h === 'id' || h.includes('sleeper'));
  const nameIdx = headers.findIndex(h => h === 'player' || h === 'player name' || h.includes('player') || h.includes('name'));
  const posIdx = headers.findIndex(h => h === 'position' || h === 'pos');
  const teamIdx = headers.findIndex(h => h === 'team');
  const injuryNameIdx = headers.findIndex(h => h.includes('api injury name') || h.includes('html injury note') || h.includes('injury name'));
  const injuryDateIdx = headers.findIndex(h => h.includes('injury date'));
  const surgeryDateIdx = headers.findIndex(h => h.includes('surgery date'));
  const addDetailsIdx = headers.findIndex(h => h.includes('additional details'));
  const recoveryIdx = headers.findIndex(h => h.includes('typical recovery'));
  const returnIdx = headers.findIndex(h => h.includes('expected return'));
  const reinjureIdx = headers.findIndex(h => h.includes('reinjury rate'));
  const concernIdx = headers.findIndex(h => h.includes('concern level'));
  const docNotesIdx = headers.findIndex(h => h.includes('doctor notes'));

  const list: any[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const playerName = cols[nameIdx] || '';
    const injuryName = cols[injuryNameIdx] || '';
    if (!playerName || !injuryName) continue;

    const concernRaw = (cols[concernIdx] || 'low').toLowerCase();
    const concernLevel = (['low', 'mild', 'medium', 'high'].includes(concernRaw) ? concernRaw : 'low');

    list.push({
      sleeperId: cols[sleeperIdIdx] || undefined,
      playerName,
      position: cols[posIdx] || '',
      team: cols[teamIdx] || '',
      injuryName,
      injuryDate: cols[injuryDateIdx] || undefined,
      surgeryDate: cols[surgeryDateIdx] || undefined,
      additionalDetails: cols[addDetailsIdx] || undefined,
      typicalRecovery: cols[recoveryIdx] || undefined,
      expectedReturn: cols[returnIdx] || undefined,
      reinjuryRate: cols[reinjureIdx] || undefined,
      concernLevel,
      doctorNotes: cols[docNotesIdx] || undefined,
    });
  }
  return list;
}

try {
  const poolJson = JSON.parse(readFileSync(poolPath, 'utf8'));
  const injuryCsv = readFileSync(injuryCsvPath, 'utf8');
  const injuries = parseInjuryCSV(injuryCsv);

  const bundleContent = `// GENERATED FILE by scripts/buildExtensionBundle.ts - DO NOT EDIT MANUALLY
;(() => {
  window.FFA_DRAFT_POOL = ${JSON.stringify(poolJson.players)};
  window.FFA_INJURY_DATA = ${JSON.stringify(injuries)};
})();
`;

  writeFileSync(outPath, bundleContent, 'utf8');
  console.log(`[buildExtensionBundle] Successfully wrote ${poolJson.players.length} players & ${injuries.length} injury records to ${outPath}`);
} catch (e: any) {
  console.error('[buildExtensionBundle] Error:', e.message);
  process.exit(1);
}
