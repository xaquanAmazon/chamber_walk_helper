# Chamber Walk Helper - Cards Extension

## Purpose
Chrome extension that extracts chamber data from the MSE WORM Work Centers card view to assist with chamber walk audits. Populates an audit form automatically, sends reports to a Slack channel via Workflow Webhook, and copies formatted output to the clipboard.

## Target URL
`https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/work-centers?...&view=CARDS`

(Query params like `plantId` and `workCenterIds` may vary)

---

## First-Time Setup

Before using the extension, open **Settings** (gear icon in the popup header) and fill in:

| Field | Description |
|---|---|
| **Amazon Alias** | Your Amazon login alias (e.g. `xaquan`). Required. Appended as `alias@amazon.com` when sending to Slack. |
| **Workflow Webhook URL** | Slack Workflow Webhook URL (`https://hooks.slack.com/triggers/...`). Required. |
| **Dropdown Options** | KTE Status, Temp Trend, Issue Found options (one per line). Pre-filled with defaults. |

Settings are saved to `chrome.storage.local` and persist across sessions.

---

## Workflow

### 1. URL Check
- Extension activates only when the current tab URL starts with the Work Centers page.
- If not on the correct page, shows: `"Not on WORM Work Centers page."`

### 2. Alias Display
- On popup open, alias is loaded from storage and shown as a **disabled (read-only)** field.
- An **Edit** button opens the Settings page to change it.
- If no alias is set yet, a **Set** button opens Settings.
- Alias is required — Send to Slack is blocked if empty.

### 3. Extract Chamber Cards
- Content script is injected and scans all visible chamber cards inside expanded panels (`[class*="content-expanded"]`).
- Cards are identified by finding `button[aria-label^="Open kiosk view"]` elements and traversing up to the card container (`div[style*="border-color"]`).
- Both active and idle chambers are collected.

### 4. Populate Chamber Dropdown
- All chambers are listed as `CHAMBER_ID - WR_ID` or `CHAMBER_ID - IDLE`.
- If no cards found: `"No chamber cards found. Expand a chamber group first."`

### 5. User Selects Chamber
- Form auto-fills with extracted card data.
- Idle chambers show `N/A` / `IDLE` for WR-related fields.

### 6. Data Mapping

| Form Field | Source |
|---|---|
| Time of Audit | Current timestamp (generated on chamber selection) |
| Chamber | Chamber ID (e.g. `VIBE-Z-08`) |
| LRU Being Tested | Part Type (e.g. `Solar TCM`) — or `N/A` if idle |
| Chamber Status | Work Type (e.g. `MFG`, `DEV`) — or `IDLE` |
| WORM Status | Status Event (e.g. `IN_PROGRESS`, `SETUP`) — or `IDLE` |
| KTE Status | User input (dropdown) |
| Temp Trend Matches Profile | User input (dropdown, required) |
| Estimated Completion Time | ETC chip text (e.g. `Mon 6/8, 1:45 am`) — or `N/A` |
| Issue Found | User input (dropdown, required) |
| Issue Details / SIM Link | User input (required only if Issue Found = YES) |
| Other Comments | User input |

### 7. Copy to Clipboard
- Disabled until required fields are filled (KTE Status, Temp Trend, Issue Found, and Issue Details if YES).
- Copies both `text/plain` and `text/html` (bold labels) to clipboard.
- Preview shown in the output area below the buttons.

### 8. Send to Slack
- Sends the full audit payload to the configured Slack Workflow Webhook.
- Routed through `background.js` (service worker) to avoid CORS restrictions.
- Webhook URL and alias are read from `chrome.storage.local` at send time.
- Result shown in the output area: `Sent to Slack!` (green) or `Error: ...` (red).

---

## Slack Payload

```json
{
  "time_of_audit":        "Jun 9, 2026, 10:30:00 AM",
  "chamber":              "VIBE-Z-08",
  "lru_being_tested":     "Solar TCM",
  "chamber_status":       "MFG",
  "worm_status":          "IN_PROGRESS",
  "kte_status":           "Running",
  "temp_trend":           "Yes",
  "estimated_completion": "Mon 6/9, 1:45 am",
  "issue_found":          "NO",
  "issue_details":        "N/A",
  "other_comments":       "N/A",
  "amz_alias":            "xaquan@amazon.com"
}
```

> **Note:** No `Content-Type` header is sent — Slack Workflow Webhooks reject it in CORS preflight. Omitting the header triggers a simple request with no preflight check.

---

## DOM Extraction Strategy (`content.js`)

| Field | Extraction Method |
|---|---|
| Chamber ID | First `<h5>` whose parent contains a `<small>` sibling |
| Work Request ID | `<p>` text matching `WR-\d+` regex |
| Work Type | Card text matching `\[(\w+)\]\s*\[QTY` regex (e.g. `[MFG]`) |
| Part Type | Second `<h5>` that isn't the chamber heading and has no `<small>` sibling |
| Status Event | First `<span>` with `style*="text-overflow"` |
| ETC | `<span>` text starting with `ETC:` (prefix stripped) |
| Idle Detection | No WR ID found → card marked as idle |
| Idle Time | `<span>` matching `^\d+h\s+\d+m` pattern (only when idle) |

---

## Settings Page (`settings.html` / `settings.js`)

Accessible via the gear icon (⚙) in the popup header.

| Section | Field | Required |
|---|---|---|
| Identity | Amazon Alias | Yes |
| Slack | Workflow Webhook URL | Yes |
| Dropdown Options | KTE Status Options (one per line) | No |
| Dropdown Options | Temp Trend Options (one per line) | No |
| Dropdown Options | Issue Found Options (one per line) | No |

- Required fields show inline red error messages if left blank on Save.
- All values stored in `chrome.storage.local`.

---

## Install

1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `extension_cards` folder

---

## Files

| File | Purpose |
|---|---|
| `manifest.json` | Extension config (Manifest V3), permissions, content script registration |
| `content.js` | Injected into Work Centers page — extracts chamber card data on message |
| `popup.html` | Main popup UI — alias display, chamber dropdown, audit form, action buttons |
| `popup.js` | Popup logic — loads alias/settings, fetches cards, populates form, validates, sends |
| `background.js` | Service worker — receives `logAudit` message, fetches webhook URL from storage, calls `sendChamberAudit()` |
| `slack.js` | `sendChamberAudit()` function — POSTs payload to Slack Workflow Webhook (imported by background.js) |
| `settings.html` | Settings page UI — alias, webhook URL, dropdown options |
| `settings.js` | Settings logic — load/save all settings to Chrome storage with validation |
