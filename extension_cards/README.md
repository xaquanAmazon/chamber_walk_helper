# Chamber Walk Helper - Cards Extension

## Purpose
Extracts chamber data from the MSE WORM Work Centers card view to assist with chamber walk audits.

## Target URL
`https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/work-centers?...&view=CARDS`

(Query params like `plantId` and `workCenterIds` may vary)

## Workflow

### 1. URL Check
- Extension activates only when the current tab URL starts with the Work Centers page.
- If not on the correct page, shows: "Not on WORM Work Centers page."

### 2. Extract Chamber Cards
- On popup open, content script is injected and scans all visible chamber cards inside expanded panels (`[class*="content-expanded"]`).
- Cards are identified by finding `button[aria-label^="Open kiosk view"]` elements and traversing up to the card container (`div[style*="border-color"]`).
- Both active and idle chambers are collected.

### 3. Populate Chamber Dropdown
- All chambers are listed in a dropdown as `CHAMBER_ID - WR_ID` or `CHAMBER_ID - IDLE`.
- If no cards found, shows: "No chamber cards found. Expand a chamber group first."

### 4. User Selects Chamber
- On selection, the form auto-fills with extracted data.
- Idle chambers show `N/A` / `IDLE` for WR-related fields.

### 5. Data Mapping

| Template Field | Source from Card |
|---|---|
| Time of Audit | Current timestamp (generated on selection) |
| Chamber | Chamber ID (e.g. `VIBE-Z-08`) |
| LRU Being Tested | Part Type (e.g. `Solar TCM`) — or `N/A` if idle |
| Chamber Status | Work Type (e.g. `MFG`, `DEV`) — or `IDLE` |
| WORM Status | Status Event (e.g. `IN_PROGRESS`, `SETUP`) — or `IDLE` |
| KTE Status | User input (text) |
| Temp Trend Matches Profile | User input (dropdown, required) |
| Estimated Completion Time | ETC chip text (e.g. `Mon 6/8, 1:45 am`) — or `N/A` |
| Issue Found | User input (dropdown, required) |
| Issue Details / SIM Link | User input (required if Issue Found = YES) |
| Other Comments | User input |

### 6. Copy to Clipboard
- "Copy to Clipboard" button is disabled until required fields are filled (Temp Trend, Issue Found, and Issue Details if YES).
- Copies formatted text and displays it in a preview area.

## DOM Extraction Strategy (content.js)

| Field | Extraction Method |
|---|---|
| Chamber ID | First `<h5>` whose parent contains a `<small>` sibling |
| Work Request ID | `<p>` text matching `WR-\d+` regex |
| Work Type | Card text matching `\[(\w+)\]\s*\[QTY` regex (e.g. `[MFG]`) |
| Part Type | Second `<h5>` in card that isn't the chamber heading and has no `<small>` sibling |
| Status Event | First `<span>` with `style*="text-overflow"` |
| ETC | `<span>` text starting with `ETC:` (prefix stripped) |
| Idle Detection | No WR ID found → card marked as idle |

## Settings Page
- Accessible via ⚙ link in the popup header.
- Configurable dropdown options (one per line):
  - **Temp Trend Matches Profile** — default: `Yes`, `No`, `NA`
  - **Issue Found** — default: `NO`, `YES`, `NA`
- Options stored in `chrome.storage.local`.

## Install
1. Go to `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked → select the `extension_cards` folder

## Files
| File | Purpose |
|---|---|
| `manifest.json` | Extension config (Manifest V3), permissions, content script registration |
| `content.js` | Injected into Work Centers page, extracts card data on message |
| `popup.html` | Main popup UI with chamber dropdown and audit form |
| `popup.js` | Popup logic: fetches cards, populates form, validates, copies output |
| `settings.html` | Settings page UI for configuring dropdown options |
| `settings.js` | Settings logic: load/save options to Chrome storage |
