// Content script that runs on the Fantasy Football Analyzer web pages.
// Its job is to receive messages from the extension background service worker
// and relay them to the React page context via window.postMessage.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'DRAFT_PICKS_UPDATE') {
    window.postMessage({
      source: 'ffa-extension',
      type: 'DRAFT_PICKS_UPDATE',
      platform: message.platform,
      draftId: message.draftId,
      picks: message.picks
    }, '*');
  }
});

// Listen to requests from the web app page and relay to background script
window.addEventListener('message', (event) => {
  if (event.data && event.data.source === 'ffa-web-app' && event.data.type === 'GET_ESPN_COOKIES') {
    chrome.runtime.sendMessage({ type: 'get-espn-cookies' }, (response) => {
      window.postMessage({
        source: 'ffa-extension-relay',
        type: 'GET_ESPN_COOKIES_RESPONSE',
        cookies: response
      }, '*');
    });
  }
});

