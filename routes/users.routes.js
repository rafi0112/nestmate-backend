const router = require('express').Router();
const usersController = require('../controllers/users.controller');

router.post('/users/upsert', usersController.upsertUser);
router.get('/users/by-email/:email', usersController.getUserByEmail);

module.exports = router;