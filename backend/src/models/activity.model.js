const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Nhật ký phải gắn với một người dùng'],
      index: true
    },
    action: {
      type: String,
      required: [true, 'Loại hành động không được để trống'],
      enum: [
        // File actions
        'file_upload',
        'file_download',
        'file_preview',
        'file_rename',
        'file_move',
        'file_copy',
        'file_trash',
        'file_restore',
        'file_delete_permanent',
        'file_star',
        'file_share',
        // Folder actions
        'folder_create',
        'folder_rename',
        'folder_move',
        'folder_trash',
        'folder_restore',
        'folder_delete_permanent',
        // Auth actions
        'auth_login',
        'auth_logout',
        'auth_password_change',
        // Admin actions
        'admin_user_update',
        'admin_user_delete'
      ],
      index: true
    },
    targetType: {
      type: String,
      enum: ['file', 'folder', 'user', 'auth', 'system'],
      default: 'file',
      index: true
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true
    },
    targetName: {
      type: String,
      default: '',
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Mô tả hành động không được để trống'],
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ip: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Index phục vụ truy vấn nhật ký theo người dùng và thời gian giảm dần
activitySchema.index({ user: 1, createdAt: -1 });

// Index phục vụ truy vấn toàn hệ thống cho Admin theo thời gian giảm dần
activitySchema.index({ createdAt: -1 });

// Index phục vụ bộ lọc theo hành động và thời gian
activitySchema.index({ action: 1, createdAt: -1 });

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
