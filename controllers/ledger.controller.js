const { getCollections } = require('../config/db');
const { maybeObjectId } = require('../utils/helpers');

async function listLedger(req, res) {
  try {
    const { ledgerCol } = getCollections();
    const { householdId } = req.query;

    if (!householdId) return res.status(400).send({ message: 'householdId required' });

    const id = maybeObjectId(householdId);
    const result = await ledgerCol
      .find({ $or: [{ householdId }, ...(id ? [{ householdId: id }] : [])] })
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching ledger', error: err.message });
  }
}

async function createLedgerEntry(req, res) {
  try {
    const { ledgerCol } = getCollections();
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
}

async function deleteLedgerEntry(req, res) {
  try {
    const { ledgerCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

    const result = await ledgerCol.deleteOne({ _id: id });
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error deleting ledger entry', error: err.message });
  }
}

module.exports = {
  listLedger,
  createLedgerEntry,
  deleteLedgerEntry,
};