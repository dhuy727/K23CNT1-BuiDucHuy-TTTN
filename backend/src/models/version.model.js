const mongoose = require('mongoose');

/**
 * Schema lưu trữ lịch sử phiên bản của tệp tin.
 * Mỗi version là một bản snapshot lưu lại trạng thái file tại một thời điểm.
 */
const versionSchema = new mongoose.Schema(
  {
    // Tệp tin gốc mà version này thuộc về
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: [true, 'Version phải thuộc về một tệp tin'],
      index: true
    },
    // Chủ sở hữu file (để tối ưu truy vấn phân quyền)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Version phải có người sở hữu'],
      index: true
    },
    // Số thứ tự phiên bản (tự động tăng: 1, 2, 3,...)
    versionNumber: {
      type: Number,
      required: true,
      min: 1
    },
    // Tên file hiển thị tại thời điểm tạo version
    name: {
      type: String,
      required: true,
      trim: true
    },
    // Tên file gốc trên hệ thống
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    // Kích thước file tại thời điểm tạo version (bytes)
    size: {
      type: Number,
      default: 0,
      min: 0
    },
    // MIME type của file
    mimeType: {
      type: String,
      default: 'application/octet-stream',
      trim: true
    },
    // Phần mở rộng file
    extension: {
      type: String,
      default: '',
      trim: true
    },
    // Đường dẫn vật lý đến file snapshot trên đĩa
    storagePath: {
      type: String,
      required: [true, 'Đường dẫn lưu trữ không được để trống']
    },
    // Ghi chú mô tả lý do tạo version (tùy chọn)
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Ghi chú không được vượt quá 500 ký tự']
    },
    // Loại hành động dẫn đến việc tạo version
    changeType: {
      type: String,
      enum: ['upload', 'update', 'rename', 'restore', 'manual'],
      default: 'manual'
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Index tổng hợp để truy vấn nhanh các version của một file, sắp xếp theo số thứ tự
versionSchema.index({ file: 1, versionNumber: -1 });
versionSchema.index({ file: 1, user: 1 });

const Version = mongoose.model('Version', versionSchema);

module.exports = Version;
