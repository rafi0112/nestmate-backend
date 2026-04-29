const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listReviews(req, res) {
  try {
    const { reviewsCol } = getCollections();
    const limit = Math.min(Number(req.query.limit || 30), 100);
    const result = await reviewsCol.find({}).sort({ date: -1 }).limit(limit).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching reviews', error: err.message });
  }
}

async function createReview(req, res) {
  try {
    const { reviewsCol } = getCollections();
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
}

module.exports = {
  listReviews,
  createReview,
};