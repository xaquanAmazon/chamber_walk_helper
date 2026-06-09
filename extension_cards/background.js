importScripts('slack.js');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'logAudit') {
    chrome.storage.local.get(['slackWebhook'], async ({ slackWebhook }) => {
      const result = await sendChamberAudit(slackWebhook, msg.data);
      sendResponse(result);
    });
  }
  return true;
});
