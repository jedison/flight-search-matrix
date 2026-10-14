# Flight Search Matrix - Backlog

## Completed through 0.6.0

- Durable MV3 run recovery.
- Provider-neutral search/query schema and normalized flight segments.
- One-way, round-trip and open-jaw matrices.
- Built-in and custom airport groups.
- Search matrix size and maximum-attempt estimates.
- Saved profiles, profile import/export and last-run cloning.
- Connection, carrier and mixed-cabin constraints.
- Confidence and parser-version provenance.
- Historical observations, query summaries and best-known results.
- Current Best filtering and per-query history view.
- Smart search ordering and provider throttling/backoff.
- Google Sheets Runs, Queries, Observations and Current Best model.
- Generic manual capture and downloadable provider diagnostics.
- Experimental Miles & More award adapter.
- Experimental Lufthansa and Brussels Airlines cash adapters.
- Cash normalization to per-person total including fees.
- Teaser/from fares excluded from best-price ranking unless a comparable total can be established.
- Optional Chrome notifications, disabled by default.

## Next provider-calibration work

1. Calibrate Miles & More selectors against a logged-in award-search page.
2. Calibrate Lufthansa and Brussels Airlines form/date selectors against live booking pages.
3. Parse outbound and return segments separately from live result cards.
4. Confirm total-price labels and fare-breakdown semantics on live Lufthansa Group results.
5. Calibrate Lufthansa Group open-jaw controls.
6. Add sanitized live HTML/text fixtures for regression tests.

## Can continue without provider calibration

1. Import/export all local search history, not just profiles.
2. Add richer comparison scoring across cash, miles, stops, duration and cabin quality.
3. Add optional FX normalization using a user-selected reference currency.
4. Add a watch-mode scheduler that only runs while Chrome is active and the user has opted in.
5. Add adapter health dashboard based on last diagnostic/result state.
6. Add retention/archive controls for very large observation histories.

## Non-goals

- No automated booking or ticket purchase.
- No CAPTCHA, MFA, Cloudflare or human-verification bypass.
- No storage of airline passwords or Google account credentials.
- No destructive overwrite of historical observations.

## Completed in 0.6.1

- Fix saved-profile loading.
- Fix newline-separated multi-airport input and add query preview.
- Calibrate the M&M adapter to the observed Award Flight form semantics and reward results SPA.
- Prevent M&M account mileage balances from being treated as availability.
- Add richer M&M control diagnostics.

