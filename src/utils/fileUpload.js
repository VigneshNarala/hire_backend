const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(
      null,
      `${file.fieldname}-${Date.now()}-${safeName}`
    );
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExt = /pdf|doc|docx|txt/;
  const extname = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedExt.test(file.mimetype.toLowerCase());

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Resumes Only! Allowed: PDF, DOC, DOCX, TXT'));
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max
  },
  fileFilter,
});

module.exports = upload;