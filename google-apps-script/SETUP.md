# Google Sheets sync setup

1. Create or open the Google Sheet that will hold flight-search history.
2. Open Extensions > Apps Script and replace the script with `Code.gs` from this folder.
3. Run `setupFlightSearchSheet()` once. It creates or schema-migrates `Observations`, `Queries`, `Runs`, and `Current Best` by matching existing columns by header name.
4. Run `setFlightSearchSyncToken('a-long-random-token')` once.
5. Deploy the script as a Web App and copy its `/exec` URL.
6. In Flight Search Matrix, enter the Web App URL and the same token.

Schema migrations preserve recognized old columns and add new columns such as per-person total including fees. Unknown old columns are not carried into the canonical table, so keep a backup before a major manual customization of the Sheets schema.
