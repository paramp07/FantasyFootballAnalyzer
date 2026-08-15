import injuryCsvRaw from '@/data/exampleinjurydata.csv?raw';
import { matchKey } from '@/utils/playerNames';

export interface InjuryDetail {
  sleeperId?: string;
  playerName: string;
  position: string;
  team: string;
  injuryName: string;
  injuryDate?: string;
  surgeryDate?: string;
  additionalDetails?: string;
  typicalRecovery?: string;
  expectedReturn?: string;
  reinjuryRate?: string;
  concernLevel: 'low' | 'mild' | 'medium' | 'high';
  doctorNotes?: string;
  lastChangedAt?: string;
}

const bySleeperId = new Map<string, InjuryDetail>();
const byNameKey = new Map<string, InjuryDetail>();

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

export function parseInjuryCSV(csvText: string): InjuryDetail[] {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length <= 1) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const sleeperIdIdx = headers.findIndex(h => h.includes('sleeper id') || h === 'id');
  const nameIdx = headers.findIndex(h => h.includes('player name') || h.includes('name'));
  const posIdx = headers.findIndex(h => h === 'position' || h === 'pos');
  const teamIdx = headers.findIndex(h => h === 'team');
  const injuryNameIdx = headers.findIndex(h => h.includes('injury name'));
  const injuryDateIdx = headers.findIndex(h => h.includes('injury date'));
  const surgeryDateIdx = headers.findIndex(h => h.includes('surgery date'));
  const detailsIdx = headers.findIndex(h => h.includes('additional details'));
  const recoveryIdx = headers.findIndex(h => h.includes('typical recovery'));
  const returnIdx = headers.findIndex(h => h.includes('expected return'));
  const reinjuryIdx = headers.findIndex(h => h.includes('reinjury rate'));
  const concernIdx = headers.findIndex(h => h.includes('concern level'));
  const notesIdx = headers.findIndex(h => h.includes('doctor notes'));
  const lastChangedIdx = headers.findIndex(h => h.includes('last changed'));

  const detailsList: InjuryDetail[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    if (cells.length < 2) continue;

    const name = nameIdx !== -1 ? cells[nameIdx] : '';
    if (!name) continue;

    const rawConcern = (concernIdx !== -1 ? cells[concernIdx] : 'low').toLowerCase();
    let concernLevel: 'low' | 'mild' | 'medium' | 'high' = 'low';
    if (rawConcern.includes('high')) concernLevel = 'high';
    else if (rawConcern.includes('med')) concernLevel = 'medium';
    else if (rawConcern.includes('mild')) concernLevel = 'mild';
    else concernLevel = 'low';

    const detail: InjuryDetail = {
      sleeperId: sleeperIdIdx !== -1 && cells[sleeperIdIdx] ? cells[sleeperIdIdx] : undefined,
      playerName: name,
      position: posIdx !== -1 ? cells[posIdx] : '',
      team: teamIdx !== -1 ? cells[teamIdx] : '',
      injuryName: injuryNameIdx !== -1 && cells[injuryNameIdx] ? cells[injuryNameIdx] : 'Injury Concern',
      injuryDate: injuryDateIdx !== -1 ? cells[injuryDateIdx] : undefined,
      surgeryDate: surgeryDateIdx !== -1 ? cells[surgeryDateIdx] : undefined,
      additionalDetails: detailsIdx !== -1 ? cells[detailsIdx] : undefined,
      typicalRecovery: recoveryIdx !== -1 ? cells[recoveryIdx] : undefined,
      expectedReturn: returnIdx !== -1 ? cells[returnIdx] : undefined,
      reinjuryRate: reinjuryIdx !== -1 ? cells[reinjuryIdx] : undefined,
      concernLevel,
      doctorNotes: notesIdx !== -1 ? cells[notesIdx] : undefined,
      lastChangedAt: lastChangedIdx !== -1 ? cells[lastChangedIdx] : undefined,
    };

    detailsList.push(detail);

    if (detail.sleeperId) {
      bySleeperId.set(detail.sleeperId, detail);
    }
    const key = matchKey(detail.playerName, detail.position || undefined);
    byNameKey.set(key, detail);
    byNameKey.set(matchKey(detail.playerName), detail);
  }

  return detailsList;
}

// Initial parsing on module load
if (injuryCsvRaw) {
  parseInjuryCSV(injuryCsvRaw);
}

export function getInjuryDetail(player: { sleeperId?: string; name: string; pos?: string }): InjuryDetail | undefined {
  if (player.sleeperId && bySleeperId.has(String(player.sleeperId))) {
    return bySleeperId.get(String(player.sleeperId));
  }
  const keyWithPos = matchKey(player.name, player.pos || undefined);
  if (byNameKey.has(keyWithPos)) {
    return byNameKey.get(keyWithPos);
  }
  const keyJustName = matchKey(player.name);
  return byNameKey.get(keyJustName);
}
