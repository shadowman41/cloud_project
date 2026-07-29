@echo off
chcp 65001 >nul
REM ============================================================
REM   E-MARKET - INITIALISATION RAPIDE (Windows)
REM   Projet académique — 100% local
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   E-MARKET - INSTALLATION LOCALE AUTOMATIQUE
echo ============================================================
echo.

echo [1/5] Vérification Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ERREUR : Node.js n'est pas installe !
    echo Telechargez-le sur https://nodejs.org/ (version 20 LTS)
    pause
    exit /b 1
)
echo       OK - Node version :
node --version
echo.

echo [2/5] Installation dependances backend...
cd backend
call npm install --no-audit --no-fund
if errorlevel 1 (
    echo ERREUR lors de npm install
    pause
    exit /b 1
)
cd ..
echo       OK
echo.

echo [3/5] Installation dependances script init DB...
cd database
call npm install mysql2 dotenv --no-audit --no-fund >nul
cd ..
echo       OK
echo.

echo [4/5] Creation fichier .env (MySQL local via XAMPP par defaut)
if not exist "backend\.env" (
    (
        echo DB_HOST=127.0.0.1
        echo DB_PORT=3306
        echo DB_USER=root
        echo DB_PASSWORD=
        echo DB_NAME=emarket_db
        echo.
        echo JWT_SECRET=projet_academique_sn_2026_abcdefghijklmnopqrstuvwxyz
        echo JWT_EXPIRES_IN=30d
        echo.
        echo PORT=3000
        echo NODE_ENV=development
        echo.
        echo CORS_ORIGIN=*
        echo FREE_SHIPPING_THRESHOLD=15000
        echo DEFAULT_SHIPPING_COST=2000
        echo TVA_RATE=0.18
    ) > backend\.env
    echo       Fichier .env cree !
    echo       (Par defaut: MySQL local root sans mdp. Modifiez backend\.env si besoin)
) else (
    echo       .env existe deja - on garde la config existante
)
echo.

echo [5/5] Initialisation de la base de donnees MySQL...
echo       IMPORTANT : Demarrez MySQL dans XAMPP/WAMP avant d'appuyer sur une touche !
echo       (Creation automatique : emarket_db + tables + donnees exemple)
pause
node database\init-db.js
if errorlevel 1 (
    echo.
    echo ATTENTION : Si l'initialisation a echoue :
    echo   - Verifiez que MySQL tourne bien (port 3306)
    echo   - Verifiez les identifiants dans backend\.env
    echo   - Vous pouvez rejouer : node database\init-db.js
)
echo.

echo ============================================================
echo   ✅ INSTALLATION TERMINEE !
echo ============================================================
echo.
echo   Pour DEMARRER le site :
echo     1) cd backend
echo     2) npm start
echo     3) Ouvrir votre navigateur : http://localhost:3000
echo.
echo   Comptes de test :
echo     Admin  : admin@e-market.sn   / password123
echo     Client : amadou@example.sn   / password123
echo.
pause
