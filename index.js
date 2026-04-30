require('dotenv').config();

const express = require('express');
const cors = require('cors');

const http = require("http");
const { Server } = require("socket.io");

const { connectDb } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const systemRoutes = require('./routes/system.routes');
const usersRoutes = require('./routes/users.routes');
const roommateRoutes = require('./routes/roommate.routes');
const householdRoutes = require('./routes/household.routes');
const messageRoutes = require('./routes/message.routes');
const ledgerRoutes = require('./routes/ledger.routes');
const mealsRoutes = require('./routes/meals.routes');
const paymentsRoutes = require('./routes/payments.routes');
const roomChatRoutes = require('./routes/roomChat.routes');
const reviewsRoutes = require('./routes/reviews.routes');
const notificationsRoutes = require('./routes/notifications.routes');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(systemRoutes);
app.use(usersRoutes);
app.use(roommateRoutes);
app.use(householdRoutes);
app.use(messageRoutes);
app.use(ledgerRoutes);
app.use(mealsRoutes);
app.use(paymentsRoutes);
app.use(roomChatRoutes);
app.use(reviewsRoutes);
app.use(notificationsRoutes);

app.use(errorHandler);

async function bootstrap() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set');
    }

    await connectDb(process.env.MONGODB_URI, 'nestmate');

    // ✅ Create HTTP server
    const server = http.createServer(app);

    // ✅ Attach socket
    const io = new Server(server, {
      cors: {
        origin: "*", // later restrict
      },
    });

    // ✅ Initialize socket logic
    require('./socket')(io);

    server.listen(port, () => {
      console.log(`🚀 Server with Socket on port ${port}`);
    });

  } catch (err) {
    console.error('❌ Startup error:', err);
    process.exit(1);
  }
}

bootstrap();
