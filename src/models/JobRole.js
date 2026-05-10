const mongoose = require('mongoose');

// Aditya domains (from placement trends)
const Domains = ['FSD', 'ML', 'Backend', 'Frontend', 'Data Science', 'DevOps', 'Mobile'];

// Skill weight tiers for ATS scoring
const SkillTiers = {
  CRITICAL: 0.25,   // Must-have (React for FSD)
  IMPORTANT: 0.15,  // Nice-to-have (Docker)
  OPTIONAL: 0.10    // Bonus (Figma)
};

const jobRoleSchema = new mongoose.Schema({
  // Role metadata
  title: {
    type: String,
    required: [true, 'Job title required'],
    trim: true,
    maxlength: [50, 'Title too long']
  },
  
  domain: {
    type: String,
    required: [true, 'Domain required'],
    enum: {
      values: Domains,
      message: `Domain must be one of: ${Domains.join(', ')}`
    },
    index: true  // Fast Top 50 FSD
  },
  
  // ATS Matching (ML service uses these)
  requiredSkills: [{
    name: {
      type: String,
      required: true,
      trim: true  // "React.js" → "React"
    },
    tier: {
      type: String,
      enum: Object.values(SkillTiers),
      default: SkillTiers.IMPORTANT
    },
    weight: {
      type: Number,
      min: 0.05,
      max: 0.30,
      default: function() {
        return SkillTiers[this.tier] || 0.10;
      }
    },
    keywords: [String]  // ["React", "React.js", "Next.js"]
  }],
  
  // Resume rewriting targets
  description: {
    type: String,
    maxlength: [500, 'Description too long']
  },
  
  // Scoring thresholds (Placement readiness)
  minATSScore: {
    type: Number,
    min: 50,
    max: 95,
    default: 75  // FSD needs 75+ ATS
  },
  
  idealReadinessScore: {
    type: Number,
    min: 70,
    max: 100,
    default: 85
  },
  
  // Aditya companies hiring this role
  companies: [{
    name: String,      // Infosys, TCS, Accenture
    hiringCount: Number  // 50 FSD openings
  }],
  
  // Active status
  isActive: {
    type: Boolean,
    default: true
  }
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 Indexes for Top 50 + Role Matching
jobRoleSchema.index({ domain: 1, isActive: 1 });              // Domain rankings
jobRoleSchema.index({ 'requiredSkills.name': 1 });             // Skill search
jobRoleSchema.index({ minATSScore: 1 });                      // Threshold queries
jobRoleSchema.index({ title: 'text', description: 'text' });  // Full-text search

// Virtual: Total skill weight (must = 1.0)
jobRoleSchema.virtual('totalSkillWeight').get(function() {
  return this.requiredSkills.reduce((sum, skill) => sum + skill.weight, 0);
});

// Pre-save: Normalize skill keywords
jobRoleSchema.pre('save', function(next) {
  this.requiredSkills.forEach(skill => {
    if (!skill.keywords?.length) {
      skill.keywords = [skill.name.toLowerCase()];
    }
  });
  next();
});

// Methods for ML Service
jobRoleSchema.methods.calculateSkillMatch = function(resumeSkills) {
  let matchScore = 0;
  
  this.requiredSkills.forEach(roleSkill => {
    const resumeHasSkill = resumeSkills.some(rs => 
      roleSkill.keywords.some(kw => rs.toLowerCase().includes(kw))
    );
    
    if (resumeHasSkill) {
      matchScore += roleSkill.weight;
    }
  });
  
  return Math.round(matchScore * 100);
};

const JobRole = mongoose.model('JobRole', jobRoleSchema);
module.exports = JobRole;
module.exports.SkillTiers = SkillTiers;
module.exports.Domains = Domains;