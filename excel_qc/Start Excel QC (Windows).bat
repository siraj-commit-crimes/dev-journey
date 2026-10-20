@echo off
rem Double-click this file to start Excel QC on Windows.
rem The first time, it sets everything up (takes a minute or two).

cd /d "%~dp0.."

if not exist .venv\Scripts\python.exe (
    echo First run: setting up Excel QC...
    python -m venv .venv
    if errorlevel 1 (
        echo Python is not installed. Download it from https://www.python.org/downloads/
        echo When installing, tick "Add python.exe to PATH".
        pause
        exit /b 1
    )
)

rem Install packages the first time, and again whenever requirements.txt changes.
fc /b excel_qc\requirements.txt .venv\installed-requirements.txt >nul 2>&1
if errorlevel 1 (
    echo Installing packages...
    .venv\Scripts\python.exe -m pip install -q -r excel_qc\requirements.txt
    if errorlevel 1 (
        echo Installing packages failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
    copy /y excel_qc\requirements.txt .venv\installed-requirements.txt >nul
)

echo.
echo Excel QC is running in your browser. Close this window to stop it.
.venv\Scripts\python.exe -m streamlit run excel_qc\app.py --server.address localhost --server.showEmailPrompt false --browser.gatherUsageStats false
pause
