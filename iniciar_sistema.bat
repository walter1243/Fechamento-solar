@echo off
chcp 65001 > nul
cls
echo ========================================
echo   INICIANDO SISTEMA DE IMPRESSAO
echo   Fechamento Solar
echo ========================================
echo.

REM Obter o diretório do script
cd /d "%~dp0"

echo [1/3] Iniciando serviço de impressão Python...
echo.

REM Verificar se Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python não encontrado!
    echo Instale Python em: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Iniciar o serviço de impressão em uma nova janela
start "Serviço de Impressão Elgin i9" python impressora_service.py

echo [✓] Serviço de impressão iniciado
echo.
echo [2/3] Aguardando serviço ficar pronto...
timeout /t 2 /nobreak

echo.
echo [3/3] Abrindo navegador...
echo.

REM Abrir o site no Chrome
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "file:///C:/Users/USER/Documents/app fechamento/index.html"

REM Se Chrome não existir, tentar Edge
if errorlevel 1 (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "file:///C:/Users/USER/Documents/app fechamento/index.html"
)

REM Se Edge não existir, abrir no navegador padrão
if errorlevel 1 (
    start "file:///C:/Users/USER/Documents/app fechamento/index.html"
)

echo.
echo ========================================
echo   SISTEMA INICIADO COM SUCESSO!
echo ========================================
echo.
echo O serviço de impressão está rodando
echo O navegador vai abrir em alguns segundos
echo.
echo DICA: Deixe a janela do serviço aberta
echo       enquanto estiver usando o sistema
echo.
pause
