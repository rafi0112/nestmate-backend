const { ObjectId, getCollections } = require('../config/db');
const { generateJoinCode, maybeObjectId, normalizeJoinCode, lookupByIdField } = require('../utils/helpers');

async function findHouseholdByListingId(householdsCol, listingId) {
  if (!listingId) return null;

  const lookup = lookupByIdField('listingId', listingId);
  return householdsCol.findOne({ $or: lookup });
}

async function resolveUniqueJoinCode(householdsCol, joinCode) {
  let resolvedJoinCode = normalizeJoinCode(joinCode || generateJoinCode());

  for (let i = 0; i < 6; i += 1) {
    const exists = await householdsCol.findOne({ joinCode: resolvedJoinCode });
    if (!exists) break;
    resolvedJoinCode = generateJoinCode();
  }

  return resolvedJoinCode;
}

async function getHousehold(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { listingId, memberEmail } = req.query;

    if (listingId) {
      const result = await findHouseholdByListingId(householdsCol, listingId);
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
}

async function listHouseholds(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { memberEmail } = req.query;

    if (!memberEmail) return res.status(400).send({ message: 'memberEmail required' });

    const result = await householdsCol.find({ members: memberEmail }).sort({ createdAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching households', error: err.message });
  }
}

async function createHousehold(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { listingId, listingTitle, ownerEmail, joinCode, members, memberIds, monthlyFee, name, address, rules, settings } = req.body;

    if (!ownerEmail) return res.status(400).send({ message: 'ownerEmail required' });

    const resolvedJoinCode = await resolveUniqueJoinCode(householdsCol, joinCode);
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
}

async function joinHousehold(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { joinCode, userEmail, userId } = req.body;

    if (!joinCode || !userEmail) return res.status(400).send({ message: 'joinCode and userEmail required' });

    const household = await householdsCol.findOne({ joinCode: normalizeJoinCode(joinCode) });
    if (!household) return res.status(404).send({ message: 'Invalid join code' });

    const memberId = maybeObjectId(userId);

    await householdsCol.updateOne(
      { _id: household._id },
      {
        $addToSet: {
          members: userEmail,
          ...(memberId ? { memberIds: memberId } : {}),
        },
        $set: { updatedAt: new Date() },
      }
    );

    const updated = await householdsCol.findOne({ _id: household._id });
    res.send(updated);
  } catch (err) {
    res.status(500).send({ message: 'Error joining household', error: err.message });
  }
}

async function updateHousehold(req, res) {
  try {
    const { householdsCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

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
}

async function getGroups(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { listingId, memberEmail } = req.query;

    if (listingId) {
      const h = await findHouseholdByListingId(householdsCol, listingId);
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
}

async function createGroup(req, res) {
  try {
    const { householdsCol } = getCollections();
    const { name, listingId, listingTitle, ownerEmail, joinCode, monthlyFee } = req.body;

    if (!ownerEmail) return res.status(400).send({ message: 'ownerEmail required' });

    const resolvedJoinCode = await resolveUniqueJoinCode(householdsCol, joinCode);
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
}

async function joinGroup(req, res) {
  try {
    const { householdsCol } = getCollections();
    const joinCode = req.body.joinCode;
    const userEmail = req.body.userEmail || req.body.userUid;

    if (!joinCode || !userEmail) return res.status(400).send({ message: 'joinCode and userEmail required' });

    const household = await householdsCol.findOne({ joinCode: normalizeJoinCode(joinCode) });
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
}

async function updateGroup(req, res) {
  try {
    const { householdsCol } = getCollections();
    const id = maybeObjectId(req.params.id);

    if (!id) return res.status(400).send({ message: 'Invalid ID' });

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
}

module.exports = {
  getHousehold,
  listHouseholds,
  createHousehold,
  joinHousehold,
  updateHousehold,
  getGroups,
  createGroup,
  joinGroup,
  updateGroup,
};