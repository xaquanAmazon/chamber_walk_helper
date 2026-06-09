const DEFAULTS = {
  kteOptions: ['Running', 'Passed', 'Failed', 'Terminated', 'NA', 'Completed with some failures'],
  tempOptions: ['Yes', 'No', 'NA'],
  issueOptions: ['NO', 'YES', 'NA']
};

// Alias logic — required, disable after set, edit button to unlock
const aliasInput = document.getElementById('amz-alias');
const aliasEditBtn = document.getElementById('alias-edit-btn');
const aliasRequired = document.getElementById('alias-required');

function lockAlias() {
  aliasInput.disabled = true;
  aliasEditBtn.style.display = 'inline-block';
}

function unlockAlias() {
  aliasInput.disabled = false;
  aliasEditBtn.style.display = 'none';
  aliasInput.focus();
}

chrome.storage.local.get(['amzAlias'], ({ amzAlias }) => {
  if (amzAlias) {
    aliasInput.value = amzAlias;
    lockAlias();
  }
});

aliasInput.addEventListener('change', () => {
  const val = aliasInput.value.trim();
  if (val) {
    chrome.storage.local.set({ amzAlias: val });
    lockAlias();
    aliasRequired.style.display = 'none';
  }
});

aliasEditBtn.addEventListener('click', () => {
  unlockAlias();
});

let formValid = false;
let cardsData = [];

function validateForm() {
  const kte = document.getElementById('f-kte').value;
  const temp = document.getElementById('f-temp').value;
  const issue = document.getElementById('f-issue').value;
  const issueDetail = document.getElementById('f-issueDetail').value.trim();
  const issueDetailRequired = issue === 'YES';

  document.getElementById('issue-detail-required').style.display = issueDetailRequired ? 'inline' : 'none';

  formValid = kte !== '' && temp !== '' && issue !== '' && (!issueDetailRequired || issueDetail !== '');
  const copyBtn = document.getElementById('copy-btn');
  copyBtn.disabled = !formValid;
  copyBtn.style.opacity = formValid ? '1' : '0.5';
}

function getPayload() {
  return {
    time_of_audit:        document.getElementById('f-time').textContent,
    chamber:              document.getElementById('f-chamber').textContent,
    lru_being_tested:     document.getElementById('f-lru').textContent,
    chamber_status:       document.getElementById('f-chamberStatus').textContent,
    worm_status:          document.getElementById('f-wormStatus').textContent,
    kte_status:           document.getElementById('f-kte').value,
    temp_trend:           document.getElementById('f-temp').value,
    estimated_completion: document.getElementById('f-completion').textContent,
    issue_found:          document.getElementById('f-issue').value,
    issue_details:        document.getElementById('f-issueDetail').value || 'N/A',
    other_comments:       document.getElementById('f-comments').value || 'N/A',
    amz_alias:            document.getElementById('amz-alias').value.trim()
                            ? document.getElementById('amz-alias').value.trim() + '@amazon.com'
                            : 'N/A'
  };
}

// Load dropdown options
chrome.storage.local.get(['kteOptions', 'tempOptions', 'issueOptions'], (data) => {
  const kteOpts = data.kteOptions || DEFAULTS.kteOptions;
  const tempOpts = data.tempOptions || DEFAULTS.tempOptions;
  const issueOpts = data.issueOptions || DEFAULTS.issueOptions;
  const kteSel = document.getElementById('f-kte');
  const tempSel = document.getElementById('f-temp');
  const issueSel = document.getElementById('f-issue');

  kteSel.add(new Option('-- Select --', ''));
  kteOpts.forEach(o => kteSel.add(new Option(o, o)));
  tempSel.add(new Option('-- Select --', ''));
  tempOpts.forEach(o => tempSel.add(new Option(o, o)));
  issueSel.add(new Option('-- Select --', ''));
  issueOpts.forEach(o => issueSel.add(new Option(o, o)));

  kteSel.addEventListener('change', validateForm);
  tempSel.addEventListener('change', validateForm);
  issueSel.addEventListener('change', validateForm);
  document.getElementById('f-issueDetail').addEventListener('input', validateForm);
  validateForm();
});

