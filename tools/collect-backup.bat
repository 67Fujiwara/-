@echo off
setlocal
rem ======================================================================
rem  プロジェクト工程ボード : バックアップ収集
rem
rem  使い方
rem    1. このファイルを「バックアップを集めたいフォルダ」に置く
rem       （例：ダイレクトクラウドの project-board\バックアップ）
rem    2. ダブルクリックする
rem
rem  ダウンロードフォルダにある project-board_*.json のうち、
rem  まだ無いものと新しいものだけを、このファイルがあるフォルダへコピーします。
rem  コピー先のパスを書く必要はありません（置いた場所が保存先になります）。
rem ======================================================================

set "SRC=%USERPROFILE%\Downloads"
set "DEST=%~dp0"

echo コピー元 : %SRC%
echo コピー先 : %DEST%
echo.

robocopy "%SRC%" "%DEST%." project-board_*.json /XO /NJH /NJS /NDL /NP
set RC=%ERRORLEVEL%

echo.
if %RC% GEQ 8 (
  echo コピーに失敗しました。robocopy の終了コード : %RC%
  echo コピー元フォルダとコピー先フォルダを確認してください。
) else if %RC% EQU 0 (
  echo 新しいバックアップはありませんでした。すでに最新です。
) else (
  echo コピーが完了しました。
)

echo.
pause
exit /b 0
