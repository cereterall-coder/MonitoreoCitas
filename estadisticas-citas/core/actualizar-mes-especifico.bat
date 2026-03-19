@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: actualizar-mes-especifico.bat
:: Permite actualizar un mes individualmente
:: ============================================================
title Actualizar Mes Especifico - Monitoreo de Citas

echo.
echo ========================================
echo   ACTUALIZACION DE MES ESPECIFICO
echo ========================================
echo.
echo Ejemplo de formato: 2026-03 o 2025-12
echo.
set /p targetMonth="Ingrese el periodo a actualizar (YYYY-MM): "

if "%targetMonth%"=="" (
    echo Error: No se ingreso ningun mes.
    pause
    exit /b
)

echo.
echo Re-procesando el mes %targetMonth%...
echo.

node "%~dp0consolidate-monthly.cjs" --month %targetMonth%

if errorlevel 1 (
    echo.
    echo [ERROR] No se pudo procesar el mes %targetMonth%. 
    echo Verifique que exista la carpeta en bot-essalud\descargas\
) else (
    echo.
    echo [OK] Mes %targetMonth% actualizado correctamente.
)

echo.
echo Presiona cualquier tecla para cerrar...
pause > nul
