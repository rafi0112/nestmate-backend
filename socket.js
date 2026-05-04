const { getDb } = require("./config/db");
const { messagesCacheKey } = require("./utils/cacheKeys");
const { deleteCache } = require("./utils/redis");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Connected:", socket.id);

    // join room
    socket.on("join_room", (householdId) => {
      socket.join(householdId);
    });

    // send message
    socket.on("send_message", async (msg) => {
      try {
        const db = getDb();
        const roomChatCol = db.collection("room_chat");

        const doc = {
          ...msg,
          isAnnouncement: msg.isAnnouncement || false,
          isPinned: msg.isPinned || false,
          timestamp: new Date(),
        };
        
        io.to(msg.householdId).emit("receive_message", doc);
        
        try {
          await roomChatCol.insertOne(doc);
        } catch (err) {
          console.error("DB save failed:", err);
        }

      } catch (err) {
        console.error("Socket error:", err);
      }
    });

    // mark direct messages as read between two users
    // payload: { otherEmail, userEmail }
    socket.on("markAsSeen", async ({ otherEmail, userEmail }) => {
      try {
        const db = getDb();
        const messagesCol = db.collection("messages");

        if (!otherEmail || !userEmail) return;

        // ✅ PERSIST TO DATABASE: mark all unread messages from otherEmail as read
        await messagesCol.updateMany(
          { fromEmail: otherEmail, toEmail: userEmail, read: false },
          { $set: { read: true, readAt: new Date() } }
        );

        // ✅ INVALIDATE REDIS CACHE so polling gets fresh data
        await deleteCache(messagesCacheKey(userEmail));
        await deleteCache(messagesCacheKey(otherEmail));

        // get updated unread count for this conversation
        const unreadCount = await messagesCol.countDocuments({
          fromEmail: otherEmail,
          toEmail: userEmail,
          read: false,
        });

        // emit updated count back to client
        socket.emit("unreadCount", { from: otherEmail, count: unreadCount });

        console.log(`✅ Marked as read: ${otherEmail} → ${userEmail}. Remaining unread: ${unreadCount}`);
      } catch (err) {
        console.error("markAsSeen error:", err);
      }
    });

    // get unread count for a specific conversation between two users
    // payload: { otherEmail, userEmail }
    socket.on("getUnreadCount", async ({ otherEmail, userEmail }) => {
      try {
        const db = getDb();
        const messagesCol = db.collection("messages");

        if (!otherEmail || !userEmail) return;

        // count unread messages from otherEmail to userEmail
        const unreadCount = await messagesCol.countDocuments({
          fromEmail: otherEmail,
          toEmail: userEmail,
          read: false,
        });

        socket.emit("unreadCount", { from: otherEmail, count: unreadCount });
      } catch (err) {
        console.error("getUnreadCount error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });
};