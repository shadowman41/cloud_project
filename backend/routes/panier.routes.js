const express = require('express');
const router = express.Router();
const panierCtrl = require('../controllers/panierController');
const { authRequired } = require('../config/auth');

router.get('/',                    authRequired, panierCtrl.getPanier);
router.post('/ajouter',            authRequired, panierCtrl.ajouterAuPanier);
router.put('/article/:id',         authRequired, panierCtrl.mettreAJourQuantite);
router.delete('/article/:id',      authRequired, panierCtrl.retirerDuPanier);
router.delete('/vider',            authRequired, panierCtrl.viderPanier);

module.exports = router;
