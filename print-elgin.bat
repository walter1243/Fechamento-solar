@echo off
setlocal

set "PRINTER_NAME=Elgin i9"
set "FILE_PATH=%~1"

if "%FILE_PATH%"=="" (
  set "FILE_PATH=%~dp0cupom-elgin.txt"
)

if not exist "%FILE_PATH%" (
  echo Arquivo do cupom nao encontrado: "%FILE_PATH%"
  echo Gere o cupom no sistema antes de imprimir.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\print-elgin.ps1" -PrinterName "%PRINTER_NAME%" -FilePath "%FILE_PATH%"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" (
  echo Falha na impressao RAW ESC/POS. Codigo: %ERR%
  pause
  exit /b %ERR%
)

echo Cupom enviado para a impressora "%PRINTER_NAME%" com comando de corte.
exit /b 0
