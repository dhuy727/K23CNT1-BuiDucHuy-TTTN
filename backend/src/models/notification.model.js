const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Thông báo phải thuộc về một người dùng'],
      index: true
    },
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      default: null
    },
    title: {
      type: String,
      required: [true, 'Tiêu đề thông báo không được để trống'],
      trim: true,
      maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
    },
    message: {
      type: String,
      required: [true, 'Nội dung thông báo không được để trống'],
      trim: true,
      maxlength: [1000, 'Nội dung không được vượt quá 1000 ký tự']
    },
    type: {
      type: String,
      enum: ['info', 'ai', 'automation', 'warning'],
      default: 'info'
    },
    isRead: {
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

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
