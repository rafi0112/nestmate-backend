const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');
const { listingsCacheKey } = require('../utils/cacheKeys');
const { getCache, setCache, deleteCache } = require('../utils/redis');

function buildListingFilter(query) {
  const { q, city, roomType, minRent, maxRent, status, userEmail } = query;
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

  return filter;
}

async function createListing(req, res) {
  try {
    const { roommatesCol } = getCollections();
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
    await deleteCache(listingsCacheKey({}));
    res.send({ _id: result.insertedId, ...doc });
  } catch (err) {
    res.status(500).send({ message: 'Error creating listing', error: err.message });
  }
}

async function listListings(req, res) {
  try {
    const { roommatesCol } = getCollections();
    const cacheKey = listingsCacheKey(req.query);
    const cached = await getCache(cacheKey);

    if (cached) {
      console.log('⚡ Redis HIT');
      return res.send(cached);
    }

    const filter = buildListingFilter(req.query);
    const result = await roommatesCol.find(filter).sort({ createdAt: -1 }).toArray();

    await setCache(cacheKey, result, 60);
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching listings', error: err.message });
  }
}

async function getListingById(req, res) {
  try {
    const { roommatesCol } = getCollections();
    if (!maybeObjectId(req.params.id)) {
      return res.status(400).send({ message: 'Invalid ID' });
    }

    const id = maybeObjectId(req.params.id);
    await roommatesCol.updateOne({ _id: id }, { $inc: { viewCount: 1 }, $set: { updatedAt: new Date() } });
    const result = await roommatesCol.findOne({ _id: id });
    res.send(result || null);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching listing', error: err.message });
  }
}

async function updateListing(req, res) {
  try {
    const { roommatesCol } = getCollections();
    const id = maybeObjectId(req.params.id);
    if (!id) {
      return res.status(400).send({ message: 'Invalid ID' });
    }

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
}

async function deleteListing(req, res) {
  try {
    const { roommatesCol } = getCollections();
    const id = maybeObjectId(req.params.id);
    if (!id) {
      return res.status(400).send({ message: 'Invalid ID' });
    }

    const result = await roommatesCol.deleteOne({ _id: id });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error deleting listing', error: err.message });
  }
}

module.exports = {
  createListing,
  listListings,
  getListingById,
  updateListing,
  deleteListing,
};