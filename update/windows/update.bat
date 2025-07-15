@echo off
chcp 65001 >nul

REM ===== ダウンロードするサイトのURL =====
set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

REM ===== 一時フォルダを作り直す =====
set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

REM ===== 最新のデータをダウンロード =====
curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"
powershell -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"

REM ===== 解凍したフォルダの場所を調べる =====
for /d %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

REM ===== いらないファイルを消す =====
if exist "%UNZIP_DIR%\default_config.json" del "%UNZIP_DIR%\default_config.json"
if exist "%UNZIP_DIR%\update\windows\update.bat" del "%UNZIP_DIR%\update\windows\update.bat"
xcopy /E /Y "%UNZIP_DIR%\*" ..\..\

REM ===== 更新した日時を保存する =====
for /f "usebackq delims=" %%A in (`
  powershell -Command "(Invoke-WebRequest -UseBasicParsing https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main | ConvertFrom-Json).commit.committer.date"
`) do set "CDATE=%%A"
echo %CDATE%> ..\..\last_update.txt

REM ===== もう使わない一時フォルダを消す =====
rd /s /q "%TMP_DIR%"

REM ===== Chromeを自分で開いて更新しようね =====
echo Google Chromeでchrome://extensions/を開き、拡張機能を更新してください。
pause

