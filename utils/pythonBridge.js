/**
 * Python Integration Utility (Placeholder for DeepCARSKit)
 *
 * This module will communicate with your Python Deep Learning
 * recommendation service once it is built.
 *
 * Expected flow:
 * 1. Node.js sends user context (history, bookmarks, categories) to Python API
 * 2. DeepCARSKit returns ranked article IDs / scores
 * 3. Node.js fetches article details and returns to React frontend
 */

// const PYTHON_URL = process.env.PYTHON_RECOMMENDER_URL;

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
 * Health check for Python recommendation service (PLACEHOLDER)
 */
const checkPythonServiceHealth = async () => {
  // TODO: GET ${PYTHON_URL}/health
  return {
    available: false,
    message: 'Python recommender not configured yet',
  };
};

module.exports = {
  buildUserContext,
  fetchRecommendationsFromPython,
  checkPythonServiceHealth,
};
