const pool = require('../config/database');

const FREE_SHIPPING = parseFloat(process.env.FREE_SHIPPING_THRESHOLD || '15000');
const SHIPPING_COST = parseFloat(process.env.DEFAULT_SHIPPING_COST || '2000');
const TVA_RATE      = parseFloat(process.env.TVA_RATE || '0.18');

async function getOrCreatePanier(utilisateur_id) {
  const [rows] = await pool.query('SELECT * FROM paniers WHERE utilisateur_id = ?', [utilisateur_id]);
  if (rows.length) return rows[0];
  const [r] = await pool.query('INSERT INTO paniers (utilisateur_id) VALUES (?)', [utilisateur_id]);
  return { id: r.insertId, utilisateur_id };
}

async function calculerPanier(panier_id) {
  const [articles] = await pool.query(
    `SELECT pa.id, pa.quantite, pa.prix_unitaire,
            p.id AS produit_id, p.nom, p.slug, p.image_principale, p.stock, p.est_actif,
            p.prix AS prix_actuel, p.prix_promo AS prix_promo_actuel,
            (COALESCE(p.prix_promo, p.prix)) AS prix_courant
     FROM panier_articles pa
     JOIN produits p ON p.id = pa.produit_id
     WHERE pa.panier_id = ?`,
    [panier_id]
  );
  let sous_total = 0;
  for (const art of articles) {
    if (!art.est_actif) continue;
    const prix = art.prix_courant;
    art.sous_total = art.quantite * prix;
    sous_total += art.sous_total;
  }
  const frais_livraison = sous_total >= FREE_SHIPPING ? 0 : SHIPPING_COST;
  const tva  = Math.round(sous_total * TVA_RATE * 100) / 100;
  const total = sous_total + frais_livraison + tva;
  const nb_articles = articles.reduce((s, a) => s + (a.est_actif ? a.quantite : 0), 0);

  return {
    articles,
    sous_total,
    tva,
    frais_livraison,
    total,
    nb_articles,
    free_shipping_threshold: FREE_SHIPPING,
    montant_pour_free: Math.max(0, FREE_SHIPPING - sous_total)
  };
}

exports.getPanier = async (req, res) => {
  try {
    const panier = await getOrCreatePanier(req.user.id);
    const infos = await calculerPanier(panier.id);
    res.json(infos);
  } catch (err) {
    res.status(500).json({ message: 'Erreur panier', error: err.message });
  }
};

exports.ajouterAuPanier = async (req, res) => {
  try {
    const { produit_id, quantite = 1 } = req.body;
    const qte = Math.max(1, parseInt(quantite));
    const panier = await getOrCreatePanier(req.user.id);

    const [pRows] = await pool.query(
      'SELECT id, prix, prix_promo, stock, est_actif FROM produits WHERE id = ?',
      [produit_id]
    );
    if (pRows.length === 0 || !pRows[0].est_actif) {
      return res.status(404).json({ message: 'Produit indisponible' });
    }
    const produit = pRows[0];
    const prix_uni = produit.prix_promo || produit.prix;

    if (qte > produit.stock && produit.stock > 0) {
      return res.status(400).json({ message: `Stock insuffisant (disponible: ${produit.stock})` });
    }

    const [existant] = await pool.query(
      'SELECT id, quantite FROM panier_articles WHERE panier_id = ? AND produit_id = ?',
      [panier.id, produit_id]
    );

    if (existant.length) {
      const nouvelle = existant[0].quantite + qte;
      if (nouvelle > produit.stock && produit.stock > 0) {
        return res.status(400).json({ message: `Stock insuffisant` });
      }
      await pool.query(
        `UPDATE panier_articles SET quantite = ?, prix_unitaire = ? WHERE id = ?`,
        [nouvelle, prix_uni, existant[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO panier_articles (panier_id, produit_id, quantite, prix_unitaire) VALUES (?, ?, ?, ?)`,
        [panier.id, produit_id, qte, prix_uni]
      );
    }

    const infos = await calculerPanier(panier.id);
    res.json({ message: 'Ajouté au panier', panier: infos });
  } catch (err) {
    res.status(500).json({ message: 'Erreur ajout panier', error: err.message });
  }
};

exports.mettreAJourQuantite = async (req, res) => {
  try {
    const article_id = parseInt(req.params.id);
    const { quantite } = req.body;
    const qte = Math.max(1, parseInt(quantite));

    const [art] = await pool.query(
      `SELECT pa.*, p.stock, p.est_actif
       FROM panier_articles pa
       JOIN produits p ON p.id = pa.produit_id
       JOIN paniers pan ON pan.id = pa.panier_id
       WHERE pa.id = ? AND pan.utilisateur_id = ?`,
      [article_id, req.user.id]
    );
    if (art.length === 0) return res.status(404).json({ message: 'Article introuvable' });
    if (qte > art[0].stock && art[0].stock > 0) {
      return res.status(400).json({ message: `Stock insuffisant (disponible: ${art[0].stock})` });
    }

    await pool.query('UPDATE panier_articles SET quantite = ? WHERE id = ?', [qte, article_id]);
    const panier = await getOrCreatePanier(req.user.id);
    const infos = await calculerPanier(panier.id);
    res.json({ message: 'Quantité mise à jour', panier: infos });
  } catch (err) {
    res.status(500).json({ message: 'Erreur MAJ panier', error: err.message });
  }
};

exports.retirerDuPanier = async (req, res) => {
  try {
    const article_id = parseInt(req.params.id);
    await pool.query(
      `DELETE pa FROM panier_articles pa
       JOIN paniers pan ON pan.id = pa.panier_id
       WHERE pa.id = ? AND pan.utilisateur_id = ?`,
      [article_id, req.user.id]
    );
    const panier = await getOrCreatePanier(req.user.id);
    const infos = await calculerPanier(panier.id);
    res.json({ message: 'Article retiré', panier: infos });
  } catch (err) {
    res.status(500).json({ message: 'Erreur retrait', error: err.message });
  }
};

exports.viderPanier = async (req, res) => {
  try {
    const panier = await getOrCreatePanier(req.user.id);
    await pool.query('DELETE FROM panier_articles WHERE panier_id = ?', [panier.id]);
    res.json({ message: 'Panier vidé', panier: { articles: [], nb_articles: 0, total: 0 } });
  } catch (err) {
    res.status(500).json({ message: 'Erreur', error: err.message });
  }
};

module.exports = { ...module.exports, calculerPanier, getOrCreatePanier, FREE_SHIPPING, SHIPPING_COST, TVA_RATE };
