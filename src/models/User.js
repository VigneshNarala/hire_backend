const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Roles = ['student', 'placement']; // match restrictTo / dashboards

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name required'],
    trim: true,
    maxlength: 100,
  },
  email: {
    type: String,
    required: [true, 'Email required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password required'],
    minlength: 8,
    select: false, // never return by default
  },
  role: {
    type: String,
    enum: Roles,
    default: 'student',
    index: true,
  },

  // Aditya-specific metadata
  studentId: {
    type: String, // 23CSE001; optional for placement users
    trim: true,
  },

  // JWT tokens (for refresh flow)
  refreshToken: {
    type: String,
    select: false,
  },

  lastLoginAt: {
    type: Date,
  },
  isActive: {
    type: Boolean,
    default: true,
  },

}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

// Generate short-lived access token
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );
};

// Generate long-lived refresh token
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
  );
};

const User = mongoose.model('User', userSchema);
module.exports = User;
module.exports.Roles = Roles;