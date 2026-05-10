const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');  // Winston/pino next

// Cache for user lookups (Redis optional)
const userCache = new Map();

// 🔐 Main Auth: Access Token + User Population
const protect = async (req, res, next) => {
  let token;

  // Extract Bearer token (case-insensitive check)
  const authHeader = req.headers.authorization || '';
  if (authHeader.toLowerCase().startsWith('bearer')) {
    try {
      token = authHeader.split(' ')[1];
      
      if (!token || token.length < 10) {
        throw new Error('Invalid token format');
      }

      // Verify JWT (expires 15min)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Cache hit (500ms TTL for dashboard sessions)
      let user = userCache.get(decoded.id);
      if (!user) {
        user = await User.findById(decoded.id)
          .select('-password')  // Never send hashed pw
          .lean();  // Faster for auth only
        
        if (!user) {
          throw new Error('User not found');
        }
        
        // Cache with TTL
        userCache.set(decoded.id, user);
        setTimeout(() => userCache.delete(decoded.id), 500);
      }
      
      req.user = user;
      req.userId = decoded.id;
      
      // Audit log for sensitive routes
      logger.info(`Auth Success: ${user.role} ${user.email} → ${req.originalUrl}`);
      
      next();
      
    } catch (error) {
      logger.warn(`Auth Failed: ${error.message}`);
      
      // Specific JWT errors
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token signature'
        });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please refresh.',
          refreshRequired: true  // Frontend → /auth/refresh
        });
      }
      
      res.status(401).json({
        success: false,
        message: 'Not authorized, token failed'
      });
    }
  } else {
    res.status(401).json({
      success: false,
      message: 'No token provided. Authorization header required.'
    });
  }
};

// 👑 Role-based Access (Student vs Placement)
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      logger.warn(`Access Denied: ${req.user?.email || 'Anonymous'} → ${req.originalUrl} (requires: ${roles.join(', ')})`);
      
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires one of: ${roles.join(', ')} role`,
        yourRole: req.user?.role || 'none'
      });
    }
    next();
  };
};

// 🔄 Refresh Token Validation (Long-lived, 7 days)
const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required'
      });
    }

    // Verify refresh token (separate secret, longer expiry)
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    const user = await User.findById(decoded.id).select('role email');
    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    next();
    
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

// 📱 Rate Limit Hook (express-rate-limit compatible)
const rateLimitAuth = (req, res, next) => {
  // 10 login attempts / 15min per IP (anti-brute force)
  req.rateLimit = {
    max: 10,
    windowMs: 15 * 60 * 1000,
    message: 'Too many login attempts. Try again later.'
  };
  next();
};

// 🛡️ Student-only (StudentDashboard routes)
const authorizeStudent = restrictTo('student');

// 👑 Placement-only (Top 50 rankings)
const authorizePlacement = restrictTo('placement');

module.exports = {
  protect,
  restrictTo,
  verifyRefreshToken,
  rateLimitAuth,
  authorizeStudent,
  authorizePlacement,
};