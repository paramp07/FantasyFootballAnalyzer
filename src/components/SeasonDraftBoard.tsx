import { useMemo } from 'react';
import type { DraftPick, Team } from '@/types';
import { useResizableBoard } from '@/hooks/useResizableBoard';
import styles from './SeasonDraftBoard.module.css';

interface SeasonDraftBoardProps {
  teams: Team[];
  totalTeams: number;
  draftType?: 'snake' | 'auction' | 'linear';
}

const POS_CLASS: Record<string, string> = {
  QB: styles.posQB,
  RB: styles.posRB,
  WR: styles.posWR,
  TE: styles.posTE,
  K: styles.posK,
  DST: styles.posDST,
  DEF: styles.posDST,
};

function formatShortName(name: string, pos: string, team: string): string {
  if (pos === 'DST' || pos === 'DEF') {
    return name.includes('D/ST') ? name : `${team || ''} D/ST`.trim();
  }
  const space = name.indexOf(' ');
  if (space === -1) return name;
  return `${name[0]}. ${name.slice(space + 1)}`;
}

type ArrowDir = 'right' | 'left' | 'down' | null;

function ArrowIcon({ direction }: { direction: ArrowDir }) {
  if (!direction) return null;
  let rotation = 0;
  if (direction === 'left') rotation = 180;
  if (direction === 'down') rotation = 90;

  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: `rotate(${rotation}deg)`,
        display: 'block',
      }}
    >
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="13 5 20 12 13 19" />
    </svg>
  );
}

function getArrowDirection(roundNum: number, colIdx: number, teamCount: number, roundsCount: number): ArrowDir {
  const isOddRound = roundNum % 2 !== 0;

  if (isOddRound) {
    if (colIdx === teamCount - 1) {
      return roundNum === roundsCount ? null : 'down';
    }
    return 'right';
  } else {
    if (colIdx === 0) {
      return roundNum === roundsCount ? null : 'down';
    }
    return 'left';
  }
}

