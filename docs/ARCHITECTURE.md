# Architecture

## Core principle

Flight Search Matrix is provider-neutral. Airline and loyalty websites are adapters around a common search and observation model.

## Main objects

- Search definition: user intent, airport sets/groups, date ranges, cabins, constraints and ordering policy.
- Query: one concrete search generated from a search definition.
- Leg: origin, destination, date and direction.
- Observation: one provider attempt at one query.
- Itinerary: normalized result-level structure.
- Segment: one flight within an itinerary.
- Query summary: consolidated evidence across retries for one query.
- Current Best: best retained summary for a normalized query key.
- Run: immutable snapshot of search definition and runtime settings.

## Layers

1. `matrix.js` expands user intent into concrete provider-neutral queries.
2. Provider adapters translate a query into site-specific interaction and parse output.
3. `result.js` converts parser output into schema-versioned observations.
4. IndexedDB preserves runs, observations, summaries and best-known results locally first.
5. `query-summary.js` combines flaky attempts without allowing one negative result to erase a positive result.
6. `provider-policy.js` controls throttling, jitter and backoff independently by adapter.
7. Google Sheets sync mirrors normalized data into Runs, Queries, Observations and Current Best.

## Provider boundary

Provider-specific selectors must stay under `src/content` or future `src/adapters`. Core matrix, storage, history and comparison logic must not depend on Miles & More markup.

## Safety boundary

Authentication, MFA, CAPTCHA and human verification remain user-controlled. The runner pauses or records NEEDS_USER when intervention is required.
