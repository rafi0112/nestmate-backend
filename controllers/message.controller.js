const { getCollections } = require('../config/db');
const { maybeObjectId, displayNameFromEmail } = require('../utils/helpers');
const { messagesCacheKey } = require('../utils/cacheKeys');
const { getCache, setCache, deleteCache } = require('../utils/redis');

async function findHouseholdByListingId(householdsCol, listingId) {
  if (!listingId) return null;
  const id = maybeObjectId(listingId);
  return householdsCol.findOne({ $or: [{ listingId }, ...(id ? [{ listingId: id }] : [])] });
}

async function listMessages(req, res) {
  try {
    const { messagesCol } = getCollections();
    const { userEmail } = req.query;

    if (!userEmail) return res.status(400).send({ message: 'userEmail required' });

    const cacheKey = messagesCacheKey(userEmail);
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log('⚡ Redis HIT (messages)');
      return res.send(cached);
    }

    const result = await messagesCol
      .find({ deleted: { $ne: true }, $or: [{ fromEmail: userEmail }, { toEmail: userEmail }] })
      .sort({ timestamp: 1 })
      .toArray();

    await setCache(cacheKey, result, 30);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching messages', error: err.message });
  }
}

async function sendMessage(req, res) {
  try {
    const { messagesCol, roomChatCol, householdsCol } = getCollections();
    const { fromEmail, toEmail, fromId, toId, listingId, listingTitle, text, mediaUrl, fromName } = req.body;

    if (!fromEmail || !toEmail || !text) return res.status(400).send({ message: 'Missing required fields' });

    const household = await findHouseholdByListingId(householdsCol, listingId);
    const doc = {
      fromEmail,
      toEmail,
      fromId: maybeObjectId(fromId),
      toId: maybeObjectId(toId),
      listingId: listingId || '',
      listingTitle: listingTitle || '',
      householdId: household?._id || null,
      text,
      mediaUrl: mediaUrl || '',
      read: false,
      readAt: null,
      deleted: false,
      timestamp: new Date(),
    };

    const result = await messagesCol.insertOne(doc);
    const insertedMessage = { _id: result.insertedId, ...doc };

    const householdMembers = household ? new Set([household.ownerEmail, ...(household.members || [])].filter(Boolean)) : null;
    if (household && !householdMembers.has(fromEmail)) {
      const roomInquiry = {
        householdId: household._id,
        senderEmail: fromEmail,
        senderId: maybeObjectId(fromId),
        senderName: fromName || displayNameFromEmail(fromEmail),
        text,
        mediaUrl: mediaUrl || '',
        type: 'listing_inquiry',
        listingId: listingId || '',
        listingTitle: listingTitle || household.listingTitle || household.name || '',
        externalEmail: fromEmail,
        sourceMessageId: result.insertedId,
        replyTo: null,
        reactions: {},
        edited: false,
        deletedAt: null,
        timestamp: doc.timestamp,
      };

      await roomChatCol.insertOne(roomInquiry);
    }

    await deleteCache(messagesCacheKey(fromEmail));
    await deleteCache(messagesCacheKey(toEmail));
    res.send(insertedMessage);
  } catch (err) {
    res.status(500).send({ message: 'Error sending message', error: err.message });
  }
}

async function markMessageRead(req, res) {
  try {
    const { messagesCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

    await messagesCol.updateOne({ _id: id }, { $set: { read: true, readAt: new Date() } });
    res.send({ success: true });
  } catch (err) {
    res.status(500).send({ message: 'Error marking read', error: err.message });
  }
}

module.exports = {
  listMessages,
  sendMessage,
  markMessageRead,
};