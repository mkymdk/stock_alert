# GAS 自動デプロイ セットアップガイド

`git push` 時に自動で GAS へデプロイする仕組みの説明と、セットアップ手順。

---

## 仕組み

GitHub Actions ではなく **git の `post-push` フック** を使用する。

```
git push
  └─ post-push フック が自動実行
       ├─ src/ に変更があれば → GAS へ push
       └─ src/ に変更がなければ → スキップ
```

フックは `.git/hooks/post-push` に配置されている。
`.git/` は git 管理外のため、**Codespaces を再作成するとフックが消える**（後述の再セットアップ手順を参照）。

---

## 初回セットアップ（Codespaces 構築時）

### Step 1: GAS プロジェクトと OAuth 認証を準備する

[docs/codespaces-gas-setup.md](codespaces-gas-setup.md) の手順をすべて完了させる。
完了後、以下のファイルが存在していること：

| ファイル | 内容 |
|---|---|
| `~/.clasprc.json` | OAuth トークン（refresh_token 含む） |
| `.clasp.json` | Script ID と rootDir の設定 |

### Step 2: post-push フックをセットアップする

Claude Code で以下のスキルを実行する：

```
/setup-gas-hook
```

または手動で：

```bash
# .git/hooks/post-push を作成して実行権限を付与
chmod +x .git/hooks/post-push
```

---

## 動作確認

`src/` 配下のファイルを変更してコミット＆push する：

```bash
git push
# → [post-push] src/ の変更を検出 — GAS へデプロイ中...
# → [post-push] GAS デプロイ完了
```

`src/` 以外のみ変更した場合：

```bash
git push
# → [post-push] src/ に変更なし — GAS デプロイをスキップ
```

---

## Codespaces 再作成後の再セットアップ

`~/.clasprc.json` と `.clasp.json` は gitignore されているため、再作成後は消えている。

1. [codespaces-gas-setup.md](codespaces-gas-setup.md) の Step 6〜7 を再実施してトークンを再取得
2. `/setup-gas-hook` スキルを実行してフックを再設置

---

## トラブルシューティング

| 症状 | 原因 | 対処 |
|---|---|---|
| push 後に GAS デプロイが走らない | フックが存在しないか実行権限がない | `/setup-gas-hook` を再実行 |
| `invalid_grant` エラー | refresh_token が失効 | [codespaces-gas-setup.md](codespaces-gas-setup.md) Step 5〜6 を再実施 |
| `User has not enabled the Apps Script API` | ユーザー設定での API 有効化が未実施 | [script.google.com/home/usersettings](https://script.google.com/home/usersettings) で Apps Script API をオン |
