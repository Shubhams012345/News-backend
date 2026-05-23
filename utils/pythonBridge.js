/**
 * Python / ML integration helpers.
 *
 * Candidate generation stays in News-Recom CSV + category fallback.
 * Final ordering for CSV candidates is delegated to utils/deepRanker.js.
 */

const { checkDeepRankerHealth } = require('./deepRanker');

/**
 * Build user context payload for the recommendation engine
 * @param {Object} user - Mongoose user document
 * @returns {Object} Context object for DeepCARSKit
 */
const buildUserContext = (user) => {
  return {
    userId: user._id.toString(),
    preferredCategories: user.preferredCategories || [],
    readingHistory: (user.readingHistory || []).map((item) => ({
      articleId: item.articleId,
      category: item.category,
      readAt: item.readAt,
      dwellTimeSeconds: item.dwellTimeSeconds,
    })),
    bookmarks: (user.bookmarks || []).map((item) => ({
      articleId: item.articleId,
      category: item.category,
    })),
  };
};

/**
 * Fetch personalized recommendations from Python service (PLACEHOLDER)
 *
 * TODO: Implement HTTP call when DeepCARSKit API is ready:
 *
 * const response = await fetch(`${PYTHON_URL}/recommend`, {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify(buildUserContext(user)),
 *   signal: AbortSignal.timeout(Number(process.env.PYTHON_RECOMMENDER_TIMEOUT_MS)),
 * });
 * return response.json();
 *
 * @param {Object} user - Authenticated user document
 * @returns {Promise<Object>} Recommendation response
 */
const fetchRecommendationsFromPython = async (user) => {
  const context = buildUserContext(user);

  // Placeholder response until Python service is connected
  return {
    status: 'placeholder',
    message:
      'DeepCARSKit integration pending. Connect PYTHON_RECOMMENDER_URL when ready.',
    userContext: context,
    recommendations: [],
  };
};

/**
 * Health check for the Flask deep ranker (GET /health).
 */
const checkPythonServiceHealth = async () => {
  return checkDeepRankerHealth();
};

module.exports = {
  buildUserContext,
  fetchRecommendationsFromPython,
  checkPythonServiceHealth,
};
