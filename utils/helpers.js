const { ObjectId } = require('mongodb');

const JOIN_CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateJoinCode(length = 6) {
  return Array.from({ length }, () => JOIN_CODE_CHARACTERS[Math.floor(Math.random() * JOIN_CODE_CHARACTERS.length)]).join('');
}

function maybeObjectId(value) {
  if (!value || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

function displayNameFromEmail(email) {
  return String(email || 'Guest')
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeJoinCode(value) {
  return String(value || '').toUpperCase().trim();
}

function lookupByIdField(fieldName, value) {
  const lookup = [{ [fieldName]: value }];
  const id = maybeObjectId(value);

  if (id) {
    lookup.push({ [fieldName]: id });
  }

  return lookup;
}

module.exports = {
  generateJoinCode,
  maybeObjectId,
  displayNameFromEmail,
  normalizeJoinCode,
  lookupByIdField,
};