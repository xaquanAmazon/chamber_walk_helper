// Chamber Walk Helper — Popup Script
// NOTE: Requires <meta charset="UTF-8"> in popup.html for emoji/special chars to render correctly.

const DEFAULTS = {
  kteOptions:   ['Running', 'Passed', 'Failed', 'Terminated', 'NA', 'Completed with some failures'],
  tempOptions:  ['Yes', 'No', 'NA'],
  issueOptions: ['NO', 'YES', 'NA'],
};

const TARGET_URL = 'https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/work-centers';

// ── DOM refs ───────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

const output   = $('output');
const statusEl = $('status');
const aliasInput    = $('amz-alias');
const aliasEditBtn  = $('alias-edit-btn');
const aliasRequired = $('alias-required');

// ── Alias — load from storage, locked, Edit opens settings ────────────────────────────

chrome.storage.local.get(['amzAlias'], ({ amzAlias }) => {
  aliasInput.disabled = true;
  aliasEditBtn.style.display = 'inline-block';
  if (amzAlias) {
    aliasInput.value = amzAlias;
  } else {
    aliasInput.placeholder = 'Set alias in Settings';
    aliasEditBtn.textContent = 'Set';
  }
});

aliasEditBtn.addEventListener('click', () => {
  window.location.href = 'settings.html';
});

// ── State ──────────────────────────────────────────────────────────────────

let formValid = false;
let cardsData = [];
let activeTabId = null;

// ── Storage helpers ────────────────────────────────────────────────────────────

/** Append one audit record to the persistent auditLog array in chrome.storage.local */
function saveRecord(payload) {
  chrome.storage.local.get(['auditLog'], ({ auditLog }) => {
    const log = Array.isArray(auditLog) ? auditLog : [];
    log.push({ ...payload, saved_at: new Date().toISOString() });
    chrome.storage.local.set({ auditLog: log });
  });
}

/** Persist the Log and Copy checkbox state so it survives popup close/reopen */
function saveCheckboxState() {
  chrome.storage.local.set({ logAndCopy: $('log-and-copy').checked });
}

/** Restore checkbox state on popup open */
chrome.storage.local.get(['logAndCopy'], ({ logAndCopy }) => {
  if (logAndCopy !== undefined) $('log-and-copy').checked = logAndCopy;
});

$('log-and-copy').addEventListener('change', saveCheckboxState);

// ── Form validation ────────────────────────────────────────────────────────

function validateForm() {
  const issueVal = $('f-issue').value;
  const issueDetailRequired = issueVal === 'YES';
  const issueDetailFilled = $('f-issueDetail').value.trim() !== '';

  $('issue-detail-required').style.display = issueDetailRequired ? 'inline' : 'none';

  formValid = $('f-kte').value !== ''
    && $('f-temp').value !== ''
    && issueVal !== ''
    && (!issueDetailRequired || issueDetailFilled);

  [$('copy-btn'), $('log-btn')].forEach(btn => {
    btn.disabled = !formValid;
    btn.style.opacity = formValid ? '1' : '0.5';
  });
}

// ── Payload ────────────────────────────────────────────────────────────────

function getPayload() {
  const alias = aliasInput.value.trim();
  return {
    time_of_audit:        $('f-time').textContent,
    chamber:              $('f-chamber').textContent,
    chamber_group:        $('f-chamberGroup').textContent,
    wr_id:                $('f-wrId').textContent,
    lru_being_tested:     $('f-lru').textContent,
    chamber_status:       $('f-chamberStatus').textContent,
    worm_status:          $('f-wormStatus').textContent,
    kte_status:           $('f-kte').value,
    temp_trend:           $('f-temp').value,
    estimated_completion: $('f-completion').textContent,
    issue_found:          $('f-issue').value,
    issue_details:        $('f-issueDetail').value || 'N/A',
    other_comments:       $('f-comments').value   || 'N/A',
    amz_alias:            alias ? alias + '@amazon.com' : 'N/A',
  };
}

// ── Dropdowns ──────────────────────────────────────────────────────────────

function populateSelect(selId, options) {
  const sel = $(selId);
  sel.add(new Option('-- Select --', ''));
  options.forEach(o => sel.add(new Option(o, o)));
  sel.addEventListener('change', validateForm);
}

chrome.storage.local.get(['kteOptions', 'tempOptions', 'issueOptions'], (data) => {
  populateSelect('f-kte',   data.kteOptions   || DEFAULTS.kteOptions);
  populateSelect('f-temp',  data.tempOptions  || DEFAULTS.tempOptions);
  populateSelect('f-issue', data.issueOptions || DEFAULTS.issueOptions);
  $('f-issueDetail').addEventListener('input', validateForm);
  validateForm();
});

