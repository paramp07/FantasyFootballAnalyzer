import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { League } from '@/types';
import styles from './LiveDraftDetectedBanner.module.css';

interface LiveDraftDetectedBannerProps {
  league: League | null;
}

export function LiveDraftDetectedBanner({ league }: LiveDraftDetectedBannerProps) {
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState(false);

  useEffect(() => {
    if (!league || (league.platform !== 'espn' && league.platform !== 'yahoo')) {
      setActiveSession(false);
      return;
    }

    const handleUpdate = () => {
      setActiveSession(true);
    };

    window.addEventListener('DRAFT_SESSION_INIT', handleUpdate);
    window.addEventListener('DRAFT_PICKS_UPDATE', handleUpdate);

    return () => {
      window.removeEventListener('DRAFT_SESSION_INIT', handleUpdate);
      window.removeEventListener('DRAFT_PICKS_UPDATE', handleUpdate);
    };
  }, [league]);

  // Render for ESPN or Yahoo leagues (unless guest)
  if (!league || league.isGuest || (league.platform !== 'espn' && league.platform !== 'yahoo')) {
    return null;
  }

  const platformName = league.platform.toUpperCase();

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={activeSession ? styles.indicatorActive : styles.indicator} />
        <div>
          <span className={styles.title}>
            {activeSession
              ? `Live ${platformName} Draft Room Connected`
              : `${platformName} Live Draft Sync Ready`}
          </span>
          <span className={styles.subtitle}>
            {activeSession
              ? 'Extension is receiving live pick updates from your draft room.'
              : 'Launch the live draft room to sync picks automatically via your extension.'}
          </span>
        </div>
      </div>
      <button
        type="button"
        className={styles.button}
        onClick={() => navigate('/draft-room', { state: { autoStart: true } })}

      >
        Open Live Draft →
      </button>
    </div>
  );
}
