import React, { useState } from 'react';
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

  return (
    <span
      className={`${styles.container} ${className || ''}`}
      onMouseEnter={() => setShowHoverCard(true)}
      onMouseLeave={() => setShowHoverCard(false)}
    >
      <span
        className={`${styles.tag} ${isSevere ? styles.tagSevere : ''}`}
        title={injuryTitle(player)}
      >
        {abbrev}
      </span>

      {showHoverCard && (
        <div className={styles.card} style={{ borderColor: concernColor }}>
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
        </div>
      )}
    </span>
  );
};
