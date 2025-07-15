#!/bin/bash
# Githubから最新のデータをもらってくるスクリプトだよ
REPO_URL="https://github.com/ogatetsu-0501/kintai_helper"

# 一時的に使うフォルダを作り直すよ
TMP_DIR=$(mktemp -d)

# 最新版のZIPをダウンロードするよ
curl -L "$REPO_URL/archive/refs/heads/main.zip" -o "$TMP_DIR/update.zip"

# ZIPファイルを解凍するよ
unzip -q "$TMP_DIR/update.zip" -d "$TMP_DIR"

# 展開したフォルダの場所を調べるよ
UNZIP_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "kintai_helper-main" | head -n 1)

# 使わないファイルを消すよ
rm -f "$UNZIP_DIR/default_config.json"
rm -f "$UNZIP_DIR/update/windows/update.bat"
rm -f "$UNZIP_DIR/update/mac/update.command"   # ← これも消すよ

# 中身をコピーして上書きするよ
cp -R "$UNZIP_DIR"/* ../../

# 更新した日時を取得して保存するよ
COMMIT_DATE=$(curl -s "https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main" \
  | grep -m 1 '"date"' \
  | sed -E 's/.*"date": "([^"]+)".*/\1/')
echo "$COMMIT_DATE" > ../../last_update.txt

# 一時フォルダを片付けるよ
rm -rf "$TMP_DIR"

# 最後に拡張機能の更新をお願いするよ
echo "Google Chromeでchrome://extensions/を開き、拡張機能を更新してください。"
read -p "Enterキーを押すと終了します" dummy
