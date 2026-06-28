# Chamber Walk Helper — Cards Extension

## Purpose
Chrome extension (Manifest V3) for Amazon Kuiper MSE WORM Work Centers.  
Scrapes chamber card data from the card view, auto-populates an audit form,
sends reports to a Slack channel via Workflow Webhook, and copies formatted
output to the clipboard.

## Target URL
```
https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/work-centers
```
Query params like `plantId`, `workCenterIds`, and `view=CARDS` may vary — match on URL prefix only.

---

## Install

1. Go to `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `extension_cards` folder

---

## File Structure

```
extension_cards/
├── manifest.json     Extension config (MV3), permissions, content script registration
├── content.js        Injected into Work Centers page — extracts chamber card data on message
├── popup.html        Main popup UI — alias, chamber dropdown, audit form, action buttons
├── popup.js          Popup logic — loads settings, fetches cards, populates form, validates, sends
├── background.js     Service worker — receives logAudit message, reads webhook URL, calls slack.js
├── slack.js          sendChamberAudit() — POSTs payload to Slack Workflow Webhook
├── settings.html     Settings page UI — alias, webhook URL, dropdown options
└── settings.js       Settings logic — load/save all settings to chrome.storage.local
```

---

## First-Time Setup

Open **Settings** (⚙ gear icon in the popup header):

| Field | Description |
|---|---|
| **Amazon Alias** | Your Amazon login alias (e.g. `xaquan`). Required. Sent as `alias@amazon.com`. |
| **Workflow Webhook URL** | Slack Workflow Webhook URL (`https://hooks.slack.com/triggers/...`). Required. |
| **KTE Status Options** | One option per line. Defaults: `Running, Passed, Failed, Terminated, NA, Completed with some failures` |
| **Temp Trend Options** | One option per line. Defaults: `Yes, No, NA` |
| **Issue Found Options** | One option per line. Defaults: `NO, YES, NA` |

All values stored in `chrome.storage.local` and persist across sessions.  
Required fields show inline red error messages if blank on Save.

---

## Popup UI Workflow

### 1. URL Check
- Extension activates only when the current tab URL starts with the Work Centers target URL.
- If not on the correct page → shows: `"Not on WORM Work Centers page."`

### 2. Alias Display
- Alias loaded from `chrome.storage.local` on popup open, shown as a **disabled (read-only)** input.
- **Edit** button opens Settings to change it.
- If no alias is set yet → **Set** button opens Settings.
- Alias is required — Send to Slack is blocked if empty.

### 3. Extract Chamber Cards
- Content script injected via `chrome.scripting.executeScript`.
- Sends `{ action: 'getCards' }` message to content script.
- If no cards found → `"No chamber cards found. Expand a chamber group first."`

### 4. Populate Chamber Dropdown
- Each card shown as `CHAMBER_ID - WR_ID` or `CHAMBER_ID - IDLE`.

### 5. User Selects Chamber → Form Auto-Fills
- Time of Audit stamped at selection moment.
- Idle chambers show `N/A` / `IDLE` for WR-related fields.

### 6. User Fills Inputs
- **KTE Status** (dropdown, required)
- **Temp Trend Matches Profile** (dropdown, required)
- **Issue Found** (dropdown, required)
- **Issue Details / SIM Link** (textarea, required only when Issue Found = `YES`)
- **Other Comments** (textarea, optional)

### 7. Validation
Copy and Slack buttons are disabled until all required fields are filled.  
`Issue Details` required indicator (`*`) shows/hides dynamically.

### 8. Copy to Clipboard
- Copies both `text/plain` and `text/html` (bold labels).
- Preview displayed in the output area.
- Fields included in copy output (in order):

| # | Label | Source |
|---|---|---|
| 1 | Alias | `@alias` from alias input |
| 2 | Time of Audit | `f-time` (hidden in UI) |
| 3 | Chamber Group | `f-chamberGroup` (hidden in UI) |
| 4 | Chamber | `f-chamber` |
| 5 | Work Request ID | `f-wrId` |
| 6 | LRU Being Tested | `f-lru` |
| 7 | Chamber Status | `f-chamberStatus` |
| 8 | WORM Status | `f-wormStatus` |
| 9 | KTE Status | `f-kte` dropdown value |
| 10 | Temp Trend Matches Profile | `f-temp` dropdown value |
| 11 | Estimated Completion Time | `f-completion` |
| 12 | Issue Found | `f-issue` dropdown value |
| 13 | If YES, List Issue Details and SIM Ticket Link | `f-issueDetail` textarea |
| 14 | Other Comments | `f-comments` textarea |

### 9. Send to Slack
- Sends full audit payload to configured Slack Workflow Webhook.
- Routed through `background.js` (service worker) to avoid CORS restrictions.
- Result: `Sent to Slack!` (green) or `❌ Error: ...` (red).

---

## Popup Form Fields

