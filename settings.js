const DEFAULTS = {
  kteOptions:  ['Running', 'Passed', 'Failed', 'Terminated', 'NA', 'Completed with some failures'],
  tempOptions: ['Yes', 'No', 'NA'],
  issueOptions: ['NO', 'YES', 'NA']
};

// Load defaults from bundled settings.json, then override with chrome.storage
async function load() {
  // 1. Read settings.json bundled with the extension (read-only, shareable)
  let fileDefaults = {};
  try {
    const url = chrome.runtime.getURL('settings.json');
    const res = await fetch(url);
    fileDefaults = await res.json();
  } catch (e) {
    console.warn('Could not load settings.json, using hardcoded defaults.', e);
  }

  // 2. Merge: settings.json → hardcoded defaults (settings.json wins)
  const merged = {
    slackWebhook: fileDefaults.slackWebhook || '',
    kteOptions:   fileDefaults.kteOptions   || DEFAULTS.kteOptions,
    tempOptions:  fileDefaults.tempOptions  || DEFAULTS.tempOptions,
    issueOptions: fileDefaults.issueOptions || DEFAULTS.issueOptions
  };

  // 3. chrome.storage overrides everything (user's saved choices win)
  chrome.storage.local.get(['slackWebhook', 'amzAlias', 'kteOptions', 'tempOptions', 'issueOptions'], (data) => {
    document.getElementById('s-slack-webhook').value = data.slackWebhook || merged.slackWebhook;
    document.getElementById('s-amz-alias').value     = data.amzAlias     || '';
    document.getElementById('s-kte').value   = (data.kteOptions   || merged.kteOptions).join('\n');
    document.getElementById('s-temp').value  = (data.tempOptions  || merged.tempOptions).join('\n');
    document.getElementById('s-issue').value = (data.issueOptions || merged.issueOptions).join('\n');
  });
}

function validate() {
  const alias   = document.getElementById('s-amz-alias').value.trim();
  const webhook = document.getElementById('s-slack-webhook').value.trim();
  let valid = true;

  const errAlias   = document.getElementById('err-alias');
  const errWebhook = document.getElementById('err-webhook');

  errAlias.style.display   = alias   ? 'none' : 'block';
  errWebhook.style.display = webhook ? 'none' : 'block';

  if (!alias || !webhook) valid = false;
  return valid;
}

document.getElementById('save-btn').addEventListener('click', () => {
  if (!validate()) return;

  const slackWebhook = document.getElementById('s-slack-webhook').value.trim();
  const amzAlias     = document.getElementById('s-amz-alias').value.trim();
  const kteOptions   = document.getElementById('s-kte').value.split('\n').map(s => s.trim()).filter(Boolean);
  const tempOptions  = document.getElementById('s-temp').value.split('\n').map(s => s.trim()).filter(Boolean);
  const issueOptions = document.getElementById('s-issue').value.split('\n').map(s => s.trim()).filter(Boolean);

  chrome.storage.local.set({ slackWebhook, amzAlias, kteOptions, tempOptions, issueOptions }, () => {
    const status = document.getElementById('status');
    status.textContent = 'Saved!';
    setTimeout(() => status.textContent = '', 1500);
  });
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'popup.html';
});

load();
