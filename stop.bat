@echo off
REM Stops the P5JS Maker server (start.bat or P5JSMaker.exe) on port 38920. Pure ASCII only.
set FOUND=0
for /f "tokens=5" %%P in ('netstat -ano -p tcp ^| findstr ":38920 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%P 1>nul 2>nul && set FOUND=1
)
if "%FOUND%"=="0" (echo [stop] No server on port 38920.) else (echo [stop] Server stopped.)
timeout /t 2 1>nul
