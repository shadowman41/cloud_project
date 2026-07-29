const pool = require('../config/database');

function buildWhereClauses(query) {
  const where = [];
  const params = [];

  where.push('p.est_actif = 1');

  if (query.categorie) {
    where.push('c.slug = ?');
    params.push(query.categorie);
  }
  if (query.categorie_id) {
    where.push('p.categorie_id = ?');
    params.push(parseInt(query.categorie_id));
  }
  if (query.sous_categorie_id) {
    where.push('p.sous_categorie_id = ?');
    params.push(parseInt(query.sous_categorie_id));
  }
  if (query.vendeur_id) {
    where.push('p.vendeur_id = ?');
    params.push(parseInt(query.vendeur_id));
  }
  if (query.recherche) {
    where.push('(p.nom LIKE ? OR p.description_courte LIKE ? OR c.nom LIKE ? OR p.marque LIKE ?)');
    const search = `%${query.recherche}%`;
    params.push(search, search, search, search);
  }
  if (query.marque) {
    where.push('p.marque = ?');
    params.push(query.marque);
  }
  if (query.prix_min) {
    where.push('COALESCE(p.prix_promo, p.prix) >= ?');
    params.push(parseFloat(query.prix_min));
  }
  if (query.prix_max) {
    where.push('COALESCE(p.prix_promo, p.prix) <= ?');
    params.push(parseFloat(query.prix_max));
  }
  if (query.est_promo === '1' || query.est_promo === 'true') {
    where.push('p.est_promo = 1');
  }
  if (query.est_nouveau === '1' || query.est_nouveau === 'true') {
    where.push('p.est_nouveau = 1');
  }

  return { where: where.length ? 'WHERE ' + where.join(' AND ') : '', params };
}

function buildOrder(query) {
  const order = String(query.tri || '').toLowerCase();
  switch (order) {
    case 'prix_asc':   return 'ORDER BY COALESCE(p.prix_promo, p.prix) ASC';
    case 'prix_desc':  return 'ORDER BY COALESCE(p.prix_promo, p.prix) DESC';
    case 'nouveau':    return 'ORDER BY p.date_creation DESC';
    case 'note':       return 'ORDER BY p.note_moyenne DESC, p.nb_avis DESC';
    case 'populaire':
    default:           return 'ORDER BY p.nb_vues DESC, p.date_creation DESC';
  }
}

exports.getAllProduits = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page || '1'));
    const limit = Math.min(100, parseInt(req.query.limit || '12'));
    const offset = (page - 1) * limit;

    const { where, params } = buildWhereClauses(req.query);
    const orderClause = buildOrder(req.query);

    const baseQuery = `
      FROM produits p
      JOIN categories c ON c.id = p.categorie_id
      LEFT JOIN sous_categories sc ON sc.id = p.sous_categorie_id
      JOIN vendeurs v ON v.id = p.vendeur_id
      ${where}
    `;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params);
    const total = countRows[0].total;

    const [produits] = await pool.query(
      `SELECT p.id, p.nom, p.slug, p.prix, p.prix_promo, p.image_principale,
              p.marque, p.est_promo, p.est_nouveau, p.note_moyenne, p.nb_avis,
              p.description_courte, p.stock,
              c.nom AS categorie_nom, c.slug AS categorie_slug,
              sc.nom AS sous_categorie_nom,
              v.nom_boutique, v.est_verifie
       ${baseQuery}
       ${orderClause}
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      produits,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getProduitBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;

    const [rows] = await pool.query(
      `SELECT p.*,
              c.nom AS categorie_nom, c.slug AS categorie_slug,
              sc.nom AS sous_categorie_nom, sc.slug AS sous_categorie_slug,
              v.nom_boutique, v.email AS vendeur_email, v.telephone AS vendeur_telephone, v.description AS vendeur_description, v.est_verifie
       FROM produits p
       JOIN categories c ON c.id = p.categorie_id
       LEFT JOIN sous_categories sc ON sc.id = p.sous_categorie_id
       JOIN vendeurs v ON v.id = p.vendeur_id
       WHERE p.slug = ? AND p.est_actif = 1 LIMIT 1`,
      [slug]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    const produit = rows[0];

    await pool.query('UPDATE produits SET nb_vues = nb_vues + 1 WHERE id = ?', [produit.id]);

    const [avis] = await pool.query(
      `SELECT a.*, u.nom, u.prenom
       FROM avis a JOIN utilisateurs u ON u.id = a.utilisateur_id
       WHERE a.produit_id = ? AND a.est_approuve = 1
       ORDER BY a.date_creation DESC LIMIT 20`,
      [produit.id]
    );

    const [similaires] = await pool.query(
      `SELECT p.id, p.nom, p.slug, p.prix, p.prix_promo, p.image_principale,
              p.note_moyenne, p.nb_avis, p.est_promo, p.est_nouveau
       FROM produits p
       WHERE p.categorie_id = ? AND p.id != ? AND p.est_actif = 1
       ORDER BY RAND() LIMIT 4`,
      [produit.categorie_id, produit.id]
    );

    res.json({ produit, avis, similaires });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.createProduit = async (req, res) => {
  try {
    const {
      vendeur_id, categorie_id, sous_categorie_id, nom, slug,
      description_courte, description, prix, prix_promo = null,
      stock = 0, image_principale = null, marque = null,
      est_promo = 0, est_nouveau = 0
    } = req.body;

    if (!vendeur_id || !categorie_id || !nom || !prix) {
      return res.status(400).json({ message: 'Champs obligatoires manquants' });
    }

    const slugFinal = slug || nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

    const [result] = await pool.query(
      `INSERT INTO produits (vendeur_id, categorie_id, sous_categorie_id, nom, slug,
        description_courte, description, prix, prix_promo, stock, image_principale, marque,
        est_promo, est_nouveau)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [vendeur_id, categorie_id, sous_categorie_id, nom, slugFinal,
       description_courte || '', description || '', prix, prix_promo, stock, image_principale, marque,
       est_promo ? 1 : 0, est_nouveau ? 1 : 0]
    );

    res.status(201).json({ id: result.insertId, slug: slugFinal, message: 'Produit créé avec succès' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Ce slug existe déjà' });
    }
    res.status(500).json({ message: 'Erreur création produit', error: err.message });
  }
};

