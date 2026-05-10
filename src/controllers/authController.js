const authService = require('../services/authService');
const { z } = require('zod');  // npm i zod

// Zod schemas for Aditya University validation
const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8),  // Enforce strong passwords
  role: z.enum(['student', 'placement']),  // Strict roles only
  studentId: z.string().optional(),        // rollNumber → studentId (AU format: 23CSE001)
  branch: z.enum(['CSE', 'IT', 'ECE', 'ME', 'Civil']).optional(),  // AU branches
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

// Input validation middleware (reusable)
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: error.errors.map(e => e.message)
    });
  }
};

const registerUser = async (req, res, next) => {
  try {
    // studentId is mapped to rollNumber in the DB
    const { name, email, password, role, studentId, branch, department } = req.body;
    
    const user = await authService.registerUser({
      name,
      email,
      password,
      role,
      studentId,     // AU: 23CSE001 format
      branch,        // CSE/IT for rankings
      department: department || branch || 'N/A', // Fallback
    });
    
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          branch: user.branch,
        },
        tokens: {
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
        }
      }
    });
  } catch (error) {
    // authService throws custom errors
    if (error.code === 'DUPLICATE_EMAIL') {
      return res.status(409).json({
        success: false,
        message: 'Email already registered for Aditya University'
      });
    }
    next(error);
  }
};

const authUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.authUser(email, password);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: user.studentId,
          branch: user.branch,
          verifiedSkillScore: user.verifiedSkillScore || 0,  // Show initial score
        },
        tokens: {
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          expiresIn: '15m'  // Frontend timer
        }
      }
    });
  } catch (error) {
    if (error.message === 'INVALID_CREDENTIALS') {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    next(error);
  }
};

const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshAccessToken(refreshToken);
    
    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token'
    });
  }
};

module.exports = {
  registerUser,
  authUser,
  refreshToken,
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
};