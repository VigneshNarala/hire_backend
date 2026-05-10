const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const Resume = require('../models/Resume');
const Score = require('../models/Score');
const StudentProfile = require('../models/StudentProfile');
const { calculatePlacementReadiness } = require('./scoringService');
const { performAnalysis } = require('./enterpriseAtsScorer');

// Ensure ML URL is configured
const ML_BASE_URL = process.env.ML_SERVICE_URL; // e.g. http://localhost:8001

// Core: Upload file → ML service → Save resume + scores
const processResumeUpload = async (studentId, filePath, fileName, targetRole = 'FSD') => {
  let fileStream;

  try {
    // 1. Prepare file + metadata
    if (!ML_BASE_URL) {
      throw new Error('ML service URL not configured (ML_SERVICE_URL)');
    }

    fileStream = fs.createReadStream(filePath);
    const formData = new FormData();
    formData.append('file', fileStream);
    formData.append('target_role', targetRole);

    // 2. Call Python ML Service (/score-resume)
    const mlResponse = await axios.post(
      `${ML_BASE_URL}/score-resume`,
      formData,
      { headers: { ...formData.getHeaders() } }
    );

    const {
      parsed_text,
      quality_score,       // structure/content score (0–100)
    } = mlResponse.data;

    // Run Enterprise ATS Scorer on parsed text
    const enterpriseAnalysis = performAnalysis(parsed_text || '');
    const ats_score = Math.round(enterpriseAnalysis.totalScore);
    const feedback = {
        metrics: enterpriseAnalysis
    };
    const red_flags = enterpriseAnalysis.redFlags.map(f => f.message);

    // 3. Versioning: mark existing resume as not current
    await Resume.updateMany(
      { student: studentId, isCurrent: true },
      { isCurrent: false }
    );

    // 4. Save Resume to DB
    const resume = new Resume({
      student: studentId,
      fileName,
      fileUrl: filePath,   // In prod: S3 or Cloudinary URL
      fileSize: fs.statSync(filePath).size,
      mimeType: guessMimeType(fileName),
      parsedText: parsed_text,
      atsScore: ats_score,
      feedback,
      targetRole,
      isCurrent: true,
      optimizedVariants: [],  // will be filled by rewrite endpoint later
    });

    await resume.save();

    // 5. Update Score document with resumeScore
    let scoreRecord = await Score.findOne({ student: studentId });
    if (!scoreRecord) {
      scoreRecord = new Score({ student: studentId });
    }

    scoreRecord.resumeScore = ats_score;
    scoreRecord.breakdown = {
      ...scoreRecord.breakdown,
      computedFrom: {
        ...(scoreRecord.breakdown?.computedFrom || {}),
        atsScore: ats_score,
      }
    };
    scoreRecord.addHistoryPoint('resume', ats_score, {
      targetRole,
      red_flags,
    });

    await scoreRecord.save();

    // 6. Update StudentProfile (resumeCount, lastScoreDate)
    const profile = await StudentProfile.findById(studentId);
    if (profile) {
      profile.resumeCount = (profile.resumeCount || 0) + 1;
      profile.lastScoreDate = new Date();
      profile.placementReadinessScore = profile.placementReadinessScore || 0; // will be updated below
      await profile.save();
    }

    // 7. Recalculate Placement Readiness (resume + github + projects + certs)
    await calculatePlacementReadiness(studentId);

    // 8. Return full resume + ATS details for frontend
    return {
      id: resume._id,
      atsScore: ats_score,
      qualityScore: quality_score || ats_score,
      feedback,
      targetRole,
      redFlags: red_flags,
      fileName: resume.fileName,
      wordCount: resume.wordCount,
      qualityGrade: resume.qualityGrade,
      version: resume.version,
    };
  } catch (error) {
    console.error('Error processing resume:', error);
    if (error.response) {
      console.error('ML Service Error Response:', error.response.data);
    }
    throw new Error(`Resume analysis failed: ${error.message}`);
  } finally {
    if (fileStream) {
      fileStream.close();
    }
  }
};

// Optional: call ML /rewrite-resume to generate optimized text
const rewriteResumeForRole = async (resumeId, targetRole = 'FSD') => {
  const resume = await Resume.findById(resumeId);
  if (!resume || !resume.parsedText) {
    throw new Error('Resume not found or not parsed');
  }

  const payload = {
    resume_text: resume.parsedText,
    target_role: targetRole,
  };

  const response = await axios.post(`${ML_BASE_URL}/rewrite-resume`, payload);
  const { rewritten_text, ats_score: newAts, suggestions } = response.data;

  // You can store rewritten version as an optimizedVariant
  resume.optimizedVariants.push({
    role: targetRole,
    atsScore: newAts,
    fileUrl: '', // later: generate/downloadable DOCX/PDF
  });

  resume.atsScore = newAts;      // optional: if you want to treat rewrite as new current
  await resume.save();

  return {
    rewrittenText: rewritten_text,
    newAtsScore: newAts,
    suggestions,
  };
};

const guessMimeType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
};

module.exports = {
  processResumeUpload,
  rewriteResumeForRole,
};