### Visible (shown in UI)
| Element ID | Label | Type | Value Source |
|---|---|---|---|
| `f-chamber` | Chamber | read-only span | `card.chamberId` |
| `f-wrId` | Work Request ID | read-only span | `card.wrId` or `N/A` |
| `f-lru` | LRU Being Tested | read-only span | `card.partType` or `N/A` |
| `f-chamberStatus` | Chamber Status | read-only span | `card.workType` or `IDLE` |
| `f-wormStatus` | WORM Status | read-only span | `card.statusEvent` or `IDLE` |
| `f-kte` | KTE Status | dropdown | user input |
| `f-temp` | Temp Trend Matches Profile | dropdown | user input |
| `f-completion` | Estimated Completion Time | read-only span | `card.etc` or `N/A` |
| `f-issue` | Issue Found | dropdown | user input |
| `f-issueDetail` | Issue Details / SIM Link | textarea | user input |
| `f-comments` | Other Comments | textarea | user input |

### Hidden (in DOM, not visible — used by payload and copy review only)
| Element ID | Label | Value Source |
|---|---|---|
| `f-time` | Time of Audit | Current timestamp at card selection |
| `f-chamberGroup` | Chamber Group | `card.cardGroup` (e.g. `MDTV`, `LGTV`, `HASS`) |

---

## Slack Payload

```json
{
  "time_of_audit":        "Jun 14, 2026, 9:03:00 AM",
  "chamber":              "MDTV-02",
  "chamber_group":        "MDTV",
  "lru_being_tested":     "SGT",
  "chamber_status":       "MFG",
  "worm_status":          "IN_PROGRESS",
  "kte_status":           "Running",
  "temp_trend":           "Yes",
  "estimated_completion": "Mon 6/8, 1:45 am",
  "issue_found":          "NO",
  "issue_details":        "N/A",
  "other_comments":       "N/A",
  "amz_alias":            "xaquan@amazon.com",
  "wr_id":                "WR-00121138"
}
```

> **Note:** No `Content-Type` header is sent in `slack.js`.  
> Slack Workflow Webhooks reject it in CORS preflight. Omitting it triggers a
> simple request (no preflight) which Slack accepts. Requests are routed through
> `background.js` (service worker) which has no CORS restrictions.

---

## DOM Extraction Strategy (`content.js`)

### Panel Scope
Only cards inside **expanded panels** are scanned:
```js
document.querySelectorAll('[class*="content-expanded"]')
```

### Card Group Name (e.g. MDTV, LGTV, VIBE-Z)
Derived directly from `chamberId` by stripping the trailing `-NNN` number suffix.  
The `[data-testid="work-center-card"]` panel (which contains the `<h4>`) is a **sibling**
panel to the cards panel — not an ancestor — so DOM traversal does not work.
```js
const cardGroup = chamberId.replace(/-\d+$/, '');
// "MDTV-02"   → "MDTV"
// "LGTV-05"   → "LGTV"
// "VIBE-Z-08" → "VIBE-Z"
```

### Card Identification
Cards are found by locating kiosk buttons, then walking up to the card container:
```js
panel.querySelectorAll('button[aria-label^="Open kiosk view"]')
btn.closest('div[style*="border-color"]')
```

### Per-Card Field Extraction

| Field | Extraction Method |
|---|---|
| `chamberId` | First `<h5>` whose parent contains a `<small>` sibling |
| `cardGroup` | `<h4>` inside `[data-testid="work-center-card"]` ancestor of the panel |
| `wrId` | `<p>` text matching `/WR-\d+/` regex |
| `workType` | Card text matching `/\[(\w+)\]\s*\[QTY/` regex (e.g. `MFG`, `DEV`) |
| `partType` | Second `<h5>` that is NOT the chamber ID and has no `<small>` sibling in its parent |
| `statusEvent` | First `<span style*="text-overflow">` with non-empty text |
| `etc` | `<span>` text starting with `ETC:` — prefix stripped |
| `idle` | `true` if no `wrId` found |
| `idleTime` | `<span>` matching `/^\d+h\s+\d+m/` — only when idle |

### Card Object Shape
```js
{
  chamberId:   "MDTV-02",
  cardGroup:   "MDTV",
  wrId:        "WR-00121138",
  workType:    "MFG",
  partType:    "SGT",
  statusEvent: "IN_PROGRESS",
  etc:         "Mon 6/8, 1:45 am",
  idle:        false,
  idleTime:    ""
}
```

---

## Settings (`settings.html` / `settings.js`)

| Section | Field | `chrome.storage.local` Key | Required |
|---|---|---|---|
| Identity | Amazon Alias | `amzAlias` | Yes |
| Slack | Workflow Webhook URL | `webhookUrl` | Yes |
| Dropdowns | KTE Status Options (one per line) | `kteOptions` | No |
| Dropdowns | Temp Trend Options (one per line) | `tempOptions` | No |
| Dropdowns | Issue Found Options (one per line) | `issueOptions` | No |

---

## `manifest.json` Requirements

```json
{
  "manifest_version": 3,
  "permissions": ["activeTab", "scripting", "storage", "tabs"],
  "host_permissions": [
    "https://ui.prod.console.mse.kuiper.amazon.dev/*",
    "https://hooks.slack.com/*"
  ],
  "background": { "service_worker": "background.js" },
  "content_scripts": [{
    "matches": ["https://ui.prod.console.mse.kuiper.amazon.dev/*"],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": { "default_popup": "popup.html" }
}
```
