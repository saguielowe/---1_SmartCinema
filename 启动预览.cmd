@echo off
setlocal
set "SMARTCINEMA_SOURCE=%~dp003_源码"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue; if (-not $listener) { $python = (Get-Command python -ErrorAction Stop).Source; Start-Process -FilePath $python -ArgumentList '-m','http.server','8080','--bind','127.0.0.1' -WorkingDirectory $env:SMARTCINEMA_SOURCE -WindowStyle Hidden }"

timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:8080/index.html"
endlocal
