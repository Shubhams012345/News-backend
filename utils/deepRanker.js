/**
 * Deep learning ranker — calls the Flask ML microservice (POST /rank).
 * Falls back to batch CSV ordering when the service is unavailable.
 */

const axios = require('axios');
const { buildFeatureVectorsForCandidates } = require('./recommendationFeatures');

const DEFAULT_BASE_URL = 'http://localhost:5001';
const DEFAULT_TIMEOUT_MS = 10000;

function getRankerConfig() {
  const baseURL = (
    process.env.PYTHON_RECOMMENDER_URL || DEFAULT_BASE_URL
  ).replace(/\/$/, '');
  const timeout =
    Number(process.env.PYTHON_RECOMMENDER_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  return { baseURL, timeout };
}

/**
 * @returns {Promise<{ available: boolean, modelLoaded?: boolean, message?: string, url: string }>}
 */
async function checkDeepRankerHealth() {
  const { baseURL, timeout } = getRankerConfig();
  const healthTimeout = Math.min(timeout, 3000);

  try {
    const response = await axios.get(`${baseURL}/health`, {
      timeout: healthTimeout,
      validateStatus: (status) => status === 200,
    });
    return {
      available: true,
      modelLoaded: Boolean(response.data?.modelLoaded),
      message: 'Deep ranker is online',
      url: baseURL,
    };
  } catch (err) {
    const message =
      err.code === 'ECONNREFUSED'
        ? 'Deep ranker service is not reachable'
        : err.message || 'Deep ranker health check failed';
    return {
      available: false,
      modelLoaded: false,
      message,
      url: baseURL,
    };
  }
}

/**
 * @typedef {Object} CandidateRow
 * @property {string} item_id
 * @property {number} score
 */

/**
 * @typedef {Object} RankedCandidate
 * @property {string} item_id
 * @property {number} score
 * @property {number} [mlScore]
 * @property {Record<string, number>} [features]
 */

/**
 * Re-order candidates using ML scores; preserve batch scores on each row.
 *
 * @param {CandidateRow[]} candidates — from News-Recom CSV (batch-sorted)
 * @param {Record<string, any>} user
 * @param {{ limit?: number }} [options]
 * @returns {Promise<{ ranked: RankedCandidate[], ranker: 'deep_learning' | 'batch', rankerMessage?: string }>}
 */
async function rankCandidatesWithDeepLearning(candidates, user, options = {}) {
  const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);

  if (!candidates.length) {
    return { ranked: [], ranker: 'batch' };
  }

  const articles = buildFeatureVectorsForCandidates(candidates, user);
  const batchById = new Map(
    candidates.map((c) => [String(c.item_id), c.score])
  );

  const { baseURL, timeout } = getRankerConfig();

  try {
    const response = await axios.post(
      `${baseURL}/rank`,
      { articles },
      {
        timeout,
        headers: { 'Content-Type': 'application/json' },
        validateStatus: (status) => status === 200,
      }
    );

    const mlRanked = response.data?.ranked;
    if (!Array.isArray(mlRanked) || mlRanked.length === 0) {
      throw new Error('Invalid response from deep ranker');
    }

    /** @type {RankedCandidate[]} */
    const ranked = [];

    for (const item of mlRanked) {
      const itemId = String(item.id);
      if (!batchById.has(itemId)) continue;
      ranked.push({
        item_id: itemId,
        score: batchById.get(itemId),
        mlScore: Number(item.score),
        features: item.features,
      });
      if (ranked.length >= limit) break;
    }

    for (const c of candidates) {
      if (ranked.length >= limit) break;
      const id = String(c.item_id);
      if (ranked.some((r) => r.item_id === id)) continue;
      ranked.push({
        item_id: id,
        score: c.score,
        mlScore: c.score,
        features: articles.find((a) => a.id === id)?.features,
      });
    }

    return {
      ranked: ranked.slice(0, limit),
      ranker: 'deep_learning',
    };
  } catch (err) {
    const reason =
      err.code === 'ECONNREFUSED'
        ? 'ML service offline; using batch scores for ordering'
        : `ML ranking failed (${err.message}); using batch scores for ordering`;

    return {
      ranked: candidates.slice(0, limit).map((c) => ({
        item_id: c.item_id,
        score: c.score,
      })),
      ranker: 'batch',
      rankerMessage: reason,
    };
  }
}

module.exports = {
  checkDeepRankerHealth,
  rankCandidatesWithDeepLearning,
};
