async function sendChamberAudit(webhookUrl, data) {
  console.log(data)
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      time_of_audit:        data.time_of_audit,
      chamber:              data.chamber,
      chamber_group:        data.chamber_group,
      lru_being_tested:     data.lru_being_tested,
      chamber_status:       data.chamber_status,
      worm_status:          data.worm_status,
      kte_status:           data.kte_status,
      temp_trend:           data.temp_trend,
      estimated_completion: data.estimated_completion,
      issue_found:          data.issue_found,
      issue_details:        data.issue_details,
      other_comments:       data.other_comments,
      amz_alias:            data.amz_alias,
      wr_id:                data.wr_id
    })
  });
  console.log(response.text())
  console.log(response.status === 200 ? '✅ Sent to Slack!' : '❌ Failed: ' + response.status);
  return { ok: response.status === 200, status: response.status };
}
