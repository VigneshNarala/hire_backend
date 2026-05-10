const githubService = require('../services/githubService');
const resumeService = require('../services/resumeService');
const certificateService = require('../services/certificateService');
const scoringService = require('../services/scoringService');  // Combines all scores
const StudentProfile = require('../models/StudentProfile');
const Score = require('../models/Score');
const { z } = require('zod');

// Zod validation for student endpoints
const resumeUploadSchema = z.object({
  targetRole: z.enum(['FSD', 'ML', 'Backend', 'Data Science', 'Frontend']).default('FSD'),
});

const githubSyncSchema = z.object({
  githubUsername: z.string().min(3).max(39),  // GitHub username rules
  accessToken: z.string().optional(),         // OAuth token
});

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: error.errors.map(e => e.message)
    });
  }
};

// 🚀 Core: Resume Upload → ML Scoring → Readiness Update
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No resume file uploaded (PDF/DOCX only)'
      });
    }

    const studentProfile = await StudentProfile.findOne({ user: req.user._id })
      .populate('user', 'name studentId branch');
    
    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        message: 'Complete your profile first'
      });
    }

    const { targetRole } = req.body;
    
    // 1. Process PDF → ML Service → ATS Score
    const resumeAnalysis = await resumeService.processResumeUpload(
      studentProfile._id,
      req.file.path,
      req.file.originalname,
      targetRole
    );

    // 2. GitHub Verified Skills (if linked)
    let verifiedSkillScore = studentProfile.verifiedSkillScore || 0;
    if (studentProfile.githubUsername) {
      const githubStats = await githubService.fetchGithubStats(studentProfile._id, studentProfile.githubUsername);
      verifiedSkillScore = githubStats.verifiedSkillScore;
    }

    // 3. Combined Placement Readiness Score (40% ATS + 40% GitHub + 20% Structure)
    const finalScore = await scoringService.calculatePlacementReadiness({
      atsScore: resumeAnalysis.atsScore,
      verifiedSkillScore,
      resumeQuality: resumeAnalysis.qualityScore,
      targetRole,
      branch: studentProfile.branch,
    });

    // 4. Save to history + update profile
    studentProfile.placementReadinessScore = finalScore.total;
    studentProfile.lastScoreDate = new Date();
    studentProfile.domainPreferences = [targetRole];
    studentProfile.isProfileComplete = true;
    await studentProfile.save();

    // Log score history
    await Score.create({
      student: studentProfile._id,
      resumeVersion: resumeAnalysis.version,
      targetRole,
      atsScore: resumeAnalysis.atsScore,
      verifiedSkillScore,
      placementReadinessScore: finalScore.total,
      breakdown: finalScore.breakdown,
    });

    res.status(201).json({
      success: true,
      data: {
        resume: resumeAnalysis,
        scores: {
          placementReadiness: Math.round(finalScore.total),
          verifiedSkills: Math.round(verifiedSkillScore),
          atsScore: Math.round(resumeAnalysis.atsScore),
          ...finalScore.breakdown,
        },
        suggestions: finalScore.improvements,  // Learning path for StudentDashboard
        nextSteps: [
          `Target ${targetRole} score: ${Math.round(finalScore.total)}/100`,
          verifiedSkillScore > 0 ? '✅ GitHub verified' : '🔗 Link GitHub for +20 points'
        ]
      }
    });

  } catch (error) {
    console.error('Resume Upload Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Resume processing failed'
    });
  }
};

// 🔗 GitHub Sync → Verified Skill Score
const syncGithub = async (req, res, next) => {
  try {
    const { githubUsername, accessToken } = req.body;
    const studentProfile = await StudentProfile.findOne({ user: req.user._id });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Update + fetch real-time stats
    studentProfile.githubUsername = githubUsername;
    await studentProfile.save();

    const githubStats = await githubService.fetchGithubStats(
      studentProfile._id, 
      githubUsername, 
      accessToken  // Private repos if provided
    );

    // Trigger full re-score if new GitHub data
    if (githubStats.verifiedSkillScore > (studentProfile.verifiedSkillScore || 0)) {
      studentProfile.verifiedSkillScore = githubStats.verifiedSkillScore;
      await studentProfile.save();
    }

    res.json({
      success: true,
      data: githubStats,
      impact: `+${Math.round(githubStats.verifiedSkillScore)} GitHub skill points`
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'GitHub sync failed (check username)'
    });
  }
};

// 📊 Student Dashboard Stats (Recharts ready)
const getDashboardStats = async (req, res, next) => {
  try {
    const studentProfile = await StudentProfile.findOne({ user: req.user._id })
      .populate({
        path: 'scores',
        options: { limit: 5, sort: { createdAt: -1 } }  // Recent scores
      });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Profile not found' });
    }

    // Certificates count (from service)
    const certificateCount = await certificateService.countValidCertificates(studentProfile._id);

    // Fetch latest resume to get detailed ATS metrics
    const Resume = require('../models/Resume');
    const latestResume = await Resume.findOne({ student: studentProfile._id }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        profile: {
          studentId: studentProfile.user.studentId,
          branch: studentProfile.branch,
          githubUsername: studentProfile.githubUsername,
          isComplete: studentProfile.isProfileComplete,
        },
        currentScores: {
          placementReadiness: Math.round(studentProfile.placementReadinessScore || 0),
          verifiedSkillScore: Math.round(studentProfile.verifiedSkillScore || 0),
          atsScore: Math.round(latestResume?.atsScore || 0),
        },
        latestResumeMetrics: latestResume?.feedback?.metrics || null,
        recentScores: studentProfile.scores?.map(s => ({
          date: s.createdAt,
          score: Math.round(s.placementReadinessScore),
          role: s.targetRole,
        })) || [],
        certificates: certificateCount,
        rank: 'Top 25%'  // Mock; compute vs peers later
      }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadResume,
  syncGithub,
  getDashboardStats,
  validateResume: validate(resumeUploadSchema),
  validateGithub: validate(githubSyncSchema),
};