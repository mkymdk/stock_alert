"""
OAuth Playground で取得した refresh_token から .clasprc.json を生成するスクリプト。
使い方: python3 setup_clasprc.py <refresh_token>
"""
import sys, json, os, time

if len(sys.argv) < 2:
    print("使い方: python3 setup_clasprc.py <refresh_token>")
    sys.exit(1)

refresh_token = sys.argv[1]
creds_path = os.path.join(os.path.dirname(__file__), "creds.json")

with open(creds_path) as f:
    creds = json.load(f)

installed = creds.get("installed") or creds.get("web")
client_id     = installed["client_id"]
client_secret = installed["client_secret"]

clasprc = {
    "token": {
        "access_token": "",
        "refresh_token": refresh_token,
        "scope": " ".join([
            "https://www.googleapis.com/auth/script.projects",
            "https://www.googleapis.com/auth/script.deployments",
            "https://www.googleapis.com/auth/script.webapp.deploy",
            "https://www.googleapis.com/auth/script.external_request",
            "https://www.googleapis.com/auth/script.scriptapp",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ]),
        "token_type": "Bearer",
        "expiry_date": 0
    },
    "oauth2ClientSettings": {
        "clientId": client_id,
        "clientSecret": client_secret,
        "redirectUri": "http://localhost"
    },
    "isLocalCreds": False
}

out_local  = os.path.join(os.path.dirname(__file__), ".clasprc.json")
out_global = os.path.expanduser("~/.clasprc.json")

for path in [out_local, out_global]:
    with open(path, "w") as f:
        json.dump(clasprc, f, indent=2)
    print(f"✅ 作成: {path}")

print("\n完了。次のコマンドを実行してください: npm run push")
