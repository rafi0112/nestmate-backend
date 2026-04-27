const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: false, deprecationErrors: true },
});

const generateJoinCode = () =>
  Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

const maybeObjectId = (value) => {
  if (!value || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
};

async function run() {
  try {
    await client.connect();

    const db = client.db('nestmate');

    // ── Collections (new architecture) ─────────────────────────────────────
    const usersCol = db.collection('users');
    const roommatesCol = db.collection('roommates');
    const householdsCol = db.collection('households');
    const messagesCol = db.collection('messages');
    const ledgerCol = db.collection('ledger');
    const mealsCol = db.collection('meals');
    const paymentsCol = db.collection('payments');
    const roomChatCol = db.collection('room_chat');
    const reviewsCol = db.collection('reviews');
    const notificationsCol = db.collection('notifications');

    // ── Indexes ─────────────────────────────────────────────────────────────
    await Promise.all([
      usersCol.createIndex({ email: 1 }, { unique: true }),
      usersCol.createIndex({ firebaseUid: 1 }, { unique: true }),
      usersCol.createIndex({ householdId: 1 }),
      usersCol.createIndex({ preferredCity: 1, isVerified: 1 }),
      usersCol.createIndex({ lastSeen: -1 }),

      roommatesCol.createIndex({ userEmail: 1 }),
      roommatesCol.createIndex({ userId: 1 }),
      roommatesCol.createIndex({ location: 1, rentAmount: 1 }),
      roommatesCol.createIndex({ city: 1, availability: 1, roomType: 1 }),
      roommatesCol.createIndex({ coordinates: '2dsphere' }, { sparse: true }),
      roommatesCol.createIndex({ likes: 1 }),
      roommatesCol.createIndex({ status: 1, expiresAt: 1 }),
      roommatesCol.createIndex({ createdAt: -1 }),
      roommatesCol.createIndex({ title: 'text', description: 'text', location: 'text' }),

      householdsCol.createIndex({ joinCode: 1 }, { unique: true }),
      householdsCol.createIndex({ members: 1 }),
      householdsCol.createIndex({ ownerEmail: 1 }),
      householdsCol.createIndex({ listingId: 1 }),
      householdsCol.createIndex({ isActive: 1 }),

      messagesCol.createIndex({ fromEmail: 1, toEmail: 1, timestamp: 1 }),
      messagesCol.createIndex({ toEmail: 1, read: 1 }),
      messagesCol.createIndex({ listingId: 1, timestamp: 1 }),
      messagesCol.createIndex({ timestamp: -1 }),
      messagesCol.createIndex({ fromId: 1, toId: 1, listingId: 1 }),

      ledgerCol.createIndex({ householdId: 1, date: -1 }),
      ledgerCol.createIndex({ householdId: 1, paidBy: 1 }),
      ledgerCol.createIndex({ householdId: 1, category: 1 }),

      mealsCol.createIndex({ householdId: 1, date: 1 }),
      mealsCol.createIndex({ householdId: 1, userEmail: 1, date: 1 }, { unique: true }),
      mealsCol.createIndex({ householdId: 1, userEmail: 1 }),

      paymentsCol.createIndex({ householdId: 1, month: 1 }),
      paymentsCol.createIndex({ householdId: 1, fromEmail: 1, month: 1 }),
      paymentsCol.createIndex({ householdId: 1, status: 1 }),
      paymentsCol.createIndex({ date: -1 }),

      roomChatCol.createIndex({ householdId: 1, timestamp: 1 }),
      roomChatCol.createIndex({ householdId: 1, senderEmail: 1 }),
      roomChatCol.createIndex({ householdId: 1, externalEmail: 1, timestamp: 1 }),
      roomChatCol.createIndex({ sourceMessageId: 1 }, { sparse: true }),
      roomChatCol.createIndex({ timestamp: 1 }, { expireAfterSeconds: 7776000 }),

      reviewsCol.createIndex({ householdId: 1, rating: -1 }),
      reviewsCol.createIndex({ authorEmail: 1 }),
      reviewsCol.createIndex({ rating: -1, date: -1 }),
      reviewsCol.createIndex({ houseName: 'text', text: 'text' }),
      reviewsCol.createIndex({ verified: 1, date: -1 }),

      notificationsCol.createIndex({ userId: 1, read: 1, createdAt: -1 }),
      notificationsCol.createIndex({ userEmail: 1, read: 1 }),
      notificationsCol.createIndex({ type: 1, createdAt: -1 }),
      notificationsCol.createIndex({ readAt: 1 }, { expireAfterSeconds: 2592000 }),
    ]);

    const findHouseholdByListingId = async (listingId) => {
      if (!listingId) return null;
      const id = maybeObjectId(listingId);
      return householdsCol.findOne({ $or: [{ listingId }, ...(id ? [{ listingId: id }] : [])] });
    };

    const displayNameFromEmail = (email) =>
      String(email || 'Guest')
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());

    // ════════════════════════════════════════════════════════════════════════
    //  USERS
    // ════════════════════════════════════════════════════════════════════════
    app.post('/users/upsert', async (req, res) => {
      try {
        const { firebaseUid, email, displayName, photoURL, phone, bio, preferredCity, lifestylePrefs, quizProfile } = req.body;
        if (!firebaseUid || !email || !displayName) {
          return res.status(400).send({ message: 'firebaseUid, email, displayName required' });
        }

        const update = {
          $set: {
            firebaseUid,
            email,
            displayName,
            photoURL: photoURL || '',
            phone: phone || '',
            bio: bio || '',
            preferredCity: preferredCity || '',
            lifestylePrefs: lifestylePrefs || {},
            quizProfile: quizProfile || {},
            lastSeen: new Date(),
            updatedAt: new Date(),
          },
          $setOnInsert: {
            isVerified: false,
            savedListings: [],
            createdAt: new Date(),
          },
        };

        await usersCol.updateOne({ firebaseUid }, update, { upsert: true });
        const doc = await usersCol.findOne({ firebaseUid });
        res.send(doc);
      } catch (err) {
        res.status(500).send({ message: 'Error upserting user', error: err.message });
      }
    });

    app.get('/users/by-email/:email', async (req, res) => {
      try {
        const doc = await usersCol.findOne({ email: req.params.email });
        res.send(doc || null);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching user', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  ROOMMATES (Listings)
    // ════════════════════════════════════════════════════════════════════════
    app.post('/roommate', async (req, res) => {
      try {
        const now = new Date();
        const {
          userEmail,
          userId,
          title,
          description,
          location,
          city,
          coordinates,
          rentAmount,
          roomType,
          availability,
          imageUrls,
          lifestylePreferences,
          amenities,
          contactInfo,
          isFeatured,
          status,
          expiresAt,
          ownerUid,
          ownerEmail,
          ownerName,
          imageUrl,
        } = req.body;

        const resolvedEmail = userEmail || ownerEmail;
        if (!resolvedEmail || !title || !description || !location || rentAmount === undefined || !contactInfo) {
          return res.status(400).send({ message: 'Missing required listing fields' });
        }

        const doc = {
          userEmail: resolvedEmail,
          userId: maybeObjectId(userId),
          title,
          description,
          location,
          city: city || location,
          coordinates: coordinates || null,
          rentAmount: Number(rentAmount),
          roomType: roomType || 'Single',
          availability: availability || 'Available',
          imageUrls: imageUrls && Array.isArray(imageUrls) ? imageUrls : (imageUrl ? [imageUrl] : []),
          lifestylePreferences: lifestylePreferences || {},
          amenities: Array.isArray(amenities) ? amenities : [],
          contactInfo,
          likes: [],
          viewCount: 0,
          isFeatured: Boolean(isFeatured),
          status: status || 'active',
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          createdAt: now,
          updatedAt: now,
          ownerUid: ownerUid || '',
          ownerEmail: ownerEmail || resolvedEmail,
          ownerName: ownerName || resolvedEmail.split('@')[0],
        };

        const result = await roommatesCol.insertOne(doc);
        res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        res.status(500).send({ message: 'Error creating listing', error: err.message });
      }
    });

    app.get('/roommate', async (req, res) => {
      try {
        const { q, city, roomType, minRent, maxRent, status, userEmail } = req.query;
        const filter = {};
        if (status) filter.status = status;
        else filter.status = { $ne: 'deleted' };
        if (userEmail) filter.$or = [{ userEmail }, { ownerEmail: userEmail }];
        if (city) filter.city = city;
        if (roomType) filter.roomType = roomType;
        if (minRent || maxRent) {
          filter.rentAmount = {};
          if (minRent) filter.rentAmount.$gte = Number(minRent);
          if (maxRent) filter.rentAmount.$lte = Number(maxRent);
        }
        if (q) filter.$text = { $search: q };

        const result = await roommatesCol.find(filter).sort({ createdAt: -1 }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching listings', error: err.message });
      }
    });

    app.get('/roommate/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const id = new ObjectId(req.params.id);
        await roommatesCol.updateOne({ _id: id }, { $inc: { viewCount: 1 }, $set: { updatedAt: new Date() } });
        const result = await roommatesCol.findOne({ _id: id });
        res.send(result || null);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching listing', error: err.message });
      }
    });

    app.put('/roommate/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const id = new ObjectId(req.params.id);
        const { userEmail, action, ...fields } = req.body;
        let update;

        if (action === 'like' && userEmail) update = { $addToSet: { likes: userEmail }, $set: { updatedAt: new Date() } };
        else if (action === 'unlike' && userEmail) update = { $pull: { likes: userEmail }, $set: { updatedAt: new Date() } };
        else update = { $set: { ...fields, updatedAt: new Date() } };

        await roommatesCol.updateOne({ _id: id }, update);
        const updated = await roommatesCol.findOne({ _id: id });
        res.send(updated);
      } catch (err) {
        res.status(500).send({ message: 'Error updating listing', error: err.message });
      }
    });

    app.delete('/roommate/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const result = await roommatesCol.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error deleting listing', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  HOUSEHOLDS
    // ════════════════════════════════════════════════════════════════════════
    app.get('/households', async (req, res) => {
      try {
        const { listingId, memberEmail } = req.query;
        if (listingId) {
          const id = maybeObjectId(listingId);
          const result = await householdsCol.findOne({ $or: [{ listingId: listingId }, ...(id ? [{ listingId: id }] : [])] });
          return res.send(result || null);
        }
        if (memberEmail) {
          const result = await householdsCol.findOne({ members: memberEmail });
          return res.send(result || null);
        }
        res.send(null);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching household', error: err.message });
      }
    });

    app.get('/households/all', async (req, res) => {
      try {
        const { memberEmail } = req.query;
        if (!memberEmail) return res.status(400).send({ message: 'memberEmail required' });
        const result = await householdsCol.find({ members: memberEmail }).sort({ createdAt: -1 }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching households', error: err.message });
      }
    });

    app.post('/households', async (req, res) => {
      try {
        const { listingId, listingTitle, ownerEmail, joinCode, members, memberIds, monthlyFee, name, address, rules, settings } = req.body;
        if (!ownerEmail) return res.status(400).send({ message: 'ownerEmail required' });

        let resolvedJoinCode = (joinCode || generateJoinCode()).toUpperCase().trim();
        for (let i = 0; i < 6; i += 1) {
          const exists = await householdsCol.findOne({ joinCode: resolvedJoinCode });
          if (!exists) break;
          resolvedJoinCode = generateJoinCode();
        }

        const doc = {
          listingId: maybeObjectId(listingId) || listingId || null,
          listingTitle: listingTitle || '',
          ownerEmail,
          joinCode: resolvedJoinCode,
          members: Array.isArray(members) && members.length ? members : [ownerEmail],
          memberIds: Array.isArray(memberIds) ? memberIds.map(maybeObjectId).filter(Boolean) : [],
          monthlyFee: Number(monthlyFee) || 0,
          name: name || listingTitle || 'Household',
          address: address || '',
          rules: rules || '',
          settings: settings || {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await householdsCol.insertOne(doc);
        res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        res.status(500).send({ message: 'Error creating household', error: err.message });
      }
    });

    app.post('/households/join', async (req, res) => {
      try {
        const { joinCode, userEmail, userId } = req.body;
        if (!joinCode || !userEmail) return res.status(400).send({ message: 'joinCode and userEmail required' });

        const household = await householdsCol.findOne({ joinCode: joinCode.toUpperCase().trim() });
        if (!household) return res.status(404).send({ message: 'Invalid join code' });

        await householdsCol.updateOne(
          { _id: household._id },
          {
            $addToSet: {
              members: userEmail,
              ...(userId && maybeObjectId(userId) ? { memberIds: maybeObjectId(userId) } : {}),
            },
            $set: { updatedAt: new Date() },
          }
        );

        const updated = await householdsCol.findOne({ _id: household._id });
        res.send(updated);
      } catch (err) {
        res.status(500).send({ message: 'Error joining household', error: err.message });
      }
    });

    app.put('/households/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const { monthlyFee, listingTitle, name, address, rules, settings, isActive } = req.body;
        const update = { updatedAt: new Date() };
        if (monthlyFee !== undefined) update.monthlyFee = Number(monthlyFee);
        if (listingTitle !== undefined) update.listingTitle = listingTitle;
        if (name !== undefined) update.name = name;
        if (address !== undefined) update.address = address;
        if (rules !== undefined) update.rules = rules;
        if (settings !== undefined) update.settings = settings;
        if (isActive !== undefined) update.isActive = Boolean(isActive);

        await householdsCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        const updated = await householdsCol.findOne({ _id: new ObjectId(req.params.id) });
        res.send(updated);
      } catch (err) {
        res.status(500).send({ message: 'Error updating household', error: err.message });
      }
    });

    // compatibility aliases for previously migrated frontend
    app.get('/groups', async (req, res) => {
      try {
        const { listingId, memberEmail } = req.query;
        if (listingId) {
          const id = maybeObjectId(listingId);
          const h = await householdsCol.findOne({ $or: [{ listingId: listingId }, ...(id ? [{ listingId: id }] : [])] });
          return res.send(h || null);
        }
        if (memberEmail) {
          const h = await householdsCol.findOne({ members: memberEmail });
          return res.send(h || null);
        }
        const all = await householdsCol.find({}).sort({ createdAt: -1 }).toArray();
        return res.send(all);
      } catch (err) {
        return res.status(500).send({ message: 'Error fetching groups', error: err.message });
      }
    });

    app.post('/groups', async (req, res) => {
      try {
        const { name, listingId, listingTitle, ownerEmail, joinCode, monthlyFee } = req.body;
        if (!ownerEmail) return res.status(400).send({ message: 'ownerEmail required' });

        let resolvedJoinCode = (joinCode || generateJoinCode()).toUpperCase().trim();
        for (let i = 0; i < 6; i += 1) {
          const exists = await householdsCol.findOne({ joinCode: resolvedJoinCode });
          if (!exists) break;
          resolvedJoinCode = generateJoinCode();
        }

        const doc = {
          listingId: maybeObjectId(listingId) || listingId || null,
          listingTitle: listingTitle || name || 'Household',
          ownerEmail,
          joinCode: resolvedJoinCode,
          members: [ownerEmail],
          memberIds: [],
          monthlyFee: Number(monthlyFee) || 0,
          name: name || listingTitle || 'Household',
          address: '',
          rules: '',
          settings: {},
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const result = await householdsCol.insertOne(doc);
        return res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        return res.status(500).send({ message: 'Error creating group', error: err.message });
      }
    });

    app.post('/groups/join', async (req, res) => {
      try {
        const joinCode = req.body.joinCode;
        const userEmail = req.body.userEmail || req.body.userUid;
        if (!joinCode || !userEmail) return res.status(400).send({ message: 'joinCode and userEmail required' });

        const household = await householdsCol.findOne({ joinCode: joinCode.toUpperCase().trim() });
        if (!household) return res.status(404).send({ message: 'Invalid join code' });

        await householdsCol.updateOne(
          { _id: household._id },
          { $addToSet: { members: userEmail }, $set: { updatedAt: new Date() } }
        );
        const updated = await householdsCol.findOne({ _id: household._id });
        return res.send(updated);
      } catch (err) {
        return res.status(500).send({ message: 'Error joining group', error: err.message });
      }
    });

    app.put('/groups/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const { monthlyFee, listingTitle, name, address, rules, settings, isActive } = req.body;
        const update = { updatedAt: new Date() };
        if (monthlyFee !== undefined) update.monthlyFee = Number(monthlyFee);
        if (listingTitle !== undefined) update.listingTitle = listingTitle;
        if (name !== undefined) update.name = name;
        if (address !== undefined) update.address = address;
        if (rules !== undefined) update.rules = rules;
        if (settings !== undefined) update.settings = settings;
        if (isActive !== undefined) update.isActive = Boolean(isActive);

        await householdsCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
        const updated = await householdsCol.findOne({ _id: new ObjectId(req.params.id) });
        return res.send(updated);
      } catch (err) {
        return res.status(500).send({ message: 'Error updating group', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  MESSAGES (Direct)
    // ════════════════════════════════════════════════════════════════════════
    app.get('/messages', async (req, res) => {
      try {
        const { userEmail } = req.query;
        if (!userEmail) return res.status(400).send({ message: 'userEmail required' });
        const result = await messagesCol
          .find({ deleted: { $ne: true }, $or: [{ fromEmail: userEmail }, { toEmail: userEmail }] })
          .sort({ timestamp: 1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching messages', error: err.message });
      }
    });

    app.post('/messages', async (req, res) => {
      try {
        const { fromEmail, toEmail, fromId, toId, listingId, listingTitle, text, mediaUrl, fromName } = req.body;
        if (!fromEmail || !toEmail || !text) return res.status(400).send({ message: 'Missing required fields' });
        const household = await findHouseholdByListingId(listingId);
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
        res.send(insertedMessage);
      } catch (err) {
        res.status(500).send({ message: 'Error sending message', error: err.message });
      }
    });

    app.patch('/messages/:id/read', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        await messagesCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { read: true, readAt: new Date() } });
        res.send({ success: true });
      } catch (err) {
        res.status(500).send({ message: 'Error marking read', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  LEDGER
    // ════════════════════════════════════════════════════════════════════════
    app.get('/ledger', async (req, res) => {
      try {
        const { householdId } = req.query;
        if (!householdId) return res.status(400).send({ message: 'householdId required' });
        const id = maybeObjectId(householdId);
        const result = await ledgerCol
          .find({ $or: [{ householdId: householdId }, ...(id ? [{ householdId: id }] : [])] })
          .sort({ date: -1, createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching ledger', error: err.message });
      }
    });

    app.post('/ledger', async (req, res) => {
      try {
        const { householdId, item, amount, currency, date, paidBy, paidById, category, receipt, splitWith } = req.body;
        if (!householdId || !item || amount === undefined || !paidBy || !date) {
          return res.status(400).send({ message: 'Missing required fields' });
        }
        const doc = {
          householdId: maybeObjectId(householdId) || householdId,
          item,
          amount: Number(amount),
          currency: currency || 'BDT',
          date,
          paidBy,
          paidById: maybeObjectId(paidById),
          category: category || 'market',
          receipt: receipt || '',
          splitWith: Array.isArray(splitWith) ? splitWith : [],
          createdAt: new Date(),
        };
        const result = await ledgerCol.insertOne(doc);
        res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        res.status(500).send({ message: 'Error creating ledger entry', error: err.message });
      }
    });

    app.delete('/ledger/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const result = await ledgerCol.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error deleting ledger entry', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  MEALS
    // ════════════════════════════════════════════════════════════════════════
    app.get('/meals', async (req, res) => {
      try {
        const { householdId, userEmail } = req.query;
        if (!householdId) return res.status(400).send({ message: 'householdId required' });
        const id = maybeObjectId(householdId);
        const filter = { $or: [{ householdId: householdId }, ...(id ? [{ householdId: id }] : [])] };
        if (userEmail) filter.userEmail = userEmail;
        const result = await mealsCol.find(filter).sort({ date: -1 }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching meals', error: err.message });
      }
    });

    app.post('/meals', async (req, res) => {
      try {
        const { householdId, userEmail, userId, date, meals, guests, note } = req.body;
        if (!householdId || !userEmail || !date || meals === undefined) {
          return res.status(400).send({ message: 'Missing required fields' });
        }

        const resolvedHouseholdId = maybeObjectId(householdId) || householdId;
        const filter = { householdId: resolvedHouseholdId, userEmail, date };
        const update = {
          $set: {
            userId: maybeObjectId(userId),
            meals: Number(meals),
            guests: Number(guests || 0),
            note: note || '',
            updatedAt: new Date(),
          },
          $setOnInsert: { createdAt: new Date() },
        };
        await mealsCol.updateOne(filter, update, { upsert: true });
        const doc = await mealsCol.findOne(filter);
        res.send(doc);
      } catch (err) {
        res.status(500).send({ message: 'Error upserting meal', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  PAYMENTS
    // ════════════════════════════════════════════════════════════════════════
    app.get('/payments', async (req, res) => {
      try {
        const { householdId } = req.query;
        if (!householdId) return res.status(400).send({ message: 'householdId required' });
        const id = maybeObjectId(householdId);
        const result = await paymentsCol
          .find({ $or: [{ householdId: householdId }, ...(id ? [{ householdId: id }] : [])] })
          .sort({ date: -1 })
          .toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching payments', error: err.message });
      }
    });

    app.post('/payments', async (req, res) => {
      try {
        const { householdId, fromEmail, fromId, toEmail, amount, currency, type, month, note, status, reference, date } = req.body;
        if (!householdId || !fromEmail || amount === undefined) {
          return res.status(400).send({ message: 'Missing required fields' });
        }
        const doc = {
          householdId: maybeObjectId(householdId) || householdId,
          fromEmail,
          fromId: maybeObjectId(fromId),
          toEmail: toEmail || 'household',
          amount: Number(amount),
          currency: currency || 'BDT',
          type: type || 'due',
          month: month || new Date().toISOString().slice(0, 7),
          note: note || '',
          status: status || 'pending',
          reference: reference || '',
          date: date ? new Date(date) : new Date(),
        };
        const result = await paymentsCol.insertOne(doc);
        res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        res.status(500).send({ message: 'Error creating payment', error: err.message });
      }
    });

    app.put('/payments/:id', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        const { status, note, reference } = req.body;
        const update = { $set: { date: new Date() } };
        if (status !== undefined) update.$set.status = status;
        if (note !== undefined) update.$set.note = note;
        if (reference !== undefined) update.$set.reference = reference;
        await paymentsCol.updateOne({ _id: new ObjectId(req.params.id) }, update);
        const updated = await paymentsCol.findOne({ _id: new ObjectId(req.params.id) });
        res.send(updated);
      } catch (err) {
        res.status(500).send({ message: 'Error updating payment', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  ROOM CHAT
    // ════════════════════════════════════════════════════════════════════════
    app.get('/room-chat', async (req, res) => {
      try {
        const { householdId, since } = req.query;
        if (!householdId) return res.status(400).send({ message: 'householdId required' });
        const id = maybeObjectId(householdId);
        const filter = { $or: [{ householdId: householdId }, ...(id ? [{ householdId: id }] : [])] };
        if (since) filter.timestamp = { $gt: new Date(since) };
        const result = await roomChatCol.find(filter).sort({ timestamp: 1 }).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching room chat', error: err.message });
      }
    });

    app.post('/room-chat', async (req, res) => {
      try {
        const { householdId, senderEmail, senderId, senderName, text, mediaUrl, type, replyTo } = req.body;
        if (!householdId || !senderEmail || !senderName || !text) {
          return res.status(400).send({ message: 'Missing required fields' });
        }
        const resolvedHouseholdId = maybeObjectId(householdId) || householdId;
        let replySnapshot = null;
        let parentMessage = null;
        const replyToId = typeof replyTo === 'string' ? replyTo : replyTo?.messageId || replyTo?._id;
        if (replyToId && ObjectId.isValid(replyToId)) {
          parentMessage = await roomChatCol.findOne({ _id: new ObjectId(replyToId) });
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
    });

    // ════════════════════════════════════════════════════════════════════════
    //  REVIEWS
    // ════════════════════════════════════════════════════════════════════════
    app.get('/reviews', async (req, res) => {
      try {
        const limit = Math.min(Number(req.query.limit || 30), 100);
        const result = await reviewsCol.find({}).sort({ date: -1 }).limit(limit).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching reviews', error: err.message });
      }
    });

    app.post('/reviews', async (req, res) => {
      try {
        const { authorEmail, authorId, authorName, houseName, householdId, text, rating, verified } = req.body;
        if (!authorEmail || !authorName || !houseName || !text || rating === undefined) {
          return res.status(400).send({ message: 'Missing required fields' });
        }
        const doc = {
          authorEmail,
          authorId: maybeObjectId(authorId),
          authorName,
          houseName,
          householdId: maybeObjectId(householdId),
          text,
          rating: Math.min(5, Math.max(1, Number(rating))),
          helpful: 0,
          verified: Boolean(verified),
          date: new Date(),
        };
        const result = await reviewsCol.insertOne(doc);
        res.send({ _id: result.insertedId, ...doc });
      } catch (err) {
        res.status(500).send({ message: 'Error creating review', error: err.message });
      }
    });

    // ════════════════════════════════════════════════════════════════════════
    //  NOTIFICATIONS
    // ════════════════════════════════════════════════════════════════════════
    app.get('/notifications', async (req, res) => {
      try {
        const { userEmail } = req.query;
        if (!userEmail) return res.status(400).send({ message: 'userEmail required' });
        const result = await notificationsCol.find({ userEmail }).sort({ createdAt: -1 }).limit(100).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: 'Error fetching notifications', error: err.message });
      }
    });

    app.post('/notifications', async (req, res) => {
      try {
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
    });

    app.patch('/notifications/:id/read', async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) return res.status(400).send({ message: 'Invalid ID' });
        await notificationsCol.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { read: true, readAt: new Date() } });
        res.send({ success: true });
      } catch (err) {
        res.status(500).send({ message: 'Error updating notification', error: err.message });
      }
    });

    app.get('/stats', async (req, res) => {
      try {
        const [activeListings, totalUsers, totalHouseholds, totalReviews, cities, reviewDocs] = await Promise.all([
          roommatesCol.countDocuments({ status: 'active' }),
          usersCol.countDocuments(),
          householdsCol.countDocuments({ isActive: { $ne: false } }),
          reviewsCol.countDocuments(),
          roommatesCol.distinct('city'),
          reviewsCol.find({}, { projection: { rating: 1 } }).toArray(),
        ]);

        const averageRating = reviewDocs.length
          ? reviewDocs.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviewDocs.length
          : 0;

        // collect per-collection storage/document/index metrics using collStats
        const collections = ['households','ledger','meals','messages','notifications','payments','reviews','room_chat','roommates','users'];
        const collStats = await Promise.all(collections.map(async (name) => {
          try {
            const stats = await db.command({ collStats: name });
            return {
              name,
              storageSize: stats.storageSize || 0,
              dataSize: stats.size || 0,
              count: stats.count || 0,
              avgObjSize: stats.avgObjSize || 0,
              nindexes: stats.nindexes || 0,
              totalIndexSize: stats.totalIndexSize || 0,
            };
          } catch (err) {
            return { name, error: String(err) };
          }
        }));

        res.send({
          activeListings,
          totalUsers,
          totalHouseholds,
          totalReviews,
          citiesCovered: cities.filter(Boolean).length,
          matchSatisfaction: reviewDocs.length ? Math.round((averageRating / 5) * 100) : 0,
          averageRating: Number(averageRating.toFixed(1)),
          collections: collStats,
        });
      } catch (err) {
        res.status(500).send({ message: 'Error fetching stats', error: err.message });
      }
    });

    await client.db('admin').command({ ping: 1 });
    console.log('✅ MongoDB connected to nestmate with reconstructed schema');
  } catch (err) {
    console.error('❌ MongoDB error:', err);
  }
}

run();

app.get('/', (req, res) => res.send('✅ NestMate API running'));

app.listen(port, () => console.log(`🚀 Server on port ${port}`));
