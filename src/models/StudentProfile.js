const mongoose = require('mongoose');

const Branches = ['CSE', 'IT', 'ECE', 'EEE', 'Civil', 'Mechanical', 'Other'];
const Domains = ['FSD', 'ML', 'Data Science', 'Cloud', 'Cybersecurity', 'DevOps', 'Other'];

const studentProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // University identity
  rollNumber: {
    type: String,
    required: true,
    unique: true,               // 23CSE001
    trim: true,
  },
  branch: {
    type: String,
    enum: Branches,
    required: true,
    index: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
  },

  // Domain preference for rankings (Top 50 FSD, ML, etc.)
  domain: {
    type: String,
    enum: ['FSD', 'ML', 'Data Science', 'Cloud', 'Cybersecurity', 'Other'],
    default: 'FSD',
  },
  domainPreferences: [{
    type: String,
    enum: Domains,
  }],

  // Public profiles
  githubUsername: {
    type: String,
    trim: true,
    index: true,
  },
  linkedinUrl: {
    type: String,
    trim: true,
  },

  // AI-driven scores
  verifiedSkillScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true,                // For Verified Skill Score ranking
  },
  placementReadinessScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true,                // For domain-wise Top 50
  },

  // Additional metrics
  resumeCount: {
    type: Number,
    default: 0,
  },
  lastScoreDate: {
    type: Date,
  },
  isProfileComplete: {
    type: Boolean,
    default: false,
  },

  // Aggregated stats (for dashboard cards)
  totalCertificates: {
    type: Number,
    default: 0,
  },
  totalProjects: {
    type: Number,
    default: 0,
  },

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for fast placement queries
studentProfileSchema.index({ domain: 1, placementReadinessScore: -1 });
studentProfileSchema.index({ branch: 1, placementReadinessScore: -1 });
studentProfileSchema.index({ verifiedSkillScore: -1 });

// Virtual relation to scores history
studentProfileSchema.virtual('scores', {
  ref: 'Score',
  localField: '_id',
  foreignField: 'student',
});

// Virtual: rank label (for UI badges)
studentProfileSchema.virtual('readinessBand').get(function () {
  const s = this.placementReadinessScore || 0;
  if (s >= 90) return 'Top 10%';
  if (s >= 80) return 'Top 25%';
  if (s >= 70) return 'Above Average';
  if (s >= 60) return 'Improving';
  return 'Needs Support';
});

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);
module.exports = StudentProfile;
module.exports.Branches = Branches;
module.exports.Domains = Domains;