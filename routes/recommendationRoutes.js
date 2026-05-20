/**
 * Recommendation routes
 * Base path: /api/recommendations
 */

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/authMiddleware');
const {
  getRecommendations,
  getRecommendationContext,
  getRecommenderHealth,
  exportNewsRecomInteractions,
} = require('../controllers/recommendationController');

const router = express.Router();

router.use(protect);

// Specific paths before parameterized routes (none here, but export before `/` is conventional)
router.get('/export', asyncHandler(exportNewsRecomInteractions));
router.get('/context', asyncHandler(getRecommendationContext));
router.get('/health', asyncHandler(getRecommenderHealth));

/** GET /api/recommendations — ranked items from exports/recommendations.csv */
router.get('/', asyncHandler(getRecommendations));

module.exports = router;
