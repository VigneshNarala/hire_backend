require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const StudentProfile = require('./src/models/StudentProfile');
const bcrypt = require('bcryptjs');

const seedUsers = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected.');

    // Clear existing for a fresh start or just find and update
    const passwordHash = '12345678';
    
    await User.deleteMany({ email: { $in: ['student@example.com', 'placement@example.com'] } });
    
    let student = null;
    if (!student) {
      student = await User.create({
        name: 'John Doe',
        email: 'student@example.com',
        password: passwordHash,
        role: 'student',
        studentId: '21A91A0501'
      });
      await StudentProfile.create({
        user: student._id,
        rollNumber: '21A91A0501',
        branch: 'CSE',
        department: 'Computer Science',
        domainPreferences: ['FSD'],
        isProfileComplete: true
      });
      console.log('Created student@example.com');
    } else {
      console.log('Student already exists.');
    }

    let placement = await User.findOne({ email: 'placement@example.com' });
    if (!placement) {
      placement = await User.create({
        name: 'Officer Jane',
        email: 'placement@example.com',
        password: passwordHash,
        role: 'placement'
      });
      console.log('Created placement@example.com');
    } else {
      console.log('Placement officer already exists.');
    }

    console.log('Seeding complete.');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding data:', err);
    process.exit(1);
  }
};

seedUsers();
