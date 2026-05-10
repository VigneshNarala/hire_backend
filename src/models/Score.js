const mongoose = require('mongoose');

// Score breakdown types
const ScoreComponents = {
  RESUME: 'resume',
  GITHUB: 'github',
  PROJECTS: 'projects',
  CERTIFICATES: 'certificates',
  OVERALL: 'overall'
};

const scoreSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: true,
    index: true,
  },

  // Atomic subscores (0–100)
  resumeScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  githubScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  projectScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  certificateScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },

  // Aggregated Placement Readiness (0–100)
  totalReadinessScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
    index: true, // Fast Top 50 / trends
  },

  // Target role context (FSD, ML, etc.)
  targetRole: {
    type: String,
    index: true,
  },

  // Detailed breakdown for UI (ScoreSummaryCard / charts)
  breakdown: {
    type: {
      weights: {
        resume: { type: Number, default: 0.4 },      // 40%
        github: { type: Number, default: 0.3 },      // 30%
        projects: { type: Number, default: 0.2 },    // 20%
        certificates: { type: Number, default: 0.1 } // 10%
      },
      computedFrom: {
        atsScore: Number,            // From Resume model
        verifiedSkillScore: Number,  // From GitHub
        projectCount: Number,
        certificateCount: Number,
      }
    },
    default: {}
  },

  // History snapshots for this score record
  history: [
    {
      date: { type: Date, default: Date.now },
      score: { type: Number, min: 0, max: 100 },
      component: {
        type: String,
        enum: Object.values(ScoreComponents),
        default: ScoreComponents.OVERALL
      },
      meta: {
        type: mongoose.Schema.Types.Mixed, // e.g., { reason: "Linked GitHub", delta: +12 }
      }
    }
  ],

}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for analytics
scoreSchema.index({ student: 1, createdAt: -1 });            // Recent scores
scoreSchema.index({ student: 1, targetRole: 1 });            // Role-specific trends
scoreSchema.index({ totalReadinessScore: -1 });              // Global rankings

// Virtual: simple label for charts/badges
scoreSchema.virtual('grade').get(function () {
  const s = this.totalReadinessScore || 0;
  if (s >= 90) return 'Elite';
  if (s >= 80) return 'Strong';
  if (s >= 70) return 'Ready';
  if (s >= 60) return 'Improving';
  return 'Needs Work';
});

// Helper method to push history snapshots
scoreSchema.methods.addHistoryPoint = function (component, score, meta = {}) {
  this.history.push({
    component,
    score,
    meta,
    date: new Date()
  });
};

const Score = mongoose.model('Score', scoreSchema);
module.exports = Score;
module.exports.ScoreComponents = ScoreComponents;