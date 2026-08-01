require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'projet-finops-db.c4jwiiu8emil.us-east-1.rds.amazonaws.com',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'emarket_db',
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  charset: 'utf8mb4_unicode_ci'
});

pool.getConnection()
  .then(conn => {
    console.log('✅ Connecté à la base MySQL :', process.env.DB_HOST);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Échec connexion MySQL :', err.message);
    console.error('💡 Vérifiez les variables .env et le groupe de sécurité RDS');
  });

module.exports = pool;
