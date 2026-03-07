# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Push local TypeScript to Google Apps Script
npm run push

# Pull GAS code back to local (after manual edits in GAS editor)
npm run pull

# Open GAS editor in browser
npm run open

# Type-check without emitting
npx tsc --noEmit
```

There is no local build step or test runner — TypeScript is transpiled by clasp on push directly to GAS.

## Deployment

### Prerequisites (one-time setup)

Credentials are **never committed**. See [docs/codespaces-gas-setup.md](docs/codespaces-gas-setup.md) for the full setup guide.

Required local files (gitignored):
- `.clasp.json` — Script ID and rootDir
- `.clasprc.json` — OAuth tokens
- `creds.json` — OAuth client credentials (web app type)

### Pushing code

clasp's built-in token refresh is broken in this environment. Always refresh manually first:

```bash
# 1. Refresh the access token
python3 - <<'EOF'
import json, urllib.request, urllib.parse, time, os
with open(os.path.expanduser('~/.clasprc.json')) as f:
    rc = json.load(f)
data = urllib.parse.urlencode({
    'grant_type': 'refresh_token',
    'refresh_token': rc['token']['refresh_token'],
    'client_id': rc['oauth2ClientSettings']['clientId'],
    'client_secret': rc['oauth2ClientSettings']['clientSecret'],
}).encode()
with urllib.request.urlopen(
    urllib.request.Request('https://oauth2.googleapis.com/token', data=data)
) as r:
    resp = json.load(r)
rc['token']['access_token'] = resp['access_token']
rc['token']['expiry_date'] = int(time.time() * 1000) + resp['expires_in'] * 1000
for path in ['.clasprc.json', os.path.expanduser('~/.clasprc.json')]:
    with open(path, 'w') as f:
        json.dump(rc, f)
EOF

# 2. Push (answer "y" to manifest overwrite prompt)
echo "y" | npm run push
```

### GitHub Actions

Auto-deploys to GAS on every push to `main`. Requires these repository secrets:

| Secret | Content |
|--------|---------|
| `CLASPRC` | Contents of `~/.clasprc.json` |
| `CLASP_JSON` | Contents of `.clasp.json` |

The workflow handles token refresh automatically — see [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

---

## Architecture

This is a **Google Apps Script (GAS)** project written in TypeScript and deployed via [clasp](https://github.com/google/clasp). All code runs inside GAS, not Node.js. GAS globals (`Logger`, `UrlFetchApp`, `ScriptApp`, `Utilities`) are available at runtime via `@types/google-apps-script`.

### Data flow

```
config.ts (STOCKS[]) → main.ts:checkAllStocks()
  → alert.ts:checkAndAlert() per stock
    → getProvider(market) → YahooFinanceProvider.fetchPriceData()
      → Yahoo Finance v8 API (no key required)
    → if drop >= DROP_THRESHOLD_PCT → slack.ts:sendSlackAlert()
      → Slack Incoming Webhook (URL stored in GAS Script Properties)
```

### Key design points

- **No local compilation**: clasp handles TS→JS transpilation; `tsconfig.json` uses `skipLibCheck: true` to avoid `@types/node` / `undici-types` conflicts.
- **GAS scope**: All `src/*.ts` files are concatenated into a single GAS script namespace — no ES module `import`/`export`. Types and classes are shared globally across files.
- **Secret management**: `SLACK_WEBHOOK_URL` must be set in GAS Script Properties (not in code). Retrieved at runtime via `PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL')`.
- **Trigger**: Registered once by running `setupTrigger()` in GAS editor. Fires every Friday 16:00 JST (`appsscript.json` sets `timeZone: Asia/Tokyo`).
- **Provider pattern**: `StockProvider` interface in `src/providers/base.ts`; `getProvider()` in `alert.ts` selects the implementation. Currently only `YahooFinanceProvider` exists.

### Market / ticker mapping

| Market | `symbol` format | Yahoo Finance ticker |
|--------|----------------|----------------------|
| `TSE`  | 4-digit code (e.g. `7203`) | `7203.T` |
| `NYSE` / `NASDAQ` | ticker (e.g. `AAPL`) | `AAPL` |

### Manual testing

Lower `DROP_THRESHOLD_PCT` in `src/config.ts` to `1`, run the push commands above, then execute `manualRun()` from the GAS editor. Restore the threshold and push again after testing.

### Adding a new market/provider

1. Create `src/providers/<name>.ts` implementing `StockProvider`
2. Add the new `Market` value to `src/types.ts`
3. Add the suffix mapping in `src/providers/yahooFinance.ts` (or the new provider)
4. Update `getProvider()` in `src/alert.ts` to return the new provider for that market
