const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listRoomChat(req, res) {
  try {
    const { roomChatCol } = getCollections();
    const { householdId, since } = req.query;

    if (!householdId) return res.status(400).send({ message: 'householdId required' });

    const id = maybeObjectId(householdId);
    const filter = { $or: [{ householdId }, ...(id ? [{ householdId: id }] : [])] };
    if (since) filter.timestamp = { $gt: new Date(since) };

    const result = await roomChatCol.find(filter).sort({ timestamp: 1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching room chat', error: err.message });
  }
}

async function sendRoomChat(req, res) {
  try {
    const { roomChatCol, messagesCol } = getCollections();
    const { householdId, senderEmail, senderId, senderName, text, mediaUrl, type, replyTo } = req.body;

    if (!householdId || !senderEmail || !senderName || !text) {
      return res.status(400).send({ message: 'Missing required fields' });
    }

    const resolvedHouseholdId = maybeObjectId(householdId) || householdId;
    let replySnapshot = null;
    let parentMessage = null;
    const replyToId = typeof replyTo === 'string' ? replyTo : replyTo?.messageId || replyTo?._id;

    if (replyToId && maybeObjectId(replyToId)) {
      parentMessage = await roomChatCol.findOne({ _id: maybeObjectId(replyToId) });
      if (parentMessage) {
        replySnapshot = {
          messageId: parentMessage._id,
          senderEmail: parentMessage.senderEmail,
          senderName: parentMessage.senderName,
          text: parentMessage.text,
          type: parentMessage.type || 'text',
          externalEmail: parentMessage.externalEmail || '',
          sourceMessageId: parentMessage.sourceMessageId || null,
          listingId: parentMessage.listingId || '',
          listingTitle: parentMessage.listingTitle || '',
        };
      }
    }

    const doc = {
      householdId: resolvedHouseholdId,
      senderEmail,
      senderId: maybeObjectId(senderId),
      senderName,
      text,
      mediaUrl: mediaUrl || '',
      type: type || 'text',
      listingId: parentMessage?.listingId || '',
      listingTitle: parentMessage?.listingTitle || '',
      externalEmail: parentMessage?.externalEmail || '',
      sourceMessageId: null,
      replyTo: replySnapshot,
      reactions: {},
      edited: false,
      deletedAt: null,
      timestamp: new Date(),
    };

    const result = await roomChatCol.insertOne(doc);
    const insertedRoomMessage = { _id: result.insertedId, ...doc };

    if (parentMessage?.externalEmail && parentMessage.externalEmail !== senderEmail) {
      const directReply = {
        fromEmail: senderEmail,
        toEmail: parentMessage.externalEmail,
        fromId: maybeObjectId(senderId),
        toId: null,
        listingId: parentMessage.listingId || '',
        listingTitle: parentMessage.listingTitle || '',
        householdId: resolvedHouseholdId,
        text,
        mediaUrl: mediaUrl || '',
        read: false,
        readAt: null,
        deleted: false,
        sourceRoomChatId: result.insertedId,
        replyToMessageId: parentMessage.sourceMessageId || null,
        timestamp: doc.timestamp,
      };

      await messagesCol.insertOne(directReply);
    }

    res.send(insertedRoomMessage);
  } catch (err) {
    res.status(500).send({ message: 'Error sending room message', error: err.message });
  }
}

module.exports = {
  listRoomChat,
  sendRoomChat,
};