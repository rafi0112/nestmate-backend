const router = require('express').Router();
const messageController = require('../controllers/message.controller');

router.get('/messages', messageController.listMessages);
router.post('/messages', messageController.sendMessage);
router.patch('/messages/:id/read', messageController.markMessageRead);

module.exports = router;