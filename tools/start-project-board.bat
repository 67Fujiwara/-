@echo off
setlocal EnableExtensions
rem ======================================================================
rem  プロジェクト工程ボードを http:// で開く
rem
rem  ファイルを直接開く（file://）と、ブラウザがフォルダ選択を拒むことが
rem  あります。このバッチで開くと通常のページと同じ扱いになり、その制限を
rem  受けません。
rem
rem  使い方
rem    1. このファイルと serve-project-board.mjs を、
rem       project-board.html と同じフォルダに置く
rem    2. ダブルクリックする（ブラウザが開きます）
rem    3. 使い終わったら、この黒い窓を閉じる
rem
rem  Node.js が必要です。
rem ======================================================================

set "DIR=%~dp0"
set "PORT=8787"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js が見つかりません。
  echo https://nodejs.org/ からインストールしてください。
  echo.
  pause
  exit /b 1
)

if not exist "%DIR%project-board.html" (
  echo project-board.html が見つかりません。
  echo このバッチを project-board.html と同じフォルダに置いてください。
  echo.
  pause
  exit /b 1
)

if not exist "%DIR%serve-project-board.mjs" (
  echo serve-project-board.mjs が見つかりません。
  echo このバッチと同じフォルダに置いてください。
  echo.
  pause
  exit /b 1
)

echo ブラウザを開きます。表示されない場合は、次のアドレスを貼り付けてください。
echo     http://127.0.0.1:%PORT%/
echo.
start "" "http://127.0.0.1:%PORT%/"

node "%DIR%serve-project-board.mjs" "%DIR%." %PORT%

echo.
pause
exit /b 0
