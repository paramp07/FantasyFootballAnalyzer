import { useEffect, useRef } from 'react';
import type { LeagueCredentials, Platform } from '@/types';
import { logger } from '@/utils/logger';

export function useAutoSyncLoader(
  isLoaded: boolean,
  onLoad: (credentials: LeagueCredentials, options?: { skipHistory?: boolean }) => void
) {
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Only run once and only if we don't have a league yet
    if (isLoaded || attemptedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const syncPlatform = params.get('syncPlatform') as Platform | null;
    const syncLeagueId = params.get('syncLeagueId') || params.get('syncDraftId');
    const syncSeason = params.get('syncSeason');

    if (!syncPlatform || !syncLeagueId) return;

    attemptedRef.current = true;
    logger.debug('[AutoSync] Auto-loading league from sync params:', { syncPlatform, syncLeagueId, syncSeason });

    if (syncPlatform === 'sleeper') {
      onLoad({
        platform: 'sleeper',
        leagueId: syncLeagueId,
        season: syncSeason ? parseInt(syncSeason, 10) : new Date().getFullYear(),
      }, { skipHistory: true });
      return;
    }

    if (syncPlatform === 'espn') {
      // Fetch cookies via window.postMessage relay (no extension ID needed!)
      try {
        let settled = false;

        const handleMessage = (event: MessageEvent) => {
          if (
            event.data &&
            event.data.source === 'ffa-extension-relay' &&
            event.data.type === 'GET_ESPN_COOKIES_RESPONSE'
          ) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            window.removeEventListener('message', handleMessage);

            const response = event.data.cookies;
            logger.debug('[AutoSync] Received ESPN cookies from extension:', {
              hasS2: !!response?.espnS2,
              hasSwid: !!response?.swid,
            });

            onLoad(
              {
                platform: 'espn',
                leagueId: syncLeagueId,
                season: syncSeason ? parseInt(syncSeason, 10) : new Date().getFullYear(),
                espnS2: response?.espnS2,
                swid: response?.swid,
              },
              { skipHistory: true }
            );
          }
        };

        window.addEventListener('message', handleMessage);

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            window.removeEventListener('message', handleMessage);
            logger.warn('[AutoSync] Extension timeout fetching ESPN cookies');
            // Try loading as public
            onLoad(
              {
                platform: 'espn',
                leagueId: syncLeagueId,
                season: syncSeason ? parseInt(syncSeason, 10) : new Date().getFullYear(),
              },
              { skipHistory: true }
            );
          }
        }, 1500);

        // Fire the request to the content script
        window.postMessage({ source: 'ffa-web-app', type: 'GET_ESPN_COOKIES' }, '*');
      } catch (err) {
        logger.warn('[AutoSync] Failed to request cookies from extension:', err);
        // Try loading as public
        onLoad(
          {
            platform: 'espn',
            leagueId: syncLeagueId,
            season: syncSeason ? parseInt(syncSeason, 10) : new Date().getFullYear(),
          },
          { skipHistory: true }
        );
      }
    }
  }, [isLoaded, onLoad]);
}
