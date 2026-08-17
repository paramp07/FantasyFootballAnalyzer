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

export function SeasonDraftBoard({ teams, totalTeams, draftType = 'snake' }: SeasonDraftBoardProps) {
  const { scrollerRef, handleMouseDown, handleTouchStart, style: resizableStyle } = useResizableBoard(380);

  const teamCount = teams.length || totalTeams || 12;

  // Determine max round
  const roundsCount = useMemo(() => {
    let max = 14;
    for (const t of teams) {
      for (const p of t.draftPicks ?? []) {
        if (p.round && p.round > max) max = p.round;
      }
    }
    return max;
  }, [teams]);

  // Index picks by `${teamId}|${round}`
  const picksByTeamAndRound = useMemo(() => {
    const map = new Map<string, DraftPick>();
    for (const team of teams) {
      for (const pick of team.draftPicks ?? []) {
        if (!pick) continue;
        const round = pick.round || (pick.pickNumber ? Math.ceil(pick.pickNumber / teamCount) : 1);
        const key = `${team.id}|${round}`;
        if (!map.has(key)) {
          map.set(key, { ...pick, round });
        }
      }
    }
    return map;
  }, [teams, teamCount]);

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
          {/* Team Header Row */}
          {teams.map((team, colIdx) => (
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

            return teams.map((team, colIdx) => {
              const pickKeyStr = `${team.id}|${roundNum}`;
              const pick = picksByTeamAndRound.get(pickKeyStr);

              const pos = pick?.player?.position || '';
              const posClass = POS_CLASS[pos] || '';

              // Direction arrow
              const showArrow = draftType === 'snake';
              const arrowSymbol = isReverseRound ? '←' : '→';

              let pickLabel = `#${pick?.pickNumber || (rIdx * teamCount + colIdx + 1)}`;
              if (pick?.round && pick?.pickNumber) {
                const slotInRound = ((pick.pickNumber - 1) % teamCount) + 1;
                pickLabel = `${pick.round}.${slotInRound < 10 ? '0' : ''}${slotInRound}`;
              }

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

                  {showArrow && <span className={styles.dirArrow}>{arrowSymbol}</span>}
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
