@echo off
:: ============================================================
:: actualizar-mes-actual.bat
:: Consolida SOLO el mes actual y meses futuros
:: (los meses pasados ya consolidados se omiten)
:: ============================================================
title Consolidacion de Citas - Mes Actual y Futuros

echo.
echo ========================================
echo  ACTUALIZACION: Mes Actual + Futuros
echo ========================================
echo.

node "%~dp0consolidate-monthly.cjs"

echo.
echo Presiona cualquier tecla para cerrar...
pause > nul
