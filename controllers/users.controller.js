const { getCollections } = require('../config/db');

async function upsertUser(req, res) {
  try {
    const { usersCol } = getCollections();
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
}

async function getUserByEmail(req, res) {
  try {
    const { usersCol } = getCollections();
    const doc = await usersCol.findOne({ email: req.params.email });
    res.send(doc || null);
  } catch (err) {
    res.status(500).send({ message: 'Error fetching user', error: err.message });
  }
}

module.exports = {
  upsertUser,
  getUserByEmail,
};