@echo off
chcp 65001 > nul

set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"

powershell -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"
for %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

if exist "%UNZIP_DIR%\default_config.json" del "%UNZIP_DIR%\default_config.json"
xcopy /E /Y "%UNZIP_DIR%\*" ..\..\

for /f "usebackq delims=" %%A in (`powershell -Command "(Invoke-WebRequest -UseBasicParsing https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main | ConvertFrom-Json).commit.committer.date"`) do set "CDATE=%%A"
echo %CDATE%> ..\..\last_update.txt

REM お掃除
rd /s /q "%TMP_DIR%"

REM ----------------------------------------
REM ここから拡張機能更新 → 勤怠ページ再読み込み処理を追加
REM ----------------------------------------

REM 1) 拡張機能一覧のページを新しいタブで開くよ
start "" chrome --new-tab "chrome://extensions/"

REM 2) ユーザーに更新ボタンを押してもらうよ
echo 拡張機能ページを開いたよ。更新ボタンを押したら何かキーを押してね…
pause

REM 3) IMEをオフにするよ（Ctrl+Spaceを送るよ）
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $ws.SendKeys('^{SPACE}');"

REM 4) 既に開いている勤怠ページタブを探してリロード、なければ新しく開くよ
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $chrome = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match '勤怠実績' } | Select-Object -First 1; if ($chrome) { $ws.AppActivate($chrome.Id); Start-Sleep -Milliseconds 200; $ws.SendKeys('{F5}'); } else { Start-Process chrome 'https://kintai.jinjer.biz/staffs/time_cards'; }"

REM 5) 終了メッセージを表示するよ
echo 更新とリロードが完了したよ！
pause
