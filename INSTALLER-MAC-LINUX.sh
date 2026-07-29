#!/bin/bash
# ============================================================
#   E-MARKET - INSTALLATION RAPIDE (Mac / Linux)
#   Projet académique - 100% local
# ============================================================

set -e
cd "$(dirname "$0")"

echo ""
echo "============================================================"
echo "  E-MARKET - INSTALLATION LOCALE AUTOMATIQUE"
echo "============================================================"
echo ""

echo "[1/5] Vérification Node.js..."
if ! command -v node &> /dev/null; then
    echo "ERREUR : Node.js non installé"
    echo "→ Mac : brew install node@20"
    echo "→ Linux (Deb/Ubuntu) : curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs"
    exit 1
fi
echo "       OK - $(node --version)"
echo ""

echo "[2/5] Dépendances backend..."
cd backend
npm install --no-audit --no-fund
cd ..
echo "       OK"
echo ""

echo "[3/5] Dépendances init DB..."
cd database
npm install mysql2 dotenv --no-audit --no-fund >/dev/null
cd ..
echo "       OK"
echo ""

echo "[4/5] Fichier .env (MySQL local root par défaut)"
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << 'EOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=emarket_db

JWT_SECRET=projet_academique_sn_2026_abcdefghijklmnopqrstuvwxyz
JWT_EXPIRES_IN=30d

PORT=3000
NODE_ENV=development

CORS_ORIGIN=*
FREE_SHIPPING_THRESHOLD=15000
DEFAULT_SHIPPING_COST=2000
TVA_RATE=0.18
EOF
    echo "       Créé (modifiez backend/.env si identifiants différents)"
else
    echo "       .env existe déjà - conservé"
fi
echo ""

echo "[5/5] Initialisation BDD (MySQL local)... "
echo "⚠️  Démarrez MySQL (MAMP/LAMP/Docker) avant de continuer !"
read -p "Appuyez sur Entrée pour lancer l'initialisation..." _
node database/init-db.js || echo "(Si échec, vérifiez MySQL et rejouez: node database/init-db.js)"

echo ""
echo "============================================================"
echo "  ✅ INSTALLATION TERMINÉE !"
echo "============================================================"
echo ""
echo "  Démarrer : "
echo "     cd backend && npm start"
echo "     → http://localhost:3000"
echo ""
echo "  Comptes :"
echo "     Admin   : admin@e-market.sn / password123"
echo "     Client  : amadou@example.sn / password123"
echo ""
