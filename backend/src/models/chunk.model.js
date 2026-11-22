const mongoose = require('mongoose');

const documentChunkSchema = new mongoose.Schema(
  {
    file: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'File',
      required: [true, 'Chunk phải thuộc về một tệp tin'],
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Chunk phải thuộc về một người dùng'],
      index: true
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: [true, 'Nội dung chunk không được để trống']
    },
    pageNumber: {
      type: Number,
      default: 1
    },
    sectionTitle: {
      type: String,
      default: '',
      trim: true
    },
    tokenCount: {
      type: Number,
      default: 0
    },
    embedding: {
      type: [Number], // Mảng float vector (768 dims cho gemini-embedding-001 hoặc text-embedding-3-small)
      required: [true, 'Vector embedding không được để trống']
    },
    embeddingModel: {
      type: String,
      default: 'gemini-embedding-001',
      trim: true
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound indexes phục vụ truy xuất và lọc nhanh
documentChunkSchema.index({ file: 1, chunkIndex: 1 });
documentChunkSchema.index({ user: 1, folder: 1 });
documentChunkSchema.index({ content: 'text' });

const DocumentChunk = mongoose.model('DocumentChunk', documentChunkSchema);

module.exports = DocumentChunk;
