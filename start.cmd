@echo off
cd /d "%~dp0"
echo Encore Calendar - http://127.0.0.1:4173
echo Keep this window open for automatic updates. Press Ctrl+C to stop.
node server.mjs
pause
