const router = require('express').Router();
const systemController = require('../controllers/system.controller');

router.get('/', systemController.getRoot);
router.get('/stats', systemController.getStats);

module.exports = router;