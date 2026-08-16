// Name matching across draft data sources (FantasyPros rankings, salary cap
// value exports, and later Yahoo/ESPN/Sleeper value files). Sources disagree
// on suffixes ("James Cook III" vs "James Cook"), punctuation ("A.J.",
// "D'Andre"), and casing. Team is never part of the match key because players
// change teams between export dates; it is only a tiebreaker when two
// different players normalize to the same name.

const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);

// Sources disagree on team abbreviations (FantasyPros JAC vs Sleeper/ESPN
// JAX, ESPN WSH vs WAS, relocations). Joins and tiebreakers must compare
// canonical forms, never raw strings.
const TEAM_ALIASES: Record<string, string> = {
  JAX: 'JAC',
  WSH: 'WAS',
  LA: 'LAR',
  RAM: 'LAR',
  RAMS: 'LAR',
  STL: 'LAR',
  SD: 'LAC',
  OAK: 'LV',
  LVR: 'LV',
  GBP: 'GB',
  KCC: 'KC',
  NOS: 'NO',
  NEP: 'NE',
  SFO: 'SF',
  TBB: 'TB',
};

export function canonicalTeam(team: string | null | undefined): string {
  const upper = (team ?? '').toUpperCase().trim();
  return TEAM_ALIASES[upper] ?? upper;
}

export function normalizeName(name: string): string {
  const tokens = name
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/-/g, '')
    .split(/\s+/)
    .filter(Boolean);
  while (tokens.length > 1 && SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(' ');
}

// "RB12" -> "RB", "DST3" -> "DST", "D/ST" -> "DST", "DEF" -> "DST"
export function basePosition(pos: string): string {
  const upper = pos.toUpperCase().replace(/\//g, '').replace(/\d+$/, '');
  if (upper === 'DEF') return 'DST';
  return upper;
}

export function stripDstSuffix(name: string): string {
  return name
    .toLowerCase()
    .replace(/\//g, '')
    .replace(/[.'’]/g, '')
    .replace(/-/g, '')
    .replace(/\b(dst|defense|def)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKey(name: string, pos?: string): string {
  return pos ? `${normalizeName(name)}|${basePosition(pos)}` : normalizeName(name);
}

export interface NameCandidate {
  name: string;
  pos?: string;
  team?: string;
}

// Exact normalized-name match (plus position when both sides have one);
// team breaks ties only. Returns null on no match or unresolvable ambiguity
// so callers can fail loudly instead of joining the wrong player.
export function matchPlayer<T extends NameCandidate>(
  query: NameCandidate,
  candidates: T[],
): T | null {
  const queryName = normalizeName(query.name);
  let hits = candidates.filter(c => normalizeName(c.name) === queryName);
  if (query.pos) {
    const queryPos = basePosition(query.pos);
    const posHits = hits.filter(c => c.pos && basePosition(c.pos) === queryPos);
    if (posHits.length > 0) hits = posHits;
  }
  if (hits.length === 1) return hits[0];
  if (hits.length > 1 && query.team) {
    const queryTeam = canonicalTeam(query.team);
    const teamHits = hits.filter(c => canonicalTeam(c.team) === queryTeam);
    if (teamHits.length === 1) return teamHits[0];
  }

  // D/ST Team Defense matching fallback (e.g. "Broncos D/ST" -> "Denver Broncos", "Texans D/ST" -> "Houston Texans", "RAM" -> "Los Angeles Rams")
  const isDstQuery = (query.pos && basePosition(query.pos) === 'DST') || /\b(dst|defense|def)\b/i.test(query.name) || /\bd\/st\b/i.test(query.name);
  if (isDstQuery) {
    const dstCandidates = candidates.filter(c => c.pos && basePosition(c.pos) === 'DST');
    if (query.team) {
      const queryTeam = canonicalTeam(query.team);
      const teamHits = dstCandidates.filter(c => canonicalTeam(c.team) === queryTeam);
      if (teamHits.length === 1) return teamHits[0];
    }
    const cleanQuery = stripDstSuffix(query.name);
    if (cleanQuery) {
      // 1. Try exact team match if query name is a team code (e.g. "DEN", "HOU", "SEA", "LAR")
      const codeTeam = canonicalTeam(cleanQuery);
      const codeHits = dstCandidates.filter(c => canonicalTeam(c.team) === codeTeam);
      if (codeHits.length === 1) return codeHits[0];

      // 2. Try substring match (e.g. "broncos" inside "denver broncos", "texans" inside "houston texans")
      const nameHits = dstCandidates.filter(c => {
        const cleanCand = stripDstSuffix(c.name);
        return cleanCand.includes(cleanQuery) || cleanQuery.includes(cleanCand);
      });
      if (nameHits.length === 1) return nameHits[0];
    }
  }

  return null;
}
