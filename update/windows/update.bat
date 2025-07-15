@echo off
chcp 65001 >nul

set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"
powershell -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"

for /d %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

if exist "%UNZIP_DIR%\default_config.json" del "%UNZIP_DIR%\default_config.json"
if exist "%UNZIP_DIR%\update\windows\update.bat" del "%UNZIP_DIR%\update\windows\update.bat"
xcopy /E /Y "%UNZIP_DIR%\*" ..\..\

for /f "usebackq delims=" %%A in (`
  powershell -Command "(Invoke-WebRequest -UseBasicParsing https://api.github.com/repos/ogatetsu-0501/kintai_helper/commits/main | ConvertFrom-Json).commit.committer.date"
`) do set "CDATE=%%A"
echo %CDATE%> ..\..\last_update.txt

rd /s /q "%TMP_DIR%"

powershell -Command "$ws=New-Object -ComObject 'WScript.Shell'; $e=Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -match '拡張機能' } | Select-Object -First 1; if ($e) { $ws.AppActivate($e.Id); Start-Sleep -Milliseconds 200; $ws.SendKeys('{F5}') } else { Start-Process chrome 'chrome://extensions/' }"
echo 拡張機能ページを開きました。拡張機能を更新してください。
pause

