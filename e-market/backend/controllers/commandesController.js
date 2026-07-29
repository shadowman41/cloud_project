const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { calculerPanier, getOrCreatePanier, FREE_SHIPPING, SHIPPING_COST, TVA_RATE } = require('./panierController');

function genererNumeroCommande() {
  const d = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `EMK-${ts}-${rand}`;
}

exports.creerCommande = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { adresse_livraison, telephone_livraison, methode_paiement = 'paiement_livraison', notes_client = '' } = req.body;

    if (!adresse_livraison) {
      return res.status(400).json({ message: 'Adresse de livraison obligatoire' });
    }
    const METHODES = ['orange_money', 'wave', 'carte', 'paiement_livraison'];
    if (!METHODES.includes(methode_paiement)) {
      return res.status(400).json({ message: 'Méthode de paiement invalide' });
    }

    const panier = await getOrCreatePanier(req.user.id);
    const infosPanier = await calculerPanier(panier.id);
    if (infosPanier.articles.length === 0) {
      return res.status(400).json({ message: 'Le panier est vide' });
    }

    for (const art of infosPanier.articles) {
      if (!art.est_actif) continue;
      if (art.quantite > art.stock) {
        await conn.rollback();
        return res.status(400).json({ message: `Stock insuffisant pour "${art.nom}"` });
      }
    }

    const numero_commande = genererNumeroCommande();
    const montant_ht      = infosPanier.sous_total;
    const tva             = Math.round(montant_ht * TVA_RATE * 100) / 100;
    const frais_livraison = montant_ht >= FREE_SHIPPING ? 0 : SHIPPING_COST;
    const montant_total   = montant_ht + tva + frais_livraison;

    const statut = methode_paiement === 'paiement_livraison' ? 'validee' : 'en_attente';
    const paiement_statut = methode_paiement === 'paiement_livraison' ? 'en_attente' : 'en_attente';

    const [cmdRes] = await conn.query(
      `INSERT INTO commandes (utilisateur_id, numero_commande, statut,
        montant_ht, tva, frais_livraison, montant_total,
        adresse_livraison, telephone_livraison, methode_paiement, paiement_statut, notes_client)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, numero_commande, statut,
       montant_ht, tva, frais_livraison, montant_total,
       adresse_livraison, telephone_livraison || '', methode_paiement, paiement_statut, notes_client]
    );
    const commande_id = cmdRes.insertId;

    for (const art of infosPanier.articles) {
      if (!art.est_actif) continue;
      const prix_unitaire = art.prix_courant;
      const sous_total = art.quantite * prix_unitaire;
      await conn.query(
        `INSERT INTO commande_articles (commande_id, produit_id, quantite, prix_unitaire, sous_total, nom_produit)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [commande_id, art.produit_id, art.quantite, prix_unitaire, sous_total, art.nom]
      );
      await conn.query('UPDATE produits SET stock = stock - ? WHERE id = ?', [art.quantite, art.produit_id]);
    }

    await conn.query('DELETE FROM panier_articles WHERE panier_id = ?', [panier.id]);

    if (methode_paiement !== 'paiement_livraison') {
      await conn.query(
        `INSERT INTO paiements (commande_id, utilisateur_id, montant, methode, statut, reference)
         VALUES (?, ?, ?, ?, 'en_attente', ?)`,
        [commande_id, req.user.id, montant_total, methode_paiement, `INIT-${uuidv4().slice(0,8)}`]
      );
    }

    await conn.commit();

    res.status(201).json({
      message: 'Commande créée avec succès',
      commande: {
        id: commande_id,
        numero_commande,
        statut,
        montant_total,
        methode_paiement,
        paiement_statut,
        paiement_instructions: methode_paiement !== 'paiement_livraison'
          ? `Utilisez l'application ${methode_paiement} avec le N° +221 76 000 00 00 - Référence: ${numero_commande}`
          : null
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: 'Erreur création commande', error: err.message });
  } finally {
    conn.release();
  }
};

exports.confirmerPaiement = async (req, res) => {
  try {
    const commande_id = parseInt(req.params.id);
    const [rows] = await pool.query(
      'SELECT * FROM commandes WHERE id = ? AND utilisateur_id = ?',
      [commande_id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Commande introuvable' });
    const cmd = rows[0];

    await pool.query(
      `UPDATE commandes SET statut = 'validee', paiement_statut = 'paye' WHERE id = ?`,
      [commande_id]
    );
    await pool.query(
      `UPDATE paiements SET statut = 'paye', date_paiement = CURRENT_TIMESTAMP WHERE commande_id = ?`,
      [commande_id]
    );
    res.json({ message: 'Paiement confirmé', commande: { id: commande_id, statut: 'validee', paiement_statut: 'paye' } });
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

exports.mesCommandes = async (req, res) => {
  try {
    const [commandes] = await pool.query(
      `SELECT id, numero_commande, statut, montant_total, methode_paiement,
              paiement_statut, date_commande, date_maj
       FROM commandes WHERE utilisateur_id = ? ORDER BY date_commande DESC`,
      [req.user.id]
    );
    for (const cmd of commandes) {
      const [articles] = await pool.query(
        `SELECT ca.*, p.image_principale, p.slug
         FROM commande_articles ca
         LEFT JOIN produits p ON p.id = ca.produit_id
         WHERE ca.commande_id = ?`,
        [cmd.id]
      );
      cmd.articles = articles;
    }
    res.json(commandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

exports.getCommande = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.query(
      `SELECT c.*, u.nom, u.prenom, u.email, u.telephone AS user_telephone
       FROM commandes c JOIN utilisateurs u ON u.id = c.utilisateur_id
       WHERE c.id = ? AND c.utilisateur_id = ?`,
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Commande introuvable' });
    const commande = rows[0];
    const [articles] = await pool.query(
      `SELECT ca.*, p.image_principale, p.slug
       FROM commande_articles ca
       LEFT JOIN produits p ON p.id = ca.produit_id
       WHERE ca.commande_id = ?`,
      [id]
    );
    commande.articles = articles;
    res.json(commande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

exports.annulerCommande = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await pool.query(
      `SELECT * FROM commandes WHERE id = ? AND utilisateur_id = ?`,
      [id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Commande introuvable' });
    const cmd = rows[0];
    if (['expediee','livree','annulee'].includes(cmd.statut)) {
      return res.status(400).json({ message: 'Cette commande ne peut pas être annulée' });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      const [articles] = await conn.query('SELECT produit_id, quantite FROM commande_articles WHERE commande_id = ?', [id]);
      for (const a of articles) {
        await conn.query('UPDATE produits SET stock = stock + ? WHERE id = ?', [a.quantite, a.produit_id]);
      }
      await conn.query(`UPDATE commandes SET statut='annulee', paiement_statut='rembourse' WHERE id = ?`, [id]);
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }

    res.json({ message: 'Commande annulée', statut: 'annulee' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};
