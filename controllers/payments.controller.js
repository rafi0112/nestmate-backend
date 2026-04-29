const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listPayments(req, res) {
  try {
    const { paymentsCol } = getCollections();
    const { householdId } = req.query;

    if (!householdId) return res.status(400).send({ message: 'householdId required' });

    const id = maybeObjectId(householdId);
    const result = await paymentsCol
      .find({ $or: [{ householdId }, ...(id ? [{ householdId: id }] : [])] })
      .sort({ date: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching payments', error: err.message });
  }
}

async function createPayment(req, res) {
  try {
    const { paymentsCol } = getCollections();
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
}

async function updatePayment(req, res) {
  try {
    const { paymentsCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

    const { status, note, reference } = req.body;
    const update = { $set: { date: new Date() } };
    if (status !== undefined) update.$set.status = status;
    if (note !== undefined) update.$set.note = note;
    if (reference !== undefined) update.$set.reference = reference;

    await paymentsCol.updateOne({ _id: id }, update);
    const updated = await paymentsCol.findOne({ _id: id });
    res.send(updated);
  } catch (err) {
    res.status(500).send({ message: 'Error updating payment', error: err.message });
  }
}

module.exports = {
  listPayments,
  createPayment,
  updatePayment,
};