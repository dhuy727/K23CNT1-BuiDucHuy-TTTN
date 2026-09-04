require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Kết nối cơ sở dữ liệu MongoDB và khởi động Server
const startServer = async () => {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
      console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔑 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`👥 User endpoints: http://localhost:${PORT}/api/users`);
      console.log(`==================================================`);
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
