#!/bin/bash
# Githubから最新バージョンをダウンロードして更新するスクリプト
# 更新用にGithubのURLを入れるよ
REPO_URL="https://github.com/ogatetsu-0501/kintai_helper"

# 作業用の一時フォルダを作るよ
TMP_DIR=$(mktemp -d)

# 最新のソースを取得
curl -L "$REPO_URL/archive/refs/heads/main.zip" -o "$TMP_DIR/update.zip"

# ZIPを展開するよ
unzip -q "$TMP_DIR/update.zip" -d "$TMP_DIR"
REPO_NAME=$(basename "$REPO_URL")

# default_config.json は上書きしたくないから消しておくよ
rm -f "$TMP_DIR/$REPO_NAME-main/default_config.json"

# 展開したファイルを上書きコピー
cp -R "$TMP_DIR/$REPO_NAME-main"/* ../../

# 最新コミット日時を取得して保存するよ
COMMIT_DATE=$(curl -s "https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main" | grep -m 1 '"date"' | sed -E 's/.*"date": "([^"]+)".*/\1/')
echo "$COMMIT_DATE" > ../../last_update.txt

# お掃除
rm -rf "$TMP_DIR"

# 更新が終わったら拡張機能をリロードするよ
# 拡張IDは固定なのでここに書いておくね
EXT_ID="knjpjbmahfhomkmgefkcdiilbffeiilj"

# まずリロード用のページを開く
open "chrome-extension://${EXT_ID}/update/reload/reload.html"

# それからkintaiページを再表示するよ
# もし既に開いているタブがあれば再読み込みするよ
osascript <<'EOF'
tell application "Google Chrome"
  set targetUrl to "https://kintai.jinjer.biz/staffs/time_cards"
  set found to false
  repeat with w in every window
    repeat with t in every tab of w
      if URL of t starts with targetUrl then
        set found to true
        reload t
        exit repeat
      end if
    end repeat
    if found then exit repeat
  end repeat
  if not found then
    open location targetUrl
  end if
end tell
EOF

echo "更新が終わりました。ブラウザが自動で再読み込みされます。"
