const { getCollections, getDb } = require('../config/db');

async function getRoot(req, res) {
  res.send('✅ NestMate API running');
}

async function getStats(req, res) {
  try {
    const { roommatesCol, usersCol, householdsCol, reviewsCol } = getCollections();
    const db = getDb();

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

    const collections = ['households', 'ledger', 'meals', 'messages', 'notifications', 'payments', 'reviews', 'room_chat', 'roommates', 'users'];
    const collStats = await Promise.all(
      collections.map(async (name) => {
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
      })
    );

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
}

module.exports = {
  getRoot,
  getStats,
};