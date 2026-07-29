const express = require('express');
const router = express.Router();
const produitsCtrl = require('../controllers/produitsController');
const { authRequired, adminRequired } = require('../config/auth');

router.get('/',       produitsCtrl.getAllProduits);
router.get('/slug/:slug', produitsCtrl.getProduitBySlug);
router.post('/',      adminRequired, produitsCtrl.createProduit);
router.delete('/:id', adminRequired, produitsCtrl.deleteProduit);

router.get('/favoris',     authRequired, produitsCtrl.getFavoris);
router.post('/:id/favori', authRequired, produitsCtrl.basculerFavori);
router.post('/:id/avis',   authRequired, produitsCtrl.ajouterAvis);

module.exports = router;
