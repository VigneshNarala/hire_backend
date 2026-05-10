const mongoose = require('mongoose');

// Certificate verification status enum
const VerificationStatus = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  INVALID: 'invalid',
  EXPIRED: 'expired'
};

// Supported platforms (Aditya students: Coursera, Udemy, AWS, Credly)
const SupportedIssuers = [
  'Coursera', 'edX', 'Udemy', 'Udacity', 'Google Career Certificates',
  'AWS', 'Microsoft', 'IBM', 'Cisco', 'Oracle', 'Credly', 'NPTEL'
];

const certificateSchema = new mongoose.Schema({
  // References
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: [true, 'Student profile required'],
    index: true,
  },
  
  // Certificate details
  name: {
    type: String,
    required: [true, 'Certificate name required'],
    trim: true,
    maxlength: [100, 'Name too long']
  },
  
  issuer: {
    type: String,
    required: [true, 'Issuer required'],
    enum: {
      values: SupportedIssuers,
      message: `Issuer must be one of: ${SupportedIssuers.join(', ')}`
    }
  },
  
  issueDate: {
    type: Date,
    required: [true, 'Issue date required']
  },
  
  expiryDate: {
    type: Date,  // AWS/Azure certs expire
  },
  
  // Verification fields (anti-fake)
  credentialId: {
    type: String,
    required: [true, 'Credential ID/URL required'],
    unique: true,  // No duplicates
  },
  
  credentialUrl: {
    type: String,
    validate: {
      validator: v => /^https?:\/\//.test(v),
      message: 'Valid URL required'
    }
  },
  
  verificationHash: {
    type: String,  // Blockchain/Credly hash
  },
  
  // Status + Score Impact
  verified: {
    type: Boolean,
    default: false,
  },
  
  verificationStatus: {
    type: String,
    enum: Object.values(VerificationStatus),
    default: VerificationStatus.PENDING
  },
  
  scoreImpact: {
    type: Number,
    min: 0,
    max: 15,  // Max +15pts to Placement Readiness
    default: 0
  },
  
  // Metadata
  skillTags: [{
    type: String,
    enum: ['React', 'Node.js', 'Python', 'AWS', 'Docker', 'ML', 'FSD']  // Boosts domain scores
  }],
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 Compound Indexes for Dashboard Queries
certificateSchema.index({ student: 1, verified: -1 });        // Student certs (verified first)
certificateSchema.index({ issuer: 1, verified: 1 });          // Platform stats
certificateSchema.index({ credentialId: 1 }, { unique: true }); // No dupes
certificateSchema.index({ verificationStatus: 1 });           // Pending queue
certificateSchema.index({ skillTags: 1, verified: 1 });       // FSD/ML filtering

// Virtuals for Placement Cell
certificateSchema.virtual('isExpired').get(function() {
  if (!this.expiryDate) return false;
  return this.expiryDate < new Date();
});

// Pre-save: Auto-set score impact based on issuer/skill
certificateSchema.pre('save', function(next) {
  if (this.isModified('verified') && this.verified) {
    // Tiered scoring (Placement Readiness boost)
    const impactMap = {
      'AWS': 15, 'Microsoft': 15, 'Google Career Certificates': 12,
      'Coursera': 10, 'Cisco': 12, 'Oracle': 12,
      'Udemy': 5, 'NPTEL': 8, 'Credly': 10
    };
    this.scoreImpact = impactMap[this.issuer] || 5;
    this.verificationStatus = VerificationStatus.VERIFIED;
  }
  
  if (this.isExpired) {
    this.verificationStatus = VerificationStatus.EXPIRED;
    this.scoreImpact = 0;
  }
  
  next();
});

// Post-save: Trigger student re-score
certificateSchema.post('save', async function(doc) {
  if (doc.verified && doc.scoreImpact > 0) {
    // Hook scoringService to boost PlacementReadinessScore
    console.log(`🎖️ Certificate boost: +${doc.scoreImpact}pts for ${doc.student}`);
    // TODO: await scoringService.updateStudentScore(doc.student);
  }
});

const Certificate = mongoose.model('Certificate', certificateSchema);
module.exports = Certificate;
module.exports.VerificationStatus = VerificationStatus;