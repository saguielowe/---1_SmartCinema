@echo off
setlocal EnableExtensions

set "SMARTCINEMA_STARTER=%~dp0scripts\start-preview.ps1"
if not exist "%SMARTCINEMA_STARTER%" (
  echo [SmartCinema] scripts\start-preview.ps1 was not found.
  echo [SmartCinema] Keep this launcher in the SmartCinema project root.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SMARTCINEMA_STARTER%"

if errorlevel 1 (
  echo.
  echo [SmartCinema] Preview startup failed. See the message above.
  pause
  exit /b 1
)

endlocal
