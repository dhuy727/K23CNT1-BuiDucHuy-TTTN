require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');
const { resumePendingJobs } = require('./src/services/ai.service');
const { initQueueEngine } = require('./src/queues/queue.engine');

const PORT = process.env.PORT || 3000;

// Kết nối cơ sở dữ liệu MongoDB và khởi động Server
const startServer = async () => {
  try {
    await connectDB();

    // Khởi tạo hàng đợi xử lý tác vụ nền (BullMQ + Redis hoặc In-Memory Adaptive Queue)
    await initQueueEngine();

    // Tự động khôi phục và xử lý các tác vụ AI còn dang dở
    await resumePendingJobs();

    const server = app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Hệ thống đang chạy tại: http://localhost:${PORT}`);
      console.log(`📡 Health check API: http://localhost:${PORT}/api/health`);
      console.log(`==================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Cổng ${PORT} đang được sử dụng bởi một tiến trình khác (EADDRINUSE). Vui lòng tắt tiến trình cũ hoặc đổi PORT trong .env.`);
      } else {
        console.error(`❌ Lỗi HTTP server: ${err.message}`);
      }
      process.exit(1);
    });

    // Bắt các lỗi unhandledRejection để tránh crash bất ngờ
    process.on('unhandledRejection', (err) => {
      console.error('LỖI UNHANDLED REJECTION! Đang tắt server...', err.message);
      server.close(() => {
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      console.log('Nhận tín hiệu SIGTERM, đang đóng HTTP server...');
      server.close(() => {
        console.log('HTTP server đã đóng an toàn.');
      });
    });
  } catch (error) {
    console.error(`Không thể khởi động server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
