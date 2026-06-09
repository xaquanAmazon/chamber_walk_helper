# Chamber Walk Helper - Chrome Extension

## Purpose
Extracts data from the MSE WORM Planning page to assist with chamber walk audits.

## Target URL
`https://ui.prod.console.mse.kuiper.amazon.dev/tools/worm/planning`

## Workflow

### 1. URL Check
- Extension activates only when the current tab URL matches the target planning page.

### 2. Detect Ticket Popup
- Look for the tooltip/popup div (class: `recharts-tooltip-wrapper`) that appears when hovering/clicking on a planning ticket bar.
- If popup does **not** exist → prompt user to click on a planning ticket on the timeline.

### 3. Extract Data from Popup
From the popup, extract:
- **Resource Id** — e.g. `MDTV-04` (from "Resource: MDTV-04 | Work Center: ST-00067")
- **Expected Completion** — save to Chrome storage for later use.

### 4. Click WR Link to Open Detail Window
- Inside the popup, find the WR link element (pattern: `STATUS | WR-XXXXXXXX - NAME`).
- The link is a clickable `<div>` with class `_xrc32VPUErnC9_5vmbQ` and `cursor: pointer` style.
- Auto-click this element to open the Work Request Detail side panel.

### 5. Extract Data from Work Request Detail Window
Once the detail panel is open, extract fields to populate the template:

| Template Field | Source |
|---|---|
| Time of Audit | Current timestamp |
| Chamber | Resource Id from popup (e.g. `SMTC-04`) |
| LRU Being Tested | Part Type from detail window |
| Chamber Status | Work Type from detail window |
| WORM Status | Status Event from detail window (e.g. `COMPLETED`, `IN_PROGRESS`, `SETUP`) |
| KTE Status | User input |
| Temp Trend Matches Profile | User input (Yes/No/NA) |
| Estimated Completion Time | Expected Completion from popup (saved in storage) |
| Issue Found | User input (YES/NO/NA) |
| Issue Details / SIM Link | User input |
| Other Comments | User input |

## Work Center Chamber Cards (DOM Structure)

The planning page displays chamber cards in a list. Each card is a `div.JmpGWV7ZnnN6Gm5aboHh` with a colored `border-color`.

### Card Elements
| Data | Selector / Location |
|---|---|
| Chamber Name | `h5` inside `.awsui_text-content_6absk_mpfxe_146` (e.g. `VIBE-Z-08`) |
| Work Center ID | `<small>` sibling below the chamber `<h5>` (e.g. `ST-00459-03`) |
| Work Request ID | `<a>` link containing `WR-XXXXXXXX` inside `.BIhrmuCpLFNJS4B76B2l` |
| Work Type | `<h5>` inside `span.Gq2ZNf_pL_DiCNTzAyPZ` (e.g. `Solar TCM`, `MAINTENANCE_UNPLANNED`) |
| WORM Status | `<span>` text inside `div.vrtyYJJJz67rwamCvqUm button` (e.g. `IN_PROGRESS`, `SETUP`) |
| ETC | `<span>` inside `.MuiChip-label` with text starting with `ETC:` (e.g. `ETC: Sun 6/7, 12:59 pm`) |
| Active Time | `<span>` inside `.MuiChip-label` with time format (e.g. `01h 02m 26s`) |
| Quantity | `<span>` with `[QTY: X]` inside `.llQMLyBT60ONWDHqmPlg` |

### Idle Chambers
- Contain `div.Wqz79SKddNGhqLQ6Nfso` with text "Idle Time:"
- No WR link or status button
- Show idle duration in a MuiChip (e.g. "Over two weeks")

## Notes
- `workRequestDetail.md` needs to be populated with an example of the detail window HTML so we know exactly which DOM elements to target for Part Type, Work Type, and Status Event.
- WR link pattern identified: text contains `STATUS | WR-XXXXXXXX - NAME` inside a `<span>` element within the clickable div.
