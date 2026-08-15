chrome.runtime.onMessage.addListener((message) => {
  console.log('[Gridiron Extension Relay] Received event from background:', message);
  if (message.type === 'DRAFT_SESSION_INIT' || message.type === 'DRAFT_PICKS_UPDATE') {
    window.dispatchEvent(new CustomEvent(message.type, { detail: message.data }));
  }
});

if (typeof BroadcastChannel !== 'undefined') {
  const syncChannel = new BroadcastChannel('gridiron_live_sync');
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'DRAFT_PICKS_UPDATE' && event.data?.data) {
      console.log('[Gridiron Extension Relay] BroadcastChannel pick update:', event.data.data);
      window.dispatchEvent(new CustomEvent('DRAFT_PICKS_UPDATE', { detail: event.data.data }));
    } else if (event.data?.type === 'GRIDIRON_HEARTBEAT') {
      window.dispatchEvent(new CustomEvent('GRIDIRON_HEARTBEAT', { detail: event.data.data }));
    }
  };
}



window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data && event.data.source === 'ffa-web-app' && event.data.type === 'GET_ESPN_COOKIES') {
    chrome.runtime.sendMessage({ type: 'get-espn-cookies' }, (cookies) => {
      window.postMessage(
        {
          source: 'ffa-extension-relay',
          type: 'GET_ESPN_COOKIES_RESPONSE',
          cookies: cookies || { installed: true },
        },
        '*'
      );
    });
  }
});

