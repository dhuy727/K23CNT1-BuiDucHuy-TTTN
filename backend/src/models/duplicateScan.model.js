const mongoose = require('mongoose');

const duplicateScanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Phiên quét phải thuộc về một người dùng'],
      index: true
    },
    folderScope: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null
    },
    status: {
      type: String,
      enum: ['idle', 'scanning', 'completed', 'failed'],
      default: 'idle'
    },
    progress: {
      stage: {
        type: String,
        enum: ['hash_scan', 'ai_compare', 'finalizing'],
        default: 'hash_scan'
      },
      percent: {
        type: Number,
        default: 0
      },
      message: {
        type: String,
        default: ''
      }
    },
    stats: {
      totalFilesScanned: {
        type: Number,
        default: 0
      },
      wastedBytes: {
        type: Number,
        default: 0
      },
      exactDuplicateCount: {
        type: Number,
        default: 0
      },
      similarDuplicateCount: {
        type: Number,
        default: 0
      }
    },
    clusters: [
      {
        clusterId: {
          type: String,
          required: true
        },
        type: {
          type: String,
          enum: ['exact', 'semantic'],
          default: 'exact'
        },
        similarityScore: {
          type: Number,
          default: 100
        },
        aiAnalysis: {
          type: String,
          default: ''
        },
        originalFile: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'File'
        },
        duplicateFiles: [
          {
            file: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'File'
            },
            isRecommendedDelete: {
              type: Boolean,
              default: true
            }
          }
        ]
      }
    ],
    ignoredPairs: [
      {
        fileA: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'File'
        },
        fileB: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'File'
        }
      }
    ],
    lastScannedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

duplicateScanSchema.index({ user: 1, folderScope: 1 });

const DuplicateScan = mongoose.model('DuplicateScan', duplicateScanSchema);

module.exports = DuplicateScan;
