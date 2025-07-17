@echo off
chcp 65001 >nul

REM ===== GithubからZIPをダウンロードするURLだよ =====
set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

REM ===== 一時フォルダを作り直すよ =====
set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

REM ===== 最新版をダウンロードするよ =====
curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"

REM ===== PowerShellの場所を探すよ =====
set "PS_EXE=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "PS_CMD="
if exist "%PS_EXE%" (
    set "PS_CMD=%PS_EXE%"
) else (
    where powershell >nul 2>&1
    if %ERRORLEVEL%==0 (
        for /f "delims=" %%p in ('where powershell') do if not defined PS_CMD set "PS_CMD=%%p"
    )
)
if not defined PS_CMD (
    REM ユーザーフォルダも調べるよ
    set "USER_PS=%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Windows PowerShell\powershell.exe"
    if exist "%USER_PS%" set "PS_CMD=%USER_PS%"
)

REM ===== ZIPファイルを解凍するよ =====
if defined PS_CMD (
    "%PS_CMD%" -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"
) else (
    echo PowerShellが見つからないのでtar.exeで解凍するよ
    if exist "%SystemRoot%\System32\tar.exe" (
        "%SystemRoot%\System32\tar.exe" -xf "%TMP_DIR%\update.zip" -C "%TMP_DIR%"
    ) else (
        tar -xf "%TMP_DIR%\update.zip" -C "%TMP_DIR%"
    )
)

REM ===== 解凍したフォルダの場所を調べるよ =====
for /d %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

REM ===== いらないファイルを消すよ =====
if exist "%UNZIP_DIR%\default_config.json" del "%UNZIP_DIR%\default_config.json"
if exist "%UNZIP_DIR%\update\win\update.bat" del "%UNZIP_DIR%\update\win\update.bat"
if exist "%UNZIP_DIR%\update\mac\update.command" del "%UNZIP_DIR%\update\mac\update.command"  REM ← これも消すよ
if exist "%UNZIP_DIR%\last_update.txt" del "%UNZIP_DIR%\last_update.txt"  REM ← 追加したよ

REM ===== 新しいファイルをコピーするよ =====
xcopy /E /Y "%UNZIP_DIR%\*" ..\..\

REM ===== 更新した日時を保存するよ =====
REM いまの%DATE%と%TIME%をそのまま書き込むよ
echo %DATE% %TIME%> ..\..\last_update.txt

REM ===== 一時フォルダを消すよ =====
rd /s /q "%TMP_DIR%"

REM ===== Chromeで拡張機能を更新してね =====
echo Google Chromeでchrome://extensions/を開き、拡張機能を更新してください。
pause
