const StudentProfile = require('../models/StudentProfile');
const Score = require('../models/Score');
const User = require('../models/User');
const { z } = require('zod');

// Zod query validation for placement dashboard
const topCandidatesSchema = z.object({
  domain: z.enum(['FSD', 'ML', 'Data Science', 'Backend', 'All Domains']).optional().default('All Domains'),
  branch: z.enum(['CSE', 'IT', 'ECE', 'All Branches']).optional().default('All Branches'),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(10).max(100).default(50),
});

const validateQuery = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      domain: req.query.domain,
      branch: req.query.branch,
      page: req.query.page,
      limit: req.query.limit,
    });
    req.query = { ...req.query, ...validated };
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Invalid query parameters',
      errors: error.errors.map(e => e.message)
    });
  }
};

// Enhanced Top Candidates (Domain + Branch + Pagination + GitHub Verified)
const getTopCandidates = async (req, res, next) => {
  try {
    const { domain, branch, page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Dynamic query for Aditya rankings
    const query = {
      // Only active/complete profiles
      isProfileComplete: true,
    };

    // Domain filter (maps to JobRole skills)
    if (domain && domain !== 'All Domains') {
      query.domainPreferences = domain;  // FSD, ML, etc.
    }

    // Branch filter (CSE/IT for tech roles)
    if (branch && branch !== 'All Branches') {
      query.branch = branch;
    }

    // Execute with compound indexes (fast Top 50)
    const students = await StudentProfile.find(query)
      .populate('user', 'name email studentId')
      .select('user placementReadinessScore verifiedSkillScore githubUsername linkedin branch domainPreferences resume.atsScore lastScoreDate')
      .sort({ 
        placementReadinessScore: -1,     // Primary: Readiness (resume + GitHub)
        verifiedSkillScore: -1,          // Secondary: GitHub commits
        'resume.atsScore': -1            // Tertiary: ATS
      })
      .skip(skip)
      .limit(Number(limit))
      .lean();  // Faster for frontend

    // Total count for pagination
    const total = await StudentProfile.countDocuments(query);

    // Format for Recharts dashboard + TopCandidatesTable.jsx
    const formattedStudents = students.map(s => ({
      id: s._id,
      name: s.user?.name || 'N/A',
      studentId: s.user?.studentId || s.rollNumber,
      email: s.user?.email,
      branch: s.branch,
      domain: s.domainPreferences?.[0] || 'General',
      scores: {
        readiness: Math.round(s.placementReadinessScore || 0),
        verifiedSkills: Math.round(s.verifiedSkillScore || 0),
        ats: Math.round(s.resume?.atsScore || 0),
      },
      github: s.githubUsername,
      linkedin: s.linkedin,
      lastUpdated: s.lastScoreDate,
      profileComplete: s.isProfileComplete,
    }));

    res.json({
      success: true,
      data: {
        candidates: formattedStudents,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / limit),
          hasNext: skip + limit < total,
        },
        filtersApplied: { domain, branch },
      }
    });

  } catch (error) {
    console.error('Top Candidates Error:', error);
    next(error);
  }
};

// Enhanced Stats (Domain breakdowns + Trends)
const getPlacementStats = async (req, res, next) => {
  try {
    const { domain } = req.query;

    // Base aggregates
    const [totalStudents, statsAgg] = await Promise.all([
      StudentProfile.countDocuments({ isProfileComplete: true }),
      
      // Multi-metric aggregation pipeline
      StudentProfile.aggregate([
        { $match: { isProfileComplete: true } },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            avgReadiness: { $avg: '$placementReadinessScore' },
            avgVerifiedSkills: { $avg: '$verifiedSkillScore' },
            avgATSScore: { $avg: '$resume.atsScore' },
            verifiedGithubs: {
              $sum: { $cond: [{ $gt: ['$verifiedSkillScore', 0] }, 1, 0] }
            },
            topPerformers: {
              $sum: { $cond: [{ $gte: ['$placementReadinessScore', 90] }, 1, 0] }
            },
            // Domain distribution
            domains: {
              $push: {
                domain: { $arrayElemAt: ['$domainPreferences', 0] },
                count: 1,
                avgScore: '$placementReadinessScore'
              }
            }
          }
        },
        { $addFields: { 
            avgReadiness: { $round: ['$avgReadiness', 1] },
            avgVerifiedSkills: { $round: ['$avgVerifiedSkills', 1] },
            avgATSScore: { $round: ['$avgATSScore', 1] }
          }
        }
      ])
    ]);

    const stats = statsAgg[0] || {
      avgReadiness: 0,
      avgVerifiedSkills: 0,
      avgATSScore: 0,
      verifiedGithubs: 0,
      topPerformers: 0
    };

    res.json({
      success: true,
      data: {
        totalStudents,
        metrics: {
          averageReadinessScore: stats.avgReadiness,
          averageVerifiedSkillScore: stats.avgVerifiedSkills,
          averageATSScore: stats.avgATSScore,
          verifiedGithubProfiles: stats.verifiedGithubs,
          topPerformers: stats.topPerformers,  // 90+ readiness
        },
        domainBreakdown: stats.domains || [],
        lastUpdated: new Date().toISOString(),
      }
    });

  } catch (error) {
    console.error('Placement Stats Error:', error);
    next(error);
  }
};

module.exports = {
  getTopCandidates,
  getPlacementStats,
  validateQuery,  // For routes middleware
};