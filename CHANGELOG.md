# Changelog

## 0.8.0 - 2026-09-09

- Rank tied Miles & More cabin awards by their lower per-passenger surcharge, retaining that fee with the selected result instead of keeping the first same-mileage fare encountered.

## 0.7.13 - 2026-09-09

- Keep committed M&M form dates as the required pre-click gate, while treating the optional `data-post` snapshot as diagnostic evidence rather than blocking a native Search flights click when it is temporarily unavailable.

## 0.7.12 - 2026-09-09

- Retry and, when needed, inject the Miles & More adapter after navigation to the availability page before requesting result parsing, removing the result-page content-script connection race.

## 0.7.11 - 2026-09-09

- Capture the dates-only M&M submission payload before native Search flights activation, validate it before the click and carry it through result navigation instead of waiting for booking-page state that disappears on the availability page.

## 0.7.10 - 2026-09-09

- Re-find and verify the Search flights control after Miles & More rerenders it on native hover, then send the native press/release to the refreshed coordinates.

## 0.7.9 - 2026-09-09

- Let Miles & More settle its hover state after the native pointer move, then dispatch an immediate press/release without the former mouse-down hold.

## 0.7.8 - 2026-09-09

- Dispatch native Search flights press and release without the previous 80 ms hold, preventing Miles & More from replacing the reactive button between pointer-down and pointer-up.

## 0.7.7 - 2026-09-09

- Recognize a parsed Miles & More result surface even when its single-page application URL does not change, while retaining the submitted-date verification before recording a result.

## 0.7.6 - 2026-09-09

- Include worker activity and run state in diagnostics, including native-debugger attachment and native press/release dispatch, so missed-click investigations retain both page and worker evidence.

## 0.7.5 - 2026-09-09

- Recheck Search flights after scrolling and immediately before the native debugger click; verify the exact center point is still on the control and report a concrete covered/moved target failure instead of an unexplained missed click.

## 0.7.4 - 2026-09-09

- Calibrate Miles & More result parsing against the confirmed availability page: detect the result list, scope awards to its fare cards and record the lowest visible fare for the requested cabin rather than timing out as inconclusive.
- Preserve the result card's mileage and separately record its per-passenger surcharge; do not mistake the signed-in account balance for an award price.

## 0.7.3 - 2026-09-09

- Replace the unbounded plain-text History log with the three most recent attempts, their actual recorded reasons and a concise status count; older attempts remain available in the diagnostic export.

## 0.7.2 - 2026-09-09

- Tighten the transparent icon canvas so the airplane-and-matrix mark is larger and clearer in Chrome's extension toolbar.

## 0.7.1 - 2026-09-09

- Make multi-airport entry rules visible in the Plan: newlines, commas and semicolons are all supported.
- Add end-to-end matrix tests for two distinct origins and two distinct destinations entered through newline, comma and semicolon delimiters.

## 0.7.0 - 2026-09-09

- Restore the 420 px FSM content width and explicitly constrain the popup HTML canvas, body and main column to that same width, eliminating the empty background to the right of the popup controls.

## 0.6.29 - 2026-09-09

- Reduce the floating FSM popup from 420 px to a 330 px preferred width, matching the compact Notre-Dame popup footprint.

## 0.6.28 - 2026-09-09

- Add a transparent airplane-and-matrix icon in 16, 32, 48 and 128 px PNG sizes for the FSM toolbar, extension manager and install surfaces.

## 0.6.27 - 2026-09-09

- Open FSM as a floating toolbar popup instead of a persistent side panel; remove side-panel registration and permission.
- Retain the compact 420 px layout with scrollable popup height.
- Save the unfinished Plan locally and restore it on reopening; existing background-run state restoration remains intact.

## 0.6.26 - 2026-09-09

- Redesign the side panel around compact Run controls, an always-editable Plan, collapsed monitoring options, results/history and Support/diagnostics.
- Use a 420 px preferred width that shrinks in narrow side panels, modest action buttons, visible keyboard focus and reduced-motion support.
- Preserve all existing control IDs, handlers, profiles, matrix generation, exports, history, sync and M&M restrictions. No changes to Notre-Dame.

