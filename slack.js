// Chamber Walk Helper — Slack Webhook

// NOTE: No Content-Type header — Slack Workflow Webhooks (/triggers/...) reject it.
// Omitting it sends a simple request (no CORS preflight) which Slack accepts.

async function sendChamberAudit(webhookUrl, data) {
  console.log('[slack.js] sending payload:', data);

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  const body = await response.text();
  console.log(`[slack.js] status: ${response.status} | body: ${body}`);

  return { ok: response.status === 200, status: response.status };
}
