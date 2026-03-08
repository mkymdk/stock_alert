# GitHub Actions → GAS 自動デプロイ セットアップガイド

`main` ブランチへの push 時に GitHub Actions が自動で GAS へデプロイする設定手順。

---

## 前提条件

[docs/codespaces-gas-setup.md](codespaces-gas-setup.md) の手順が完了していること。
具体的には以下の2ファイルが手元（Codespaces 内）に存在している状態：

| ファイル | 内容 |
|---|---|
| `~/.clasprc.json` | OAuth トークン（refresh_token 含む） |
| `.clasp.json` | Script ID と rootDir の設定 |

---

## 設定手順

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

**登録例 — `CLASPRC`：**
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

**登録例 — `CLASP_JSON`：**
```json
{"scriptId":"1xxxxxxxxxxxxx","rootDir":"src"}
```

---

### Step 3: 動作確認

`main` ブランチに何かコミットして push すると、GitHub の **Actions** タブでワークフローが実行される。

**成功ログの目安：**
```
Pushed X files.
```

**失敗した場合のよくあるエラーと対処：**

| エラーメッセージ | 原因 | 対処 |
|---|---|---|
| `invalid_client` | CLASPRC の clientId/clientSecret が間違っている | `.clasprc.json` の内容を再確認して Secret を更新 |
| `invalid_grant` | refresh_token が失効または無効 | [codespaces-gas-setup.md](codespaces-gas-setup.md) の Step 5〜6 を再実施してトークンを再取得し、CLASPRC を更新 |
| `User has not enabled the Apps Script API` | ユーザー設定での API 有効化が未実施 | [script.google.com/home/usersettings](https://script.google.com/home/usersettings) で Apps Script API をオン |
| `Could not read file: .clasp.json` | CLASP_JSON が登録されていない | GitHub Secrets に CLASP_JSON を追加 |
| `Script ID が見つからない` | CLASP_JSON の scriptId が間違っている | GAS エディタの URL から Script ID を再確認 |

---

## ワークフローの仕組み

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) が行っていること：

1. **Secrets を配置** — `CLASPRC` → `~/.clasprc.json`、`CLASP_JSON` → `.clasp.json`
2. **アクセストークンを更新** — refresh_token を使って新しい access_token を取得
   （clasp 内蔵のトークンリフレッシュは CI 環境で動作しないため Python スクリプトで代替）
3. **`npm run push`** — clasp が TypeScript を GAS へトランスパイル＆アップロード

---

## Secrets の更新が必要になるタイミング

| 状況 | 更新すべき Secret |
|---|---|
| GAS プロジェクトを新しく作り直した | `CLASP_JSON`（新しい scriptId） |
| OAuth クライアントを再作成した | `CLASPRC`（新しい clientId/clientSecret/refresh_token） |
| refresh_token が `invalid_grant` になった | `CLASPRC`（refresh_token の再取得が必要） |

refresh_token の有効期限は通常 **6ヶ月**（定期的に clasp push しているうちは自動延長される）。
