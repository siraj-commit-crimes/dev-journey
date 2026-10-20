@echo off
rem Double-click once to put an "Excel QC" shortcut on your desktop and in the Start menu.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"
if errorlevel 1 (
    echo.
    echo Something went wrong. Send a screenshot of this window.
) else (
    echo.
    echo Done! Double-click "Excel QC" on your desktop, or press the Windows key and type Excel QC.
)
echo.
pause