// ── Card loading ───────────────────────────────────────────────────────────

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab.url.startsWith(TARGET_URL)) {
    statusEl.innerHTML = 'Not on WORM Work Centers page. <a href="' + TARGET_URL + '" target="_blank">Open it</a>';
    return;
  }

  activeTabId = tab.id;
  await chrome.scripting.executeScript({ target: { tabId: activeTabId }, files: ['content.js'] });

  chrome.tabs.sendMessage(activeTabId, { action: 'getCards' }, (response) => {
    if (chrome.runtime.lastError || !response?.cards?.length) {
      statusEl.textContent = 'No chamber cards found. Expand a chamber group first.';
      return;
    }

    cardsData = response.cards;
    const dropdown = $('chamber-dropdown');
    cardsData.forEach((card, i) => {
      const label = card.idle
        ? `${card.chamberId} - IDLE`
        : `${card.chamberId} - ${card.wrId}`;
      dropdown.add(new Option(label, i));
    });
  });
})();

// ── Chamber selection ──────────────────────────────────────────────────────

function resetForm() {
  ['f-kte', 'f-temp', 'f-issue'].forEach(id => $(id).value = '');
  $('f-issueDetail').value = '';
  $('f-comments').value = '';
  $('issue-detail-required').style.display = 'none';
  output.textContent = '';
  validateForm();
}

$('chamber-dropdown').addEventListener('change', (e) => {
  const idx = e.target.value;
  if (idx === '') { $('form').style.display = 'none'; return; }

  const card = cardsData[idx];
  const now  = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  });

  resetForm();
  $('form').style.display = 'block';

  $('f-time').textContent         = now;
  $('f-chamber').textContent      = card.chamberId;
  $('f-chamberGroup').textContent = card.cardGroup  || 'N/A';
  $('f-wrId').textContent         = card.wrId       || 'N/A';
  $('f-lru').textContent          = card.idle ? 'N/A'  : card.partType;
  $('f-chamberStatus').textContent = card.idle ? 'IDLE' : card.workType;
  $('f-wormStatus').textContent   = card.idle ? 'IDLE' : card.statusEvent;
  $('f-completion').textContent   = card.idle ? 'N/A'  : card.etc;
});

// ── Send to Slack ──────────────────────────────────────────────────────────

$('log-btn').addEventListener('click', async () => {
  if (!formValid) return;

  if (!aliasInput.value.trim()) {
    aliasRequired.style.display = 'block';
    aliasInput.disabled = false;
    aliasInput.focus();
    return;
  }
  aliasRequired.style.display = 'none';

  // Wake up service worker
  await chrome.scripting.executeScript({ target: { tabId: activeTabId }, func: () => {} });

  const payload = getPayload();
  const andCopy = $('log-and-copy').checked;

  saveRecord(payload);

  chrome.runtime.sendMessage({ action: 'logAudit', data: payload }, async () => {
    if (chrome.runtime.lastError) {
      output.className = 'output-box error';
      output.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
      return;
    }

    if (andCopy) {
      await copyPayload(payload);
      output.className = 'output-box success';
      output.textContent = '✅ Logged and copied!';
    } else {
      output.className = 'output-box success';
      output.textContent = '✅ Logged to record!';
    }
  });
});

// ── Copy to clipboard ──────────────────────────────────────────────────────

async function copyPayload(p) {
  const fields = [
    ['Alias',                                    '@' + (aliasInput.value.trim() || 'N/A')],
    ['Time of Audit',                            p.time_of_audit],
    ['Chamber Group',                            p.chamber_group],
    ['Chamber',                                  p.chamber],
    ['Work Request ID',                          p.wr_id],
    ['LRU Being Tested',                         p.lru_being_tested],
    ['Chamber Status',                           p.chamber_status],
    ['WORM Status',                              p.worm_status],
    ['KTE Status',                               p.kte_status],
    ['Temp Trend Matches Profile',               p.temp_trend],
    ['Estimated Completion Time',                p.estimated_completion],
    ['Issue Found',                              p.issue_found],
    ['Issue Details and SIM Ticket Link',        p.issue_details],
    ['Other Comments',                           p.other_comments],
  ];

  const plain = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html  = fields.map(([k, v]) => `<b>${k}:</b> ${v.replace(/\n/g, '<br>')}`).join('<br>');

  await navigator.clipboard.write([new ClipboardItem({
    'text/html':  new Blob([html],  { type: 'text/html' }),
    'text/plain': new Blob([plain], { type: 'text/plain' }),
  })]);

  return plain;
}

$('copy-btn').addEventListener('click', async () => {
  if (!formValid) return;
  const payload = getPayload();
  saveRecord(payload);
  const plain = await copyPayload(payload);
  output.className = 'output-box';
  output.textContent = plain;
});
