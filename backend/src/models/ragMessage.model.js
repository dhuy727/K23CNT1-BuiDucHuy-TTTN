const mongoose = require('mongoose');

const citationSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: true
    },
    fileName: {
      type: String,
      default: ''
    },
    pageNumber: {
      type: Number,
      default: 1
    },
    sectionTitle: {
      type: String,
      default: ''
    },
    snippet: {
      type: String,
      default: ''
    },
    similarityScore: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const ragMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RagConversation',
      required: true,
      index: true
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true
    },
    content: {
      type: String,
      required: true
    },
    citations: {
      type: [citationSchema],
      default: []
    },
    tokenUsage: {
      promptTokens: { type: Number, default: 0 },
      completionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 }
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

ragMessageSchema.index({ conversation: 1, createdAt: 1 });

const RagMessage = mongoose.model('RagMessage', ragMessageSchema);

module.exports = RagMessage;
