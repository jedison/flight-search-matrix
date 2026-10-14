# Testing

## Automated tests

Requirements: Node.js 20 or later is recommended.

Run:

```bash
npm test
npm run check
npm run verify
```

- `npm test` runs Node unit tests for matrix generation, open jaw, airport groups, constraints, schema normalization, history, provider policy, result normalization, Sheets serialization and versioning.
- `npm run check` syntax-checks extension JavaScript.
- `npm run verify` runs tests, syntax checks, version consistency and the no-em-dash repository rule.

The 0.5.0 release candidate passes 27 unit tests.

## Manual Chrome smoke test

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Load the project folder unpacked.
4. Open the extension side panel.
5. Build a one-query matrix first.
6. Verify round-trip, one-way and open-jaw matrix previews produce the intended legs.
7. Test an airport group such as `YELLOWSTONE_SOUTH` and confirm it expands to JAC, IDA and SLC.
8. Log into the airline site yourself.
9. Run or manually capture one query and compare the stored observation with the visible result.
10. Test pause, resume and stop.
11. Confirm Current Best retains positive availability even if a later attempt is negative.
12. Export CSV and confirm the observation is present.
13. After Sheets setup, sync and confirm Runs, Queries, Observations and Current Best populate.

## M&M-specific acceptance test

Use one known route/date combination and run it three times. If M&M intermittently says unavailable and later returns seats, the history must preserve all attempts and must not convert the earlier technical/negative result into a false final conclusion.

Open-jaw M&M automation is not an acceptance target until the live adapter calibration pass is performed.
