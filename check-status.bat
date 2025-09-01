@echo off
echo ========================================
echo    Sistema de Mensageria - Status
echo ========================================
echo.

echo [INFO] Verificando status do servidor...
echo.

REM Verificar se o servidor está rodando
netstat -an | findstr :3001 >nul
if %errorlevel% equ 0 (
    echo [OK] Servidor rodando na porta 3001
    echo.
    echo [INFO] URLs de acesso:
    echo   Local: http://localhost:3001
    echo   Rede: http://192.168.1.64:3001
    echo.
    echo [INFO] Para acessar de outros dispositivos:
    echo   1. Certifique-se de que estao na mesma rede WiFi
    echo   2. Abra o navegador
    echo   3. Digite: http://192.168.1.64:3001
    echo.
) else (
    echo [ERRO] Servidor nao esta rodando!
    echo.
    echo [INFO] Para iniciar o servidor:
    echo   npm run dev:server
    echo.
)

echo ========================================
pause
