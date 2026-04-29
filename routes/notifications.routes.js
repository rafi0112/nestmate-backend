const router = require('express').Router();
const notificationsController = require('../controllers/notifications.controller');

router.get('/notifications', notificationsController.listNotifications);
router.post('/notifications', notificationsController.createNotification);
router.patch('/notifications/:id/read', notificationsController.markNotificationRead);

module.exports = router;