## 0.6.25 - 2026-09-08

- Refresh the live tab URL on every attempt so retries return from results to the booking form.
- Recheck Stop/Pause before native mouse-down and release outside the button if interrupted during the press.
- Set cabin after airport selection, compare exact native cabin values, and recheck before submission.
- Disable unverified positive result inference from page-wide text; account balances and recent searches must never become award fares. Positive parsing awaits live result-card calibration.
- Finish unresolved runs as INCONCLUSIVE, with an explicit explanation, instead of Run complete.

## 0.6.24 - 2026-09-07

- Keep digit-by-digit entry and wait for M&M's delayed split/validation of the separate model-bound dates before submitting.
- Require matching displayed field values, validated ISO date attributes and validity, with a bounded, cancellable wait and explicit activity messages.
- Apply the commit gate to calendar fallback too, including accepting a one-way calendar selection.
- Retain default one passenger, disabled M&M matrix runs, native click and submitted-payload checks.

## 0.6.23 - 2026-09-07

- Restore the 0.6.20 date-entry flow for the requested comparison test, including digit-by-digit entry, timing, field verification and calendar fallback.
- Retain native Search flights activation, the panel messaging fix and verification of dates received by the availability page.

## 0.6.22 - 2026-09-07

- Make the side panel observe runtime messages without returning a competing empty response to native date-entry requests.
- Test that the background worker's delayed acknowledgement survives with the panel open and that panel status updates still work.

## 0.6.21 - 2026-09-07

- Replace synthetic guided date entry with Chrome keyboard input of compact date digits, followed by Tab to commit.
- Validate dates received in the availability page's embedded search payload; blank or mismatched dates stop with an explicit diagnostic.
- Add behavioral tests for native date entry, cleanup, cancellation and submitted-date validation.

## 0.6.20 - 2026-09-07

- Send the required pressed-button state with Chrome's native M&M mouse input.
- Trace native pointer and click events at document level, including their live target.

## 0.6.19 - 2026-09-07

- Record trusted pointer, click, and form-submit events for the guided native M&M search activation.
- Include the native-click trace in the activity timeline and any unacknowledged activation result.

## 0.6.18 - 2026-09-07

- Add Chrome debugger-backed native mouse input for the single guided Miles & More Search flights activation.
- Detach from the M&M tab immediately after sending the one native click.
- Keep the guided test blocked unless M&M acknowledges submission or loading before result navigation.

## 0.6.17 - 2026-09-07

- Use a complete pointer-and-click sequence on the exact Miles & More Search flights control.
- Require a visible M&M submission or loading acknowledgement before waiting for result navigation.
- Report an unacknowledged activation as Needs User instead of completing the guided test as though a search occurred.

## 0.6.16 - 2026-09-07

- Make Miles & More guided calibration always use the site's default of one passenger.
- Remove passenger-picker interaction and passenger-count verification from the guided adapter.
- Keep Miles & More matrix runs disabled pending live calibration.

## 0.6.14 - 2026-09-05

- Keep diagnostics, release-test proof, clone-last-run and manual page capture together with the main run controls.

## 0.6.13 - 2026-09-05

- Move the persistent run state beside the Test, Start, Pause, Resume and Stop controls; keep diagnostics and release proof actions separate below it.

## 0.6.12 - 2026-09-04

- After verified M&M form entry, activate Search flights exactly once and watch for result navigation.
- Remove manual-search waiting and all fallback submission paths; an absent navigation is now reported as a single, explicit inconclusive outcome.
- Update the live-browser release proof to record a single extension-submitted search rather than a manual click.

## 0.6.11 - 2026-09-04

- Treat one passenger as the existing Miles & More default and do not open or verify the passenger picker for that case.

## 0.6.10 - 2026-09-04

- Preserve the specific M&M form verification failure in the activity timeline and final run state instead of replacing it with a generic non-submission message.

## 0.6.9 - 2026-09-04