// Fetch cards from content script
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const target = 'https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/work-centers';

  if (!tab.url.startsWith(target)) {
    document.getElementById('status').textContent = 'Not on WORM Work Centers page.';
    return;
  }

  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });

  chrome.tabs.sendMessage(tab.id, { action: 'getCards' }, (response) => {
    if (chrome.runtime.lastError || !response?.cards?.length) {
      document.getElementById('status').textContent = 'No chamber cards found. Expand a chamber group first.';
      return;
    }

    cardsData = response.cards;
    const dropdown = document.getElementById('chamber-dropdown');
    cardsData.forEach((card, i) => {
      const label = card.idle ? `${card.chamberId} - IDLE` : `${card.chamberId} - ${card.wrId}`;
      dropdown.add(new Option(label, i));
    });
  });
})();

// Select chamber
document.getElementById('chamber-dropdown').addEventListener('change', (e) => {
  const idx = e.target.value;
  if (idx === '') {
    document.getElementById('form').style.display = 'none';
    return;
  }

  const card = cardsData[idx];
  const now = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });

  document.getElementById('f-kte').value = '';
  document.getElementById('f-temp').value = '';
  document.getElementById('f-issue').value = '';
  document.getElementById('f-issueDetail').value = '';
  document.getElementById('f-comments').value = '';
  document.getElementById('issue-detail-required').style.display = 'none';
  document.getElementById('output').textContent = '';
  validateForm();

  document.getElementById('form').style.display = 'block';
  document.getElementById('f-time').textContent = now;
  document.getElementById('f-chamber').textContent = card.chamberId;
  document.getElementById('f-lru').textContent = card.idle ? 'N/A' : card.partType;
  document.getElementById('f-chamberStatus').textContent = card.idle ? 'IDLE' : card.workType;
  document.getElementById('f-wormStatus').textContent = card.idle ? 'IDLE' : card.statusEvent;
  document.getElementById('f-completion').textContent = card.idle ? 'N/A' : card.etc;
});

// Send to Slack (logs to background)
document.getElementById('slack-btn').addEventListener('click', async () => {
  if (!formValid) return;

  if (!aliasInput.value.trim()) {
    aliasRequired.style.display = 'block';
    aliasInput.disabled = false;
    aliasInput.focus();
    return;
  }

  const payload = getPayload();
  const output = document.getElementById('output');

  // Wake up service worker then send
  await chrome.scripting.executeScript({ target: { tabId: (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id }, func: () => {} });

  chrome.runtime.sendMessage({ action: 'logAudit', data: payload }, () => {
    if (chrome.runtime.lastError) {
      output.style.color = 'red';
      output.textContent = '❌ Error: ' + chrome.runtime.lastError.message;
      return;
    }
    output.style.color = 'green';
    output.textContent = 'Sent to Slack!';
  });
});

// Copy to clipboard
document.getElementById('copy-btn').addEventListener('click', async () => {
  if (!formValid) return;

  const fields = [
    ['Time of Audit', document.getElementById('f-time').textContent],
    ['Chamber', document.getElementById('f-chamber').textContent],
    ['LRU Being Tested', document.getElementById('f-lru').textContent],
    ['Chamber Status', document.getElementById('f-chamberStatus').textContent],
    ['WORM Status', document.getElementById('f-wormStatus').textContent],
    ['KTE Status', document.getElementById('f-kte').value],
    ['Temp Trend Matches Profile', document.getElementById('f-temp').value],
    ['Estimated Completion Time', document.getElementById('f-completion').textContent],
    ['Issue Found', document.getElementById('f-issue').value],
    ['If YES, List Issue Details and SIM Ticket Link', document.getElementById('f-issueDetail').value],
    ['Other Comments', document.getElementById('f-comments').value]
  ];

  const plain = fields.map(([k, v]) => `${k}: ${v}`).join('\n');
  const html = fields.map(([k, v]) => `<b>${k}:</b> ${v.replace(/\n/g, '<br>')}`).join('<br>');

  await navigator.clipboard.write([new ClipboardItem({
    'text/html': new Blob([html], { type: 'text/html' }),
    'text/plain': new Blob([plain], { type: 'text/plain' })
  })]);

  console.log('[Chamber Walk] Audit Data:', getPayload());

  document.getElementById('output').textContent = plain;
});
