# GitHub Actions → GAS 自動デプロイ セットアップガイド

`main` ブランチへの push 時に GitHub Actions が自動で GAS へデプロイする設定手順。

---

## 動作仕様

| 条件 | 動作 |
|---|---|
| `src/` 配下のファイルが変更された push | Actions が起動し GAS へデプロイ |
| `src/` 以外のみの変更（docs 修正など） | Actions は起動しない |
| Secrets（`CLASPRC` / `CLASP_JSON`）が未設定 | Steps をスキップして正常終了（失敗にならない） |
| タイムアウト | 5分（超過した場合はジョブを強制終了） |

---

## 前提条件

[docs/codespaces-gas-setup.md](codespaces-gas-setup.md) の手順が完了していること。
以下の2ファイルが手元（Codespaces 内）に存在している状態：

| ファイル | 内容 |
|---|---|
| `~/.clasprc.json` | OAuth トークン（refresh_token 含む） |
| `.clasp.json` | Script ID と rootDir の設定 |

---

## セットアップ手順

### Step 1: 各ファイルの内容を確認する

Codespaces のターミナルで内容を表示：

```bash
cat ~/.clasprc.json
cat .clasp.json
```

それぞれの出力内容をまるごとコピーしておく。

---

### Step 2: GitHub に Secrets を登録する

1. GitHub でこのリポジトリを開く
2. **Settings** タブ → 左メニュー **Secrets and variables** → **Actions**
3. **New repository secret** ボタンで以下の2つを登録：

| Secret 名 | 貼り付ける内容 |
|---|---|
| `CLASPRC` | `~/.clasprc.json` の内容（JSON 全体） |
| `CLASP_JSON` | `.clasp.json` の内容（JSON 全体） |

**`CLASPRC` の内容例：**
```json
{
  "token": {
    "access_token": "ya29.xxx",
    "refresh_token": "1//xxx",
    "scope": "https://www.googleapis.com/auth/script.projects ...",
    "token_type": "Bearer",
    "expiry_date": 1700000000000
  },
  "oauth2ClientSettings": {
    "clientId": "xxxx.apps.googleusercontent.com",
    "clientSecret": "GOCSPX-xxx",
    "redirectUri": "http://localhost"
  },
  "isLocalCreds": false
}
```

**`CLASP_JSON` の内容例：**
```json
{"scriptId":"1xxxxxxxxxxxxx","rootDir":"src"}
```

---

### Step 3: 動作確認

`src/` 配下のファイルを変更してコミット＆push すると、GitHub の **Actions** タブでワークフローが実行される。

Secrets が未設定の場合は `configured=false` として残りの steps がスキップされ、ジョブは **成功（緑）** で終了する。

---

## Secrets の更新が必要になるタイミング

| 状況 | 更新すべき Secret |
|---|---|
| GAS プロジェクトを新しく作り直した | `CLASP_JSON`（新しい scriptId） |
| OAuth クライアントを再作成した | `CLASPRC`（新しい clientId/clientSecret/refresh_token） |
| `invalid_grant` エラーが出た | `CLASPRC`（refresh_token の再取得が必要） |

refresh_token の有効期限は通常 **6ヶ月**（定期的に push していれば自動延長される）。

---

## トラブルシューティング

| エラー | 原因 | 対処 |
|---|---|---|
| `invalid_client` | CLASPRC の clientId/clientSecret が間違っている | `.clasprc.json` を再確認して Secret を更新 |
| `invalid_grant` | refresh_token が失効 | [codespaces-gas-setup.md](codespaces-gas-setup.md) Step 5〜6 を再実施してトークンを再取得し CLASPRC を更新 |
| `User has not enabled the Apps Script API` | ユーザー設定での API 有効化が未実施 | [script.google.com/home/usersettings](https://script.google.com/home/usersettings) で Apps Script API をオン |
| push しても Actions が起動しない | `src/` 以外のみの変更 | 仕様通り。`src/` 配下のファイルを変更した push のみ起動する |
