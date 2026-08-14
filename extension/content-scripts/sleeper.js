/**
 * Sleeper Draft Content Script
 * 
 * Injects an "Open Board" button into the Sleeper draft interface header.
 * Uses a self-healing setInterval to handle Sleeper's React SPA re-renders.
 */
(function sleeperContentScript() {
  'use strict';

  const BUTTON_ID = 'ffa-open-board-btn';
  const POLL_INTERVAL_MS = 800;

  /**
   * Extract the draft ID from Sleeper's URL.
   * Sleeper draft URLs look like:
   *   https://sleeper.com/draft/nfl/1234567890
   */
  function extractDraftId() {
    const parts = window.location.pathname.split('/');
    // The draft ID is the last segment of the path
    return parts[parts.length - 1] || null;
  }

  /**
   * Build the analyzer draft room URL with sync params.
   */
  function buildAnalyzerUrl(draftId) {
    return `http://localhost:5173/draft-room?syncPlatform=sleeper&syncDraftId=${draftId}`;
  }

  /**
   * Apply our branded styles to the button element.
   */
  function applyButtonStyles(btn) {
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      color: '#ffffff',
      border: '1px solid #84cc16',
      borderRadius: '6px',
      padding: '6px 14px',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(132, 204, 22, 0.2)',
      transition: 'all 0.2s ease',
      height: '32px',
      minWidth: '120px',
      verticalAlign: 'middle',
      flexShrink: '0',
      margin: '0 8px',
    });

    btn.addEventListener('mouseover', () => {
      btn.style.border = '1px solid #a3e635';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4), 0 0 12px rgba(163, 230, 53, 0.4)';
      btn.style.transform = 'scale(1.02)';
    });
    btn.addEventListener('mouseout', () => {
      btn.style.border = '1px solid #84cc16';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3), 0 0 8px rgba(132, 204, 22, 0.2)';
      btn.style.transform = 'scale(1)';
    });
  }

  /**
   * Create the "Open Board" button element.
   */
  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';

    // Green dot indicator
    const dot = document.createElement('span');
    Object.assign(dot.style, {
      width: '8px',
      height: '8px',
      backgroundColor: '#84cc16',
      borderRadius: '50%',
      display: 'inline-block',
      flexShrink: '0',
    });

    const label = document.createElement('span');
    label.textContent = 'Open Board';

    btn.appendChild(dot);
    btn.appendChild(label);

    applyButtonStyles(btn);

    btn.addEventListener('click', () => {
      const draftId = extractDraftId();
      if (!draftId) {
        alert('Could not find Sleeper Draft ID in the URL.');
        return;
      }
      const url = buildAnalyzerUrl(draftId);
      window.open(url, '_blank');
    });

    return btn;
  }

  /**
   * Self-healing injection loop. Sleeper's React SPA can re-render
   * the header at any time. This loop ensures our button stays present.
   * 
   * The button is placed inside the `div.draft-header` container,
   * inserted before the `.right` element (if it exists) to sit inline
   * with the other header controls.
   */
  function inject() {
    // Already injected and still in DOM — nothing to do
    if (document.getElementById(BUTTON_ID)) return;

    // Only inject on draft pages
    if (!window.location.pathname.includes('/draft/')) return;

    // Sleeper uses `div.draft-header` for the header row
    const header = document.querySelector('div.draft-header');
    if (!header) return;

    const btn = createButton();

    // Insert before the `.right` section if it exists
    const rightSection = header.querySelector('.right');
    if (rightSection) {
      header.insertBefore(btn, rightSection);
    } else {
      header.appendChild(btn);
    }
  }

  // Start polling — Sleeper runs at document_end so DOM is available
  setInterval(inject, POLL_INTERVAL_MS);
})();
