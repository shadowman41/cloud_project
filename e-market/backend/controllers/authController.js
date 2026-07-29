const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { generateToken } = require('../config/auth');

const { body, validationResult } = require('express-validator');

exports.validateRegister = [
  body('nom').trim().notEmpty().withMessage('Nom obligatoire'),
  body('email').isEmail().withMessage('Email invalide'),
  body('mot_de_passe').isLength({ min: 6 }).withMessage('Mot de passe min 6 caractères'),
  body('telephone').optional().matches(/^[0-9+\s()-]{8,}$/).withMessage('Téléphone invalide')
];

exports.validateLogin = [
  body('email').isEmail().withMessage('Email invalide'),
  body('mot_de_passe').notEmpty().withMessage('Mot de passe obligatoire')
];

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map(e => ({ field: e.param, message: e.msg })) });
  }

  try {
    const { nom, prenom = '', email, telephone = '', mot_de_passe, adresse = '', ville = '', pays = 'Sénégal' } = req.body;

    const [existing] = await pool.query('SELECT id FROM utilisateurs WHERE email = ? LIMIT 1', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'Cet email est déjà utilisé' });
    }

    const hashed = await bcrypt.hash(mot_de_passe, 10);

    const [result] = await pool.query(
      `INSERT INTO utilisateurs (nom, prenom, email, telephone, mot_de_passe, adresse, ville, pays)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nom, prenom, email, telephone, hashed, adresse, ville, pays]
    );

    const [userRows] = await pool.query(
      `SELECT id, nom, prenom, email, telephone, role, date_creation
       FROM utilisateurs WHERE id = ?`,
      [result.insertId]
    );
    const user = userRows[0];
    const token = generateToken(user);

    await pool.query('INSERT IGNORE INTO paniers (utilisateur_id) VALUES (?)', [user.id]);

    res.status(201).json({
      message: 'Inscription réussie',
      token,
      utilisateur: user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur inscription', error: err.message });
  }
};

exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, mot_de_passe } = req.body;
    const [rows] = await pool.query(
      `SELECT id, nom, prenom, email, telephone, mot_de_passe, role, est_actif, adresse, ville, pays
       FROM utilisateurs WHERE email = ? LIMIT 1`,
      [email]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    const user = rows[0];

    if (!user.est_actif) {
      return res.status(403).json({ message: 'Compte désactivé, contactez le support' });
    }

    const ok = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!ok) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    const token = generateToken(user);

    await pool.query('INSERT IGNORE INTO paniers (utilisateur_id) VALUES (?)', [user.id]);

    const userSafe = { ...user };
    delete userSafe.mot_de_passe;

    res.json({
      message: 'Connexion réussie',
      token,
      utilisateur: userSafe
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur connexion', error: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, nom, prenom, email, telephone, role, adresse, ville, pays, date_naissance, avatar_url, date_creation
       FROM utilisateurs WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur profil', error: err.message });
  }
};

exports.updateProfil = async (req, res) => {
  try {
    const { nom, prenom, telephone, adresse, ville, pays, date_naissance } = req.body;
    await pool.query(
      `UPDATE utilisateurs SET nom=?, prenom=?, telephone=?, adresse=?, ville=?, pays=?, date_naissance=? WHERE id=?`,
      [nom, prenom, telephone, adresse, ville, pays, date_naissance, req.user.id]
    );
    res.json({ message: 'Profil mis à jour' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur mise à jour', error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { ancien_mdp, nouveau_mdp } = req.body;
    if (!nouveau_mdp || nouveau_mdp.length < 6) {
      return res.status(400).json({ message: 'Nouveau mot de passe trop court' });
    }
    const [rows] = await pool.query('SELECT mot_de_passe FROM utilisateurs WHERE id = ?', [req.user.id]);
    const ok = await bcrypt.compare(ancien_mdp, rows[0].mot_de_passe);
    if (!ok) return res.status(401).json({ message: 'Ancien mot de passe incorrect' });

    const hashed = await bcrypt.hash(nouveau_mdp, 10);
    await pool.query('UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?', [hashed, req.user.id]);
    res.json({ message: 'Mot de passe modifié' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};
