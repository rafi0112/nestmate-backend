const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listNotifications(req, res) {
  try {
    const { notificationsCol } = getCollections();
    const { userEmail } = req.query;

    if (!userEmail) return res.status(400).send({ message: 'userEmail required' });

    const result = await notificationsCol.find({ userEmail }).sort({ createdAt: -1 }).limit(100).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching notifications', error: err.message });
  }
}

async function createNotification(req, res) {
  try {
    const { notificationsCol } = getCollections();
    const { userId, userEmail, type, title, body, link, metadata } = req.body;

    if (!userEmail || !type || !title || !body) {
      return res.status(400).send({ message: 'Missing required fields' });
    }

    const doc = {
      userId: maybeObjectId(userId),
      userEmail,
      type,
      title,
      body,
      link: link || '',
      metadata: metadata || {},
      read: false,
      readAt: null,
      createdAt: new Date(),
    };

    const result = await notificationsCol.insertOne(doc);
    res.send({ _id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).send({ message: 'Error creating notification', error: err.message });
  }
}

async function markNotificationRead(req, res) {
  try {
    const { notificationsCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

    await notificationsCol.updateOne({ _id: id }, { $set: { read: true, readAt: new Date() } });
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ message: 'Error updating notification', error: err.message });
  }
}

module.exports = {
  listNotifications,
  createNotification,
  markNotificationRead,
};