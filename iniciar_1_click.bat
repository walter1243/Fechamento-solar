@echo off
setlocal EnableExtensions
chcp 65001 >nul

set "NO_BROWSER="
if /I "%~1"=="--no-browser" set "NO_BROWSER=1"

set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

set "APP_DIR=%SCRIPT_DIR%"

set "INDEX_FILE=%APP_DIR%index.html"
set "REQ_FILE=%APP_DIR%requirements.txt"
set "SERVICE_FILE=%APP_DIR%impressora_service.py"
set "VENV_DIR=%APP_DIR%.venv"
set "VENV_DIR_FALLBACK=%LOCALAPPDATA%\FechamentoSolar\.venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"

echo ========================================
echo  FECHAMENTO SOLAR - INICIO 1 CLICK
echo ========================================
echo Pasta: %APP_DIR%
echo.

if not exist "%INDEX_FILE%" goto :err_index
if not exist "%REQ_FILE%" goto :err_requirements
if not exist "%SERVICE_FILE%" goto :err_service

if exist "%VENV_PY%" goto :check_venv_health
if exist "%VENV_DIR_FALLBACK%\Scripts\python.exe" goto :use_fallback_venv
goto :create_venv

:check_venv_health
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 goto :venv_ok
echo Ambiente .venv invalido detectado. Recriando do zero...
rmdir /s /q "%VENV_DIR%" >nul 2>&1

:create_venv
echo [1/5] Criando ambiente Python local (.venv)...
py -3 --version >nul 2>&1
if not errorlevel 1 py -3 -m venv "%VENV_DIR%"
if exist "%VENV_PY%" goto :venv_ok

python --version >nul 2>&1
if not errorlevel 1 python -m venv "%VENV_DIR%"
if exist "%VENV_PY%" goto :venv_ok

echo Nao foi possivel criar .venv na pasta atual. Tentando ambiente em LOCALAPPDATA...
if exist "%VENV_DIR_FALLBACK%" rmdir /s /q "%VENV_DIR_FALLBACK%" >nul 2>&1
if not exist "%LOCALAPPDATA%\FechamentoSolar" mkdir "%LOCALAPPDATA%\FechamentoSolar" >nul 2>&1

py -3 --version >nul 2>&1
if not errorlevel 1 py -3 -m venv "%VENV_DIR_FALLBACK%"
if exist "%VENV_DIR_FALLBACK%\Scripts\python.exe" goto :use_fallback_venv

python --version >nul 2>&1
if not errorlevel 1 python -m venv "%VENV_DIR_FALLBACK%"
if exist "%VENV_DIR_FALLBACK%\Scripts\python.exe" goto :use_fallback_venv

goto :err_python_or_venv

:use_fallback_venv
set "VENV_DIR=%VENV_DIR_FALLBACK%"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
echo Usando ambiente Python em: %VENV_DIR%
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 goto :venv_ok
echo Ambiente alternativo invalido. Recriando...
rmdir /s /q "%VENV_DIR_FALLBACK%" >nul 2>&1
goto :create_venv

:venv_ok
echo [2/5] Instalando dependencias do sistema e da impressora...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade pip >nul 2>&1
"%VENV_PY%" -m pip install --disable-pip-version-check -r "%REQ_FILE%"
if errorlevel 1 goto :err_pip

rem Registra DLLs do pywin32 (necessario na primeira instalacao em cada PC)
if exist "%VENV_DIR%\Scripts\pywin32_postinstall.py" "%VENV_PY%" "%VENV_DIR%\Scripts\pywin32_postinstall.py" -install >nul 2>&1

echo [3/5] Validando modulos de impressao (Win32 + Pillow)...
"%VENV_PY%" -c "import fastapi, uvicorn, win32print; from PIL import Image; win32print.EnumPrinters(2); print('OK_DEPENDENCIAS')" >nul 2>&1
if errorlevel 1 goto :err_imports

echo [4/5] Verificando servico local de impressao...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Uri 'http://127.0.0.1:8000/status_impressora' -Method Get -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 goto :service_ok

start "Servico de Impressao Elgin i9" /D "%APP_DIR%" "%VENV_PY%" "%SERVICE_FILE%"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok = $false; 1..30 | ForEach-Object { try { Invoke-RestMethod -Uri 'http://127.0.0.1:8000/status_impressora' -Method Get -TimeoutSec 1 | Out-Null; $ok = $true; break } catch { Start-Sleep -Seconds 1 } }; if ($ok) { exit 0 } else { exit 1 }"
if errorlevel 1 goto :diag_service
goto :service_ok

:diag_service
echo.
echo ATENCAO: o servico nao respondeu. Rodando em modo diagnostico para mostrar o erro:
echo ----------------------------------------------------------------------
"%VENV_PY%" "%SERVICE_FILE%"
echo ----------------------------------------------------------------------
goto :err_service_start

:service_ok
echo [5/5] Conferindo impressora selecionada...
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/status_impressora' -Method Get -TimeoutSec 2; if ($r.printer) { Write-Output $r.printer } else { Write-Output 'Nao definida' } } catch { Write-Output 'Nao foi possivel consultar' }"`) do set "PRINTER_NAME=%%I"
echo Impressora ativa: %PRINTER_NAME%
echo.

if "%NO_BROWSER%"=="1" goto :success

set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if "%CHROME_EXE%"=="" if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if "%CHROME_EXE%"=="" if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not "%CHROME_EXE%"=="" start "" "%CHROME_EXE%" "%INDEX_FILE%"
if "%CHROME_EXE%"=="" start "" "%INDEX_FILE%"

:success
echo Sistema pronto: impressao e site liberados em 1 click.
exit /b 0

:err_index
echo ERRO: index.html nao encontrado em %INDEX_FILE%
goto :fail

:err_requirements
echo ERRO: requirements.txt nao encontrado em %REQ_FILE%
goto :fail

:err_service
echo ERRO: impressora_service.py nao encontrado em %SERVICE_FILE%
goto :fail

:err_python
echo ERRO: Python nao encontrado no computador.
echo Instale Python 3 e rode novamente.
echo Abrindo pagina oficial de download...
start "" "https://www.python.org/downloads/windows/"
goto :fail

:err_python_or_venv
echo ERRO: Python nao encontrado ou nao foi possivel criar ambiente virtual.
echo Se estiver rodando do pendrive, copie a pasta para o Desktop e tente novamente.
echo Abrindo pagina oficial de download do Python...
start "" "https://www.python.org/downloads/windows/"
goto :fail

:err_venv
echo ERRO: nao foi possivel criar/encontrar o .venv em %VENV_DIR%
goto :fail

:err_pip
echo ERRO: falha ao instalar dependencias do requirements.txt
goto :fail

:err_imports
echo ERRO: dependencias de impressao nao carregaram corretamente (fastapi/uvicorn/win32print/Pillow).
goto :fail

:err_service_start
echo ERRO: servico local nao respondeu em tempo habil (http://127.0.0.1:8000).
goto :fail

:fail
echo.
echo Fechando com erro. Corrija o problema e execute novamente.
pause
exit /b 1