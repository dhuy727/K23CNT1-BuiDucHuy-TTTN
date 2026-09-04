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

// Endpoint trang chủ chào mừng
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Chào mừng đến với REST API Quản lý Người dùng & Xác thực JWT 2 Token',
    version: '1.0.0',
    documentation: '/api/health'
  });
});

// Gắn toàn bộ API routes với tiền tố /api
app.use('/api', routes);

// Middleware xử lý 404 Not Found
app.use(notFound);

// Middleware xử lý lỗi tập trung
app.use(errorHandler);

module.exports = app;
