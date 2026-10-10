const mongoose = require('mongoose');

const ragConversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      default: 'Đoạn chat mới',
      trim: true,
      maxlength: [200, 'Tiêu đề không được vượt quá 200 ký tự']
    },
    scopeType: {
      type: String,
      enum: ['all', 'folder', 'file'],
      default: 'all',
      index: true
    },
    scopeTargetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    scopeName: {
      type: String,
      default: 'Toàn bộ Drive',
      trim: true
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

ragConversationSchema.index({ user: 1, lastMessageAt: -1 });

const RagConversation = mongoose.model('RagConversation', ragConversationSchema);

module.exports = RagConversation;
