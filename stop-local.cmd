@echo off
cd /d "%~dp0"
node scripts\local.mjs --stop
if errorlevel 1 pause
