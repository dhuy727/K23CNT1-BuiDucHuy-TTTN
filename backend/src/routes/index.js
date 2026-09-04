const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const folderRoutes = require('./folder.routes');
const fileRoutes = require('./file.routes');
const searchRoutes = require('./search.routes');
const shareRoutes = require('./share.routes');

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Hệ thống REST API đang hoạt động bình thường',
    timestamp: new Date().toISOString()
  });
});

// Gắn các router con
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/folders', folderRoutes);
router.use('/files', fileRoutes);
router.use('/search', searchRoutes);
router.use('/shares', shareRoutes);

module.exports = router;