- Repair the guided Miles & More tab startup: wait for the page adapter and booking controls, retry during page hydration, and refresh the adapter once when needed.
- Replace the silent new-tab failure with a precise Needs User status listing the missing controls or page-connection detail.

## 0.6.8 - 2026-09-04

- Gate release checking and packaging on a fresh, version-matched Miles & More guided-browser proof.
- Record the proof only after verified form actions, the user's Search flights click and observed result navigation; the Run controls can download it for the release gate.
- Preserve guided-test mode when resuming an interrupted run, so it cannot become a prohibited M&M matrix run.

## 0.6.7 - 2026-09-04

- Replaced unproven automatic Miles & More submission with a guided, one-query form test. The extension now waits for the user to click Search flights and reports result navigation only when it actually occurs.
- Disabled Miles & More matrix runs until that single-query workflow has a successful live calibration.
- Added acknowledged run states, a persistent chronological activity timeline, and clear starting, active, waiting-for-you, pausing, paused, stopping, stopped, completed, needs-user and error states.
- Stop now remains stopping until the M&M page acknowledges cancellation, and Download diagnostic remains beside the run controls.
- Use a dedicated M&M automation tab instead of redirecting an existing user tab.

## 0.6.6 - 2026-09-04

- Strengthened Search flights targeting and activation with pointer events, native button click, and form submission fallback.
- Moved Download diagnostic into Run controls for easier failure investigation.

## 0.6.5 - 2026-09-04

- Corrected the release version displayed by the extension and package artifacts.

## 0.6.4 - 2026-09-04

- Show the extension version in the side-panel header.
- Add a persistent, color-coded run state with clear idle, running, paused, completed and error states.
- Actively switch Miles & More Travel type to One way and verify the selected state before entering a single date.
- Require Search flights to produce a submitted or loading signal before the adapter reports success.
- Prefer the exact Search flights control and use native form submission when available, avoiding false failures before navigation begins.
- Preserve saved-profile compatibility and diagnostic snapshots.

## 0.6.3 - 2026-09-03

- Fixed Miles & More direct date entry to send true digit-by-digit editing input instead of repeatedly replacing the whole masked field value.
- Keeps the compact date sequence such as `1705202727052027`; Miles & More remains responsible for inserting date separators.

## 0.6.2 - 2026-09-03

- Miles & More now enters the compact outbound and return date digits directly into the Travel dates field.
- The adapter verifies that Miles & More reformats the value to the expected day/month/year dates before searching.
- Calendar navigation remains as a fallback if direct date entry is not accepted.
- Calendar fallback now clicks Select after choosing both dates when that control is present.

## 0.6.1 - 2026-09-03

- Fix saved-profile selection so selecting a profile repopulates the Search Matrix instead of resetting the selection.
- Treat both real newlines and literal `\n` separators as multiple airport inputs.
- Add a visible generated-query preview before a run starts.
- Rework Miles & More automation around the observed Award Flight booking form.
- Handle travel type, cabin, airport autocomplete, the combined Travel dates calendar, passenger count and Search flights.
- Start every M&M attempt from the Award Flight booking form and wait for navigation to the shop.miles-and-more.com results application.
- Parse explicit M&M negative states such as No flights found, no offer and Sorry, no result on this date without mistaking the account mileage balance for award availability.
- Upgrade M&M diagnostics to capture visible interactive-control metadata, including open shadow-root controls.

## 0.6.0 - 2026-08-29

- Added experimental Lufthansa cash and Brussels Airlines cash adapters using shared Lufthansa Group form/result logic.
- Added per-person total-including-fees cash normalization.
- Added price kind, comparability and fee-inclusion fields so teaser/from fares remain visible but are not ranked as best fares.
- Added optional Chrome notifications, disabled by default and requested only when enabled.
- Added profile JSON export/import and clone-last-run.
- Added editable custom airport groups in the side panel.
- Added Current Best provider/status filters and per-query observation history.
- Added downloadable adapter diagnostic snapshots for future live calibration.
- Bumped observation schema to version 4 and IndexedDB database version to 4.
- Fixed empty-price ranking edge cases so blank values cannot behave like zero.
- Increased automated tests to 30.

