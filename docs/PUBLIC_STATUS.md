# Public project status

Flight Search Matrix is a local Chrome extension for structured flight research.
Its reusable planning, persistence, evidence, export, and provider-policy
layers are implemented and covered by offline tests.

Provider adapters are intentionally conservative and remain experimental. The
Miles & More adapter is a guided, calibration-oriented flow; Lufthansa Group
cash adapters use guarded heuristics and report uncertainty instead of making
up a price or availability result. A provider response labelled inconclusive,
needs-user, or unavailable should not be treated as a booking outcome.

The project does not complete purchases, bypass login or human verification,
or circumvent provider protections. It is best used as a research and
development tool by someone prepared to verify results on the provider site.
