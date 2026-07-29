const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const { authRequired } = require('../config/auth');

router.post('/register', authCtrl.validateRegister, authCtrl.register);
router.post('/login',    authCtrl.validateLogin,    authCtrl.login);

router.get('/me',             authRequired, authCtrl.me);
router.put('/profil',         authRequired, authCtrl.updateProfil);
router.put('/change-password', authRequired, authCtrl.changePassword);

module.exports = router;
