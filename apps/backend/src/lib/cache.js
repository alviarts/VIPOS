// Simple in-memory cache for API responses (P4-optimization).
//
// Redis would be better for multi-instance deployments, but for
// Phase 4 single-instance VPS this is sufficient. Cache entries
// expire after TTL and can be manually invalidated.

const cache = new Map();

/**
 * Get cached value by key.
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null if expired/missing
 */
function get(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

/**
 * Set cache value with TTL.
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds
 */
function set(key, value, ttlSeconds = 60) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Delete cache entry.
 * @param {string} key - Cache key
 */
function del(key) {
  cache.delete(key);
}

/**
 * Clear all cache entries.
 */
function clear() {
  cache.clear();
}

/**
 * Get cache statistics.
 * @returns {{size: number, keys: string[]}}
 */
function stats() {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

module.exports = { get, set, del, clear, stats };
