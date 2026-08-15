import React, { useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import { injuryAbbrev, injuryIsSevere, injuryTitle } from '@/utils/injury';
import { getInjuryDetail, type InjuryDetail } from '@/utils/injuryData';
import styles from './InjuryTagWithCard.module.css';

interface PlayerInjuryFields {
  sleeperId?: string;
  name: string;
  pos?: string;
  injuryStatus?: string;
  injuryBodyPart?: string;
  injuryNotes?: string;
  injuryStartDate?: string;
}

interface InjuryTagWithCardProps {
  player: PlayerInjuryFields;
  className?: string;
}

const CONCERN_COLORS: Record<'low' | 'mild' | 'medium' | 'high', string> = {
  low: '#caf21c',
  mild: '#ffcf3a',
  medium: '#f97316',
  high: '#ff6242',
};

export const InjuryTagWithCard: React.FC<InjuryTagWithCardProps> = ({ player, className }) => {
  const [showHoverCard, setShowHoverCard] = useState(false);
  const [cardPos, setCardPos] = useState<{ left: number; top?: number; bottom?: number; placement: 'top' | 'bottom' } | null>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  const detail: InjuryDetail | undefined = getInjuryDetail(player);

  const status = player.injuryStatus || (detail ? 'Questionable' : null);
  if (!status) return null;

  const abbrev = injuryAbbrev(status);
  const isSevere = injuryIsSevere(status);
  const concernLevel = detail?.concernLevel ?? (isSevere ? 'high' : 'low');
  const concernColor = CONCERN_COLORS[concernLevel];

  const injuryName = detail?.injuryName || (player.injuryBodyPart ? `${player.injuryBodyPart} Injury` : status);
  const expectedReturn = detail?.expectedReturn || 'TBD';
  const reinjuryRate = detail?.reinjuryRate || 'Low';
  const notes = detail?.doctorNotes || detail?.additionalDetails || player.injuryNotes || 'Monitoring status for team practices.';

  const handleMouseEnter = () => {
    if (tagRef.current) {
      const rect = tagRef.current.getBoundingClientRect();
      // Estimated height of card ~ 320px
      const spaceAbove = rect.top;
      const placement = spaceAbove < 330 ? 'bottom' : 'top';

      if (placement === 'top') {
        setCardPos({
          left: Math.max(10, Math.min(rect.left, window.innerWidth - 390)),
          bottom: window.innerHeight - rect.top + 6,
          placement: 'top',
        });
      } else {
        setCardPos({
          left: Math.max(10, Math.min(rect.left, window.innerWidth - 390)),
          top: rect.bottom + 6,
          placement: 'bottom',
        });
      }
    }
    setShowHoverCard(true);
  };

  const handleMouseLeave = () => {
    setShowHoverCard(false);
  };

  return (
    <span
      ref={tagRef}
      className={`${styles.container} ${className || ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        className={`${styles.tag} ${isSevere ? styles.tagSevere : ''}`}
        aria-label={injuryTitle(player)}
      >
        {abbrev}
      </span>

      {showHoverCard && cardPos && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div
          className={`${styles.card} ${cardPos.placement === 'bottom' ? styles.cardBottom : styles.cardTop}`}
          style={{
            left: `${cardPos.left}px`,
            top: cardPos.top !== undefined ? `${cardPos.top}px` : undefined,
            bottom: cardPos.bottom !== undefined ? `${cardPos.bottom}px` : undefined,
            borderColor: concernColor,
          }}
        >
          {/* Header */}
          <div className={styles.cardHeader}>
            <div className={styles.iconBox}>
              <svg
                className={styles.iconSvg}
                viewBox="0 0 24 24"
                fill="none"
                stroke={concernColor}
                strokeWidth="2.5"
                strokeLinecap="square"
                strokeLinejoin="miter"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <div className={styles.headerInfo}>
              <h2 className={styles.title}>{injuryName}</h2>
              <div>
                <span
                  className={styles.badge}
                  style={{ backgroundColor: concernColor, color: '#0a0a0a' }}
                >
                  {concernLevel} CONCERN
                </span>
              </div>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Data Rows */}
          <div className={styles.dataRows}>
            <div className={styles.dataRow}>
              <span className={styles.label}>EXPECTED RETURN</span>
              <span className={styles.value}>{expectedReturn}</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>REINJURY RATE</span>
              <span className={styles.value} style={{ color: concernColor }}>
                {reinjuryRate}
              </span>
            </div>
          </div>

          <hr className={styles.divider} />

          {/* Doctor Notes */}
          <div className={styles.notesSection}>
            <span className={styles.notesLabel}>NOTES</span>
            <p className={styles.notesText}>{notes}</p>
          </div>
        </div>,
        document.body
      )}
    </span>
  );
};
