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

    socket.on("disconnect", () => {
      console.log("❌ Disconnected:", socket.id);
    });
  });
};