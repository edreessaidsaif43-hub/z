@echo off
setlocal
cd /d "%~dp0"
echo Starting Enjazy Portfolio server on http://localhost:8000
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1" -Port 8000
