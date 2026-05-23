/**
 * Build ML feature vectors for candidate articles (News-Recom + user context).
 */

const { getCurrentTimeContext } = require('./recommendationFallback');

const RECENCY_HALF_LIFE_DAYS = 14;

/**
 * @param {Record<string, any>} user
 * @returns {Record<string, number>}
 */
function buildCategoryAffinityScores(user) {
  const currentTimeContext = getCurrentTimeContext();
  const scores = {};

  const add = (category, value) => {
    if (!category) return;
    scores[category] = (scores[category] || 0) + value;
  };

  for (const b of user.bookmarks || []) {
    add(b.category, 5);
  }

  for (const h of user.readingHistory || []) {
    const timeBonus = h.timeContext === currentTimeContext ? 2 : 0;
    const dwellBonus = Math.min((h.dwellTimeSeconds || 0) / 30, 5);
    add(h.category, 3 + timeBonus + dwellBonus);
  }

  for (const p of user.preferredCategories || []) {
    add(p, 1);
  }

  return scores;
}

/**
 * @param {string} articleId
 * @param {Record<string, any>} user
 * @returns {string}
 */
function resolveArticleCategory(articleId, user) {
  for (const b of user.bookmarks || []) {
    if (String(b.articleId) === String(articleId) && b.category) {
      return b.category;
    }
  }
  for (const h of user.readingHistory || []) {
    if (String(h.articleId) === String(articleId) && h.category) {
      return h.category;
    }
  }
  return 'general';
}

/**
 * @param {number} value
 * @param {number} max
 * @returns {number}
 */
function normalizeToUnit(value, max) {
  if (!max || max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

/**
 * @param {string} articleId
 * @param {Record<string, any>} user
 * @param {Record<string, number>} categoryAffinity
 * @returns {number}
 */
function computeCategoryMatch(articleId, user, categoryAffinity) {
  const category = resolveArticleCategory(articleId, user);
  const raw = categoryAffinity[category] || 0;
  const maxAffinity = Math.max(...Object.values(categoryAffinity), 0);
  if (maxAffinity <= 0) {
    const preferred = (user.preferredCategories || []).map((c) =>
      String(c).toLowerCase()
    );
    return preferred.includes(String(category).toLowerCase()) ? 0.6 : 0.2;
  }
  return normalizeToUnit(raw, maxAffinity);
}

/**
 * @param {string} articleId
 * @param {Record<string, any>} user
 * @returns {number}
 */
function computeDwellTime(articleId, user) {
  let maxDwell = 0;
  for (const h of user.readingHistory || []) {
    if (String(h.articleId) === String(articleId)) {
      maxDwell = Math.max(maxDwell, Number(h.dwellTimeSeconds) || 0);
    }
  }
  return maxDwell;
}

/**
 * @param {string} articleId
 * @param {Record<string, any>} user
 * @returns {number}
 */
function computeTimeContextMatch(articleId, user) {
  const current = getCurrentTimeContext();
  let direct = false;
  let categoryMatch = false;
  const category = resolveArticleCategory(articleId, user);

  for (const b of user.bookmarks || []) {
    if (String(b.articleId) === String(articleId)) {
      direct = true;
      break;
    }
  }

  for (const h of user.readingHistory || []) {
    if (String(h.articleId) === String(articleId)) {
      if (h.timeContext === current) return 1;
      direct = true;
    }
    if (h.category === category && h.timeContext === current) {
      categoryMatch = true;
    }
  }

  if (direct) return 0.5;
  if (categoryMatch) return 0.75;
  return 0.25;
}

/**
 * No geo fields on User yet — neutral default until location is modeled.
 * @returns {number}
 */
function computeLocationMatch() {
  return 0.5;
}

/**
 * @param {string} articleId
 * @param {Record<string, any>} user
 * @param {number} batchScore
 * @param {number} batchMin
 * @param {number} batchMax
 * @returns {number}
 */
function computeRecencyScore(articleId, user, batchScore, batchMin, batchMax) {
  let latestRead = null;

  for (const h of user.readingHistory || []) {
    if (String(h.articleId) !== String(articleId)) continue;
    const readAt = h.readAt ? new Date(h.readAt) : null;
    if (!readAt || Number.isNaN(readAt.getTime())) continue;
    if (!latestRead || readAt > latestRead) latestRead = readAt;
  }

  if (latestRead) {
    const daysSince =
      (Date.now() - latestRead.getTime()) / (1000 * 60 * 60 * 24);
    return Math.exp(-daysSince / RECENCY_HALF_LIFE_DAYS);
  }

  if (batchMax > batchMin) {
    return normalizeToUnit(batchScore - batchMin, batchMax - batchMin);
  }

  return normalizeToUnit(batchScore, 1);
}

/**
 * @typedef {Object} CandidateRow
 * @property {string} item_id
 * @property {number} score
 */

/**
 * @param {CandidateRow[]} candidates
 * @param {Record<string, any>} user
 * @returns {{ id: string, features: Record<string, number> }[]}
 */
function buildFeatureVectorsForCandidates(candidates, user) {
  const categoryAffinity = buildCategoryAffinityScores(user);
  const batchScores = candidates.map((c) => c.score);
  const batchMin = Math.min(...batchScores);
  const batchMax = Math.max(...batchScores);

  return candidates.map((candidate) => {
    const id = candidate.item_id;
    return {
      id,
      features: {
        categoryMatch: computeCategoryMatch(id, user, categoryAffinity),
        dwellTime: computeDwellTime(id, user),
        timeContextMatch: computeTimeContextMatch(id, user),
        locationMatch: computeLocationMatch(),
        recencyScore: computeRecencyScore(
          id,
          user,
          candidate.score,
          batchMin,
          batchMax
        ),
      },
    };
  });
}

module.exports = {
  buildFeatureVectorsForCandidates,
  resolveArticleCategory,
};
