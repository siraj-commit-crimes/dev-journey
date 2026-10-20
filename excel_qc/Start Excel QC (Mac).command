#!/bin/bash
# Double-click this file to start Excel QC on a Mac.
# The first time, it sets everything up (takes a minute or two).

cd "$(dirname "$0")/.." || exit 1

pause_and_exit() {
    echo
    read -r -p "Press Enter to close this window."
    exit 1
}

if [ ! -x .venv/bin/python ]; then
    echo "First run: setting up Excel QC..."
    python3 -m venv .venv || {
        echo "Python 3 is not installed. Download it from https://www.python.org/downloads/"
        pause_and_exit
    }
fi

# Install packages the first time, and again whenever requirements.txt changes.
if ! cmp -s excel_qc/requirements.txt .venv/installed-requirements.txt; then
    echo "Installing packages..."
    .venv/bin/pip install -q -r excel_qc/requirements.txt || {
        echo "Installing packages failed. Check your internet connection and try again."
        pause_and_exit
    }
    cp excel_qc/requirements.txt .venv/installed-requirements.txt
fi

echo
echo "Excel QC is running in your browser. Close this window to stop it."
.venv/bin/streamlit run excel_qc/app.py \
    --server.address localhost \
    --server.showEmailPrompt false \
    --browser.gatherUsageStats false
