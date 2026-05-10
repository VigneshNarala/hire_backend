const express = require('express');
const router = express.Router();

const placementController = require('../controllers/placementController');
const {
  protect,
  authorizePlacement,  // wrapper around restrictTo('placement')
} = require('../middleware/authMiddleware');

// 🏆 Domain-wise Top Candidates (Top 50, filters, pagination)
router.get(
  '/top-candidates',
  protect,
  authorizePlacement,
  placementController.validateQuery,   // Zod query validation (domain, branch, page, limit)
  placementController.getTopCandidates
);

// 📊 Placement stats (averages, domain breakdown)
router.get(
  '/stats',
  protect,
  authorizePlacement,
  placementController.getPlacementStats
);

module.exports = router;