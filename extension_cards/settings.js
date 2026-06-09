const DEFAULTS = {
  kteOptions: ['Running', 'Passed', 'Failed', 'Terminated', 'NA', 'Completed with some failures'],
  tempOptions: ['Yes', 'No', 'NA'],
  issueOptions: ['NO', 'YES', 'NA']
};

function load() {
  chrome.storage.local.get(['slackWebhook', 'kteOptions', 'tempOptions', 'issueOptions'], (data) => {
    document.getElementById('s-slack-webhook').value = data.slackWebhook || '';
    document.getElementById('s-kte').value = (data.kteOptions || DEFAULTS.kteOptions).join('\n');
    document.getElementById('s-temp').value = (data.tempOptions || DEFAULTS.tempOptions).join('\n');
    document.getElementById('s-issue').value = (data.issueOptions || DEFAULTS.issueOptions).join('\n');
  });
}

document.getElementById('save-btn').addEventListener('click', () => {
  const slackWebhook = document.getElementById('s-slack-webhook').value.trim();
  const kteOptions = document.getElementById('s-kte').value.split('\n').map(s => s.trim()).filter(Boolean);
  const tempOptions = document.getElementById('s-temp').value.split('\n').map(s => s.trim()).filter(Boolean);
  const issueOptions = document.getElementById('s-issue').value.split('\n').map(s => s.trim()).filter(Boolean);
  chrome.storage.local.set({ slackWebhook, kteOptions, tempOptions, issueOptions }, () => {
    document.getElementById('status').textContent = 'Saved!';
    setTimeout(() => document.getElementById('status').textContent = '', 1500);
  });
});

document.getElementById('back-btn').addEventListener('click', () => {
  window.location.href = 'popup.html';
});

load();
