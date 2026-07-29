# 🛒 E-MARKET - Marketplace Sénégalaise (Projet Académique)

![Version](https://img.shields.io/badge/version-1.0.0-green)
![Stack](https://img.shields.io/badge/stack-Node%20%2F%20Express%20%2F%20MySQL-blue)
![Déploiement](https://img.shields.io/badge/AWS-EC2%20%2B%20RDS%20MySQL-orange)
![OS](https://img.shields.io/badge/Amazon%20Linux%202023-2023-ff9900)

> Marketplace e-commerce sénégalaise multi-vendeurs.  
> **Architecture :** Frontend HTML/CSS/JS + Backend Node.js/Express + Base MySQL (AWS RDS)  
> **Serveur Web :** Apache HTTPD 2.4 (Reverse Proxy) sur **Amazon Linux 2023**  
> **Contexte :** Projet universitaire

---

## ⚡ Démarrer LOCALEMENT (Windows, 2 clics)

```
1. Double-cliquez sur  INSTALLER-WINDOWS.bat
2. Double-cliquez sur  DEMARRER-SERVEUR.bat
3. Ouvrez http://localhost:3000
```

| Mac / Linux |
|---|
| `bash INSTALLER-MAC-LINUX.sh` → `cd backend && npm start` |

**Comptes de test :**
| Rôle | Identifiant | Mot de passe |
|---|---|---|
| 🎛️ Admin | `admin@e-market.sn` | `password123` |
| 🛍️ Client | `amadou@example.sn` | `password123` |
| 🛍️ Client | `fatou@example.sn` | `password123` |

---

## 🧩 Stack Technique

| Couche | Technologie |
|---|---|
| Frontend | HTML5 + CSS3 (responsive) + JS vanilla (client API) |
| Backend | **Node.js 20 LTS** + **Express 4** |
| Auth | JWT Bearer Token + bcryptjs (hash mots de passe) |
| Base | **MySQL 8** — pool mysql2 (compatibilité AWS RDS MySQL / Aurora) |
| Serveur Web | **Apache 2.4** (mod_proxy, mod_rewrite, mod_ssl) |
| OS | **Amazon Linux 2023** (EC2) |
| Process Manager | **PM2** (redémarrage auto, crash restart, start au boot) |
| Paquets backend | express-validator, cors, dotenv, uuid |

---

## 📁 Arborescence du projet

```
e-market/
├── index.html                  # Accueil
├── e-market_homepage.html      # Boutique catalogue + filtres
├── produit.html                # Fiche produit dynamique
├── panier.html                 # Panier d'achat + tunnel commande
├── connexion.html              # Connexion / Inscription
├── commandes.html              # Suivi commandes
├── profil.html                 # Mon profil
├── favoris.html                # Mes favoris
├── services.html               # Page services
│
├── assets/
│   ├── style.css               # CSS partagé (desktop + mobile)
│   └── app.js                  # Client API (requêtes, panier, auth, composants)
│
├── images/                     # Images produits + logo
│
├── backend/                    # ⚙️ API REST (Express)
│   ├── server.js               # Entrée + routes + fichiers statiques
│   ├── .env.example            # Modèle config (RDS, JWT...)
│   ├── package.json
│   ├── config/
│   │   ├── database.js         # Pool MySQL (RDS)
│   │   └── auth.js             # Middlewares JWT (auth/admin)
│   ├── controllers/            # Logique métier (x5)
│   └── routes/                 # Routes REST (x5)
│
├── database/                   # 🗄️ Initialisation BDD MySQL
│   ├── 01_schema.sql           # 12 tables + FK + index + Fulltext
│   ├── 02_seed_data.sql        # Données exemple (produits, users, commandes)
│   └── init-db.js              # Script Node UNE COMMANDE
│
├── INSTALLER-WINDOWS.bat       # 🪟 Install 1 clic (Windows)
├── INSTALLER-MAC-LINUX.sh      # 🍣🐧 Install 1 clic
├── DEBARRER-SERVEUR.bat        # 🚀 Démarrer le serveur (Windows)
└── DEPLOIEMENT-EC2-RDS.md      # ☁️ Guide complet AWS
```

---

## ☁️ Workflow GITHUB → EC2 (votre cas)

Cette section décrit exactement **ce que vous allez faire**.

### 1️⃣ Préparer le repo local et le pousser sur GitHub

Dans PowerShell (dossier du projet) :

```powershell
cd "D:\Gestion des projets\e-market\e-market"

# Initialiser repo Git
git init
git add .
git commit -m "🎉 Commit initial - E-Market complet, backend + frontend + BDD"

# (Préalable : créer le repo sur github.com - ex: VotrePseudo/e-market)
git branch -M main
git remote add origin https://github.com/VotrePseudo/e-market.git
git push -u origin main
```

✅ Vos fichiers sont maintenant sur GitHub.  
⚠️ Notez que : `.env`, `node_modules/`, `*.pem` **NE SONT PAS PUSHÉS** (grâce à `.gitignore`)

---

### 2️⃣ Sur l'instance EC2 (Amazon Linux 2023) : cloner le repo

Prérequis : Votre EC2 est lancée et :
- Apache, Node, PM2 sont installés (voir guide `DEPLOIEMENT-EC2-RDS.md`)
- Votre RDS MySQL est créée et accessible (Public Access + SG autorisant)

**SSH sur EC2 :**
```bash
cd /var/www
sudo chown -R ec2-user:apache /var/www

# Cloner VOTRE repo GitHub (adaptez l'URL)
git clone https://github.com/VotrePseudo/e-market.git e-market
cd e-market
ls   # → vous voyez index.html, backend/, etc.

# Droits Apache
sudo chgrp -R apache /var/www/e-market
sudo chmod -R g+rwX /var/www/e-market
```

---

### 3️⃣ Config `.env` de production (RDS MySQL)

**Sur EC2 :**
```bash
cd /var/www/e-market

cat > backend/.env << 'EOF'
DB_HOST=MARKET_DATABASE_ENDPOINT_RDS.xxxxx.eu-west-3.rds.amazonaws.com
DB_PORT=3306
DB_USER=admin
DB_PASSWORD=Admin1234!
DB_NAME=emarket_db

JWT_SECRET=une_cle_longue_aleatoire_a_changer_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
JWT_EXPIRES_IN=30d

PORT=3000
NODE_ENV=production

CORS_ORIGIN=*
FREE_SHIPPING_THRESHOLD=15000
DEFAULT_SHIPPING_COST=2000
TVA_RATE=0.18
EOF
```

---

### 4️⃣ Install dépendances + Initialiser base RDS

```bash
cd /var/www/e-market

# Backend
cd backend
npm install --omit=dev
cd ..

# Init BDD
cd database
npm install mysql2 dotenv
cd ..
node database/init-db.js
# → 🎉 "BASE DE DONNÉES INITIALISÉE AVEC SUCCÈS"
```

---

### 5️⃣ Démarrer Node (PM2) + Config Apache Reverse Proxy

```bash
cd /var/www/e-market/backend
pm2 start server.js --name e-market
pm2 save
pm2 startup systemd -u ec2-user --hp /home/ec2-user
# Exécuter la commande sudo affichée par PM2

# Vérifier
pm2 status               # online
curl -s http://127.0.0.1:3000/api/health   # status ok + database ok
```

**Apache vhost minimal (déjà présent dans le guide) :**
```bash
sudo nano /etc/httpd/conf.d/e-market.conf
```
Coller :
```apache
<VirtualHost *:80>
    ServerAlias *
    DocumentRoot /var/www/e-market
    <Directory "/var/www/e-market">
        AllowOverride All
        Require all granted
        Options FollowSymLinks
    </Directory>
    RewriteEngine On
    RewriteCond "%{DOCUMENT_ROOT}/%{REQUEST_FILENAME}" !-f
    RewriteCond "%{DOCUMENT_ROOT}/%{REQUEST_FILENAME}" !-d
    RewriteRule "^(.*)$" "http://127.0.0.1:3000$1" [P,L]
    ProxyPass        /api  http://127.0.0.1:3000/api
    ProxyPassReverse /api  http://127.0.0.1:3000/api
    ProxyPreserveHost On
</VirtualHost>
```
Puis :
```bash
sudo mv /etc/httpd/conf.d/welcome.conf /etc/httpd/conf.d/welcome.conf.disabled 2>/dev/null
sudo httpd -t && sudo systemctl restart httpd
```

🎉 Ouvrir `http://IP_PUBLIQUE_EC2` → site en ligne !

---

### 6️⃣ À CHAQUE MODIFICATION (Workflow GitHub → EC2)

Sur votre PC :
```powershell
cd "D:\Gestion des projets\e-market\e-market"
git add .
git commit -m "Détail de la modif (ex: correction panier)"
git push
```

**Ensuite SUR EC2 (SSH) — une seule commande :**
```bash
cd /var/www/e-market && ./scripts/deploy.sh
```

(Ce script est fourni plus bas — il fait `git pull`, `npm install` si besoin, restart PM2 + reload Apache.)

**Première fois : créez le script**
```bash
mkdir -p /var/www/e-market/scripts
cat > /var/www/e-market/scripts/deploy.sh << 'EOF'
#!/bin/bash
# E-Market : Déploiement depuis GitHub
set -e

cd /var/www/e-market

echo "↪️  Git pull..."
git pull

echo "↪️  Permission Apache..."
sudo chgrp -R apache /var/www/e-market
sudo chmod -R g+rwX /var/www/e-market

echo "↪️  Install dépendances backend..."
cd backend
npm install --omit=dev
cd ..

echo "↪️  Restart PM2..."
pm2 reload e-market || pm2 start /var/www/e-market/backend/server.js --name e-market

echo "↪️  Reload Apache..."
sudo systemctl reload httpd

echo ""
echo "✅ Déploiement terminé !"
echo "Health : $(curl -s http://127.0.0.1:3000/api/health | head -c 120)"
EOF

chmod +x /var/www/e-market/scripts/deploy.sh
```

---

## 🔗 Endpoints API REST

| Méthode | URL | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Inscription | ❌ |
| `POST` | `/api/auth/login` | Connexion (retourne JWT) | ❌ |
| `GET`  | `/api/auth/me` | Profil connecté | 🔒 |
| `PUT`  | `/api/auth/profil` | Modifier profil | 🔒 |
| `GET`  | `/api/categories` | Catégories + sous-catégories | ❌ |
| `GET`  | `/api/produits` | Catalogue avec filtres/tri/pagination | ❌ |
| `GET`  | `/api/produits/slug/:slug` | Détail produit + avis + similaires | ❌ |
| `GET`  | `/api/produits/favoris` | Liste de favoris | 🔒 |
| `POST` | `/api/produits/:id/favori` | Ajouter/retirer favori | 🔒 |
| `GET`  | `/api/panier` | Panier (articles + totaux + livraison gratuite) | 🔒 |
| `POST` | `/api/panier/ajouter` | Ajouter article | 🔒 |
| `DELETE`| `/api/panier/article/:id` | Retirer | 🔒 |
| `POST` | `/api/commandes` | Créer commande + transaction SQL (décrémente stock) | 🔒 |
| `GET`  | `/api/commandes` | Historique commandes | 🔒 |
| `POST` | `/api/commandes/:id/annuler` | Annuler commande | 🔒 |
| `GET`  | `/api/health` | État backend + connexion BDD | ❌ |
| `GET`  | `/api/stats` | Tableau de bord général | ❌ |

**Exemple requête produit :**
```
GET /api/produits?categorie=technologies&est_promo=1&tri=prix_asc&prix_max=150000
```

---

## 🗄️ Schéma BDD MySQL (12 tables)

`utilisateurs` → `paniers` → `panier_articles` ↔ `produits`  
`produits` → `categorie_id` / `sous_categorie_id` / `vendeur_id`  
`utilisateurs` → `commandes` → `commande_articles`  
`produits` ← `avis` → `utilisateurs`  
`produits` ← `favoris` → `utilisateurs`  
`commandes` ↔ `paiements`

---

## 📝 Bonnes pratiques projet académique

- ✅ Ne **jamais** commit de `.env` (identifiants RDS) ou de fichiers `.pem` (clé SSH) → `.gitignore` s'en occupe
- ✅ Faites des commits réguliers avec messages clairs : `git commit -m "Ajout tunnel paiement Wave"`
- ✅ Sur EC2, privilégiez `./scripts/deploy.sh` (automatique et fiable)
- ✅ Pour la soutenance : gardez un onglet sur `/api/health` → prouve connexion API + BDD RDS
- ✅ Sauvegarde BDD RDS 1 clic : `mysqldump -h ENDPOINT -u admin -pAdmin1234! emarket_db > backup.sql`

---

## 🧑‍🏫 Ressources

- Guide déploiement AWS détaillé : [`DEPLOIEMENT-EC2-RDS.md`](DEPLOIEMENT-EC2-RDS.md)
- Node.js 20 LTS : https://nodejs.org/
- AWS Free Tier : https://aws.amazon.com/free
- Certificat SSL Let's Encrypt gratuit (Certbot Apache) : voir guide `DEPLOIEMENT-EC2-RDS.md` section HTTPS
