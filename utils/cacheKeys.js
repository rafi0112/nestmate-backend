function listingsCacheKey(query = {}) {
  return `listings:${JSON.stringify(query)}`;
}

function messagesCacheKey(userEmail) {
  return `messages:${userEmail}`;
}

module.exports = {
  listingsCacheKey,
  messagesCacheKey,
};