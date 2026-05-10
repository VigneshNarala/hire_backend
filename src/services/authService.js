const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');

const registerUser = async ({
  name,
  email,
  password,
  role,
  studentId,
  branch,
  department,
}) => {
  // Check duplicate email
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('User already exists');
    error.code = 'DUPLICATE_EMAIL';
    throw error;
  }

  // Create base user
  const user = await User.create({
    name,
    email,
    password,
    role,       // 'student' | 'placement'
    studentId,  // optional for placement
  });

  // Create StudentProfile for students
  if (role === 'student') {
    await StudentProfile.create({
      user: user._id,
      rollNumber: studentId || email,   // fallback if not provided
      branch,
      department,
      domain: 'Full Stack',             // default domain
      domainPreferences: ['FSD'],
      placementReadinessScore: 0,
      verifiedSkillScore: 0,
      isProfileComplete: false,
    });
  }

  // Generate tokens
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // Persist refresh token (optional; keeps last active device)
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    accessToken,
    refreshToken,
  };
};

const authUser = async (email, password) => {
  // Need password field (select: false in schema)
  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user) {
    const error = new Error('INVALID_CREDENTIALS');
    throw error;
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    const error = new Error('INVALID_CREDENTIALS');
    throw error;
  }

  // Update last login
  user.lastLoginAt = new Date();

  // Rotate refresh token optionally
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();
  user.refreshToken = refreshToken;

  await user.save({ validateBeforeSave: false });

  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId,
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (refreshToken) => {
  // This is used by authController + verifyRefreshToken middleware
  const user = await User.findOne({ refreshToken });
  if (!user) {
    const error = new Error('INVALID_REFRESH');
    throw error;
  }

  const newAccessToken = user.generateAccessToken();
  // Optional: rotate refresh token here too
  return {
    accessToken: newAccessToken,
    refreshToken, // or a new one if you want rotation
  };
};

module.exports = {
  registerUser,
  authUser,
  refreshAccessToken,
};