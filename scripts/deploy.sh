#!/bin/bash
# ============================================================
#  E-MARKET : Script de déploiement automatique (EC2 Amazon Linux 2023)
#  Usage (sur EC2, en SSH) :
#    cd /var/www/e-market && ./scripts/deploy.sh
# ============================================================
#  Ce script fait tout automatiquement après un "git push" :
#    1. Git pull origin main
#    2. Met à jour les permissions (Apache)
#    3. Réinstalle dépendances Node (si besoin)
#    4. Relance PM2 (0 downtime si possible)
#    5. Recharge Apache
#    6. Teste l'endpoint /api/health
# ============================================================

set -e
START=$(date +%s)
CYAN="\033[0;36m"
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

PROJECT_DIR="/var/www/e-market"
PM2_NAME="e-market"
BACKEND_DIR="$PROJECT_DIR/backend"

# Aller dans le bon dossier
cd "$PROJECT_DIR"

echo ""
echo -e "  🚀 E-MARKET DÉPLOIEMENT AUTO (GitHub → EC2)"
echo "  ────────────────────────────────────────────"
echo ""

# ─────────────────────────────────────────────
# 1) GIT PULL
# ─────────────────────────────────────────────
echo -e "  [1/6]${CYAN} Git pull origin main...${NC}"
if git branch --show-current | grep -q "main"; then
    git pull origin main
elif git branch --show-current | grep -q "master"; then
    git pull origin master
else
    git pull
fi
echo -e "       ${GREEN}OK — code mis à jour.${NC}"
echo ""

# ─────────────────────────────────────────────
# 2) PERMISSIONS APACHE
# ─────────────────────────────────────────────
echo -e "  [2/6]${CYAN} Permissions Apache (ec2-user:apache)...${NC}"
sudo chgrp -R apache "$PROJECT_DIR"
sudo chmod -R g+rwX  "$PROJECT_DIR"
sudo restorecon -R "$PROJECT_DIR" 2>/dev/null || true
echo -e "       ${GREEN}OK${NC}"
echo ""

# ─────────────────────────────────────────────
# 3) DÉPENDANCES BACKEND
# ─────────────────────────────────────────────
echo -e "  [3/6]${CYAN} Installation dépendances backend ($BACKEND_DIR)...${NC}"
cd "$BACKEND_DIR"
npm install --omit=dev --prefer-offline --no-audit --no-fund 2>&1 | tail -n 3
cd "$PROJECT_DIR"
echo -e "       ${GREEN}OK${NC}"
echo ""

# ─────────────────────────────────────────────
# 4) RESTART PM2
# ─────────────────────────────────────────────
echo -e "  [4/6]${CYAN} Relance PM2 (process Node)...${NC}"
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    pm2 reload "$PM2_NAME" --update-env > /dev/null
    echo -e "       ${GREEN}OK — reload (0 downtime).${NC}"
else
    echo -e "       ${YELLOW}Process inexistant, on démarre pour la première fois.${NC}"
    pm2 start "$BACKEND_DIR/server.js" --name "$PM2_NAME"
    pm2 save
fi
echo ""

# ─────────────────────────────────────────────
# 5) RELOAD APACHE
# ─────────────────────────────────────────────
echo -e "  [5/6]${CYAN} Test config Apache + reload...${NC}"
if sudo httpd -t >/dev/null 2>&1; then
    sudo systemctl reload httpd
    echo -e "       ${GREEN}OK — Apache rechargé.${NC}"
else
    echo -e "       ${RED}⚠️  ERREUR DANS LA CONFIG APACHE${NC}"
    sudo httpd -t
    exit 1
fi
echo ""

# ─────────────────────────────────────────────
# 6) SANITY CHECK : /api/health
# ─────────────────────────────────────────────
echo -e "  [6/6]${CYAN} Vérification endpoint /api/health...${NC}"
sleep 2
HEALTH=$(curl -s --max-time 8 http://127.0.0.1:3000/api/health || echo "FAIL")
if echo "$HEALTH" | grep -q "status.*ok"; then
    DB_STATUS=$(echo "$HEALTH" | grep -o '"database":"[^"]*"' | cut -d: -f2 | tr -d '"')
    echo -e "       ${GREEN}✅ API OK — statut BDD : ${DB_STATUS}${NC}"
else
    echo -e "       ${RED}⚠️  Erreur /api/health. Voir logs: pm2 logs e-market --lines 30${NC}"
    echo "       Réponse: $HEALTH"
fi

END=$(date +%s)
DURATION=$((END - START))
echo ""
echo "  ────────────────────────────────────────────"
echo -e "  ${GREEN}✅ Déploiement terminé en ${DURATION}s${NC}"
echo ""
echo "  Prochaines étapes :"
echo "    • Ouvrir : http://$(curl -s ifconfig.me 2>/dev/null || echo IP_PUBLIQUE_EC2)"
echo "    • Logs   : pm2 logs e-market --lines 50"
echo "    • Commit : git log --oneline -3"
echo ""
