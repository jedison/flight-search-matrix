# Contributing

Contributions should preserve the project’s local-first evidence model and its
provider safety boundaries. Do not add bypasses for login, MFA, CAPTCHA,
Cloudflare, rate limits, or provider controls.

Before a pull request, run:

```sh
npm test
npm run check
npm run verify
```

Use only synthetic or fully redacted fixtures. Do not commit account details,
search history, cookies, diagnostics, booking data, or live-provider captures.
