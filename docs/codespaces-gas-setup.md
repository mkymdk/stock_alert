# GitHub Codespaces × GAS (clasp) 連携ガイド

> ローカル環境なし・CLI OAuth ありで GAS プロジェクトに clasp でコードをプッシュするまでの手順と、詰まりやすいポイントのまとめ。

---

## 全体構成

```
[Codespaces] --clasp push--> [GAS プロジェクト]
     ↑
  OAuthトークン（OAuth Playgroundで取得）
```

---

## 前提条件

- GitHub Codespaces 環境（ローカルブラウザなし）
- Google アカウント（GAS プロジェクトを作成したアカウントと同一である必要あり）
- `npm install` 済み（`@google/clasp` 導入済み）

---

## セットアップ手順（完全版）

### Step 1: GAS プロジェクトをブラウザで作成

1. [script.google.com](https://script.google.com) → 「新しいプロジェクト」
2. プロジェクト名を設定
3. URL から Script ID をコピー：
   `https://script.google.com/d/`**`SCRIPT_ID`**`/edit`
4. `.clasp.json` を作成：
   ```json
   {"scriptId":"SCRIPT_ID","rootDir":"src"}
   ```

> ⚠️ この手順が最初に必要な理由：`clasp login --creds` は `.clasp.json` が存在しないと動作しない（clasp のバグ）

---

### Step 2: Google Cloud プロジェクトを作成

[console.cloud.google.com](https://console.cloud.google.com/) で：

1. 新しいプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」→「**Google Apps Script API**」を有効化

---

### Step 3: OAuth 同意画面を設定

「APIとサービス」→「OAuth 同意画面」：

1. ユーザータイプ：「**外部**」
2. アプリ名・メール等を入力して保存
3. 「**テストユーザー**」に自分の Gmail を追加（必須）

> ⚠️ テストユーザー未追加だと「アクセスをブロック」のハードブロックになる

---

### Step 4: OAuth クライアントを2種類作成

#### ① ウェブアプリケーション（OAuth Playground 用）

「APIとサービス」→「認証情報」→「OAuth クライアント ID」：

- 種別：**ウェブ アプリケーション**
- 承認済みのリダイレクト URI に追加：
  ```
  https://developers.google.com/oauthplayground
  ```
- 作成後、クライアント ID とシークレットをメモ

> ⚠️ デスクトップアプリ用クライアントは OAuth Playground では使えない（redirect URI 不一致）

---

### Step 5: OAuth Playground で必要スコープのトークンを取得

[developers.google.com/oauthplayground](https://developers.google.com/oauthplayground/) で：

1. 右上 ⚙️ → 「Use your own OAuth credentials」にチェック
2. Step 4 で作成した**ウェブアプリ**の client_id と client_secret を入力
3. 左パネルの入力欄に以下をまとめて貼り付け：
   ```
   https://www.googleapis.com/auth/script.projects,https://www.googleapis.com/auth/script.deployments,https://www.googleapis.com/auth/script.webapp.deploy,https://www.googleapis.com/auth/script.external_request,https://www.googleapis.com/auth/script.scriptapp,https://www.googleapis.com/auth/drive.metadata.readonly,https://www.googleapis.com/auth/userinfo.email,https://www.googleapis.com/auth/userinfo.profile
   ```
4. 「Authorize APIs」→ Google 認証
5. 「Exchange authorization code for tokens」
6. **Refresh token** をコピー

> ⚠️ `clasp login --creds` では `script.projects` スコープが取得できない（clasp の仕様）。
> そのため OAuth Playground でスコープを手動指定する必要がある。

---

### Step 6: `.clasprc.json` を生成

`creds.json`（ウェブアプリ用 JSON）をリポジトリ直下に配置後、以下のスクリプトで生成：

```python
# setup_clasprc.py
import sys, json, os, time

refresh_token = sys.argv[1]
with open('creds.json') as f:
    creds = json.load(f)
installed = creds.get('installed') or creds.get('web')

clasprc = {
    "token": {
        "access_token": "",
        "refresh_token": refresh_token,
        "scope": "https://www.googleapis.com/auth/script.projects ...",
        "token_type": "Bearer",
        "expiry_date": 0
    },
    "oauth2ClientSettings": {
        "clientId": installed["client_id"],
        "clientSecret": installed["client_secret"],
        "redirectUri": "http://localhost"
    },
    "isLocalCreds": False
}

for path in ['.clasprc.json', os.path.expanduser('~/.clasprc.json')]:
    with open(path, 'w') as f:
        json.dump(clasprc, f, indent=2)
```

```bash
python3 setup_clasprc.py "<refresh_token>"
```

---

### Step 7: アクセストークンを手動リフレッシュ

clasp のトークンリフレッシュが `unauthorized_client` になる問題を回避：

```python
import json, urllib.request, urllib.parse, time

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
        json.dump(rc, f, indent=2)
```

---

### Step 8: Apps Script API をユーザー設定で有効化

[script.google.com/home/usersettings](https://script.google.com/home/usersettings) で
「**Google Apps Script API**」を **オン** にする。

> ⚠️ Google Cloud での API 有効化とは別。ユーザーレベルの設定で、ここを忘れると 403 エラー。

---

### Step 9: プッシュ

```bash
echo "y" | npm run push
```

`appsscript.json` の更新確認プロンプトに自動で `y` を返す。

---

## GitHub Actions 設定

### GitHub Secrets に登録するもの

| Secret 名 | 内容 |
|---|---|
| `CLASPRC` | `~/.clasprc.json` の内容 |
| `CLASP_JSON` | `.clasp.json` の内容 |

### ワークフロー（`.github/workflows/deploy.yml`）

```yaml
name: Deploy to Google Apps Script
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install

      - name: Set up clasp credentials
        run: |
          echo '${{ secrets.CLASP_JSON }}' > .clasp.json
          echo '${{ secrets.CLASPRC }}' > ~/.clasprc.json

      - name: Refresh access token
        run: |
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
          with open(os.path.expanduser('~/.clasprc.json'), 'w') as f:
              json.dump(rc, f)
          EOF

      - name: Push to GAS
        run: echo "y" | npm run push
```

---

## 詰まりポイント一覧

| エラー | 原因 | 解決策 |
|---|---|---|
| `アクセスをブロック`（最初の clasp login） | clasp デフォルトの OAuth クライアントが Google にブロックされている | カスタム OAuth クライアントを作成する |
| `No valid .clasp.json project file` | `clasp login --creds` が `.clasp.json` を要求する | 先にブラウザで GAS プロジェクトを作成し `.clasp.json` を用意する |
| `アクセスをブロック`（カスタム認証情報でも） | OAuth 同意画面にテストユーザー未追加 | 自分の Gmail をテストユーザーに追加 |
| スコープ不足（`script.projects` がない） | `clasp login --creds` が限定的なスコープしか要求しない | OAuth Playground でスコープを手動指定してトークン取得 |
| OAuth Playground で `アクセスをブロック` | デスクトップアプリ用クライアントは OAuth Playground の redirect URI に対応しない | **ウェブアプリケーション**タイプのクライアントを作成する |
| `unauthorized_client`（push 時） | clasp 内部のトークンリフレッシュが失敗 | Python スクリプトでアクセストークンを手動リフレッシュ |
| `User has not enabled the Apps Script API` | ユーザー設定での API 有効化が未実施 | script.google.com/home/usersettings でオンにする |
| `readline was closed`（push 時） | manifest 更新の確認プロンプトが CI で応答できない | `echo "y" \| npm run push` で解決 |

---

## .gitignore に必ず含めるもの

```
.clasp.json      # Script ID・プロジェクト情報
.clasprc.json    # OAuth トークン（パスワード相当）
creds.json       # OAuth クライアント認証情報
```

---

## appsscript.json の配置

`rootDir: "src"` を設定した場合、`appsscript.json` は `src/` 直下に置く。
ルートに置くと `Manifest: src/appsscript.json invalid` エラーになる。
