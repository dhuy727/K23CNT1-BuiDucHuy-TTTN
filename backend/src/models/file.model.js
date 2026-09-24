const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên file không được để trống'],
      trim: true,
      maxlength: [255, 'Tên file không được vượt quá 255 ký tự']
    },
    originalName: {
      type: String,
      required: [true, 'Tên file gốc không được để trống'],
      trim: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'File phải thuộc về một người dùng'],
      index: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null, // null là file ở thư mục gốc (Root)
      index: true
    },
    size: {
      type: Number,
      default: 0,
      min: [0, 'Kích thước file không được âm']
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
      trim: true
    },
    extension: {
      type: String,
      default: '',
      trim: true
    },
    storagePath: {
      type: String,
      default: ''
    },
    storageType: {
      type: String,
      enum: ['local', 'minio', 's3'],
      default: 'local'
    },
    storageKey: {
      type: String,
      default: ''
    },
    contentHash: {
      type: String,
      default: '',
      trim: true,
      index: true
    },
    // Các trường hỗ trợ phân loại & xử lý tự động bằng AI
    aiStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
      default: 'pending'
    },
    aiCategory: {
      type: String,
      default: 'Chưa phân loại', // vd: Hóa đơn, Báo cáo, Hợp đồng, Đồ án, Hình ảnh
      trim: true
    },
    aiTags: {
      type: [String],
      default: []
    },
    aiSummary: {
      type: String,
      default: ''
    },
    aiConfidence: {
      type: Number,
      default: null,
      min: [0, 'Độ tin cậy AI không được nhỏ hơn 0'],
      max: [1, 'Độ tin cậy AI không được lớn hơn 1']
    },
    aiSuggestedName: {
      type: String,
      default: '',
      trim: true,
      maxlength: [255, 'Tên đề xuất không được vượt quá 255 ký tự']
    },
    aiSuggestedFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null
    },
    aiError: {
      type: String,
      default: '',
      trim: true
    },
    extractedText: {
      type: String,
      default: '',
      select: false, // không trả full text ra list/API trừ khi includeText
      maxlength: [15000, 'Nội dung trích xuất không được vượt quá 15000 ký tự']
    },
    aiProcessedAt: {
      type: Date,
      default: null
    },
    isStarred: {
      type: Boolean,
      default: false
    },
    isTrash: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Index tìm kiếm theo thư mục và người dùng
fileSchema.index({ user: 1, folder: 1, isTrash: 1 });
fileSchema.index({ user: 1, contentHash: 1, isTrash: 1 });
fileSchema.index({ user: 1, name: 'text', aiSummary: 'text', aiTags: 'text' });

const File = mongoose.model('File', fileSchema);

module.exports = File;
