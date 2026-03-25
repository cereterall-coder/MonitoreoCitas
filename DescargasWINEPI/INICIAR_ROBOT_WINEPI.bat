@echo off
cd /d "%~dp0"
title ROBOT WINEPI
echo Lanzando Robot...
node index.js
if %errorlevel% neq 0 (
    echo.
    echo El robot se detuvo con error: %errorlevel%
)
pause
