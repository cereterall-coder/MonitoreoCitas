@echo off
title Robot EsSalud - Panel de Control
echo ==========================================
echo    INICIANDO ROBOT ESSALUD AUTONOMO
echo ==========================================
echo.
echo Presione cualquier tecla para abrir el menu de reportes...
pause > nul
node index.js
echo.
echo ==========================================
echo    PROCESO FINALIZADO O CERRADO
echo ==========================================
pause
