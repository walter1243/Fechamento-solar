@echo off
setlocal EnableExtensions
chcp 65001 >nul

cd /d "%~dp0"
set "APP_DIR=%~dp0"

REM Se executado fora da pasta do projeto (ex.: Desktop), procura a pasta correta.
if exist "%APP_DIR%index.html" if exist "%APP_DIR%iniciar_executavel.py" goto :app_dir_ok

echo Pasta atual nao contem o projeto. Procurando "app fechamento"...
for %%D in (
    "%USERPROFILE%\Documents\app fechamento\"
    "%USERPROFILE%\Desktop\app fechamento\"
    "%USERPROFILE%\Desktop\PENDRIVE_FechamentoSolar\"
    "%USERPROFILE%\OneDrive\Documents\app fechamento\"
    "%USERPROFILE%\OneDrive\Desktop\app fechamento\"
    "D:\app fechamento\"
    "E:\app fechamento\"
    "F:\app fechamento\"
    "G:\app fechamento\"
    "H:\app fechamento\"
) do (
    if exist "%%~D\index.html" if exist "%%~D\iniciar_executavel.py" (
        set "APP_DIR=%%~D"
        goto :app_dir_found
    )
)

echo ERRO: nao foi possivel localizar a pasta do projeto "app fechamento".
echo Coloque este .bat dentro da pasta do projeto ou clone/copie o projeto para o Desktop ou Documents.
pause
exit /b 1

:app_dir_found
echo Projeto localizado em: %APP_DIR%
cd /d "%APP_DIR%"

:app_dir_ok
set "REQ_FILE=%APP_DIR%requirements.txt"
set "SERVICE_FILE=%APP_DIR%impressora_service.py"
set "ENTRY_FILE=%APP_DIR%iniciar_executavel.py"
set "INDEX_FILE=%APP_DIR%index.html"
set "VENV_DIR=%APP_DIR%.venv"
set "VENV_DIR_FALLBACK=%LOCALAPPDATA%\FechamentoSolar\.venv"
set "VENV_PY=%VENV_DIR%\Scripts\python.exe"
set "EXE_NAME=IniciarFechamentoSolar"
set "DIST_DIR=%APP_DIR%dist"
set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "DESKTOP_APP=%DESKTOP_DIR%\app fechamento"

echo ========================================
echo  INSTALAR DEPENDENCIAS + GERAR EXECUTAVEL
echo  FECHAMENTO SOLAR
echo ========================================
echo Pasta origem: %APP_DIR%
echo.

if not exist "%INDEX_FILE%" goto :err_index
if not exist "%REQ_FILE%" goto :err_requirements
if not exist "%ENTRY_FILE%" goto :err_entry
if not exist "%SERVICE_FILE%" goto :err_service

REM ------------------------------------------------------------
REM [1/6] Criar / validar .venv
REM ------------------------------------------------------------
if exist "%VENV_PY%" goto :check_venv_health
goto :create_venv

:check_venv_health
"%VENV_PY%" -m pip --version >nul 2>&1
if not errorlevel 1 goto :venv_ok
echo Ambiente .venv invalido detectado. Recriando do zero...
rmdir /s /q "%VENV_DIR%" >nul 2>&1

:create_venv
echo [1/6] Criando ambiente Python local (.venv)...
py -3 --version >nul 2>&1
if not errorlevel 1 py -3 -m venv "%VENV_DIR%"
if exist "%VENV_PY%" goto :venv_ok

python --version >nul 2>&1
if not errorlevel 1 python -m venv "%VENV_DIR%"
if exist "%VENV_PY%" goto :venv_ok

echo Nao foi possivel criar .venv na pasta atual. Tentando em LOCALAPPDATA...
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

:venv_ok
REM ------------------------------------------------------------
REM [2/6] Instalar dependencias do requirements.txt
REM ------------------------------------------------------------
echo [2/6] Instalando dependencias do sistema e da impressora...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade pip
"%VENV_PY%" -m pip install --disable-pip-version-check -r "%REQ_FILE%"
if errorlevel 1 goto :err_pip

REM Registra DLLs do pywin32 (necessario na primeira instalacao em cada PC)
if exist "%VENV_DIR%\Scripts\pywin32_postinstall.py" "%VENV_PY%" "%VENV_DIR%\Scripts\pywin32_postinstall.py" -install >nul 2>&1

