const mongoose = require('mongoose');

// ATS Feedback categories (from ATS_Resume_Analyzer_2026.html)
const FeedbackCategories = {
  PARSING: 'parsing',      // Multi-column, tables (-25pts)
  KEYWORDS: 'keywords',    // Missing React (-15pts)
  STRUCTURE: 'structure',  // No dates, bad bullets
  CONTENT: 'content',      // Weak achievements
  CONTACT: 'contact',      // Missing phone/LinkedIn
  LENGTH: 'length'         // 400-700 words optimal
};

const RedFlagSeverity = {
  CRITICAL: 'critical',    // Parsing failure
  HIGH: 'high',            // Missing critical skills
  MEDIUM: 'medium',
  LOW: 'low'
};

const resumeSchema = new mongoose.Schema({
  // Core references
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudentProfile',
    required: [true, 'Student required'],
    index: true,
  },
  
  // File metadata (Multer)
  fileName: {
    type: String,
    required: [true, 'Filename required'],
    trim: true,
  },
  
  fileUrl: {
    type: String,
    required: [true, 'File URL required'],
  },
  
  fileSize: {
    type: Number,  // bytes (limit 5MB)
    min: 1000,
    max: 5 * 1024 * 1024
  },
  
  mimeType: {
    type: String,  // application/pdf
    enum: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  },
  
  // Parsed content
  parsedText: {
    type: String,
    maxlength: [10000, 'Text too long (max 10k chars)']
  },
  
  wordCount: {
    type: Number,
    min: 200,
    max: 1000  // Optimal ATS range
  },
  
  // ML Analysis Results
  atsScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
    index: true  // Top ATS rankings
  },
  
  targetRole: {
    type: String,  // FSD, ML (from JobRole)
    index: true,
  },
  
  // Structured ML feedback (HTML prototype → JSON)
  feedback: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Versioning (rewrite history)
  version: {
    type: Number,
    min: 1,
    default: 1
  },
  
  isCurrent: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // Role-optimized variants
  optimizedVariants: [{
    role: String,     // FSD-optimized version
    atsScore: Number,
    fileUrl: String,
    createdAt: { type: Date, default: Date.now }
  }]
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 🔥 Indexes for Student History + Rankings
resumeSchema.index({ student: 1, isCurrent: 1 });           // Latest resume
resumeSchema.index({ student: 1, atsScore: -1 });           // Score trends
resumeSchema.index({ student: 1, targetRole: 1 });          // FSD history
resumeSchema.index({ targetRole: 1, atsScore: -1 });        // Top FSD resumes
resumeSchema.index({ createdAt: -1 });                      // Recent uploads

// Virtuals
resumeSchema.virtual('qualityGrade').get(function() {
  const score = this.atsScore;
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'Needs Work';
});

// Pre-save: Parse word count
resumeSchema.pre('save', function(next) {
  if (this.parsedText) {
    this.wordCount = this.parsedText.split(/\s+/).length;
  }
  next();
});

// Post-save: Trigger scoring update
resumeSchema.post('save', async function(doc) {
  if (doc.isCurrent && doc.atsScore > 0) {
    console.log(`📄 Resume scored: ${doc.atsScore} for ${doc.targetRole}`);
    // TODO: scoringService.updateStudentProfile(doc.student);
  }
});

const Resume = mongoose.model('Resume', resumeSchema);
module.exports = Resume;
module.exports.FeedbackCategories = FeedbackCategories;
module.exports.RedFlagSeverity = RedFlagSeverity;