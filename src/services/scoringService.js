const Score = require('../models/Score');
const StudentProfile = require('../models/StudentProfile');

// Core weights (can be tuned per domain later)
const WEIGHTS = {
  resume: 0.4,       // ATS + structure
  github: 0.3,       // Verified Skill Score
  projects: 0.2,     // Portfolio depth (future)
  certificates: 0.1, // Verified certs
};

const clamp = (value, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

const calculatePlacementReadiness = async (studentId) => {
  const student = await StudentProfile.findById(studentId);
  if (!student) return 0;

  let scoreRecord = await Score.findOne({ student: studentId });
  if (!scoreRecord) {
    // Initialize empty record if not exists
    scoreRecord = new Score({ student: studentId });
  }

  const resumeScore = clamp(scoreRecord.resumeScore || 0);
  const githubScore = clamp(scoreRecord.githubScore || 0);
  const projectScore = clamp(scoreRecord.projectScore || 0);
  const certificateScore = clamp(scoreRecord.certificateScore || 0);

  // Weighted formula
  let total =
    resumeScore * WEIGHTS.resume +
    githubScore * WEIGHTS.github +
    projectScore * WEIGHTS.projects +
    certificateScore * WEIGHTS.certificates;

  total = Math.round(total); // 0–100 integer

  // Update Score record
  scoreRecord.totalReadinessScore = total;
  scoreRecord.breakdown = {
    weights: { ...WEIGHTS },
    computedFrom: {
      atsScore: resumeScore,
      verifiedSkillScore: githubScore,
      projectScore,
      certificateScore,
    },
  };
  scoreRecord.addHistoryPoint('overall', total, {
    domain: student.domain,
    branch: student.branch,
  });
  await scoreRecord.save();

  // Update StudentProfile
  student.placementReadinessScore = total;
  student.lastScoreDate = new Date();
  await student.save();

  return total;
};

module.exports = {
  calculatePlacementReadiness,
  WEIGHTS,
};