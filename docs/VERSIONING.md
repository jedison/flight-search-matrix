# Versioning and releases

The project uses Semantic Versioning: `MAJOR.MINOR.PATCH`.

- PATCH - bug fixes, selector fixes and parsing improvements that do not change stored-data compatibility.
- MINOR - new adapters, new fields, new search modes or notable UI capabilities with backward compatibility.
- MAJOR - incompatible storage/schema/API changes or a redesigned extension architecture.

The current version must match in all three places:

- `VERSION`
- `package.json`
- `manifest.json`

`tests/version.test.mjs` enforces this.

For every release:

1. Update the three version locations.
2. Add a dated entry to `CHANGELOG.md`.
3. Run `npm run verify`.
4. Smoke-test as an unpacked extension.
5. Build a source ZIP named `flight-search-matrix-X.Y.Z.zip`.
6. Keep the ZIP in `releases/` and preserve the source tree in Drive.
