const express = require('express');
const router = express.Router();
const categoriesCtrl = require('../controllers/categoriesController');

router.get('/',         categoriesCtrl.getAllCategories);
router.get('/:slug',    categoriesCtrl.getCategorieBySlug);
router.get('/sous/:slug', categoriesCtrl.getSousCategorieBySlug);

module.exports = router;
