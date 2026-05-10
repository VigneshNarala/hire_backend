const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const { rateLimitAuth, verifyRefreshToken } = require('../middleware/authMiddleware');

// 🔐 Register (Student / Placement)
router.post(
  '/register',
  rateLimitAuth,                    // optional: anti-brute force
  authController.validateRegister,  // Zod validation
  authController.registerUser
);

// 🔑 Login
router.post(
  '/login',
  rateLimitAuth,
  authController.validateLogin,
  authController.authUser
);

// 🔄 Refresh Access Token
router.post(
  '/refresh',
  verifyRefreshToken,
  authController.refreshToken
);

module.exports = router;