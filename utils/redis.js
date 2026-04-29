const { Redis } = require('@upstash/redis');

const redis = Redis.fromEnv();

async function getCache(key) {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

async function setCache(key, value, ttl = 60) {
  try {
    await redis.set(key, value, { ex: ttl });
  } catch {}
}

async function deleteCache(key) {
  try {
    await redis.del(key);
  } catch {}
}

module.exports = {
  redis,
  getCache,
  setCache,
  deleteCache,
};