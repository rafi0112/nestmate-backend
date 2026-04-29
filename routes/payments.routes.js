const router = require('express').Router();
const paymentsController = require('../controllers/payments.controller');

router.get('/payments', paymentsController.listPayments);
router.post('/payments', paymentsController.createPayment);
router.put('/payments/:id', paymentsController.updatePayment);

module.exports = router;