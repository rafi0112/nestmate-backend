const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listMeals(req, res) {
  try {
    const { mealsCol } = getCollections();
    const { householdId, userEmail } = req.query;

    if (!householdId) return res.status(400).send({ message: 'householdId required' });

    const id = maybeObjectId(householdId);
    const filter = { $or: [{ householdId }, ...(id ? [{ householdId: id }] : [])] };
    if (userEmail) filter.userEmail = userEmail;

    const result = await mealsCol.find(filter).sort({ date: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching meals', error: err.message });
  }
}

async function upsertMeal(req, res) {
  try {
    const { mealsCol } = getCollections();
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
}

module.exports = {
  listMeals,
  upsertMeal,
};