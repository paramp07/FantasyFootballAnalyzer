import { describe, it, expect } from 'vitest';
import { parseInjuryCSV, getInjuryDetail } from './injuryData';

describe('injuryData', () => {
  it('parses CSV lines correctly', () => {
    const csv = `Overall,Player,Position,Team,Bye,Tier,Pos Rank,Sleeper ID,HTML Injury Note,API Injury Name,Injury Date,Surgery Date,Additional Details,Typical Recovery,Expected Return,Reinjury Rate,Concern Level,Doctor Notes,Last Changed At
4,Puka Nacua,WR,LAR,11,1,2,9493,"Psoas muscle ""soreness""","Psoas muscle ""soreness""",August 11 2026,N/A,Expected back at practice,1-2 weeks,Week 1 2026,Low,low,For those who wanted to know,2026-08-15`;

    const parsed = parseInjuryCSV(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].playerName).toBe('Puka Nacua');
    expect(parsed[0].sleeperId).toBe('9493');
    expect(parsed[0].concernLevel).toBe('low');
    expect(parsed[0].expectedReturn).toBe('Week 1 2026');
  });

  it('matches player from loaded injurydata.csv by Sleeper ID or player name', () => {
    const detailPuka = getInjuryDetail({ sleeperId: '9493', name: 'Puka Nacua', pos: 'WR' });
    expect(detailPuka).toBeDefined();
    expect(detailPuka?.playerName).toBe('Puka Nacua');
    expect(detailPuka?.expectedReturn).toBe('Week 1 2026');

    const detailBowers = getInjuryDetail({ name: 'Brock Bowers', pos: 'TE' });
    expect(detailBowers).toBeDefined();
    expect(detailBowers?.playerName).toBe('Brock Bowers');
  });
});
