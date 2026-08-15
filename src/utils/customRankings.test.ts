import { describe, expect, it } from 'vitest';
import type { PoolPlayer } from '@/types/draft';
import {
  applyCustomRankingsToPool,
  validateCustomRankings,
  cleanTiers,
  type CustomRanking,
} from './customRankings';

describe('validateCustomRankings', () => {
  it('should validate correct CSV rankings', () => {
    const validCsv = `Overall,Player,Position,Team,Bye,Tier,Pos Rank,ADP,Pos Tier
1,Ja'Marr Chase,WR,CIN,10,1,1,1.2,1
2,Bijan Robinson,RB,ATL,5,1,1,2.1,1
3,Josh Allen,QB,BUF,7,1,1,18.4,1
4,Sam LaPorta,TE,DET,5,2,1,25.6,2
5,Saquon Barkley,RB,PHI,5,1,2,5.1,1`;
    const res = validateCustomRankings(validCsv);
    expect(res.valid).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.rankings).toHaveLength(5);
    expect(res.rankings![0]).toEqual({ name: "Ja'Marr Chase", rank: 1, pos: 'WR', tier: 1, team: 'CIN', posTiers: { WR: 1 } });
    expect(res.rankings![2]).toEqual({ name: 'Josh Allen', rank: 3, pos: 'QB', tier: 1, team: 'BUF', posTiers: { QB: 1 } });
  });

  it('should parse specific position tier columns', () => {
    const csv = `Overall,Player,Position,RB Tier,WR Tier,QB Tier
1,Bijan Robinson,RB,1,,
2,Ja'Marr Chase,WR,,2,
3,Josh Allen,QB,,,3`;
    const res = validateCustomRankings(csv);
    expect(res.valid).toBe(true);
    expect(res.rankings![0].posTiers).toEqual({ RB: 1 });
    expect(res.rankings![1].posTiers).toEqual({ WR: 2 });
    expect(res.rankings![2].posTiers).toEqual({ QB: 3 });
  });

  it('should catch empty strings', () => {
    expect(validateCustomRankings('').valid).toBe(false);
    expect(validateCustomRankings('   ').valid).toBe(false);
  });

  it('should catch missing required headers', () => {
    const missingHeaders = `Position,Team,Bye,Tier
WR,CIN,10,1`;
    const res = validateCustomRankings(missingHeaders);
    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain('Could not find required columns');
  });

  it('should catch validation errors within CSV lines', () => {
    const invalidLines = `Overall,Player,Position,Tier
,Ja'Marr Chase,WR,1
2,,RB,1
-3,Josh Allen,QB,1
4,Sam LaPorta,TE,-2`;
    const res = validateCustomRankings(invalidLines);
    expect(res.valid).toBe(false);
    expect(res.errors).toHaveLength(4);
    expect(res.errors[0]).toContain('Line 2 ("Ja\'Marr Chase"): Invalid "Overall" rank');
    expect(res.errors[1]).toContain('Line 3: Missing a valid player name');
    expect(res.errors[2]).toContain('Line 4 ("Josh Allen"): Invalid "Overall" rank');
    expect(res.errors[3]).toContain('Line 5 ("Sam LaPorta"): Invalid "Tier"');
  });
});

