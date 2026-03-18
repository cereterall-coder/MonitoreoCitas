@echo off
title Estadisticas Citas - Servidor de Desarrollo
color 0A

echo.
echo  =========================================
echo   Estadisticas Citas - Iniciando app...
echo  =========================================
echo.

:: Ir al directorio donde se encuentra este bat
cd /d "%~dp0"

:: Verificar si node_modules existe
if not exist "node_modules" (
    echo  [!] node_modules no encontrado. Instalando dependencias...
    echo.
    npm install
    if errorlevel 1 (
        echo.
        echo  [ERROR] Fallo al instalar dependencias.
        pause
        exit /b 1
    )
    echo.
)

echo  [OK] Iniciando servidor de desarrollo...
echo  [OK] La app se abrira en: http://localhost:5173
echo.
echo  Presiona Ctrl+C para detener el servidor.
echo.

:: Abrir navegador con un pequeño retraso para que el servidor arranque
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

:: Iniciar el servidor de desarrollo
npm run dev

echo.
pause
