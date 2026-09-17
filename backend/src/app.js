const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Middlewares xử lý request
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger ghi nhận request trong môi trường development
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Gắn toàn bộ API routes với tiền tố /api
app.use('/api', routes);

// Phục vụ Frontend React (Single Page Application)
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');

if (fs.existsSync(frontendDistPath)) {
  // Phục vụ các file tĩnh trong frontend/dist
  app.use(express.static(frontendDistPath));

  // SPA fallback: Mọi route client-side (như /login, /drive, /trash...) đều trả về index.html
  app.get('*', (req, res, next) => {
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Fallback nếu chưa chạy build frontend
  app.get('/', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Chào mừng đến với REST API (Frontend chưa được build trong /frontend/dist)',
      instruction: 'Chạy "npm run build" để tạo bản build frontend',
      documentation: '/api/health'
    });
  });
}

// Middleware xử lý 404 Not Found cho các route API không tồn tại
app.use(notFound);

// Middleware xử lý lỗi tập trung
app.use(errorHandler);

module.exports = app;
