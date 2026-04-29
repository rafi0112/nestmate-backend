const router = require('express').Router();
const ledgerController = require('../controllers/ledger.controller');

router.get('/ledger', ledgerController.listLedger);
router.post('/ledger', ledgerController.createLedgerEntry);
router.delete('/ledger/:id', ledgerController.deleteLedgerEntry);

module.exports = router;