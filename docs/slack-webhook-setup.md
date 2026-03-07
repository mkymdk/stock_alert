# Slack Webhook URL の発行と GAS への設定

---

## 1. Slack Incoming Webhook を発行する

### Step 1: Slack App を作成

1. [api.slack.com/apps](https://api.slack.com/apps) を開く
2. 「**Create New App**」→「**From scratch**」
3. App Name（例: `Stock Alert`）と通知先ワークスペースを選択 → 「Create App」

### Step 2: Incoming Webhook を有効化

1. 左メニュー「**Incoming Webhooks**」
2. 「Activate Incoming Webhooks」を **On** に切り替え
3. ページ下部「**Add New Webhook to Workspace**」をクリック
4. 通知を送るチャンネルを選択（例: `#stock-alerts`）→「**許可する**」
5. 生成された Webhook URL をコピー

```
https://hooks.slack.com/services/T.../B.../...
```

> ⚠️ この URL は**パスワードと同等**。他人に共有・コードに書き込みしないこと。

---

## 2. GAS のスクリプトプロパティに設定する

### Step 1: GAS エディタを開く

[script.google.com](https://script.google.com) → 「Stock Alert」プロジェクト

### Step 2: スクリプトプロパティを設定

1. 左メニューの歯車アイコン「**プロジェクトの設定**」
2. 「**スクリプト プロパティ**」セクション → 「**プロパティを追加**」
3. 以下を入力：

| プロパティ名 | 値 |
|---|---|
| `SLACK_WEBHOOK_URL` | コピーした Webhook URL |

4. 「**スクリプト プロパティを保存**」をクリック

---

## 3. 動作確認

GAS エディタで `manualRun` を実行し、指定チャンネルに通知が届くか確認。

届かない場合は GAS エディタの「実行数」でログを確認：
- `[slack] SLACK_WEBHOOK_URL is not set` → プロパティ名のタイポを確認
- `[slack] Unexpected response 404` → Webhook URL が無効（再発行が必要）

---

## Webhook URL を再発行したい場合

[api.slack.com/apps](https://api.slack.com/apps) → 対象アプリ → 「Incoming Webhooks」→「Add New Webhook to Workspace」で追加発行できる。古い URL は引き続き有効。

不要になった URL は同画面の「Revoke」で無効化する。
