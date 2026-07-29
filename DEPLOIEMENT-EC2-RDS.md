# ╔══════════════════════════════════════════════════════════════╗
# ║     GUIDE SIMPLIFIÉ E-MARKET — PROJET ACADÉMIQUE             ║
# ║  EC2 Amazon Linux 2023 + Apache + RDS MySQL (FACILE)         ║
# ╚══════════════════════════════════════════════════════════════╝

ℹ️  Contexte : Ce guide est VOLONTAIREMENT SIMPLIFIÉ pour un projet
    universitaire. On désactive certaines contraintes de sécurité
    (ex: RDS publique) pour rendre la mise en place RAPIDE et SANS
    BLOCAGE. N'utilisez pas ça en production réelle.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🎯 PLAN EN 3 NIVEAUX (AU CHOIX)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Niveau | Description | Temps estimé | Sans AWS ? |
|---|---|---|---|
| ⭐ **NIV 1** | **100% LOCAL** (XAMPP + Node) | 5 min | ✅ OUI |
| ⭐⭐ **NIV 2** | **EC2 uniquement** (SQLite interne) | 10 min | ❌ EC2 seul |
| ⭐⭐⭐ **NIV 3** | **EC2 + RDS MySQL** (L'architecture demandée) | 20-30 min | ❌ AWS |

Choisissez le niveau qui correspond à votre besoin. Le NIV 1 est
PARFAIT pour **démontrer** rapidement en TD, le NIV 3 est
**l'architecture officielle demandée (EC2 + RDS)**.

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⭐ NIVEAU 1 — TESTER LOCALEMENT EN 5 MINUTES (SANS AWS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Idéal pour **présentation rapide**, **debug**, ou si vous n'avez
   pas (encore) configuré AWS. On utilise une base SQLite qui ne
   nécessite AUCUNE installation MySQL.

### Option A — Version express (SQLite temporaire, 0 config)

```bash
# 1. Allez dans le dossier du projet
cd D:\Gestion des projets\e-market\e-market

# 2. Installez dépendances backend
cd backend
npm install

# 3. Démarrez
npm start
```

🎉 Ouvrez **http://localhost:3000** → le site fonctionne !

(Avec cette méthode, pas besoin de MySQL — Express utilise
une base SQL locale automatique pour les tests.)

---

### Option B — Avec MySQL local (XAMPP / WAMP / MAMP — ressemble RDS)

1. **Installer XAMPP** (apachefriends.org) → démarrer MySQL + Apache
2. Dans phpMyAdmin (`http://localhost/phpmyadmin`) :
   - Créer base : `emarket_db` (interclassement `utf8mb4_unicode_ci`)
   - Créer utilisateur : `admin` / mot de passe : `admin123`
3. Ouvrir PowerShell dans le dossier projet :
   ```bash
   cd backend
   # Créer fichier .env :
   @"
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=emarket_db
   JWT_SECRET=projet_academique_2026_super_cle
   JWT_EXPIRES_IN=30d
   PORT=3000
   NODE_ENV=development
   "@ | Out-File .env -Encoding ASCII
   ```
4. Initialiser la base :
   ```bash
   cd ..\database
   npm install mysql2 dotenv
   cd ..
   node database/init-db.js
   ```
5. Démarrer :
   ```bash
   cd backend
   npm start
   ```
→ http://localhost:3000

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ⭐⭐ NIVEAU 3 — EC2 + RDS MySQL (ARCHITECTURE DEMANDÉE)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Étape 1 : Créer RDS MySQL (3 min — VERSION SIMPLIFIÉE)

Dans AWS → RDS → **Create database** :
- Méthode : **Easy Create** (plus rapide)
- Engine       : **MySQL**
- DB instance size : **Free tier** (db.t3.micro)
- DB identifier : `emarket-db`
- Master username : `admin`
- Master password : `Admin1234!` (on garde simple pour projet — ⚠️ pas en prod)
- ✅ **Public access** : OUI (✅ IMPORTANT — plus simple, pas de problème SG)
- VPC security group : Créer nouveau → Nom : `emarket-rds-sg`
- → Create database

**Attendre Available (5-10 min)**, puis copier l'**Endpoint** :
Exemple : `emarket-db.xxxxx.eu-west-3.rds.amazonaws.com`

**⚠️ Configurer Security Group RDS (TRÈS IMPORTANT)** :
Cliquer sur `emarket-rds-sg` → Inbound rules → Edit :
- Ajouter règle :
  - Type : **MySQL/Aurora**
  - Source : **Anywhere-IPv4** (`0.0.0.0/0`)
- Save rules

💡 Pour le projet académique c'est acceptable et ça évite
   tous les problèmes de connexion entre EC2 et RDS.

---

### Étape 2 : Créer EC2 Amazon Linux 2023 (2 min)

EC2 → Launch instances :
- Name : `e-market-ec2`
- AMI : **Amazon Linux 2023**
- Type : `t2.micro` (Free tier)
- Key pair : Créer `emarket-key` → télécharger `.pem`
- Network settings :
  ✅ Allow SSH
  ✅ Allow HTTP
  ✅ Allow HTTPS
  ✅ Allow ICMP (ping optionnel)
- Storage : 20-30 GB
- Advanced → User data (coller CE SCRIPT QUI INSTALLE TOUT AUTO) :

```bash
#!/bin/bash
# ─────────────────────────────────────────────
# E-MARKET INSTALL AUTO — UNIVERSITAIRE
# Amazon Linux 2023 + Apache + Node 20 + PM2
# ─────────────────────────────────────────────
set +e
dnf update -y
dnf upgrade -y
dnf install -y git curl nano firewalld mariadb105 httpd httpd-tools mod_ssl
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# Node 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
npm install -g pm2

# Apache
systemctl enable --now httpd
setsebool -P httpd_can_network_connect 1
setsebool -P httpd_can_network_relay 1
mv /etc/httpd/conf.d/welcome.conf /etc/httpd/conf.d/welcome.conf.disabled 2>/dev/null

# Dossier projet
mkdir -p /var/www
chown ec2-user:apache /var/www
chmod 775 /var/www

echo "OK BOOTSTRAP TERMINE $(date)" > /root/bootstrap.log
```

→ Launch instance. Attendre `Running`.

**Noter l'IP publique** : Ex. `13.37.42.123`

---

### Étape 3 : Connecter EC2 + Uploader code (Windows PowerShell)

```powershell
# 1) Dans votre dossier Downloads où est emarket-key.pem
cd C:\Users\Vous\Downloads
icacls.exe .\emarket-key.pem /inheritance:r
icacls.exe .\emarket-key.pem /grant:r "$env:USERNAME:(R)"

# 2) Upload du dossier projet (dossier source : adaptez chemin)
cd "D:\Gestion des projets\e-market\e-market"
scp -i "C:\Users\Vous\Downloads\emarket-key.pem" -r .\ ec2-user@13.37.42.123:/tmp/e-market

# 3) Connexion SSH + déplacer dans le bon dossier
ssh -i "C:\Users\Vous\Downloads\emarket-key.pem" ec2-user@13.37.42.123
```

Une fois en SSH :
```bash
sudo mkdir -p /var/www/e-market
sudo mv /tmp/e-market/* /var/www/e-market/ 2>/dev/null
sudo mv /tmp/e-market/.gitignore /var/www/e-market/ 2>/dev/null
sudo chown -R ec2-user:apache /var/www/e-market
sudo chmod -R 775 /var/www/e-market
cd /var/www/e-market
ls    # → doit afficher index.html, backend/, database/, etc.
```

---

### Étape 4 : Configurer .env + Initialiser base RDS

Toujours en SSH :
```bash
cd /var/www/e-market

# ── Créer .env automatique ──────────────────────────
# ⚠️ REMPLACEZ DB_HOST PAR VOTRE ENDPOINT RDS :
cat > backend/.env << 'EOF'
DB_HOST=emarket-db.xxxxx.eu-west-3.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=Admin1234!
DB_NAME=emarket_db

JWT_SECRET=projet_academique_2026_jbnfd78df4sdfs564fds4f65sd
JWT_EXPIRES_IN=30d

PORT=3000
NODE_ENV=production

CORS_ORIGIN=*
FREE_SHIPPING_THRESHOLD=15000
DEFAULT_SHIPPING_COST=2000
TVA_RATE=0.18
EOF

# ── Vérifier connexion RDS (optionnel, rassurant) ────
mysql -h $(grep DB_HOST backend/.env | cut -d= -f2) \
      -u admin -pAdmin1234! -e "SHOW DATABASES;"
# → doit afficher emarket_db, information_schema, etc.

# ── Installer Node + Init base ──────────────────────
cd backend
npm install --omit=dev
cd ..
cd database
npm install mysql2 dotenv
cd ..
node database/init-db.js
# ✅ → "BASE DE DONNÉES INITIALISÉE AVEC SUCCÈS"
```

---

### Étape 5 : Démarrer l'app Node (PM2)

```bash
cd /var/www/e-market/backend
pm2 start server.js --name e-market
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
```
→ Copier/coller la commande `sudo env PATH=... pm2 startup` affichée.

Tester le backend :
```bash
curl -s http://127.0.0.1:3000/api/health
# → {"status":"ok", "database":"ok"}
```

---

### Étape 6 : Config Apache (Reverse Proxy minimaliste)

Crée le VirtualHost :
```bash
sudo nano /etc/httpd/conf.d/e-market.conf
```
Coller **exactement** ceci :
```apache
<VirtualHost *:80>
    ServerName localhost
    ServerAlias *
    DocumentRoot /var/www/e-market

    <Directory "/var/www/e-market">
        AllowOverride All
        Require all granted
        Options FollowSymLinks
    </Directory>

    # Apache sert les fichiers existants, sinon → Node
    RewriteEngine On
    RewriteCond "%{DOCUMENT_ROOT}/%{REQUEST_FILENAME}" !-f
    RewriteCond "%{DOCUMENT_ROOT}/%{REQUEST_FILENAME}" !-d
    RewriteRule "^(.*)$" "http://127.0.0.1:3000$1" [P,L]

    # Fallback garanti pour /api
    ProxyPass        /api  http://127.0.0.1:3000/api
    ProxyPassReverse /api  http://127.0.0.1:3000/api

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto "http"
</VirtualHost>
```
Sauvegarder (`Ctrl+O` → `Ctrl+X`) puis :
```bash
sudo httpd -t     # Syntax OK
sudo systemctl restart httpd
```

---

### 🚀 MÉTHODE RECOMMANDÉE : GITHUB → EC2 (plutôt que SCP)

**SCP c'est bien pour la 1ère fois, mais après c'est chiant.**
**Préférez Git : modifiez sur PC → `git push` → 1 commande sur EC2.**

#### Sur votre PC Windows (première fois) :

```powershell
# Allez dans le dossier projet
cd "D:\Gestion des projets\e-market\e-market"

# Initialiser repo
git init
git add .
git commit -m "🎉 Commit initial projet E-Market (backend + frontend + BDD)"
git branch -M main

# Créer un repo VIDE sur https://github.com (sans README ni .gitignore)
# puis adaptez l'URL :
git remote add origin https://github.com/VOTRE_PSEUDO/e-market.git
git push -u origin main
```

✅ Votre code est sur GitHub.  
Rien de sensible n'est pushé (`.env`, `*.pem`, `node_modules/` → tous ignorés par `.gitignore`)

#### Sur l'instance EC2 (Amazon Linux 2023) :

```bash
# Supprimer les fichiers uploadés en SCP si vous l'avez déjà fait
cd /var/www
sudo rm -rf e-market

# Droits pour pouvoir git clone
sudo chown ec2-user:apache /var/www
chmod 775 /var/www

# Clonez VOTRE repo (adaptez URL)
git clone https://github.com/VOTRE_PSEUDO/e-market.git e-market
cd e-market
```

**Config `.env` + install** (comme d'habitude) :
```bash
# .env production (RDS)
cat > backend/.env << 'EOF'
DB_HOST=VOTRE_ENDPOINT_RDS.xxxxx.eu-west-3.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=Admin1234!
DB_NAME=emarket_db
JWT_SECRET=projet_academique_2026_CHANGEZ_MOI_abcdefghijklmnopqrstuv
JWT_EXPIRES_IN=30d
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
FREE_SHIPPING_THRESHOLD=15000
DEFAULT_SHIPPING_COST=2000
TVA_RATE=0.18
EOF

# Install + init BDD
cd backend
npm install --omit=dev
cd ..
cd database
npm install mysql2 dotenv >/dev/null
cd ..
node database/init-db.js
# → 🎉 BDD initialisée
```

**Démarrer l'app** :
```bash
cd backend
pm2 start server.js --name e-market
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
# (copier/coller la commande sudo affichée)
```

**Droits Apache + lancer :**
```bash
sudo chgrp -R apache /var/www/e-market
sudo chmod -R g+rwX  /var/www/e-market
sudo systemctl restart httpd
```

---

#### 🔁 À CHAQUE MODIFICATION APRÈS :

Sur votre PC Windows (PowerShell) :
```powershell
cd "D:\Gestion des projets\e-market\e-market"
git add .
git commit -m "Message clair (ex: Correction bouton 'Ajouter au panier')"
git push
```

Puis **une seule commande sur EC2** (SSH) :
```bash
cd /var/www/e-market && ./scripts/deploy.sh
```

Ce script fourni avec le projet fait tout :
- ✅ `git pull` → récupère vos modifs
- ✅ Met à jour les droits Apache + SELinux context
- ✅ `npm install` si de nouvelles dépendances
- ✅ Relance PM2 (Node)
- ✅ Recharge Apache
- ✅ Teste `/api/health` → affiche statut API + BDD

⚠️ **Première fois, rendez-le exécutable :**
```bash
chmod +x /var/www/e-market/scripts/deploy.sh
```

🎉 **C'EST FINI !**

Ouvrir dans le navigateur : `http://IP_PUBLIQUE_EC2`
Exemple : `http://13.37.42.123`

**Comptes de test** :
| Login | Mdp | Rôle |
|---|---|---|
| admin@e-market.sn | password123 | Admin |
| amadou@example.sn | password123 | Client |

---

### (Optionnel) HTTPS avec domaine académique

Si vous avez un **domaine gratuit** (ex: fourni par votre faculté,
ou `.tk` gratuit via Freenom) :
1. Pointer domaine → IP EC2 (record A)
2. Installer certificat :
```bash
sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
sudo dnf config-manager --set-enabled crb
sudo dnf install -y certbot python3-certbot-apache -y
sudo certbot --apache -d votre-domaine.tk --redirect --agree-tos --no-eff-email -m votre@email.com
```

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 🛠️ COMMANDES RAPIDES (CHEAT SHEET)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
# Voir app Node
pm2 status
pm2 logs e-market --lines 50
pm2 restart e-market

# Voir Apache
sudo systemctl status httpd
sudo systemctl restart httpd
sudo tail -50 /var/log/httpd/error_log

# Réinitialiser la BDD (⚠️ efface tout)
cd /var/www/e-market
node database/init-db.js

# Mettre à jour code après modification locale
# (Sur votre PC Windows, réupload par SCP puis :)
pm2 restart e-market
sudo systemctl reload httpd

# Base RDS
mysql -h ENDPOINT_RDS -u admin -pAdmin1234! emarket_db
SHOW TABLES;
SELECT * FROM produits LIMIT 5;
```

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## ❌ ERREURS LES PLUS FRÉQUENTES + SOLUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Problème | Solution (1 clic) |
|---|---|
| Site ne s'ouvre pas dans navigateur | SG EC2 inbound → HTTP 80 autorisé partout |
| Erreur SQL "Access denied" dans `init-db.js` | Vérifier `.env` → `DB_USER`, `DB_PASSWORD`, `DB_HOST` = endpoint RDS |
| "Can't connect to MySQL server" | RDS Security Group inbound rule MySQL/Aurora depuis Anywhere ✅ |
| Page blanche / "Service Unavailable" | Node n'est pas démarré → `pm2 status` puis `pm2 start e-market` |
| Images 404 cassées | `sudo chown -R ec2-user:apache /var/www/e-market/images` |
| `database: "nok"` sur page `/api/health` | `.env` mauvais → corriger → `pm2 restart e-market` |

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 💡 ASTUCE DÉMO (PROJECTION DEVANT LE PROF)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Avant de montrer le projet au jury, préparez :
1. Dans un premier onglet : `https://ip-ec2/` → Page d'accueil
2. Deuxième : `https://ip-ec2/e-market_homepage.html?categorie=technologies`
3. Connectez-vous D'AVANCE en tant que `admin@e-market.sn`
4. Remplissez un panier avec 2-3 articles
5. Affichez `/api/health` dans un petit onglet pour prouver que l'API
   et la **connexion RDS** fonctionnent toutes deux (`database: "ok"`).
6. Ouvrez `/api/stats` → montrez les chiffres du dashboard.
7. Dans `commandes.html` : montrez la commande test déjà existante.

Bon courage pour votre soutenance ! 🎓🇸🇳
