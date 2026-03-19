@echo off
:: ============================================================
:: consolidar-todo.bat
:: Re-procesa TODOS los meses desde cero (toma mas tiempo)
:: Usar cuando hay cambios en datos historicos
:: ============================================================
title Consolidacion COMPLETA de Citas

echo.
echo ========================================
echo  CONSOLIDACION COMPLETA (todos los meses)
echo ========================================
echo.
echo  ADVERTENCIA: Esto re-procesara todos los meses.
echo  Puede tomar varios minutos segun el volumen de datos.
echo.
pause

node "%~dp0consolidate-monthly.js" --all

echo.
echo Presiona cualquier tecla para cerrar...
pause > nul
