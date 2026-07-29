const pool = require('../config/database');

exports.getAllCategories = async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM produits p WHERE p.categorie_id = c.id AND p.est_actif = 1) AS nb_produits
       FROM categories c
       WHERE c.actif = 1
       ORDER BY c.ordre ASC`
    );
    for (const cat of categories) {
      const [sous] = await pool.query(
        `SELECT id, nom, slug, icone, ordre
         FROM sous_categories WHERE categorie_id = ? AND actif = 1 ORDER BY ordre ASC`,
        [cat.id]
      );
      cat.sous_categories = sous;
    }
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getCategorieBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const [cats] = await pool.query('SELECT * FROM categories WHERE slug = ? AND actif = 1 LIMIT 1', [slug]);
    if (cats.length === 0) return res.status(404).json({ message: 'Catégorie introuvable' });
    const cat = cats[0];
    const [sous] = await pool.query(
      `SELECT sc.*,
              (SELECT COUNT(*) FROM produits p WHERE p.sous_categorie_id = sc.id AND p.est_actif=1) AS nb_produits
       FROM sous_categories sc WHERE sc.categorie_id = ? AND sc.actif = 1 ORDER BY sc.ordre ASC`,
      [cat.id]
    );
    cat.sous_categories = sous;
    res.json(cat);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

exports.getSousCategorieBySlug = async (req, res) => {
  try {
    const slug = req.params.slug;
    const [rows] = await pool.query(
      `SELECT sc.*, c.nom AS categorie_nom, c.slug AS categorie_slug
       FROM sous_categories sc
       JOIN categories c ON c.id = sc.categorie_id
       WHERE sc.slug = ? AND sc.actif = 1 LIMIT 1`,
      [slug]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Sous-catégorie introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
