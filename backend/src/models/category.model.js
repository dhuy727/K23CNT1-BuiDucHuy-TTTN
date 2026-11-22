const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên danh mục không được để trống'],
      trim: true,
      maxlength: [100, 'Tên danh mục không được vượt quá 100 ký tự']
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Danh mục phải thuộc về một người dùng'],
      index: true
    },
    color: {
      type: String,
      default: '#3B82F6',
      trim: true
    },
    icon: {
      type: String,
      default: 'tag',
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: [255, 'Mô tả không được vượt quá 255 ký tự']
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Một người dùng không được tạo trùng tên danh mục
categorySchema.index({ user: 1, name: 1 }, { unique: true });

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
