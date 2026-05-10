const express = require('express');
const router = express.Router();

const studentController = require('../controllers/studentController');
const {
  protect,
  authorizeStudent,   // wrapper around restrictTo('student')
} = require('../middleware/authMiddleware');
const upload = require('../utils/fileUpload');

// 📊 Student dashboard (scores, history, certificates)
router.get(
  '/dashboard',
  protect,
  authorizeStudent,
  studentController.getDashboardStats
);

// 📁 Resume upload → ATS + ML scoring
router.post(
  '/resume',
  protect,
  authorizeStudent,
  upload.single('file'),              // Multer: field name "file"
  studentController.validateResume,   // Zod: targetRole, etc.
  studentController.uploadResume
);

// 🔗 GitHub sync → Verified Skill Score
router.post(
  '/github',
  protect,
  authorizeStudent,
  studentController.validateGithub,   // Zod: githubUsername, accessToken (optional)
  studentController.syncGithub
);

module.exports = router;