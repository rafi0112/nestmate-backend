const router = require('express').Router();
const roomChatController = require('../controllers/roomChat.controller');

router.get('/room-chat', roomChatController.listRoomChat);
router.post('/room-chat', roomChatController.sendRoomChat);

module.exports = router;