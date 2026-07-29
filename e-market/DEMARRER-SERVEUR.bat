@echo off
chcp 65001 >nul
REM ============================================================
REM   E-MARKET - DEMARRER LE SERVEUR (Windows)
REM ============================================================

cd /d "%~dp0backend"

echo.
echo   🚀 Démarrage du serveur E-Market...
echo.
echo      Frontend : http://localhost:3000
echo      API      : http://localhost:3000/api/health
echo      Stats    : http://localhost:3000/api/stats
echo.
echo      (Appuyez sur Ctrl+C pour arrêter)
echo.

npm start
