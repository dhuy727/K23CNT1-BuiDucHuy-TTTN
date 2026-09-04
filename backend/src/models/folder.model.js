const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên thư mục không được để trống'],
      trim: true,
      maxlength: [120, 'Tên thư mục không được vượt quá 120 ký tự']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Thư mục phải thuộc về một người dùng'],
      index: true
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    // Chuỗi đường dẫn phân cấp (vd: "/64b.../64c...") hỗ trợ truy vấn con cháu nhanh
    path: {
      type: String,
      default: '/'
    },
    color: {
      type: String,
      default: '#3B82F6', // Màu xanh dương mặc định
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Mô tả không được vượt quá 500 ký tự']
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

// Đảm bảo không tạo 2 thư mục cùng tên trong cùng một thư mục cha cho cùng 1 user (khi không ở trong thùng rác)
folderSchema.index(
  { user: 1, parent: 1, name: 1, isTrash: 1 },
  { unique: true }
);

// Index hỗ trợ tìm kiếm phân cấp và tìm kiếm văn bản nhanh
folderSchema.index({ user: 1, path: 1, isTrash: 1 });
folderSchema.index({ user: 1, name: 'text', description: 'text' });

const Folder = mongoose.model('Folder', folderSchema);

module.exports = Folder;
