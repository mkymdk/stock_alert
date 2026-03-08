# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Type-check without emitting
npx tsc --noEmit

# Push local TypeScript to Google Apps Script (manual)
# → Usually not needed: git push triggers post-push hook or GitHub Actions automatically
echo "y" | npm run push

# Pull GAS code back to local (after manual edits in GAS editor)
npm run pull

# Open GAS editor in browser
npm run open
```

There is no local build step or test runner — TypeScript is transpiled by clasp on push directly to GAS.

## Deployment

### Auto-deploy (normal workflow)

`git push` triggers two mechanisms — either is sufficient:

1. **GitHub Actions** (`.github/workflows/deploy.yml`) — runs only when `src/**` changes; skips gracefully if Secrets are not configured. Requires `CLASPRC` and `CLASP_JSON` repository secrets.
2. **git post-push hook** (`.git/hooks/post-push`) — local hook, runs only when `src/` changes. Recreate with `/setup-gas-hook` skill if lost after Codespaces rebuild.

### Manual push

clasp's built-in token refresh is broken in this environment. Always refresh manually first:

```bash
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
echo "y" | npm run push
```

### Credentials (never committed)

| File | Purpose |
|---|---|
| `.clasp.json` | Script ID and rootDir |
| `~/.clasprc.json` | OAuth tokens (refresh_token + clientId/clientSecret) |
| `creds.json` | OAuth client credentials (web app type) |

Full setup guide: [docs/codespaces-gas-setup.md](docs/codespaces-gas-setup.md)
GitHub Actions setup: [docs/github-actions-deploy-setup.md](docs/github-actions-deploy-setup.md)

---

## Architecture

GAS + clasp + TypeScript. All code runs inside GAS, not Node.js.
GAS globals (`Logger`, `UrlFetchApp`, `ScriptApp`, `Utilities`, `PropertiesService`) are available at runtime via `@types/google-apps-script`.

**GAS scope**: All `src/*.ts` files are concatenated into a single GAS script namespace — no ES module `import`/`export`. Types and classes are shared globally.

### Data flow

```
main.ts:checkAllStocks()
  → screener.ts:getScreenedStocks()
      → yutaiProvider.ts:fetchFilteredStocks()
          → minkabu /stock/search API
            (yutai_exist=1 + dividend_yield + per フィルタ)
          → returns ScreenedStock[] with name/per/dividendYieldPct
  → alert.ts:checkAndAlert(stock) per stock
      → YahooFinanceProvider.fetchPriceData()
          → Yahoo Finance v8 chart API (5年・週足)
      → if dropPct <= -DROP_THRESHOLD_PCT:
          → slack.ts:sendSlackAlert()
              → yutaiProvider.ts:fetchYutaiDetail() (HTML scraping)
              → Slack Incoming Webhook
```

### Screening logic

銘柄はハードコードなし。毎回 minkabu API でスクリーニング:
1. 株主優待あり
2. 配当利回り >= `DIVIDEND_YIELD_MIN_PCT` (2.0%)
3. PER <= `PER_MAX` (35倍)
4. 過去5年高値から `DROP_THRESHOLD_PCT` (25%) 以上下落

### Key files

| File | Role |
|---|---|
| `src/config.ts` | `DROP_THRESHOLD_PCT`, `DIVIDEND_YIELD_MIN_PCT`, `PER_MAX`, `YUTAI_MAX_PAGES` |
| `src/types.ts` | `Market`, `StockConfig`, `ScreenedStock`, `PriceData` |
| `src/providers/base.ts` | `StockProvider` interface (`fetchPriceData` のみ) |
| `src/providers/yahooFinance.ts` | Yahoo Finance v8 chart API 実装 |
| `src/yutaiProvider.ts` | minkabu API スクリーニング + 優待詳細スクレイピング |
| `src/screener.ts` | `getScreenedStocks()` — `fetchFilteredStocks()` の薄いラッパー |
| `src/alert.ts` | 下落率チェック、`getProvider()` でプロバイダー選択 |
| `src/slack.ts` | Slack Incoming Webhook 通知・メッセージ整形 |
| `src/main.ts` | `checkAllStocks()`, `setupTrigger()`, `manualRun()` |

### External APIs

| API | 用途 | 認証 |
|---|---|---|
| minkabu `/stock/search` JSON API | スクリーニング（銘柄一覧・PER・配当） | 不要（`Accept: application/json` + `X-Requested-With: XMLHttpRequest` ヘッダー必須） |
| minkabu `/stock/{code}/yutai` HTML | 優待内容テキスト取得（スクレイピング） | 不要 |
| Yahoo Finance v8 `/finance/chart` | 株価データ（5年・週足） | 不要 |
| Slack Incoming Webhook | アラート通知 | `SLACK_WEBHOOK_URL` を GAS Script Properties に設定 |

> Yahoo Finance v7 quote API は HTTP 401 のため使用不可。ファンダメンタルズは minkabu API で代替。

### Trigger

毎週金曜 16:00 JST。`setupTrigger()` を GAS エディタで1回実行して登録。
`setupTrigger()` は既存トリガーを全削除してから再作成するため冪等。

### Manual testing

`src/config.ts` の `DROP_THRESHOLD_PCT` を `1` に下げて push し、GAS エディタで `manualRun()` を実行。確認後に元の値に戻して再 push。

### Adding a new market/provider

1. `src/providers/<name>.ts` を作成して `StockProvider` を実装
2. `src/types.ts` の `Market` 型に追加
3. `src/providers/yahooFinance.ts` の `MARKET_SUFFIX` に追加（または新プロバイダー側）
4. `src/alert.ts` の `getProvider()` を更新
