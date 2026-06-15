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

const aliasInput   = $('amz-alias');
const aliasEditBtn = $('alias-edit-btn');
const aliasRequired = $('alias-required');
const output       = $('output');
const statusEl     = $('status');

// ── State ──────────────────────────────────────────────────────────────────

let formValid = false;
let cardsData = [];
let activeTabId = null;

// ── Alias ──────────────────────────────────────────────────────────────────

chrome.storage.local.get(['amzAlias'], ({ amzAlias }) => {
  aliasInput.disabled = true;
  aliasEditBtn.style.display = 'inline-block';
  if (amzAlias) {
    aliasInput.value = amzAlias;
  } else {
    aliasInput.placeholder = 'Set in Settings';
    aliasEditBtn.textContent = 'Set';
  }
});

aliasEditBtn.addEventListener('click', () => {
  window.location.href = 'settings.html';
});

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

  [$('copy-btn'), $('slack-btn')].forEach(btn => {
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
    statusEl.textContent = 'Not on WORM Work Centers page.';
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

$('slack-btn').addEventListener('click', async () => {
  if (!formValid) return;

  if (!aliasInput.value.trim()) {
    aliasRequired.style.display = 'block';
    aliasInput.disabled = false;
    aliasInput.focus();
    return;
  }

  // Wake up service worker
  await chrome.scripting.executeScript({ target: { tabId: activeTabId }, func: () => {} });

  chrome.runtime.sendMessage({ action: 'logAudit', data: getPayload() }, () => {
    if (chrome.runtime.lastError) {
      output.style.color = 'red';
      output.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
      return;
    }
    output.style.color = 'green';
    output.textContent = '✅ Sent to Slack!';
  });
});

// ── Copy to clipboard ──────────────────────────────────────────────────────

$('copy-btn').addEventListener('click', async () => {
  if (!formValid) return;

  const p = getPayload();
  const fields = [
    ['Alias',                                    '@' + aliasInput.value.trim()],
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

  output.style.color = '#333';
  output.textContent = plain;
});