export function SeasonDraftBoard({ teams, totalTeams, draftType = 'snake' }: SeasonDraftBoardProps) {
  const { scrollerRef, handleMouseDown, handleTouchStart, style: resizableStyle } = useResizableBoard(380);

  const teamCount = teams.length || totalTeams || 12;

  // Flatten all picks
  const allPicks = useMemo(() => {
    return teams.flatMap(t => t.draftPicks ?? []).filter(Boolean);
  }, [teams]);

  // Determine max round
  const roundsCount = useMemo(() => {
    let max = 14;
    for (const p of allPicks) {
      if (p.round && p.round > max) max = p.round;
      else if (p.pickNumber) {
        const calcR = Math.ceil(p.pickNumber / teamCount);
        if (calcR > max) max = calcR;
      }
    }
    return max;
  }, [allPicks, teamCount]);

  // 1. Sort teams by 1st Round draft pick order (1.01, 1.02, 1.03 ...)
  const orderedTeams = useMemo(() => {
    const r1Picks = allPicks.filter(p => p.round === 1 || (p.pickNumber && p.pickNumber <= teamCount));
    if (r1Picks.length > 0) {
      const orderMap = new Map<string, number>();
      r1Picks.forEach(p => {
        const slot = p.pickNumber ? ((p.pickNumber - 1) % teamCount) + 1 : 999;
        orderMap.set(p.teamId, slot);
      });
      return [...teams].sort((a, b) => {
        const slotA = orderMap.get(a.id) ?? 999;
        const slotB = orderMap.get(b.id) ?? 999;
        return slotA - slotB;
      });
    }
    return teams;
  }, [teams, allPicks, teamCount]);

  // Map picks by overall pickNumber AND by teamId|round
  const picksByPickNumber = useMemo(() => {
    const map = new Map<number, DraftPick>();
    for (const pick of allPicks) {
      if (pick.pickNumber) {
        map.set(pick.pickNumber, pick);
      }
    }
    return map;
  }, [allPicks]);

  const picksByTeamAndRound = useMemo(() => {
    const map = new Map<string, DraftPick>();
    for (const pick of allPicks) {
      const r = pick.round || (pick.pickNumber ? Math.ceil(pick.pickNumber / teamCount) : 1);
      map.set(`${pick.teamId}|${r}`, { ...pick, round: r });
    }
    return map;
  }, [allPicks, teamCount]);

  const legendPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];

  return (
    <div className={styles.boardContainer}>
      <div className={styles.boardHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>Draft Board</h2>
          <span className={styles.subtitle}>
            {roundsCount} Rounds · {teamCount} Teams ({draftType.toUpperCase()})
          </span>
        </div>
        <div className={styles.legend}>
          {legendPositions.map(pos => (
            <span key={pos} className={`${styles.legendChip} ${POS_CLASS[pos] || ''}`}>
              {pos}
            </span>
          ))}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className={styles.scroller}
        style={resizableStyle || undefined}
      >
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `repeat(${teamCount}, minmax(110px, 1fr))` }}
        >
          {/* Team Header Row: Columns in Draft Pick 1..N order */}
          {orderedTeams.map((team, colIdx) => (
            <div key={team.id || colIdx} className={styles.teamHeaderCell}>
              <div className={styles.teamName} title={team.name}>
                {team.name}
              </div>
              {team.ownerName && <div className={styles.ownerName}>{team.ownerName}</div>}
            </div>
          ))}

          {/* Round Rows */}
          {Array.from({ length: roundsCount }, (_, rIdx) => {
            const roundNum = rIdx + 1;
            const isReverseRound = draftType === 'snake' && roundNum % 2 === 0;

            return orderedTeams.map((team, colIdx) => {
              // Calculate overall pick number for snake or linear draft
              const slotInRound = isReverseRound ? teamCount - colIdx : colIdx + 1;
              const overallPickNo = (roundNum - 1) * teamCount + slotInRound;

              // Find pick by pick number or by team + round
              let pick = picksByPickNumber.get(overallPickNo);
              if (!pick) {
                pick = picksByTeamAndRound.get(`${team.id}|${roundNum}`);
              }

              const pos = pick?.player?.position || '';
              const posClass = POS_CLASS[pos] || '';

              const showArrow = draftType === 'snake';
              const arrowDir = getArrowDirection(roundNum, colIdx, teamCount, roundsCount);

              const pickLabel = `${roundNum}.${slotInRound < 10 ? '0' : ''}${slotInRound}`;
              const byeWeek = (pick?.player as any)?.byeWeek ?? (pick?.player as any)?.bye;

              return (
                <div
                  key={`${team.id || colIdx}-r${roundNum}`}
                  className={`${styles.cell} ${pick ? `${styles.cellFilled} ${posClass}` : styles.cellEmpty}`}
                >
                  <div className={styles.pickMetaHeader}>
                    <span className={styles.pickNo}>{pickLabel}</span>
                    <div className={styles.badgeGroup}>
                      {pick?.isKeeper && <span className={styles.keeperBadge}>KEEP</span>}
                      {pick?.auctionValue !== undefined && pick.auctionValue > 0 && (
                        <span className={styles.priceBadge}>${pick.auctionValue}</span>
                      )}
                    </div>
                  </div>

                  {pick?.player ? (
                    <>
                      <div className={styles.playerName} title={pick.player.name}>
                        {formatShortName(pick.player.name, pos, pick.player.team)}
                      </div>
                      <div className={styles.playerDetails}>
                        <span className={styles.posText}>{pos}</span>
                        {pick.player.team && <span>{pick.player.team}</span>}
                        {byeWeek ? <span>(B{byeWeek})</span> : null}
                      </div>
                    </>
                  ) : (
                    <div className={styles.playerName}>-</div>
                  )}

                  {showArrow && arrowDir && (
                    <span className={styles.dirArrow}>
                      <ArrowIcon direction={arrowDir} />
                    </span>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>

      <div
        className={styles.resizeHandle}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        title="Drag to resize draft board height"
      >
        <div className={styles.handleBar} />
      </div>
    </div>
  );
}
