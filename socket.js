const { getDb } = require("./config/db");

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
          // track which users have seen this message (room chat -> multiple users)
          seenBy: msg.seenBy || [],
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

    // mark messages in a household as seen by a specific user
    // payload: { householdId, userId }
    socket.on("markAsSeen", async ({ householdId, userId }) => {
      try {
        const db = getDb();
        const roomChatCol = db.collection("room_chat");

        if (!householdId || !userId) return;

        // add userId to seenBy for all unseen messages in the household
        await roomChatCol.updateMany(
          { householdId, seenBy: { $ne: userId } },
          { $addToSet: { seenBy: userId } }
        );

        // compute unread count for this user in the household
        const unreadCount = await roomChatCol.countDocuments({
          householdId,
          seenBy: { $ne: userId },
        });

        // reply only to the requesting socket with the updated count
        socket.emit("unreadCount", { householdId, userId, count: unreadCount });

        // optionally notify the room that messages were marked seen
        io.to(householdId).emit("messagesMarkedSeen", { householdId, userId });
      } catch (err) {
        console.error("markAsSeen error:", err);
      }
    });

    // get unread count for a user in a household
    // payload: { householdId, userId }
    socket.on("getUnreadCount", async ({ householdId, userId }) => {
      try {
        const db = getDb();
        const roomChatCol = db.collection("room_chat");

        if (!householdId || !userId) return;

        const unreadCount = await roomChatCol.countDocuments({
          householdId,
          seenBy: { $ne: userId },
        });

        socket.emit("unreadCount", { householdId, userId, count: unreadCount });
      } catch (err) {
        console.error("getUnreadCount error:", err);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });
};