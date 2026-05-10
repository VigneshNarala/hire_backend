const Certificate = require('../models/Certificate');

const countValidCertificates = async (studentProfileId) => {
  try {
    const count = await Certificate.countDocuments({
      student: studentProfileId,
      status: 'Verified'
    });
    return count;
  } catch (err) {
    console.error('Error counting certificates:', err);
    return 0;
  }
};

module.exports = {
  countValidCertificates,
};
