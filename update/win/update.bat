@echo off
chcp 65001 >nul

REM ===== スクリプトが置いてあるフォルダに移動するよ =====
cd /d "%~dp0"

REM ===== GithubからZIPをダウンロードするURLだよ =====
set REPO_URL=https://github.com/ogatetsu-0501/kintai_helper

REM ===== 一時フォルダを作り直すよ =====
set "TMP_DIR=%TEMP%\kintai_update"
if exist "%TMP_DIR%" rd /s /q "%TMP_DIR%"
mkdir "%TMP_DIR%"

REM ===== 最新版のZIPをダウンロードするよ =====
curl -L "%REPO_URL%/archive/refs/heads/main.zip" -o "%TMP_DIR%\update.zip"

REM ===== PowerShellかtarでZIPを解凍するよ =====
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
    set "USER_PS=%USERPROFILE%\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Windows PowerShell\powershell.exe"
    if exist "%USER_PS%" set "PS_CMD=%USER_PS%"
)
if defined PS_CMD (
    "%PS_CMD%" -Command "Expand-Archive -Path '%TMP_DIR%\update.zip' -DestinationPath '%TMP_DIR%'"
) else (
    if exist "%SystemRoot%\System32\tar.exe" (
        "%SystemRoot%\System32\tar.exe" -xf "%TMP_DIR%\update.zip" -C "%TMP_DIR%"
    ) else (
        tar -xf "%TMP_DIR%\update.zip" -C "%TMP_DIR%"
    )
)

REM ===== 解凍したフォルダの場所を探すよ =====
for /d %%d in ("%TMP_DIR%\*") do set "UNZIP_DIR=%%~fd"

REM ===== 上書きしたくない3ファイルを解凍先から削除するよ =====
if exist "%UNZIP_DIR%\update\win\update.bat"      del "%UNZIP_DIR%\update\win\update.bat"
if exist "%UNZIP_DIR%\update\mac\update.command" del "%UNZIP_DIR%\update\mac\update.command"
if exist "%UNZIP_DIR%\last_update.txt"           del "%UNZIP_DIR%\last_update.txt"

REM ===== 新しいファイルをコピーするよ =====
set "ROOT_DIR=%~dp0..\.."
xcopy /E /Y /I /R "%UNZIP_DIR%\*" "%ROOT_DIR%"

REM ===== 更新日時を記録するよ =====
echo %DATE% %TIME%> "%ROOT_DIR%\last_update.txt"

REM ===== 一時フォルダを消すよ =====
rd /s /q "%TMP_DIR%"

REM ===== Chromeで拡張機能を更新してね =====
echo Google Chromeで chrome://extensions/ を開き、拡張機能を更新してください。
pause
