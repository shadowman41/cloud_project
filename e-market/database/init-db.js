require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10
};

const SQL_SCHEMA = path.join(__dirname, '01_schema.sql');
const SQL_SEED   = path.join(__dirname, '02_seed_data.sql');

async function readSql(filePath) {
  return fs.promises.readFile(filePath, 'utf-8');
}

async function initDatabase() {
  console.log('\n🚀 Initialisation de la base E-Market (MySQL / RDS)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Hôte DB    : ${dbConfig.host}:${dbConfig.port}`);
  console.log(`Utilisateur: ${dbConfig.user}\n`);

  let connection;
  try {
    console.log('1️⃣  Connexion au serveur MySQL...');
    connection = await mysql.createConnection(dbConfig);
    console.log('   ✅ Connexion établie\n');

    console.log('2️⃣  Création schéma & tables (01_schema.sql)...');
    const schemaSql = await readSql(SQL_SCHEMA);
    await connection.query(schemaSql);
    console.log('   ✅ Schéma créé avec succès\n');

    console.log('3️⃣  Insertion données de test (02_seed_data.sql)...');
    const seedSql = await readSql(SQL_SEED);
    await connection.query(seedSql);
    console.log('   ✅ Données insérées avec succès\n');

    console.log('4️⃣  Vérification des données...');
    const [rows] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM emarket_db.vendeurs)     AS vendeurs,
        (SELECT COUNT(*) FROM emarket_db.categories)   AS categories,
        (SELECT COUNT(*) FROM emarket_db.sous_categories) AS sous_categories,
        (SELECT COUNT(*) FROM emarket_db.produits)     AS produits,
        (SELECT COUNT(*) FROM emarket_db.utilisateurs) AS utilisateurs,
        (SELECT COUNT(*) FROM emarket_db.commandes)    AS commandes
    `);
    const stats = rows[0];
    console.log(`   📦 Vendeurs      : ${stats.vendeurs}`);
    console.log(`   📂 Catégories    : ${stats.categories} (${stats.sous_categories} sous-catégories)`);
    console.log(`   🛒 Produits      : ${stats.produits}`);
    console.log(`   👤 Utilisateurs  : ${stats.utilisateurs}`);
    console.log(`   📦 Commandes     : ${stats.commandes}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 BASE DE DONNÉES E-MARKET INITIALISÉE AVEC SUCCÈS !');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔑 Comptes de test:');
    console.log('   Admin  : admin@e-market.sn  / password123');
    console.log('   Client : amadou@example.sn  / password123');
    console.log('   Client : fatou@example.sn   / password123\n');

  } catch (err) {
    console.error('\n❌ ERREUR lors de l\'initialisation :\n', err.message);
    console.error('\n💡 Vérifiez :');
    console.error('   - Les variables d\'environnement (.env) DB_HOST, DB_PORT, DB_USER, DB_PASSWORD');
    console.error('   - Que l\'instance RDS MySQL est accessible depuis EC2 (groupe de sécurité)');
    console.error('   - Que l\'utilisateur a les droits CREATE / INSERT\n');
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
