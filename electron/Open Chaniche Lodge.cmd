@echo off
setlocal
cd /d "%~dp0"
if not exist "Chaniche Lodge.exe" (
  echo Please right-click the downloaded ZIP and choose Extract All first.
  echo Open this file from the extracted Chaniche Lodge folder.
  pause
  exit /b 1
)
echo Opening Chaniche Lodge. Keep this window open until the lodge window appears.
"%~dp0Chaniche Lodge.exe" --disable-gpu --enable-logging --log-file="%~dp0Chaniche-startup.log"
echo.
echo If the lodge window did not open, send Chaniche-startup.log with your report.
echo If that file is missing, send a photo of any Windows message you see.
pause