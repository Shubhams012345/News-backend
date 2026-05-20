/**
 * User Routes (Protected)
 * Base path: /api/user
 */

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { protect } = require('../middleware/authMiddleware');
const {
  getProfile,
  addBookmark,
  getBookmarks,
  addHistory,
  getHistory,
} = require('../controllers/userController');

const router = express.Router();

// All user routes require valid JWT
router.use(protect);

router.get('/profile', asyncHandler(getProfile));
router.post('/bookmark', asyncHandler(addBookmark));
router.get('/bookmarks', asyncHandler(getBookmarks));
router.post('/history', asyncHandler(addHistory));
router.get('/history', asyncHandler(getHistory));

module.exports = router;
