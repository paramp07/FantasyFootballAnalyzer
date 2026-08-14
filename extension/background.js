// Service worker: only job is to answer "get the user's ESPN cookies"
// when the Fantasy Football Analyzer web app asks for them.
//
// We never store cookies, never send them anywhere, never make network calls.
// The web origin asking is gated by manifest.externally_connectable.

const ESPN_URL = 'https://www.espn.com';

async function readCookie(name) {
  // chrome.cookies.get returns null if the cookie isn't set or the user isn't logged in.
  const cookie = await chrome.cookies.get({ url: ESPN_URL, name });
  return cookie ? cookie.value : null;
}

async function readEspnCookies() {
  const [espnS2, swid] = await Promise.all([
    readCookie('espn_s2'),
    readCookie('SWID'),
  ]);
  return { espnS2, swid };
}

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Belt-and-suspenders: even though externally_connectable gates the origin,
  // double-check sender.url is from an allowed origin before answering.
  const url = sender?.url || '';
  const allowed = url.startsWith('https://krool.github.io/') || url.startsWith('http://localhost:');
  if (!allowed) {
    sendResponse({ error: 'origin-not-allowed' });
    return false;
  }

  if (message?.type === 'ping') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  if (message?.type === 'get-espn-cookies') {
    readEspnCookies()
      .then(({ espnS2, swid }) => {
        if (!espnS2 || !swid) {
          sendResponse({ error: 'no-cookies', espnS2: null, swid: null });
        } else {
          sendResponse({ espnS2, swid });
        }
      })
      .catch((err) => {
        sendResponse({ error: String(err?.message || err) });
      });
    // Return true to keep the message channel open for the async response.
    return true;
  }

  sendResponse({ error: 'unknown-message-type' });
  return false;
});

// Handle proxy API calls from the Sleeper/ESPN content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'get-espn-cookies') {
    readEspnCookies()
      .then(({ espnS2, swid }) => {
        sendResponse({ espnS2, swid });
      })
      .catch((err) => {
        sendResponse({ error: String(err?.message || err) });
      });
    return true;
  }

  if (message && message.type === 'proxy-service.draft-api') {
    const { path, args } = message.data || {};
    const method = path ? path[0] : null;

    if (method === 'getSitePositionMap') {
      const platform = args[0];
      if (platform === 'espn') {
        sendResponse({
          res: {
            success: true,
            data: [
              { sitePositionId: '0', position: 'QB' },
              { sitePositionId: '2', position: 'RB' },
              { sitePositionId: '4', position: 'WR' },
              { sitePositionId: '6', position: 'TE' },
              { sitePositionId: '7', position: 'SUPERFLEX' },
              { sitePositionId: '16', position: 'DST' },
              { sitePositionId: '17', position: 'K' },
              { sitePositionId: '23', position: 'FLEX' }
            ]
          }
        });
      } else {
        // sleeper
        sendResponse({
          res: {
            success: true,
            data: [
              { sitePositionId: 'QB', position: 'QB' },
              { sitePositionId: 'RB', position: 'RB' },
              { sitePositionId: 'WR', position: 'WR' },
              { sitePositionId: 'TE', position: 'TE' },
              { sitePositionId: 'K', position: 'K' },
              { sitePositionId: 'DEF', position: 'DST' },
              { sitePositionId: 'FLEX', position: 'FLEX' }
            ]
          }
        });
      }
    } else if (method === 'initEspnDraft') {
      const { leagueId, season } = args[0] || {};
      sendResponse({
        res: {
          success: true,
          data: { id: `${leagueId}-${season}` }
        }
      });
    } else if (method === 'initSleeperDraft') {
      const { sleeperDraftId } = args[0] || {};
      sendResponse({
        res: {
          success: true,
          data: { id: sleeperDraftId }
        }
      });
    } else if (method === 'postEspnPicks') {
      const [picks, draftId] = args || [];
      broadcastDraftUpdate('espn', draftId, picks);
      sendResponse({ res: { success: true } });
    } else if (method === 'postSleeperPicks') {
      const [picks, draftId] = args || [];
      broadcastDraftUpdate('sleeper', draftId, picks);
      sendResponse({ res: { success: true } });
    } else {
      sendResponse({ res: { success: true } });
    }

    return true; // Keep message channel open
  }

  // Fallback direct broadcast
  if (message && message.type === 'DRAFT_PICKS_UPDATE') {
    const { platform, draftId, picks } = message;
    broadcastDraftUpdate(platform, draftId, picks);
    sendResponse({ success: true });
    return false;
  }
});

function broadcastDraftUpdate(platform, draftId, picks) {
  chrome.tabs.query({}, (tabs) => {
    const allowedOrigins = [
      'http://localhost',
      'https://krool.github.io',
      'https://fantasyfootballanalyzer.app'
    ];
    const targetTabs = tabs.filter(tab => {
      if (!tab.url) return false;
      return allowedOrigins.some(origin => tab.url.startsWith(origin));
    });

    targetTabs.forEach(tab => {
      if (tab.id !== undefined) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'DRAFT_PICKS_UPDATE',
          platform,
          draftId,
          picks
        }).catch((err) => {
          // Tab might not have the relay script loaded/active, ignore
          console.debug('[background] Failed to send draft update to tab:', tab.id, err);
        });
      }
    });
  });
}


