import { describe, it, expect } from 'vitest';
import { parseInjuryCSV, getInjuryDetail } from './injuryData';

describe('injuryData', () => {
  it('parses CSV lines correctly', () => {
    const csv = `Sleeper ID,Player Name,Position,Team,Injury Name,Injury Date,Surgery Date,Additional Details,Typical Recovery,Expected Return,Reinjury Rate,Concern Level,Doctor Notes,Last Changed At
10219,Chris Rodriguez Jr.,RB,JAC,Left Foot Fracture,March 1 2026,Spring 2026,Slowly ramping up in camp,6-8 weeks,Week 1 2026,Low,Low,Currently at training camp,2026-08-15`;

    const parsed = parseInjuryCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].playerName).toBe('Chris Rodriguez Jr.');
    expect(parsed[0].concernLevel).toBe('low');
    expect(parsed[0].expectedReturn).toBe('Week 1 2026');
  });

  it('matches player by Sleeper ID or player name', () => {
    const detail = getInjuryDetail({ sleeperId: '10219', name: 'Chris Rodriguez Jr.', pos: 'RB' });
    expect(detail).toBeDefined();
    expect(detail?.injuryName).toBe('Left Foot Fracture');
  });
});
