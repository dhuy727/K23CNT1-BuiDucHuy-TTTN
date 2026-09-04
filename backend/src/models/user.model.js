const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Vui lòng nhập họ và tên'],
      trim: true,
      maxlength: [100, 'Họ tên không được vượt quá 100 ký tự']
    },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập địa chỉ email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Vui lòng nhập định dạng email hợp lệ'
      ]
    },
    password: {
      type: String,
      required: [true, 'Vui lòng nhập mật khẩu'],
      minlength: [6, 'Mật khẩu phải có ít nhất 6 ký tự'],
      select: false // Mặc định không trả về password trong query
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'manager'],
      default: 'user'
    },
    phone: {
      type: String,
      trim: true,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    },
    // Lưu trữ refreshToken dài hạn trong Database để kiểm tra tính hợp lệ và thu hồi khi logout
    refreshToken: {
      type: String,
      default: null,
      select: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Mã hóa mật khẩu trước khi lưu vào database
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// So sánh mật khẩu người dùng nhập vào với mật khẩu đã băm
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Loại bỏ các trường nhạy cảm khi chuyển thành JSON
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.refreshToken;
  return userObject;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