describe('applyCustomRankingsToPool', () => {
  const mockPool: PoolPlayer[] = [
    {
      id: '1',
      name: 'Christian McCaffrey',
      team: 'SF',
      pos: 'RB',
      posRank: 1,
      overallRank: 1,
      overallRankSF: 1,
      tier: 1,
      bye: 9,
      baseValue: 70,
    },
    {
      id: '2',
      name: 'CeeDee Lamb',
      team: 'DAL',
      pos: 'WR',
      posRank: 1,
      overallRank: 2,
      overallRankSF: 2,
      tier: 1,
      bye: 7,
      baseValue: 65,
    },
    {
      id: '3',
      name: 'Josh Allen',
      team: 'BUF',
      pos: 'QB',
      posRank: 1,
      overallRank: 3,
      overallRankSF: 3,
      tier: 1,
      bye: 6,
      baseValue: 40,
    },
    {
      id: '4',
      name: 'Breece Hall',
      team: 'NYJ',
      pos: 'RB',
      posRank: 2,
      overallRank: 4,
      overallRankSF: 4,
      tier: 1,
      bye: 12,
      baseValue: 60,
    },
  ];

  it('should match and re-rank players accordingly', () => {
    const custom: CustomRanking[] = [
      { name: 'Breece Hall', rank: 1 },
      { name: 'CeeDee Lamb', rank: 2 },
    ];

    const { updatedPlayers, warnings, matchedCount } = applyCustomRankingsToPool(mockPool, custom);
    expect(warnings).toHaveLength(0);
    expect(matchedCount).toBe(2);

    // Breece Hall (#4 overall originally) becomes #1
    expect(updatedPlayers[0].name).toBe('Breece Hall');
    expect(updatedPlayers[0].overallRank).toBe(1);
    expect(updatedPlayers[0].overallRankSF).toBe(1);

    // CeeDee Lamb (#2 overall originally) becomes #2
    expect(updatedPlayers[1].name).toBe('CeeDee Lamb');
    expect(updatedPlayers[1].overallRank).toBe(2);

    // Unmatched players (McCaffrey #1 and Josh Allen #3) are shifted after matched ones
    // and ordered by their original rank relative to each other: McCaffrey (#1) -> Allen (#3)
    expect(updatedPlayers[2].name).toBe('Christian McCaffrey');
    expect(updatedPlayers[2].overallRank).toBe(3);

    expect(updatedPlayers[3].name).toBe('Josh Allen');
    expect(updatedPlayers[3].overallRank).toBe(4);
  });

  it('should recalculate posRank correctly', () => {
    const custom: CustomRanking[] = [
      { name: 'Breece Hall', rank: 1 },
      { name: 'Christian McCaffrey', rank: 2 }, // Hall RB1, McCaffrey RB2
    ];

    const { updatedPlayers } = applyCustomRankingsToPool(mockPool, custom);

    const hall = updatedPlayers.find(p => p.name === 'Breece Hall')!;
    const cmc = updatedPlayers.find(p => p.name === 'Christian McCaffrey')!;

    expect(hall.posRank).toBe(1);
    expect(cmc.posRank).toBe(2);
  });

  it('should apply custom tiers and fallback when tier is not provided', () => {
    const custom: CustomRanking[] = [
      { name: 'Breece Hall', rank: 1 }, // originally tier 1, no custom tier provided
      { name: 'CeeDee Lamb', rank: 2, tier: 2 }, // originally tier 1, overridden to 2
    ];

    const { updatedPlayers } = applyCustomRankingsToPool(mockPool, custom);

    const hall = updatedPlayers.find(p => p.name === 'Breece Hall')!;
    const lamb = updatedPlayers.find(p => p.name === 'CeeDee Lamb')!;

    expect(hall.tier).toBe(1); // fallback to original
    expect(lamb.tier).toBe(2); // overridden
  });

  it('should warn on unmatched players', () => {
    const custom: CustomRanking[] = [
      { name: 'Non Existent Player', rank: 1 },
    ];
    const { warnings, matchedCount } = applyCustomRankingsToPool(mockPool, custom);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Could not match custom ranked player');
    expect(matchedCount).toBe(0);
  });

  it('should fallback to matching by first name initial and last name with team/rank tiebreakers', () => {
    const custom: CustomRanking[] = [
      { name: 'J. Gibbs', rank: 2 }, // Matches Jahmyr Gibbs
      { name: 'B. Robinson', rank: 1, team: 'ATL' }, // Matches Bijan Robinson over Brian Robinson Jr
      { name: 'B. Robinson', rank: 3, team: 'WAS' }, // Matches Brian Robinson Jr over Bijan Robinson
    ];

    const poolWithRobinsons: PoolPlayer[] = [
      { id: 'gibbs', name: 'Jahmyr Gibbs', team: 'DET', pos: 'RB', overallRank: 5, overallRankSF: 5, tier: 1, posRank: 3 },
      { id: 'bijan', name: 'Bijan Robinson', team: 'ATL', pos: 'RB', overallRank: 2, overallRankSF: 2, tier: 1, posRank: 1 },
      { id: 'brian', name: 'Brian Robinson Jr.', team: 'WAS', pos: 'RB', overallRank: 30, overallRankSF: 30, tier: 3, posRank: 15 },
    ];

    const { updatedPlayers, warnings } = applyCustomRankingsToPool(poolWithRobinsons, custom);
    expect(warnings).toHaveLength(0);

    expect(updatedPlayers[0].id).toBe('bijan');
    expect(updatedPlayers[1].id).toBe('gibbs');
    expect(updatedPlayers[2].id).toBe('brian');
  });

  describe('cleanTiers', () => {
    it('should enforce tier monotonicity and pull sandwiched tiers up', () => {
      const players: PoolPlayer[] = [
        { id: '1', name: 'P1', pos: 'RB', team: 'KC', overallRank: 1, overallRankSF: 1, tier: 2, posRank: 1 },
        { id: '2', name: 'P2', pos: 'RB', team: 'KC', overallRank: 2, overallRankSF: 2, tier: 3, posRank: 2 },
        { id: '3', name: 'P3', pos: 'RB', team: 'KC', overallRank: 3, overallRankSF: 3, tier: 2, posRank: 3 },
        { id: '4', name: 'P4', pos: 'RB', team: 'KC', overallRank: 4, overallRankSF: 4, tier: 0, posRank: 4 }, // unranked
      ];

      const cleaned = cleanTiers(players);
      expect(cleaned[0].tier).toBe(2);
      expect(cleaned[1].tier).toBe(2); // pulled up to tier 2 because it was sandwiched
      expect(cleaned[2].tier).toBe(2);
      expect(cleaned[3].tier).toBe(0); // ignored because tier is 0
    });
  });
});
