@echo off
setlocal EnableExtensions
rem ======================================================================
rem  プロジェクト工程ボード : バックアップ収集
rem
rem  ダウンロードフォルダに溜まった project-board_*.json を、
rem  指定したフォルダへコピーします。
rem
rem  使い方
rem    初回      : ダブルクリック → コピー先フォルダを選ぶ
rem    2回目以降 : ダブルクリックするだけ（前回の場所にコピー）
rem    変更したい: /select を付けて実行（右クリック→ショートカット等）
rem    自動実行  : /quiet を付けてタスクスケジューラに登録
rem
rem  コピー先は、このファイルの横の collect-backup-dest.txt に記録されます。
rem  直接書き換えても構いません。
rem ======================================================================

set "SRC=%USERPROFILE%\Downloads"
set "CFG=%~dp0collect-backup-dest.txt"
set "SELECT="
set "QUIET="

:parse
if "%~1"=="" goto parsed
if /i "%~1"=="/select" set "SELECT=1"
if /i "%~1"=="/quiet"  set "QUIET=1"
shift
goto parse
:parsed

if defined SELECT del "%CFG%" >nul 2>&1

call :readdest
if defined DEST goto check

rem ---- コピー先が未設定 ----
if defined QUIET goto nodest
echo コピー先のフォルダを選んでください。
echo.
call :askdest
call :readdest
if not defined DEST goto cancelled
echo コピー先を記録しました。次回からは選ばずに実行できます。
echo.

:check
if exist "%DEST%\" goto run
echo コピー先が見つかりません : "%DEST%"
echo.
if defined QUIET exit /b 1
echo 選び直してください。
echo.
call :askdest
call :readdest
if not defined DEST goto cancelled
if not exist "%DEST%\" goto cancelled

:run
echo コピー元 : "%SRC%"
echo コピー先 : "%DEST%"
echo.

robocopy "%SRC%" "%DEST%" project-board_*.json /XO /NJH /NJS /NDL /NP
set RC=%ERRORLEVEL%

echo.
if %RC% GEQ 8 (
  echo コピーに失敗しました。robocopy の終了コード : %RC%
) else if %RC% EQU 0 (
  echo 新しいバックアップはありませんでした。すでに最新です。
) else (
  echo コピーが完了しました。
)
goto done

:nodest
echo コピー先が設定されていません。
echo /quiet を付けずに一度実行して、コピー先を選んでください。
exit /b 1

:cancelled
echo 選択をやめました。コピーしていません。
goto done

:done
if defined QUIET exit /b 0
echo.
pause
exit /b 0

rem ---------------- 以下は内部処理 ----------------

:readdest
set "DEST="
if not exist "%CFG%" exit /b 0
for /f "usebackq delims=" %%L in ("%CFG%") do if not defined DEST set "DEST=%%~L"
if not defined DEST exit /b 0
if "%DEST:~-1%"=="\" set "DEST=%DEST:~0,-1%"
exit /b 0

:askdest
powershell -NoProfile -STA -Command "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.ShowNewFolderButton = $true; $d.Description = 'project-board backup destination'; if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Set-Content -LiteralPath $env:CFG -Value $d.SelectedPath -Encoding Default }"
exit /b 0
