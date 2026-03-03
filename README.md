# stock_alert

日本株・米国株の株価下落を **毎週金曜日に Slack へ通知する** Google Apps Script (GAS) システムです。
指定した銘柄が直近N日間の高値からX%以上下落した場合にアラートを送ります。

---

## 機能

- 複数銘柄を毎週自動監視（東証・NYSE・NASDAQ 対応）
- 高値からの下落率が閾値を超えた場合に Slack へ通知
- 毎週金曜 16:00 JST（東証終値確定後）に自動実行
- 条件を満たし続ける限り毎週通知（継続ドローダウンを見逃さない）
- TypeScript で記述、clasp でローカル開発・デプロイ

---

## 通知メッセージの例

```
🚨 株価下落アラート
銘柄: トヨタ自動車 (7203) [東証]
現在値: ¥2,345
直近90日の高値: ¥3,000 (2025-12-15 達成)
下落率: -21.8%
（監視条件: 高値から20%以上の下落）
```

---

## セットアップ手順

### 前提条件

- Node.js 18 以上
- Google アカウント
- Slack ワークスペースで Incoming Webhook が設定済みであること

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <your-repo-url>
cd stock_alert
npm install
```

### 2. Google アカウントでログイン

```bash
npx clasp login
```

ブラウザが開くので Google アカウントでログインし、権限を許可します。

### 3. GAS プロジェクトの作成

```bash
npx clasp create --type standalone --title "Stock Alert"
```

実行すると `.clasp.json` が生成されます（`.gitignore` に含まれるため Git 管理外）。
Google Drive 上に「Stock Alert」という名前の GAS プロジェクトが作成されます。

### 4. コードを GAS へプッシュ

```bash
npm run push
```

`src/` 以下のすべての TypeScript ファイルと `appsscript.json` が GAS へアップロードされます。

### 5. 監視銘柄・閾値の設定

[src/config.ts](src/config.ts) を編集して監視銘柄・下落閾値・遡及日数を設定します。

```typescript
const STOCKS: StockConfig[] = [
  { symbol: '7203', name: 'トヨタ自動車', market: 'TSE' },
  // 銘柄を追加・変更する
  // 米国株の追加例:
  // { symbol: 'AAPL', name: 'Apple Inc.', market: 'NASDAQ' },
];

const LOOKBACK_DAYS = 90;      // 直近何日間の高値を基準にするか（30〜180）
const DROP_THRESHOLD_PCT = 20; // 何%下落でアラートを出すか
```

編集後は再度 `npm run push` を実行します。

### 6. Slack Webhook URL の設定

> ⚠️ Webhook URL はコードに書かず、GAS のスクリプトプロパティに保存します。

1. [GAS エディタ](https://script.google.com) を開く（`npm run open` でも可）
2. 左メニュー「プロジェクトの設定」（歯車アイコン）をクリック
3. 「スクリプト プロパティ」セクションで「プロパティを追加」をクリック
4. キー: `SLACK_WEBHOOK_URL`、値: Slack の Webhook URL を入力
5. 「スクリプト プロパティを保存」をクリック

### 7. 定期実行トリガーの設定

GAS エディタで以下の手順を実行します：

1. 関数の選択ドロップダウンで **`setupTrigger`** を選択
2. 「実行」ボタンをクリック
3. 「承認が必要です」と表示された場合は「権限を確認」をクリックし、権限を許可

これで **毎週金曜 16:00 JST** に自動実行されるトリガーが登録されます。

### 8. 動作テスト

GAS エディタで **`manualRun`** を選択して実行すると即時チェックが行えます。

テスト時は `src/config.ts` の `DROP_THRESHOLD_PCT` を一時的に低い値（例: `1`）に変更して
`npm run push` 後に `manualRun` を実行してください。

---

## ファイル構成

| ファイル | 役割 |
|---|---|
| [src/types.ts](src/types.ts) | 共通型定義（`StockConfig`, `PriceData`, `Market`） |
| [src/config.ts](src/config.ts) | 銘柄リスト・閾値・遡及日数 |
| [src/providers/base.ts](src/providers/base.ts) | `StockProvider` インターフェース |
| [src/providers/yahooFinance.ts](src/providers/yahooFinance.ts) | Yahoo Finance v8 API 実装 |
| [src/alert.ts](src/alert.ts) | 下落判定ロジック・プロバイダー選択 |
| [src/slack.ts](src/slack.ts) | Slack Incoming Webhook 通知 |
| [src/main.ts](src/main.ts) | エントリーポイント・トリガー設定 |
| [appsscript.json](appsscript.json) | GAS マニフェスト（タイムゾーン・OAuth スコープ） |

---

## 銘柄の追加・変更方法

[src/config.ts](src/config.ts) の `STOCKS` 配列を編集します。

| 市場 | `market` の値 | `symbol` の形式 |
|---|---|---|
| 東京証券取引所 | `'TSE'` | 4桁の証券コード（例: `'7203'`） |
| NYSE | `'NYSE'` | ティッカーシンボル（例: `'IBM'`） |
| NASDAQ | `'NASDAQ'` | ティッカーシンボル（例: `'AAPL'`） |

編集後は `npm run push` を実行してください。

---

## 開発ワークフロー

```bash
# コードを変更後、GAS へ反映
npm run push

# GAS エディタを開く
npm run open

# GAS からローカルへ取得（手動編集した場合）
npm run pull
```

---

## 注意事項

- Yahoo Finance の API 仕様は予告なく変更される場合があります。データが取得できない場合はログを確認してください。
- GAS の時間トリガーは指定時刻から最大15分の誤差があります。
- Webhook URL は外部に漏らさないよう管理してください。
