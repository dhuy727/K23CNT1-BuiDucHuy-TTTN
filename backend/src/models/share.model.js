const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    // Người sở hữu chia sẻ (Owner)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Chủ sở hữu chia sẻ không được để trống'],
      index: true
    },
    // Loại đối tượng: 'file' hoặc 'folder'
    itemType: {
      type: String,
      enum: ['file', 'folder'],
      required: [true, 'Loại đối tượng chia sẻ phải là file hoặc folder']
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null,
      index: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    // Vai trò phân quyền: 'viewer' (chỉ đọc/xem/tải), 'editor' (chỉnh sửa, đổi tên, thêm file)
    role: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer'
    },
    // Hình thức chia sẻ: 'user' (nội bộ với user khác) hoặc 'public' (qua liên kết công khai)
    shareType: {
      type: String,
      enum: ['user', 'public'],
      required: true,
      index: true
    },
    // Thông tin người được chia sẻ (khi shareType = 'user')
    sharedWith: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    sharedEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: ''
    },
    // Thông tin liên kết công khai (khi shareType = 'public')
    shareToken: {
      type: String,
      unique: true,
      sparse: true
    },
    password: {
      type: String, // bcrypt hash nếu có đặt mật khẩu bảo vệ
      default: null
    },
    hasPassword: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      default: null
    },
    allowDownload: {
      type: Boolean,
      default: true
    },
    isPublic: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Tránh chia sẻ trùng lặp cùng một file/thư mục cho cùng một user
shareSchema.index(
  { itemType: 1, file: 1, folder: 1, sharedWith: 1 },
  { unique: true, sparse: true }
);

const Share = mongoose.model('Share', shareSchema);

module.exports = Share;
