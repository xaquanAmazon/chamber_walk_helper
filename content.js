// Chamber Walk Helper — Content Script

// ── Helpers ────────────────────────────────────────────────────────────────

/** First <h5> whose parent also contains a <small> → the chamber ID label */
function extractChamberId(cardEl) {
  for (const h5 of cardEl.querySelectorAll('h5')) {
    if (h5.parentElement?.querySelector('small'))
      return h5.textContent.trim();
  }
  return '';
}

/** Second <h5> that isn't the chamber ID and has no <small> sibling → part type */
function extractPartType(cardEl, chamberId) {
  for (const h5 of cardEl.querySelectorAll('h5')) {
    const text = h5.textContent.trim();
    if (text !== chamberId && !h5.parentElement?.querySelector('small'))
      return text;
  }
  return '';
}

/** Work type from "[MFG] [QTY" pattern */
function extractWorkType(cardEl) {
  const m = cardEl.textContent.match(/\[(\w+)\]\s*\[QTY/);
  return m ? m[1] : '';
}

/** WR-XXXXXX from any <p> */
function extractWrId(cardEl) {
  for (const p of cardEl.querySelectorAll('p')) {
    const m = p.textContent.match(/(WR-\d+)/);
    if (m) return m[1];
  }
  return '';
}

/** First non-empty <span style*="text-overflow"> → status event */
function extractStatusEvent(cardEl) {
  for (const s of cardEl.querySelectorAll('span[style*="text-overflow"]')) {
    const t = s.textContent.trim();
    if (t) return t;
  }
  return '';
}

/** <span> starting with "ETC:" → strip prefix */
function extractEtc(cardEl) {
  for (const s of cardEl.querySelectorAll('span')) {
    const t = s.textContent.trim();
    if (t.startsWith('ETC:')) return t.replace('ETC:', '').trim();
  }
  return '';
}

/** Idle time — only when no WR: <span> matching "NNh NNm" */
function extractIdleTime(cardEl) {
  for (const s of cardEl.querySelectorAll('span')) {
    const t = s.textContent.trim();
    if (/^\d+h\s+\d+m/.test(t)) return t;
  }
  return '';
}

// ── Main extraction ────────────────────────────────────────────────────────

function extractCards() {
  const cards = [];

  for (const panel of document.querySelectorAll('[class*="content-expanded"]')) {
    for (const btn of panel.querySelectorAll('button[aria-label^="Open kiosk view"]')) {
      const cardEl = btn.closest('div[style*="border-color"]');
      if (!cardEl) continue;

      const chamberId = extractChamberId(cardEl);
      if (!chamberId) continue;

      const wrId = extractWrId(cardEl);
      const idle = !wrId;

      cards.push({
        chamberId,
        cardGroup:   chamberId.replace(/-\d+$/, ''), // e.g. "MDTV-02" → "MDTV"
        wrId,
        workType:    extractWorkType(cardEl),
        partType:    extractPartType(cardEl, chamberId),
        statusEvent: extractStatusEvent(cardEl),
        etc:         extractEtc(cardEl),
        idle,
        idleTime:    idle ? extractIdleTime(cardEl) : '',
      });
    }
  }

  return cards;
}

// ── Message listener ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getCards') sendResponse({ cards: extractCards() });
  return true;
});
