// Chamber Walk Helper Cards - Content Script

function extractCards() {
  const cards = [];

  // Only look inside expanded panels
  const expandedPanels = document.querySelectorAll('[class*="content-expanded"]');

  for (const panel of expandedPanels) {
    const kioskButtons = panel.querySelectorAll('button[aria-label^="Open kiosk view"]');

    for (const btn of kioskButtons) {
      let cardEl = btn.closest('div[style*="border-color"]');
      if (!cardEl) continue;

      // Chamber ID
      let chamberId = '';
      const h5s = cardEl.querySelectorAll('h5');
      for (const h5 of h5s) {
        if (h5.parentElement?.querySelector('small')) {
          chamberId = h5.textContent.trim();
          break;
        }
      }
      if (!chamberId) continue;

      // Work Request Id
      let wrId = '';
      const ps = cardEl.querySelectorAll('p');
      for (const p of ps) {
        const match = p.textContent.match(/(WR-\d+)/);
        if (match) { wrId = match[1]; break; }
      }

      // Work Type
      let workType = '';
      const wtMatch = cardEl.textContent.match(/\[(\w+)\]\s*\[QTY/);
      if (wtMatch) workType = wtMatch[1];

      // Part Type
      let partType = '';
      for (const h5 of h5s) {
        const text = h5.textContent.trim();
        if (text !== chamberId && !h5.parentElement?.querySelector('small')) {
          partType = text;
          break;
        }
      }

      // Status Event
      let statusEvent = '';
      const spans = cardEl.querySelectorAll('span[style*="text-overflow"]');
      for (const s of spans) {
        const t = s.textContent.trim();
        if (t) { statusEvent = t; break; }
      }

      // ETC
      let etc = '';
      const allSpans = cardEl.querySelectorAll('span');
      for (const s of allSpans) {
        const t = s.textContent.trim();
        if (t.startsWith('ETC:')) {
          etc = t.replace('ETC:', '').trim();
          break;
        }
      }

      // Idle detection
      let idleTime = '';
      if (!wrId) {
        for (const s of allSpans) {
          const t = s.textContent.trim();
          if (/^\d+h\s+\d+m/.test(t)) { idleTime = t; break; }
        }
      }

      cards.push({ chamberId, wrId, workType, partType, statusEvent, etc, idle: !wrId, idleTime });
    }
  }

  return cards;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getCards') {
    const cards = extractCards();
    sendResponse({ cards });
  }
  return true;
});
