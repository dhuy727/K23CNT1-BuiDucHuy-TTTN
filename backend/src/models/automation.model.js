const mongoose = require('mongoose');

const CONDITION_FIELDS = [
  'extension',
  'mimeType',
  'size',
  'name',
  'folder',
  'aiCategory',
  'aiTags',
  'aiStatus'
];

const CONDITION_OPERATORS = ['equals', 'not_equals', 'contains', 'gt', 'gte', 'lt', 'lte'];

const TRIGGER_TYPES = ['FILE_UPLOADED', 'FILE_UPDATED', 'AI_COMPLETED', 'FILE_MOVED'];

const ACTION_TYPES = [
  'MOVE_FILE',
  'RENAME_FILE',
  'ADD_TAG',
  'STAR_FILE',
  'NOTIFY',
  'CREATE_VERSION'
];

const conditionSchema = new mongoose.Schema(
  {
    field: {
      type: String,
      required: [true, 'Điều kiện phải có trường so sánh'],
      enum: CONDITION_FIELDS
    },
    operator: {
      type: String,
      required: [true, 'Điều kiện phải có toán tử'],
      enum: CONDITION_OPERATORS
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Điều kiện phải có giá trị']
    }
  },
  { _id: false }
);

const triggerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Rule phải có loại trigger'],
      enum: TRIGGER_TYPES
    }
  },
  { _id: false }
);

const actionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Hành động phải có loại'],
      enum: ACTION_TYPES
    },
    value: {
      type: String,
      default: '',
      trim: true
    },
    targetFolderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null
    },
    newName: {
      type: String,
      default: '',
      trim: true,
      maxlength: [255, 'Tên mới không được vượt quá 255 ký tự']
    }
  },
  { _id: false }
);

const automationRuleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Rule phải thuộc về một người dùng'],
      index: true
    },
    name: {
      type: String,
      required: [true, 'Tên rule không được để trống'],
      trim: true,
      maxlength: [150, 'Tên rule không được vượt quá 150 ký tự']
    },
    isActive: {
      type: Boolean,
      default: true
    },
    trigger: {
      type: triggerSchema,
      required: [true, 'Rule phải có trigger']
    },
    conditions: {
      type: [conditionSchema],
      default: []
    },
    actions: {
      type: [actionSchema],
      default: [],
      validate: {
        validator: (actions) => Array.isArray(actions) && actions.length > 0,
        message: 'Rule phải có ít nhất một hành động'
      }
    },
    priority: {
      type: Number,
      default: 0
    },
    lastRunAt: {
      type: Date,
      default: null
    },
    runCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

automationRuleSchema.index({ user: 1, isActive: 1, priority: 1 });
automationRuleSchema.index({ user: 1, 'trigger.type': 1, isActive: 1 });

const AutomationRule = mongoose.model('AutomationRule', automationRuleSchema);

module.exports = AutomationRule;
module.exports.CONDITION_FIELDS = CONDITION_FIELDS;
module.exports.CONDITION_OPERATORS = CONDITION_OPERATORS;
module.exports.TRIGGER_TYPES = TRIGGER_TYPES;
module.exports.ACTION_TYPES = ACTION_TYPES;
