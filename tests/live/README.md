# Live browser release proof

Do not add a fabricated placeholder to this directory.

Before a release, use the installed extension to complete **Test one M&M form** through result navigation. The extension activates **Search flights** once after it verifies the form. Download **release-test proof** from Run controls and save it here as `miles-and-more-browser-gate.json`.

`npm run release:check` requires that proof to match the package version and be no more than 72 hours old. The proof deliberately contains only test metadata and result status, not the search route, dates or passenger count.
