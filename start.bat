@echo off
REM P5JS Maker launcher (source mode, needs Python 3). Pure ASCII only.
cd /d "%~dp0"
where python 1>nul 2>nul
if errorlevel 1 (
    echo [error] Python not found in PATH. Use dist/P5JSMaker.exe or install Python 3.
    pause
    exit /b 1
)
echo [start] http://127.0.0.1:38920/index.html
echo [start] Close this window or press Ctrl+C to stop.
python tools/serve.py --open
if errorlevel 1 pause
