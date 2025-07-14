@echo off
chcp 65001 > nul
REM Githubから最新バージョンをダウンロードして更新するバッチ
REM 更新用にGithubのURLを入れるよ
set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

REM 作業用の一時フォルダを作るよ
set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

REM 最新のソースを取得
curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"

REM ZIPを展開するよ
powershell -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"
for %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

REM 展開したファイルを上書きコピー
if exist "%UNZIP_DIR%\default_config.json" del "%UNZIP_DIR%\default_config.json"
xcopy /E /Y "%UNZIP_DIR%\*" ..\..\

REM 最新コミット日時を取得して保存するよ
for /f "usebackq delims=" %%A in (`powershell -Command "(Invoke-WebRequest -UseBasicParsing https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main | ConvertFrom-Json).commit.committer.date"`) do set "CDATE=%%A"
echo %CDATE%> ..\..\last_update.txt

REM お掃除
rd /s /q "%TMP_DIR%"

REM 更新が終わったらkintaiページを再表示するよ
REM もし既に開いているタブがあれば再読み込みするよ
powershell -Command ^
  "$url='https://kintai.jinjer.biz/staffs/time_cards';" ^
  "$ws=New-Object -ComObject WScript.Shell;" ^
  "$chrome=(Get-Process chrome -ErrorAction SilentlyContinue | Select-Object -First 1);" ^
  "if($chrome){$ws.AppActivate($chrome.Id)|Out-Null;$ws.SendKeys('^l');$ws.SendKeys($url);$ws.SendKeys('{ENTER}');}else{Start-Process chrome $url}"

echo 更新が終わりました。ブラウザが自動で再読み込みされます。
pause