exports.deleteProduit = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [result] = await pool.query('UPDATE produits SET est_actif = 0 WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Produit introuvable' });
    res.json({ message: 'Produit désactivé' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur suppression', error: err.message });
  }
};

exports.ajouterAvis = async (req, res) => {
  try {
    const produit_id = parseInt(req.params.id);
    const utilisateur_id = req.user.id;
    const { note, titre, commentaire } = req.body;

    if (!note || note < 1 || note > 5) {
      return res.status(400).json({ message: 'Note invalide (1-5)' });
    }

    await pool.query(
      `INSERT INTO avis (produit_id, utilisateur_id, note, titre, commentaire)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE note=VALUES(note), titre=VALUES(titre), commentaire=VALUES(commentaire), date_creation=CURRENT_TIMESTAMP`,
      [produit_id, utilisateur_id, note, titre || '', commentaire || '']
    );

    await pool.query(
      `UPDATE produits
       SET note_moyenne = (SELECT COALESCE(AVG(note),0) FROM avis WHERE produit_id = ? AND est_approuve=1),
           nb_avis      = (SELECT COUNT(*)        FROM avis WHERE produit_id = ? AND est_approuve=1)
       WHERE id = ?`,
      [produit_id, produit_id, produit_id]
    );

    res.json({ message: 'Avis enregistré avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur enregistrement avis', error: err.message });
  }
};

exports.basculerFavori = async (req, res) => {
  try {
    const produit_id = parseInt(req.params.id);
    const utilisateur_id = req.user.id;

    const [existing] = await pool.query(
      'SELECT id FROM favoris WHERE utilisateur_id = ? AND produit_id = ? LIMIT 1',
      [utilisateur_id, produit_id]
    );

    let estFavori;
    if (existing.length) {
      await pool.query('DELETE FROM favoris WHERE id = ?', [existing[0].id]);
      estFavori = false;
    } else {
      await pool.query('INSERT INTO favoris (utilisateur_id, produit_id) VALUES (?, ?)', [utilisateur_id, produit_id]);
      estFavori = true;
    }
    res.json({ estFavori, message: estFavori ? 'Ajouté aux favoris' : 'Retiré des favoris' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur favoris', error: err.message });
  }
};

exports.getFavoris = async (req, res) => {
  try {
    const utilisateur_id = req.user.id;
    const [rows] = await pool.query(
      `SELECT p.id, p.nom, p.slug, p.prix, p.prix_promo, p.image_principale,
              p.note_moyenne, p.nb_avis, f.date_ajout
       FROM favoris f JOIN produits p ON p.id = f.produit_id
       WHERE f.utilisateur_id = ? AND p.est_actif = 1
       ORDER BY f.date_ajout DESC`,
      [utilisateur_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Erreur récupération favoris', error: err.message });
  }
};
