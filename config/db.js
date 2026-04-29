const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

let client;
let database;
let collections;

const indexPlan = [
  ['users', [
    [{ email: 1 }, { unique: true }],
    [{ firebaseUid: 1 }, { unique: true }],
    [{ householdId: 1 }],
    [{ preferredCity: 1, isVerified: 1 }],
    [{ lastSeen: -1 }],
  ]],
  ['roommates', [
    [{ userEmail: 1 }],
    [{ userId: 1 }],
    [{ location: 1, rentAmount: 1 }],
    [{ city: 1, availability: 1, roomType: 1 }],
    [{ coordinates: '2dsphere' }, { sparse: true }],
    [{ likes: 1 }],
    [{ status: 1, expiresAt: 1 }],
    [{ createdAt: -1 }],
    [{ title: 'text', description: 'text', location: 'text' }],
  ]],
  ['households', [
    [{ joinCode: 1 }, { unique: true }],
    [{ members: 1 }],
    [{ ownerEmail: 1 }],
    [{ listingId: 1 }],
    [{ isActive: 1 }],
  ]],
  ['messages', [
    [{ fromEmail: 1, toEmail: 1, timestamp: 1 }],
    [{ toEmail: 1, read: 1 }],
    [{ listingId: 1, timestamp: 1 }],
    [{ timestamp: -1 }],
    [{ fromId: 1, toId: 1, listingId: 1 }],
  ]],
  ['ledger', [
    [{ householdId: 1, date: -1 }],
    [{ householdId: 1, paidBy: 1 }],
    [{ householdId: 1, category: 1 }],
  ]],
  ['meals', [
    [{ householdId: 1, date: 1 }],
    [{ householdId: 1, userEmail: 1, date: 1 }, { unique: true }],
    [{ householdId: 1, userEmail: 1 }],
  ]],
  ['payments', [
    [{ householdId: 1, month: 1 }],
    [{ householdId: 1, fromEmail: 1, month: 1 }],
    [{ householdId: 1, status: 1 }],
    [{ date: -1 }],
  ]],
  ['room_chat', [
    [{ householdId: 1, timestamp: 1 }],
    [{ householdId: 1, senderEmail: 1 }],
    [{ householdId: 1, externalEmail: 1, timestamp: 1 }],
    [{ sourceMessageId: 1 }, { sparse: true }],
    [{ timestamp: 1 }, { expireAfterSeconds: 7776000 }],
  ]],
  ['reviews', [
    [{ householdId: 1, rating: -1 }],
    [{ authorEmail: 1 }],
    [{ rating: -1, date: -1 }],
    [{ houseName: 'text', text: 'text' }],
    [{ verified: 1, date: -1 }],
  ]],
  ['notifications', [
    [{ userId: 1, read: 1, createdAt: -1 }],
    [{ userEmail: 1, read: 1 }],
    [{ type: 1, createdAt: -1 }],
    [{ readAt: 1 }, { expireAfterSeconds: 2592000 }],
  ]],
];

async function connectDb(uri, dbName = 'nestmate') {
  if (database) return { client, db: database, collections };

  client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
  });

  await client.connect();
  database = client.db(dbName);

  collections = {
    usersCol: database.collection('users'),
    roommatesCol: database.collection('roommates'),
    householdsCol: database.collection('households'),
    messagesCol: database.collection('messages'),
    ledgerCol: database.collection('ledger'),
    mealsCol: database.collection('meals'),
    paymentsCol: database.collection('payments'),
    roomChatCol: database.collection('room_chat'),
    reviewsCol: database.collection('reviews'),
    notificationsCol: database.collection('notifications'),
  };

  await Promise.all(
    indexPlan.map(async ([name, definitions]) => {
      const collection = database.collection(name);
      await Promise.all(definitions.map(([spec, options]) => collection.createIndex(spec, options || {})));
    })
  );

  await client.db('admin').command({ ping: 1 });

  return { client, db: database, collections };
}

function getDb() {
  if (!database) {
    throw new Error('Database has not been connected yet');
  }

  return database;
}

function getCollections() {
  if (!collections) {
    throw new Error('Collections have not been initialized yet');
  }

  return collections;
}

module.exports = {
  connectDb,
  getDb,
  getCollections,
  ObjectId,
};