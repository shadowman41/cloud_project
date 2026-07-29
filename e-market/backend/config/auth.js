const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

function authRequired(req, res, next) {
  const header = req.headers.authorization || req.headers['Authorization'];
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Accès non autorisé - Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Accès réservé aux administrateurs' });
    }
    next();
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, nom: user.nom },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function formatFCFA(montant) {
  return new Intl.NumberFormat('fr-SN').format(Number(montant) || 0) + ' FCFA';
}

module.exports = { authRequired, adminRequired, generateToken, formatFCFA };
