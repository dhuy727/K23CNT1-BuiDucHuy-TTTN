require('dotenv').config();
const mongoose = require('mongoose');
const AutomationRule = require('./src/models/automation.model');
const Notification = require('./src/models/notification.model');
const File = require('./src/models/file.model');
const User = require('./src/models/user.model');
const automationService = require('./src/services/automation.service');
const notificationService = require('./src/services/notification.service');
const aiService = require('./src/services/ai.service');

const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ [THẤT BẠI]: ${message}`);
    process.exit(1);
  }
  console.log(`✅ [THÀNH CÔNG]: ${message}`);
};

async function testEngine() {
  console.log('--- KIỂM TRA TỰ ĐỘNG HÓA & AI ENGINE ---');
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/user_management_db');
    console.log('-> Kết nối MongoDB thành công');

    // 1. Tạo user giả lập cho test
    let user = await User.findOne({ email: 'autotest@smartdoc.com' });
    if (!user) {
      user = new User({
        name: 'Auto Tester',
        email: 'autotest@smartdoc.com',
        password: 'Password123!',
        isEmailVerified: true
      });
      await user.save();
    }
    assert(user._id, 'Đảm bảo có user kiểm thử');

    // 2. Tạo thông báo
    const notif = await notificationService.createNotification({
      user: user._id,
      title: 'Kiểm tra thông báo',
      message: 'Hệ thống kiểm tra thông báo hoạt động bình thường',
      type: 'automation'
    });
    assert(notif && notif._id, 'Tạo thông báo thành công');

    const notifList = await notificationService.getNotifications(user._id, { limit: 5 });
    assert(notifList.notifications.length > 0, 'Lấy danh sách thông báo thành công');
    assert(typeof notifList.unreadCount === 'number', 'Unread count chính xác');

    const markRes = await notificationService.markAsRead(user._id, notif._id);
    assert(markRes.notification.isRead === true, 'Đánh dấu thông báo đã đọc thành công');

    // 3. Tạo rule tự động hóa
    const ruleData = {
      name: 'Test Rule: Hợp đồng PDF',
      trigger: { type: 'AI_COMPLETED' },
      conditions: [
        { field: 'aiCategory', operator: 'equals', value: 'Hợp đồng' },
        { field: 'extension', operator: 'equals', value: 'pdf' }
      ],
      actions: [
        { type: 'ADD_TAG', value: 'contract' },
        { type: 'STAR_FILE', value: '' },
        { type: 'NOTIFY', value: 'Đã gắn thẻ và sao cho hợp đồng' }
      ],
      priority: 5,
      isActive: true
    };

    const createdRule = await automationService.createRule(user._id, ruleData);
    assert(createdRule && createdRule._id, 'Tạo Automation Rule thành công');

    // 4. Tạo file giả lập và chạy Automation Engine
    const testFile = new File({
      name: 'HopDongThuViec.pdf',
      originalName: 'HopDongThuViec.pdf',
      user: user._id,
      folder: null,
      size: 1024,
      mimeType: 'application/pdf',
      extension: 'pdf',
      storagePath: '',
      aiCategory: 'Hợp đồng',
      aiStatus: 'completed',
      aiTags: [],
      isStarred: false,
      isTrash: false
    });
    await testFile.save();

    // Chạy engine
    await automationService.run(user._id, 'AI_COMPLETED', testFile);

    // Kiểm tra kết quả snapshot file sau khi rule chạy
    const updatedFile = await File.findById(testFile._id);
    assert(updatedFile.isStarred === true, 'File đã được tự động gắn sao (STAR_FILE)');
    assert(updatedFile.aiTags.includes('contract'), 'File đã được tự động gắn tag contract (ADD_TAG)');

    // Kiểm tra runCount của rule
    const ruleAfterRun = await AutomationRule.findById(createdRule._id);
    assert(ruleAfterRun.runCount >= 1, 'Rule tăng runCount sau khi kích hoạt');

    // 5. Test toggle rule
    const toggled = await automationService.toggleRuleActive(user._id, createdRule._id);
    assert(toggled.isActive === false, 'Tắt rule thành công');

    // Dọn dẹp dữ liệu test
    await AutomationRule.findByIdAndDelete(createdRule._id);
    await File.findByIdAndDelete(testFile._id);
    await Notification.deleteMany({ user: user._id });

    console.log('\n🎉 TẤT CẢ KIỂM THỬ AUTOMATION & AI ENGINE ĐỀU ĐẠT CHUẨN 100%!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi chạy kiểm thử:', err);
    process.exit(1);
  }
}

testEngine();