## 0.5.0 - 2026-08-29

- Added provider-neutral schema version 3 for search legs, itineraries and flight segments.
- Added true one-way, round-trip and open-jaw matrix generation.
- Added built-in airport groups including NYC, WAS, LON, PAR, TYO, CHI and Yellowstone gateway groups.
- Added connection, carrier and mixed-cabin constraints.
- Added query keys based on full itinerary legs to prevent open-jaw collisions.
- Added parser provenance, confidence, price-scope fields and richer normalized observations.
- Added IndexedDB schema migration support and a persistent best-known result store.
- Added historical availability helpers, including reappearance detection and minimum-ever pricing.
- Added smart matrix ordering and adjacent-date reprioritization after availability is found.
- Added per-provider delay policy, jitter, exponential backoff and configurable backoff cap.
- Added maximum-attempt estimates before a run starts.
- Expanded Google Sheets synchronization to Runs, Queries, Observations and Current Best.
- Added UI controls for open jaw, connection/carrier constraints, smart ordering, backoff and stop-on-first-availability.
- Increased automated tests from 12 to 25 before final release verification.
- Kept Miles & More open-jaw automation paused pending live calibration rather than generating misleading results.

## 0.2.0 - 2026-08-29

- Persist active-run state and allow recovery after service-worker interruption.
- Add query summaries over repeated observations.
- Add saved search profiles.
- Add result-state polling with configurable wait duration.
- Correct positive-result versus no-result parser precedence.
- Add candidate fee/connection/seat/carrier extraction.
- Add Summaries worksheet synchronization.

## 0.1.0 - 2026-08-23

- Initial Manifest V3 extension scaffold.
- Matrix generation for origins, destinations, dates and cabins.
- Experimental Miles & More adapter.
- Durable local IndexedDB observations.
- CSV export and Google Sheets Apps Script endpoint.
## 0.8.1 - 2026-09-09

- Save every visible Miles & More itinerary-and-cabin offer, including its mileage and surcharge.
- Retain departure, arrival, stops, duration, carrier, cabin, and a stable itinerary identity for comparison over time.
- Derive the compact best price from one actual offer, breaking mileage ties by surcharge.
## 0.8.2 - 2026-09-10

- Enlarged the toolbar airplane icon by removing excess transparent padding while preserving its existing artwork.
## 0.8.3 - 2026-09-10

- Enabled Miles & More matrix runs using the live-proven native-click and one-passenger calibration flow.
## 0.8.4 - 2026-09-10

- Kept Miles & More batch execution behind the one-query test while round-trip fare-combination calibration begins.
## 0.8.5 - 2026-09-10

- Locked the current Miles & More cart-path calibration to round trips, preventing one-way date entry from being used by mistake.
## 0.8.6 - 2026-09-10

- Added an opt-in pinned status card that follows an active Miles & More test across its page transitions.
## 0.8.12 - 2026-09-10

- Select the opened outbound fare with a native-coordinate click and wait for the return-selection page.

## 0.8.11 - 2026-09-10

- After saving the outbound result list, open the first visible fare family for the requested cabin using the M&M-safe native-coordinate click.
- Stop before selecting a fare family; return-leg and cart selection remain the next calibration step.

## 0.8.10 - 2026-09-10

- Exclude downloaded diagnostics from source-style verification; captured evidence must not block a test build.

## 0.8.9 - 2026-09-10

- Start the in-page Miles & More monitor automatically for every Test M&M form run, so closing Chrome's toolbar popup does not hide progress.

## 0.8.8 - 2026-09-10

- Restore Chrome-native keyboard entry for the focused Miles & More date field so its booking model receives the actual date keystrokes.
- Refuse to click Search flights when Miles & More has prepared a submission with blank or mismatched dates.

## 0.8.7 - 2026-09-10

- Keep a pinned Miles & More status card visible through the manual fare-to-cart steps until it is explicitly unpinned.
