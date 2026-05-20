/**
 * JWT Authentication Middleware
 * Protects routes by verifying the Bearer token in the Authorization header.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc Verify JWT and attach user to request object
 * @route Use on protected routes (e.g. GET /api/user/profile)
 */
const protect = async (req, res, next) => {
  let token;

  // Expect header: Authorization: Bearer <token>
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode token and get user id
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Attach user (without password) to request for controllers
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found. Token may be invalid.',
        });
      }

      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Invalid or expired token.',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. No token provided.',
    });
  }
};

module.exports = { protect };
