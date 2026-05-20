/**
 * Recommendation controller — News-Recom CSV ingestion + category fallback.
 */

const path = require('path');
const User = require('../models/User');
const {
  checkPythonServiceHealth,
  buildUserContext,
} = require('../utils/pythonBridge');
const { writeNewsRecomInteractionsCsv } = require('../utils/exportInteractions');
const {
  loadRecommendationRows,
  getRankedRecommendationsForUser,
} = require('../utils/loadRecommendations');
const { buildCategoryFallbackFromUser } = require('../utils/recommendationFallback');

const DEFAULT_LIMIT = 20;
const MIN_LIMIT = 1;
const MAX_LIMIT = 100;

function parseLimit(queryLimit) {
  const n = parseInt(String(queryLimit ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.min(Math.max(n, MIN_LIMIT), MAX_LIMIT);
}

/**
 * @desc    Personalized recommendations from `exports/recommendations.csv`
 * @route   GET /api/recommendations
 * @access  Private
 *
 * Query: `limit` (1–100, default 20)
 */
const getRecommendations = async (req, res) => {
  const limit = parseLimit(req.query.limit);
  const userId = req.user._id;

  const { rows, fileMissing } = await loadRecommendationRows();
  const ranked = getRankedRecommendationsForUser(rows, userId, { limit });

  if (ranked.length > 0) {
    return res.status(200).json({
      success: true,
      message: 'Recommendations loaded from News-Recom export',
      data: {
        source: 'news_recom_csv',
        count: ranked.length,
        recommendations: ranked.map((r) => ({
          articleId: r.item_id,
          itemId: r.item_id,
          score: r.score,
        })),
      },
    });
  }

  const fallbackCategories = buildCategoryFallbackFromUser(req.user, {
    maxCategories: limit,
  });

  return res.status(200).json({
    success: true,
    message:
      fileMissing || rows.length === 0
        ? 'No recommendations file or file is empty; returning category hints from your bookmarks and history.'
        : 'No recommendation rows for your account; returning category hints from your bookmarks and history.',
    data: {
      source: 'fallback_categories',
      count: fallbackCategories.length,
      recommendations: [],
      fallbackCategories,
    },
  });
};

/**
 * @desc    Preview user context sent to Python engine (for debugging)
 * @route   GET /api/recommendations/context
 * @access  Private
 */
const getRecommendationContext = async (req, res) => {
  const user = await User.findById(req.user._id);
  const context = buildUserContext(user);

  res.status(200).json({
    success: true,
    message: 'User context payload for DeepCARSKit',
    data: context,
  });
};

/**
 * @desc    Check if Python recommendation service is online
 * @route   GET /api/recommendations/health
 * @access  Private
 */
const getRecommenderHealth = async (req, res) => {
  const health = await checkPythonServiceHealth();

  res.status(200).json({
    success: true,
    data: health,
  });
};

/**
 * @desc    Export all user bookmarks & reading history to CSV for News-Recom
 * @route   GET /api/recommendations/export
 * @access  Private
 */
const exportNewsRecomInteractions = async (req, res) => {
  const result = await writeNewsRecomInteractionsCsv();

  res.status(200).json({
    success: true,
    message: 'Interaction data exported for News-Recom pipeline',
    data: {
      rowCount: result.rowCount,
      filePath: result.relativePath.split(path.sep).join('/'),
      formatVersion: result.formatVersion,
      timeContextBasis: 'utc_hour',
    },
  });
};

module.exports = {
  getRecommendations,
  getRecommendationContext,
  getRecommenderHealth,
  exportNewsRecomInteractions,
};
