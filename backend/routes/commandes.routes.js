const express = require('express');
const router = express.Router();
const commandesCtrl = require('../controllers/commandesController');
const { authRequired, adminRequired } = require('../config/auth');

router.post('/',                authRequired, commandesCtrl.creerCommande);
router.get('/',                 authRequired, commandesCtrl.mesCommandes);
router.get('/:id',              authRequired, commandesCtrl.getCommande);
router.post('/:id/confirmer',   authRequired, commandesCtrl.confirmerPaiement);
router.post('/:id/annuler',     authRequired, commandesCtrl.annulerCommande);

module.exports = router;