REM ------------------------------------------------------------
REM [3/6] Instalar PyInstaller
REM ------------------------------------------------------------
echo [3/6] Instalando/atualizando PyInstaller...
"%VENV_PY%" -m pip install --disable-pip-version-check --upgrade pyinstaller
if errorlevel 1 goto :err_pyinstaller

REM ------------------------------------------------------------
REM [4/6] Validar modulos de impressao
REM ------------------------------------------------------------
echo [4/6] Validando modulos (fastapi, uvicorn, win32print, Pillow)...
"%VENV_PY%" -c "import fastapi, uvicorn, win32print; from PIL import Image; win32print.EnumPrinters(2); print('OK_DEPENDENCIAS')"
if errorlevel 1 goto :err_imports

REM ------------------------------------------------------------
REM [5/6] Gerar executavel via PyInstaller
REM ------------------------------------------------------------
echo [5/6] Gerando executavel %EXE_NAME%.exe...
if exist "%DIST_DIR%\%EXE_NAME%.exe" del /q "%DIST_DIR%\%EXE_NAME%.exe" >nul 2>&1
"%VENV_PY%" -m PyInstaller --noconfirm --clean --onefile --name %EXE_NAME% --hidden-import win32print --hidden-import win32api --hidden-import PIL --collect-submodules fastapi --collect-submodules uvicorn "%ENTRY_FILE%"
if errorlevel 1 goto :err_pyinstaller_build
if not exist "%DIST_DIR%\%EXE_NAME%.exe" goto :err_pyinstaller_build

REM ------------------------------------------------------------
REM [6/6] Copiar arquivos para a Area de Trabalho
REM ------------------------------------------------------------
echo [6/6] Copiando aplicacao e executavel para a Area de Trabalho...
if not exist "%DESKTOP_APP%" mkdir "%DESKTOP_APP%" >nul 2>&1
robocopy "%APP_DIR%." "%DESKTOP_APP%" /E /R:1 /W:1 /NFL /NDL /NJH /NJS /NP /XD ".git" "build" "dist" "__pycache__" ".venv" >nul
if errorlevel 8 goto :err_copy

copy /Y "%DIST_DIR%\%EXE_NAME%.exe" "%DESKTOP_DIR%\%EXE_NAME%.exe" >nul
copy /Y "%DIST_DIR%\%EXE_NAME%.exe" "%DESKTOP_APP%\%EXE_NAME%.exe" >nul

echo.
echo ========================================
echo  INSTALACAO E BUILD CONCLUIDOS
echo ========================================
echo Executavel: %DESKTOP_DIR%\%EXE_NAME%.exe
echo Pasta app:  %DESKTOP_APP%
echo.
echo Para iniciar: clique duas vezes em %EXE_NAME%.exe no Desktop.
echo.
pause
exit /b 0

:err_index
echo ERRO: index.html nao encontrado em %INDEX_FILE%
goto :fail
:err_requirements
echo ERRO: requirements.txt nao encontrado em %REQ_FILE%
goto :fail
:err_entry
echo ERRO: iniciar_executavel.py nao encontrado em %ENTRY_FILE%
goto :fail
:err_service
echo ERRO: impressora_service.py nao encontrado em %SERVICE_FILE%
goto :fail
:err_python_or_venv
echo ERRO: Python 3 nao encontrado ou nao foi possivel criar .venv.
echo Instale o Python 3 marcando "Add Python to PATH" e rode novamente.
start "" "https://www.python.org/downloads/windows/"
goto :fail
:err_pip
echo ERRO: falha ao instalar dependencias do requirements.txt
goto :fail
:err_pyinstaller
echo ERRO: falha ao instalar/atualizar o PyInstaller.
goto :fail
:err_imports
echo ERRO: dependencias de impressao nao carregaram (fastapi/uvicorn/win32print/Pillow).
goto :fail
:err_pyinstaller_build
echo ERRO: PyInstaller nao gerou o executavel esperado em %DIST_DIR%\%EXE_NAME%.exe
goto :fail
:err_copy
echo ERRO: falha ao copiar arquivos para o Desktop.
goto :fail

:fail
echo.
echo Fechando com erro. Veja a mensagem acima e tente novamente.
pause
exit /b 1
