/**
 * Script tiện ích: Lập chỉ mục RAG cho toàn bộ tài liệu hiện có trong MongoDB Atlas
 * Chạy lệnh: node scripts/index-all-rag.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const File = require('../src/models/file.model');
const { indexFileForRag } = require('../src/services/rag-indexing.service');
const { isSupportedExtractType } = require('../src/services/text-extract.service');

const run = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('Lỗi: Thiếu MONGO_URI trong file .env');
      process.exit(1);
    }

    console.log('Đang kết nối tới MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('Kết nối MongoDB Atlas thành công!\n');

    const files = await File.find({ isTrash: false });
    console.log(`Tìm thấy tổng cộng ${files.length} tệp tin trong hệ thống.`);

    const supportedFiles = files.filter((f) => isSupportedExtractType(f));
    console.log(`Có ${supportedFiles.length} tệp tin định dạng văn bản (PDF, DOCX, TXT) hỗ trợ RAG.\n`);

    if (supportedFiles.length === 0) {
      console.log('Không có tệp tin nào cần lập chỉ mục.');
      process.exit(0);
    }

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < supportedFiles.length; i++) {
      const file = supportedFiles[i];
      console.log(`[${i + 1}/${supportedFiles.length}] Bắt đầu xử lý: "${file.name}"...`);

      try {
        const indexed = await indexFileForRag(file._id);
        if (indexed && indexed.ragStatus === 'indexed') {
          console.log(`  -> Thành công: Tạo ${indexed.ragChunkCount} chunks vector.`);
          successCount++;
        } else {
          console.log(`  -> Trạng thái: ${indexed?.ragStatus || 'bỏ qua'} (${indexed?.ragError || 'không có văn bản'})`);
        }
      } catch (err) {
        console.error(`  -> Thất bại: ${err.message}`);
        failCount++;
      }

      // Giãn cách nhẹ 500ms giữa các file để tránh quá tải quota
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log('\n=======================================');
    console.log(`Hoàn tất! Thành công: ${successCount}, Lỗi: ${failCount}`);
    console.log('=======================================');
  } catch (error) {
    console.error('Lỗi chạy script index:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();
