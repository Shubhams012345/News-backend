/**
 * User Controller
 * Profile, bookmarks, and reading history for personalization.
 * This data will later feed the DeepCARSKit recommendation engine.
 */

const User = require('../models/User');

/**
 * @desc    Get logged-in user profile
 * @route   GET /api/user/profile
 * @access  Private
 */
const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    data: {
      _id: user._id,
      name: user.name,
      email: user.email,
      preferredCategories: user.preferredCategories,
      bookmarksCount: user.bookmarks.length,
      historyCount: user.readingHistory.length,
      createdAt: user.createdAt,
    },
  });
};

/**
 * @desc    Add article to bookmarks
 * @route   POST /api/user/bookmark
 * @access  Private
 * @body    { articleId, title?, category? }
 */
const addBookmark = async (req, res) => {
const { articleId, title, category, url } = req.body
  if (!articleId) {
    return res.status(400).json({
      success: false,
      message: 'articleId is required',
    });
  }

  const user = await User.findById(req.user._id);

  // Prevent duplicate bookmarks
  const alreadyBookmarked = user.bookmarks.some(
    (b) => b.articleId === articleId
  );

  if (alreadyBookmarked) {
    return res.status(400).json({
      success: false,
      message: 'Article already bookmarked',
    });
  }
  
  user.bookmarks.unshift({
  articleId,
  title: title || '',
  category: category || 'general',
  url: url || '',
  bookmarkedAt: new Date(),
});
  await user.save();

  res.status(201).json({
    success: true,
    message: 'Article bookmarked',
    data: user.bookmarks,
  });
};

/**
 * @desc    Get all bookmarks for logged-in user
 * @route   GET /api/user/bookmarks
 * @access  Private
 */
const getBookmarks = async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    count: user.bookmarks.length,
    data: user.bookmarks,
  });
};

/**
 * @desc    Add article to reading history
 * @route   POST /api/user/history
 * @access  Private
 * @body    { articleId, title?, category?, dwellTimeSeconds? }
 */
const addHistory = async (req, res) => {
  const { articleId, title, category, dwellTimeSeconds } = req.body;

  if (!articleId) {
    return res.status(400).json({
      success: false,
      message: 'articleId is required',
    });
  }

  const user = await User.findById(req.user._id);

  // Add new history entry at the beginning (most recent first)
  const hour = new Date().getHours()
  
  let timeContext = 'night'
  
  if (hour >= 5 && hour < 12) {
  timeContext = 'morning'
  } else if (hour >= 12 && hour < 17) {
  timeContext = 'afternoon'
  } else if (hour >= 17 && hour < 21) {
  timeContext = 'evening'
  }
  user.readingHistory.unshift({
  articleId,
  title: title || '',
  category: category || 'general',
  timeContext,
  readAt: new Date(),
  dwellTimeSeconds: dwellTimeSeconds || 0,
});

  // Keep history size manageable for DB and ML pipeline (last 100 items)
  if (user.readingHistory.length > 100) {
    user.readingHistory = user.readingHistory.slice(0, 100);
  }

  await user.save();

  res.status(201).json({
    success: true,
    message: 'Reading history updated',
    data: user.readingHistory,
  });
};

/**
 * @desc    Get reading history for logged-in user
 * @route   GET /api/user/history
 * @access  Private
 */
const getHistory = async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json({
    success: true,
    count: user.readingHistory.length,
    data: user.readingHistory,
  });
};

module.exports = {
  getProfile,
  addBookmark,
  getBookmarks,
  addHistory,
  getHistory,
};
