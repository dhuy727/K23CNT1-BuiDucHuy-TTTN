const express = require('express');
const router = express.Router();
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const folderRoutes = require('./folder.routes');
const fileRoutes = require('./file.routes');
const searchRoutes = require('./search.routes');
const shareRoutes = require('./share.routes');
const collabRoutes = require('./collab.routes');
const automationRoutes = require('./automation.routes');
const notificationRoutes = require('./notification.routes');
const duplicateRoutes = require('./duplicate.routes');
const activityRoutes = require('./activity.routes');
const analyticsRoutes = require('./analytics.routes');
const categoryRoutes = require('./category.routes');
const ragRoutes = require('./rag.routes');

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
router.use('/collab', collabRoutes);
router.use('/automations', automationRoutes);
router.use('/notifications', notificationRoutes);
router.use('/duplicates', duplicateRoutes);
router.use('/activities', activityRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/categories', categoryRoutes);
router.use('/rag', ragRoutes);

module.exports = router;
