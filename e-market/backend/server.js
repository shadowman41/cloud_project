require('dotenv').config();
require('./config/database');

const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');

const categoriesRoutes = require('./routes/categories.routes');
const produitsRoutes   = require('./routes/produits.routes');
const authRoutes       = require('./routes/auth.routes');
const panierRoutes     = require('./routes/panier.routes');
const commandesRoutes  = require('./routes/commandes.routes');
const pool             = require('./config/database');

const app = express();
const PORT = parseInt(process.env.PORT || '3000');
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(cors({
  origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') || true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const rootDir = path.resolve(__dirname, '..');
app.use('/images', express.static(path.join(rootDir, 'images'), { maxAge: '1h' }));
app.use('/assets', express.static(rootDir, { maxAge: '1h' }));

app.use((req, res, next) => {
  if (NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

app.get('/api/health', async (req, res) => {
  let db = 'nok';
  try {
    await pool.query('SELECT 1');
    db = 'ok';
  } catch (_) {}
  res.json({
    status: 'ok',
    service: 'E-Market Backend',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    database: db
  });
});

app.get('/api/stats', async (req, res) => {
  try {
    const [[{nb_produits}]]    = await pool.query('SELECT COUNT(*) nb_produits FROM produits WHERE est_actif=1');
    const [[{nb_categories}]]  = await pool.query('SELECT COUNT(*) nb_categories FROM categories WHERE actif=1');
    const [[{nb_vendeurs}]]    = await pool.query('SELECT COUNT(*) nb_vendeurs FROM vendeurs');
    const [[{nb_clients}]]     = await pool.query('SELECT COUNT(*) nb_clients FROM utilisateurs WHERE role="client"');
    const [[{nb_commandes}]]   = await pool.query('SELECT COUNT(*) nb_commandes FROM commandes');
    const [[{ca_total}]]       = await pool.query("SELECT COALESCE(SUM(montant_total),0) ca_total FROM commandes WHERE statut IN ('validee','expediee','livree')");
    res.json({ nb_produits, nb_categories, nb_vendeurs, nb_clients, nb_commandes, ca_total });
  } catch (err) {
    res.status(500).json({ message: 'Erreur stats', error: err.message });
  }
});

app.use('/api/categories', categoriesRoutes);
app.use('/api/produits',   produitsRoutes);
app.use('/api/auth',       authRoutes);
app.use('/api/panier',     panierRoutes);
app.use('/api/commandes',  commandesRoutes);

function listStaticPages() {
  const pages = [];
  const files = fs.readdirSync(rootDir);
  for (const f of files) {
    if (f.endsWith('.html') && !f.includes('404')) {
      pages.push('/' + f);
    }
  }
  return pages.sort();
}

app.get('/', (req, res) => {
  const htmlPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.json({
      message: 'Bienvenue sur l\'API E-Market',
      documentation: {
        auth: {
          register: 'POST /api/auth/register',
          login:    'POST /api/auth/login',
          profil:   'GET  /api/auth/me (Bearer token)'
        },
        produits: {
          list:    'GET  /api/produits?categorie=technologies&tri=prix_asc&recherche=samsung',
          detail:  'GET  /api/produits/slug/:slug',
          favoris: 'GET  /api/produits/favoris',
          toggleFav: 'POST /api/produits/:id/favori'
        },
        categories: {
          list:   'GET /api/categories',
          detail: 'GET /api/categories/:slug'
        },
        panier:    'GET    /api/panier | POST /api/panier/ajouter | DELETE /api/panier/article/:id',
        commandes: 'GET    /api/commandes | POST /api/commandes | POST /api/commandes/:id/confirmer',
        pages_statiques: listStaticPages()
      }
    });
  }
});

app.get(/^\/(index|services|panier|connexion|inscription|produit|e-market_homepage)?\.?html?$/i, (req, res) => {
  let page = req.params[0] ? req.params[0].toLowerCase() : 'index';
  let file = page.includes('produit') ? 'produit.html' : `${page}.html`;
  if (!fs.existsSync(path.join(rootDir, file))) file = 'index.html';
  res.sendFile(path.join(rootDir, file));
});

app.use((req, res, next) => {
  if (req.url.startsWith('/api/')) {
    return res.status(404).json({ message: 'Route API introuvable' });
  }
  const notFound = path.join(rootDir, 'index.html');
  if (fs.existsSync(notFound)) res.status(404).sendFile(notFound);
  else res.status(404).json({ message: 'Ressource introuvable' });
});

app.use((err, req, res, _next) => {
  console.error('ERREUR:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Erreur interne serveur',
    ...(NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║          🛒 E-MARKET BACKEND DÉMARRÉ                     ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Env     : ${NODE_ENV.padEnd(47)}║`);
  console.log(`║  Port    : ${String(PORT).padEnd(47)}║`);
  console.log(`║  URL     : http://localhost:${PORT}/                      ║`);
  console.log(`║  Health  : http://localhost:${PORT}/api/health            ║`);
  console.log(`║  Stat.   : http://localhost:${PORT}/api/stats             ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Routes: /api/auth | /api/produits | /api/categories    ║');
  console.log('║          /api/panier | /api/commandes                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');
});
