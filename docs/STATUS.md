# Flight Search Matrix - Status

Current release candidate: 0.8.12

UI redesign verified with automated tests and a local HTML/CSS browser preview. The floating popup's HTML canvas, body and content are all fixed to 420 px; run buttons are 30 px tall. Monitoring and Support disclosures were opened in the browser. This is layout verification, not a live authenticated extension search test. Notre-Dame was inspected read-only.

Retry navigation, native-click cancellation and exact cabin validation have regression coverage. Positive M&M availability parsing is intentionally conservative until live result cards are calibrated; unresolved runs finish INCONCLUSIVE. These changes are not yet live-verified in authenticated Chrome.

M&M date entry now waits for validated model-bound date fields before native submission. Automated regression verification is required; live authenticated search still needs confirmation.

For the requested comparison test, guided M&M date entry uses the restored 0.6.20 flow. The destination page's embedded search dates must match the requested dates before parsing results. This change still requires live M&M verification.

## Implemented

- Provider-neutral search and itinerary schema.
- One-way, round-trip and open-jaw matrix generation.
- Miles & More experimental award adapter.
- Lufthansa cash and Brussels Airlines cash experimental adapters sharing Lufthansa Group logic.
- Cash ranking normalized to per-person total including fees.
- Non-comparable teaser/from fares are retained as observations but excluded from best-price ranking.
- Provider throttling, jitter, backoff and resumable runs.
- Saved profiles plus profile JSON import/export.
- Clone-last-run workflow.
- Built-in airport groups plus custom airport-group JSON in the UI.
- Current Best provider/status filters and per-query observation history.
- Downloadable adapter diagnostic snapshots.
- Optional Chrome notifications, disabled by default and requested only when explicitly enabled.
- Google Sheets Runs, Queries, Observations and Current Best sync model.

## 0.6.12 guided M&M handoff

The side panel identifies the running version, gives an acknowledged state for every control action, and retains a timestamped activity timeline. Download diagnostic remains with Run controls.

Miles & More has a live-proven form and native-click flow. It verifies M&M readiness and form actions, activates Search flights once, then observes result navigation. The current fare-combination calibration is round-trip only and requires both dates. Matrix execution remains disabled while that path is calibrated.

Every new release is blocked until a fresh guided test records form completion, one native Search flights click and result navigation. The proof is version-bound and expires after 72 hours.

The guided test now explicitly waits for the M&M content adapter and form controls after opening its dedicated tab. It retries while the site is loading and reports the exact missing form controls or connection failure after 20 seconds.

When M&M fails to verify a form action, the final state retains the failing field names. When M&M form verification succeeds, Search flights is activated once; an absent result navigation is reported as inconclusive.

For the current calibration, every guided test leaves the M&M passenger picker untouched and records that it is using the site's default of one passenger, regardless of the saved matrix adults value.

## Live calibration still required

1. Miles & More controls/result markup.
2. Lufthansa and Brussels Airlines booking-result markup for exact segment parsing and reliable form selectors.
3. Open-jaw booking controls on Lufthansa Group sites.

Until calibrated, adapters return NEEDS_USER or INCONCLUSIVE instead of inventing results when controls cannot be identified.

## 0.6.1 live M&M calibration

- Based on the 2026-09-03 Award Flight form and results diagnostics.
- Saved-profile selection and multi-airport expansion bugs fixed.
- M&M opens a dedicated test tab and never repurposes an existing user tab.
- Remaining calibration risk is exact live DOM behavior of airport autocomplete, calendar month navigation and passenger controls.

## 0.6.3 M&M direct-date patch

M&M direct date entry now targets the real Travel dates input and types the compact DDMMYYYYDDMMYYYY value, relying on the site mask to format it. Calendar handling remains fallback-only.
