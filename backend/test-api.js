require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const User = require('./src/models/user.model');

const PORT = 5001; // Dùng port riêng để test không bị xung đột
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

// Helper thực hiện fetch
const request = async (path, options = {}) => {
  const url = `${BASE_URL}${path}`;
  const headers = { ...(options.headers || {}) };

  let body;
  if (options.isFormData) {
    body = options.body;
  } else if (options.body) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body
  });

  if (options.isRaw) {
    const text = await response.text().catch(() => '');
    return { status: response.status, headers: response.headers, text };
  }

  const data = await response.json().catch(() => null);
  return { status: response.status, headers: response.headers, data };
};

// Hàm assertion đơn giản
const assert = (condition, message) => {
  if (!condition) {
    console.error(`❌ [THẤT BẠI]: ${message}`);
    process.exit(1);
  }
  console.log(`✅ [THÀNH CÔNG]: ${message}`);
};

async function runTests() {
  try {
    console.log('--- KHỞI ĐỘNG HỆ THỐNG KIỂM THỬ TỰ ĐỘNG ---');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('-> Kết nối MongoDB thành công');

    server = app.listen(PORT, () => {
      console.log(`-> Server test đang chạy trên port ${PORT}`);
    });

    const testEmail = `tester_${Date.now()}@test.com`;
    let secretToken = '';
    let refreshToken = '';
    let userId = '';

    // Test 1: Health check
    console.log('\n[1] Kiểm tra endpoint /health');
    const resHealth = await request('/health');
    assert(resHealth.status === 200, 'Health check trả về status 200');
    assert(resHealth.data.success === true, 'Health check success = true');

    // Test 2: Đăng ký người dùng mới
    console.log('\n[2] Kiểm tra Đăng Ký Tài Khoản (/auth/register)');
    const resRegister = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Nguyễn Văn Test',
        email: testEmail,
        password: 'password123',
        role: 'admin',
        phone: '0988888888'
      }
    });
    assert(resRegister.status === 201, 'Đăng ký trả về status 201');
    assert(resRegister.data.data.tokens.secretToken, 'Có secretToken ngắn hạn');
    assert(resRegister.data.data.tokens.refreshToken, 'Có refreshToken dài hạn');
    userId = resRegister.data.data.user._id;

    // Test 3: Đăng nhập
    console.log('\n[3] Kiểm tra Đăng Nhập (/auth/login)');
    const resLogin = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'password123'
      }
    });
    assert(resLogin.status === 200, 'Đăng nhập trả về status 200');
    secretToken = resLogin.data.data.tokens.secretToken;
    refreshToken = resLogin.data.data.tokens.refreshToken;
    assert(secretToken && refreshToken, 'Nhận đủ cả 2 token: secretToken và refreshToken');

    // Test 4: Truy cập Protected Route (/auth/me) với secretToken
    console.log('\n[4] Kiểm tra Protected Route /auth/me');
    const resMe = await request('/auth/me', {
      headers: { Authorization: `Bearer ${secretToken}` }
    });
    assert(resMe.status === 200, 'Truy cập /auth/me thành công với secretToken');
    assert(resMe.data.data.email === testEmail, 'Thông tin người dùng trả về chính xác');

    // Test 5: Làm mới token (/auth/refresh-token) với refreshToken
    console.log('\n[5] Kiểm tra Cấp lại Token (/auth/refresh-token)');
    const resRefresh = await request('/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken }
    });
    assert(resRefresh.status === 200, 'Cấp lại token thành công 200');
    assert(resRefresh.data.data.secretToken, 'Nhận được secretToken mới');
    const newSecretToken = resRefresh.data.data.secretToken;

    // Test 6: Lấy thông tin cá nhân người dùng (/users/profile)
    console.log('\n[6] Kiểm tra Lấy thông tin cá nhân (/users/profile & /users/me)');
    const resProfile = await request('/users/profile', {
      headers: { Authorization: `Bearer ${newSecretToken}` }
    });
    assert(resProfile.status === 200, 'Lấy profile thành công 200');
    assert(resProfile.data.data.email === testEmail, 'Email trong profile trùng khớp');

    // Test 7: Sửa thông tin cá nhân người dùng (/users/profile)
    console.log('\n[7] Kiểm tra Sửa thông tin cá nhân (/users/profile)');
    const resUpdateProfile = await request('/users/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${newSecretToken}` },
      body: {
        name: 'Nguyễn Văn Đã Sửa Profile',
        phone: '0911223344'
      }
    });
    assert(resUpdateProfile.status === 200, 'Sửa profile thành công 200');
    assert(resUpdateProfile.data.data.name === 'Nguyễn Văn Đã Sửa Profile', 'Tên đã cập nhật chính xác');
    assert(resUpdateProfile.data.data.phone === '0911223344', 'SĐT đã cập nhật chính xác');

    // Test 8: Đổi mật khẩu (/users/change-password)
    console.log('\n[8] Kiểm tra Đổi mật khẩu (/users/change-password)');
    const resChangePass = await request('/users/change-password', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${newSecretToken}` },
      body: {
        currentPassword: 'password123',
        newPassword: 'newpassword123'
      }
    });
    assert(resChangePass.status === 200, 'Đổi mật khẩu thành công');

    // Test 9: Đăng nhập bằng mật khẩu mới
    console.log('\n[9] Kiểm tra Đăng nhập lại với mật khẩu mới');
    const resLoginNew = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'newpassword123'
      }
    });
    assert(resLoginNew.status === 200, 'Đăng nhập thành công với mật khẩu mới');
    const activeSecretToken = resLoginNew.data.data.tokens.secretToken;
    const activeRefreshToken = resLoginNew.data.data.tokens.refreshToken;

    // Test 10: Đăng xuất người dùng (/users/logout)
    console.log('\n[10] Kiểm tra Đăng xuất qua (/users/logout)');
    const resLogout = await request('/users/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${activeSecretToken}` }
    });
    assert(resLogout.status === 200, 'Đăng xuất thành công qua /users/logout');

    // Test 11: Kiểm tra thu hồi refreshToken sau khi logout
    console.log('\n[11] Kiểm tra tính hợp lệ của refreshToken sau khi đã logout');
    const resRevokedRefresh = await request('/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: activeRefreshToken }
    });
    assert(
      resRevokedRefresh.status === 401,
      'refreshToken cũ bị từ chối với status 401 sau khi người dùng đăng xuất'
    );

    // Test 12: Kiểm tra Quản lý Users (Admin)
    console.log('\n[12] Kiểm tra Quản lý Users - Lấy danh sách (/users) & Xem chi tiết (/users/:id)');
    // Đăng nhập lại để có token kiểm tra admin API
    const resLoginAgain = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testEmail,
        password: 'newpassword123'
      }
    });
    const userToken = resLoginAgain.data.data.tokens.secretToken;
    const resUsers = await request('/users?page=1&limit=5', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resUsers.status === 200, 'Lấy danh sách người dùng thành công');

    const resUserDetail = await request(`/users/${userId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resUserDetail.status === 200, 'Xem chi tiết người dùng theo ID thành công');

    // =========================================================================
    // 📁 KIỂM THỬ TOÀN DIỆN CÁC TÍNH NĂNG THƯ MỤC (FOLDER MANAGEMENT)
    // =========================================================================

    // Test 13: Tạo thư mục gốc (Root Folder)
    console.log('\n[13] Kiểm tra Tạo thư mục gốc (/folders)');
    const resRootFolder = await request('/folders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        name: 'Dự Án AI File Manager',
        color: '#10B981',
        description: 'Thư mục chứa tài liệu dự án'
      }
    });
    assert(resRootFolder.status === 201, 'Tạo thư mục gốc thành công 201');
    const rootFolderId = resRootFolder.data.data._id;
    assert(resRootFolder.data.data.parent === null, 'Thư mục gốc có parent = null');

    // Test 14: Tạo thư mục con (Subfolder)
    console.log('\n[14] Kiểm tra Tạo thư mục con (/folders với parentId)');
    const resSubfolder = await request('/folders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        name: 'Báo Cáo Nghiên Cứu',
        parentId: rootFolderId,
        color: '#F59E0B'
      }
    });
    assert(resSubfolder.status === 201, 'Tạo thư mục con thành công 201');
    const subfolderId = resSubfolder.data.data._id;
    assert(resSubfolder.data.data.parent === rootFolderId, 'Thư mục con có parent trỏ đến thư mục cha');

    // Test 15: Kiểm tra chặn trùng tên thư mục cùng cấp
    console.log('\n[15] Kiểm tra Chặn trùng tên thư mục cùng cấp');
    const resDuplicate = await request('/folders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        name: 'Báo Cáo Nghiên Cứu',
        parentId: rootFolderId
      }
    });
    assert(resDuplicate.status === 409, 'Chặn trùng tên trả về 409 Conflict');

    // Test 16: Lấy danh sách thư mục (Lọc theo parentId)
    console.log('\n[16] Kiểm tra Lấy danh sách thư mục con theo parentId (/folders?parentId=...)');
    const resListSubs = await request(`/folders?parentId=${rootFolderId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resListSubs.status === 200, 'Lấy danh sách thư mục thành công');
    assert(resListSubs.data.data.length === 1, 'Danh sách trả về đúng 1 thư mục con');

    // Test 17: Xem chi tiết thư mục (kèm Breadcrumb và Thống kê)
    console.log('\n[17] Kiểm tra Xem chi tiết thư mục (/folders/:id)');
    const resFolderDetail = await request(`/folders/${subfolderId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resFolderDetail.status === 200, 'Xem chi tiết thư mục thành công');
    assert(resFolderDetail.data.metadata.breadcrumb.length >= 2, 'Có Breadcrumb đường dẫn phân cấp');
    assert(resFolderDetail.data.metadata.statistics !== undefined, 'Có thống kê tệp tin / thư mục');

    // Test 18: Đổi tên thư mục (/folders/:id/rename)
    console.log('\n[18] Kiểm tra Đổi tên thư mục (/folders/:id/rename)');
    const resRename = await request(`/folders/${subfolderId}/rename`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { name: 'Báo Cáo Đã Đổi Tên' }
    });
    assert(resRename.status === 200, 'Đổi tên thư mục thành công 200');
    assert(resRename.data.data.name === 'Báo Cáo Đã Đổi Tên', 'Tên mới trùng khớp');

    // Test 19: Chống lặp vòng khi di chuyển (Cycle Prevention)
    console.log('\n[19] Kiểm tra Chống lặp vòng khi di chuyển thư mục');
    const resCycleMove = await request(`/folders/${rootFolderId}/move`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { targetParentId: subfolderId }
    });
    assert(resCycleMove.status === 400, 'Chặn di chuyển thư mục cha vào thư mục con của chính nó (HTTP 400)');

    // Test 20: Di chuyển thư mục hợp lệ
    console.log('\n[20] Kiểm tra Di chuyển thư mục hợp lệ (/folders/:id/move)');
    const resTargetFolder = await request('/folders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { name: 'Thư Mục Lưu Trữ Đích' }
    });
    const targetFolderId = resTargetFolder.data.data._id;

    const resValidMove = await request(`/folders/${subfolderId}/move`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { targetParentId: targetFolderId }
    });
    assert(resValidMove.status === 200, 'Di chuyển thư mục thành công');
    assert(resValidMove.data.data.parent === targetFolderId, 'Thư mục đã chuyển sang cha mới');

    // Test 21: Lấy cây thư mục (Folder Tree)
    console.log('\n[21] Kiểm tra Lấy cây thư mục (/folders/tree)');
    const resTree = await request('/folders/tree', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resTree.status === 200, 'Lấy cây thư mục thành công');
    assert(Array.isArray(resTree.data.data), 'Cây thư mục trả về mảng danh sách nhánh');

    // Test 22: Lấy danh sách file con trong thư mục (/folders/:id/files)
    console.log('\n[22] Kiểm tra Lấy file con trong thư mục (/folders/:id/files)');
    // Tạo file mẫu trong subfolder
    const File = require('./src/models/file.model');
    await File.create({
      name: 'BaoCaoTienDo_AI.pdf',
      originalName: 'BaoCaoTienDo_AI.pdf',
      user: userId,
      folder: subfolderId,
      size: 102400,
      mimeType: 'application/pdf',
      aiCategory: 'Báo cáo',
      aiSummary: 'Báo cáo tổng kết tiến độ phát triển mô hình AI xử lý file'
    });

    const resFiles = await request(`/folders/${subfolderId}/files`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resFiles.status === 200, 'Lấy danh sách file con thành công');
    assert(resFiles.data.data.length === 1, 'Nhận đúng 1 file con vừa tạo');
    assert(resFiles.data.data[0].name === 'BaoCaoTienDo_AI.pdf', 'Tên file con trùng khớp');

    // Test 23: Xóa thư mục (Cascade delete)
    console.log('\n[23] Kiểm tra Xóa thư mục (/folders/:id?permanent=true)');
    const resDeleteFolder = await request(`/folders/${targetFolderId}?permanent=true`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resDeleteFolder.status === 200, 'Xóa thư mục thành công');

    // =========================================================================
    // 📄 KIỂM THỬ TOÀN DIỆN CÁC TÍNH NĂNG TÀI LIỆU (FILE MANAGEMENT)
    // =========================================================================

    // Test 24: Tải lên 1 tệp tin đơn lẻ (/files/upload)
    console.log('\n[24] Kiểm tra Tải lên 1 tệp tin (/files/upload)');
    const singleFormData = new FormData();
    const testContent = 'Xin chao, day la noi dung kiem thu du an AI File Manager cua Bui Duc Huy.';
    const fileBlob = new Blob([testContent], { type: 'text/plain' });
    singleFormData.append('file', fileBlob, 'TaiLieuKiemThu.txt');
    singleFormData.append('folderId', rootFolderId);
    singleFormData.append('aiCategory', 'Đồ án');
    singleFormData.append('aiSummary', 'Tài liệu kiểm thử hệ thống');

    const resUploadSingle = await request('/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: singleFormData,
      isFormData: true
    });
    assert(resUploadSingle.status === 201, 'Tải lên 1 file thành công 201');
    const uploadedFileId = resUploadSingle.data.data._id;
    assert(resUploadSingle.data.data.name.includes('TaiLieuKiemThu'), 'Tên file chính xác');
    assert(resUploadSingle.data.data.aiCategory === 'Đồ án', 'Phân loại AI chính xác');
    assert(resUploadSingle.data.data.formattedSize !== undefined, 'Có formattedSize');

    // Test 25: Tải lên nhiều tệp tin cùng lúc (/files/upload-multiple)
    console.log('\n[25] Kiểm tra Tải lên nhiều tệp tin (/files/upload-multiple)');
    const multiFormData = new FormData();
    multiFormData.append('files', new Blob(['Noi dung file 1'], { type: 'text/plain' }), 'File_1.txt');
    multiFormData.append('files', new Blob(['Noi dung file 2'], { type: 'text/plain' }), 'File_2.txt');
    multiFormData.append('folderId', rootFolderId);

    const resUploadMulti = await request('/files/upload-multiple', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: multiFormData,
      isFormData: true
    });
    assert(resUploadMulti.status === 201, 'Tải lên nhiều file thành công 201');
    assert(resUploadMulti.data.data.length === 2, 'Đã tải lên đủ 2 file');

    // Test 26: Lấy danh sách tệp tin (/files)
    console.log('\n[26] Kiểm tra Lấy danh sách tệp tin (/files)');
    const resListFiles = await request(`/files?folderId=${rootFolderId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resListFiles.status === 200, 'Lấy danh sách file thành công 200');
    assert(resListFiles.data.data.length >= 3, 'Danh sách trả về đủ số file');
    assert(resListFiles.data.metadata.total >= 3, 'Metadata phân trang chính xác');

    // Test 27: Xem chi tiết tệp tin (/files/:id)
    console.log('\n[27] Kiểm tra Xem chi tiết tệp tin (/files/:id)');
    const resFileDetail = await request(`/files/${uploadedFileId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resFileDetail.status === 200, 'Xem chi tiết file thành công');
    assert(resFileDetail.data.data._id === uploadedFileId, 'ID file trùng khớp');
    assert(resFileDetail.data.data.folder !== null, 'File có thông tin folder');

    // Test 28: Tải file về máy (/files/:id/download)
    console.log('\n[28] Kiểm tra Tải file về máy (/files/:id/download)');
    const resDownload = await request(`/files/${uploadedFileId}/download`, {
      headers: { Authorization: `Bearer ${userToken}` },
      isRaw: true
    });
    assert(resDownload.status === 200, 'Download trả về 200 OK');
    assert(resDownload.text === testContent, 'Nội dung file tải về trùng khớp 100%');

    // Test 29: Xem trước tệp tin inline (/files/:id/preview)
    console.log('\n[29] Kiểm tra Xem trước tệp tin inline (/files/:id/preview)');
    const resPreview = await request(`/files/${uploadedFileId}/preview`, {
      headers: { Authorization: `Bearer ${userToken}` },
      isRaw: true
    });
    assert(resPreview.status === 200, 'Preview trả về 200 OK');
    assert(resPreview.headers.get('content-disposition').includes('inline'), 'Header Content-Disposition có inline');

    // Test 30: Đổi tên tệp tin (/files/:id/rename)
    console.log('\n[30] Kiểm tra Đổi tên tệp tin (/files/:id/rename)');
    const resRenameFile = await request(`/files/${uploadedFileId}/rename`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { name: 'TaiLieu_DaDoiTen.txt' }
    });
    assert(resRenameFile.status === 200, 'Đổi tên file thành công');
    assert(resRenameFile.data.data.name === 'TaiLieu_DaDoiTen.txt', 'Tên file mới trùng khớp');

    // Test 31: Đánh dấu sao yêu thích (/files/:id/star)
    console.log('\n[31] Kiểm tra Đánh dấu sao yêu thích (/files/:id/star)');
    const resStar = await request(`/files/${uploadedFileId}/star`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resStar.status === 200, 'Gắn sao thành công');
    assert(resStar.data.data.isStarred === true, 'Trạng thái isStarred = true');

    // Test 32: Sao chép tệp tin (/files/:id/copy)
    console.log('\n[32] Kiểm tra Sao chép tệp tin (/files/:id/copy)');
    const resCopy = await request(`/files/${uploadedFileId}/copy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resCopy.status === 201, 'Sao chép file thành công 201');
    assert(resCopy.data.data.name.includes('Copy'), 'Tên file bản sao có chứa chữ Copy');
    const copiedFileId = resCopy.data.data._id;

    // Test 33: Di chuyển tệp tin sang thư mục khác (/files/:id/move)
    console.log('\n[33] Kiểm tra Di chuyển tệp tin sang thư mục gốc (/files/:id/move)');
    const resMove = await request(`/files/${uploadedFileId}/move`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { targetFolderId: 'root' }
    });
    assert(resMove.status === 200, 'Di chuyển file thành công');
    assert(resMove.data.data.folder === null, 'File đã được chuyển ra ngoài Root');

    // =========================================================================
    // 🔍 KIỂM THỬ MODULE TÌM KIẾM & LỌC ĐA TIÊU CHÍ (SEARCH & FILTER MODULE)
    // =========================================================================

    // Test 34: Tìm kiếm toàn cục theo từ khóa (/api/search?q=...)
    console.log('\n[34] Kiểm tra Tìm kiếm toàn cục (/api/search?q=...)');
    const resSearchKeyword = await request('/search?q=TaiLieu', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchKeyword.status === 200, 'Tìm kiếm từ khóa trả về 200 OK');
    assert(resSearchKeyword.data.data.items.length > 0, 'Tìm thấy kết quả khớp từ khóa');
    assert(resSearchKeyword.data.metadata.statistics.totalResults > 0, 'Thống kê kết quả chính xác');

    // Test 35: Lọc theo nhóm loại file (/api/search?type=document)
    console.log('\n[35] Kiểm tra Lọc theo nhóm định dạng tệp tin (/api/search?type=document)');
    const resSearchType = await request('/search?type=document', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchType.status === 200, 'Lọc theo type document trả về 200');
    assert(resSearchType.data.data.files.every(f => ['txt', 'pdf', 'doc', 'docx'].includes(f.extension)), 'Tất cả file trả về đúng định dạng document');

    // Test 36: Lọc theo danh mục AI (/api/search?aiCategory=...)
    console.log('\n[36] Kiểm tra Lọc theo phân loại AI (/api/search?aiCategory=Đồ án)');
    const resSearchCategory = await request('/search?aiCategory=%C4%90%E1%BB%93%20%C3%A1n', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchCategory.status === 200, 'Lọc theo aiCategory thành công');
    assert(resSearchCategory.data.data.files.length > 0, 'Có tệp tin thuộc danh mục Đồ án');
    assert(resSearchCategory.data.data.files[0].aiCategory === 'Đồ án', 'Tên danh mục trùng khớp');

    // Test 37: Lọc theo khoảng kích thước (/api/search?sizePreset=tiny)
    console.log('\n[37] Kiểm tra Lọc theo kích thước tệp tin (/api/search?sizePreset=tiny)');
    const resSearchSize = await request('/search?sizePreset=tiny', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchSize.status === 200, 'Lọc theo sizePreset thành công');
    assert(resSearchSize.data.data.files.every(f => f.size < 1024 * 1024), 'Các file đều nhỏ hơn 1MB');

    // Test 38: Lọc theo khoảng thời gian (/api/search?datePreset=today)
    console.log('\n[38] Kiểm tra Lọc theo thời gian tạo (/api/search?datePreset=today)');
    const resSearchDate = await request('/search?datePreset=today', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchDate.status === 200, 'Lọc theo datePreset thành công');
    assert(resSearchDate.data.data.items.length > 0, 'Có dữ liệu tạo trong ngày hôm nay');

    // Test 39: Tìm kiếm đệ quy theo cây thư mục (/api/search?folderId=...&recursive=true)
    console.log('\n[39] Kiểm tra Tìm kiếm đệ quy trong thư mục (/api/search?folderId=...&recursive=true)');
    const resSearchRecursive = await request(`/search?folderId=${rootFolderId}&recursive=true`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSearchRecursive.status === 200, 'Tìm kiếm đệ quy thành công');
    assert(resSearchRecursive.data.metadata.statistics.totalResults >= 1, 'Tìm thấy kết quả đệ quy trong cây thư mục');

    // Test 40: Gợi ý tìm kiếm nhanh (Autocomplete /api/search/suggestions)
    console.log('\n[40] Kiểm tra Gợi ý tìm kiếm Autocomplete (/api/search/suggestions)');
    const resSuggestions = await request('/search/suggestions?q=TaiLieu', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resSuggestions.status === 200, 'Lấy gợi ý tìm kiếm thành công');
    assert(Array.isArray(resSuggestions.data.data), 'Gợi ý trả về mảng danh sách');
    assert(resSuggestions.data.data.some(s => s.text.includes('TaiLieu')), 'Có gợi ý khớp từ khóa');

    // Test 41: Lấy metadata bộ lọc (/api/search/filters-metadata)
    console.log('\n[41] Kiểm tra Lấy metadata bộ lọc (/api/search/filters-metadata)');
    const resMetadata = await request('/search/filters-metadata', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resMetadata.status === 200, 'Lấy metadata bộ lọc thành công');
    assert(resMetadata.data.data.overview !== undefined, 'Có dữ liệu overview');
    assert(Array.isArray(resMetadata.data.data.categories), 'Có danh sách categories');
    assert(Array.isArray(resMetadata.data.data.sizePresets), 'Có danh sách sizePresets');
    assert(Array.isArray(resMetadata.data.data.datePresets), 'Có danh sách datePresets');

    // =========================================================================
    // 🤝 KIỂM THỬ MODULE CHIA SẺ & PHÂN QUYỀN (SHARE & PERMISSION MODULE)
    // =========================================================================

    // Test 42: Đăng ký người dùng phụ (Collaborator) để kiểm tra chia sẻ
    console.log('\n[42] Đăng ký người dùng phụ (Collaborator) để kiểm thử chia sẻ');
    const collabEmail = `collab_${Date.now()}@test.com`;
    const resRegisterCollab = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Trần Thị Hợp Tác',
        email: collabEmail,
        password: 'password123'
      }
    });
    assert(resRegisterCollab.status === 201, 'Đăng ký tài khoản cộng tác viên thành công');
    const collabToken = resRegisterCollab.data.data.tokens.secretToken;
    const collabUserId = resRegisterCollab.data.data.user._id;

    // Test 43: Chia sẻ tệp tin cho người dùng phụ qua Email (/api/shares)
    console.log('\n[43] Kiểm tra Chia sẻ tệp tin cho người dùng phụ (/api/shares)');
    const resShareUser = await request('/shares', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        itemType: 'file',
        itemId: uploadedFileId,
        email: collabEmail,
        role: 'viewer'
      }
    });
    assert(resShareUser.status === 201, 'Chia sẻ tệp tin thành công 201');
    const shareRecordId = resShareUser.data.data._id;
    assert(resShareUser.data.data.role === 'viewer', 'Vai trò ban đầu là viewer');

    // Test 44: Người dùng phụ kiểm tra danh sách được chia sẻ (/api/shares/shared-with-me)
    console.log('\n[44] Kiểm tra Danh sách được chia sẻ với tôi (/api/shares/shared-with-me)');
    const resSharedWithMe = await request('/shares/shared-with-me', {
      headers: { Authorization: `Bearer ${collabToken}` }
    });
    assert(resSharedWithMe.status === 200, 'Lấy danh sách shared-with-me thành công');
    assert(resSharedWithMe.data.data.length >= 1, 'Người dùng phụ nhận được tệp tin chia sẻ');
    assert(resSharedWithMe.data.data[0].role === 'viewer', 'Quyền truy cập là viewer');

    // Test 45: Cập nhật quyền cộng tác viên từ viewer sang editor (/api/shares/:id/role)
    console.log('\n[45] Kiểm tra Cập nhật quyền cộng tác viên sang editor (/api/shares/:id/role)');
    const resUpdateRole = await request(`/shares/${shareRecordId}/role`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { role: 'editor' }
    });
    assert(resUpdateRole.status === 200, 'Cập nhật quyền thành công');
    assert(resUpdateRole.data.data.role === 'editor', 'Quyền mới là editor');

    // Test 46: Xem thông tin chia sẻ của tệp tin (/api/shares/item/file/:id)
    console.log('\n[46] Kiểm tra Xem thông tin chia sẻ của tệp tin (/api/shares/item/file/:id)');
    const resItemShares = await request(`/shares/item/file/${uploadedFileId}`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resItemShares.status === 200, 'Lấy thông tin chia sẻ tệp tin thành công');
    assert(resItemShares.data.data.collaborators.length >= 1, 'Có danh sách cộng tác viên');

    // Test 47: Tạo liên kết chia sẻ công khai có mật khẩu (/api/shares/public-link)
    console.log('\n[47] Kiểm tra Tạo liên kết chia sẻ công khai có mật khẩu (/api/shares/public-link)');
    const resPublicLink = await request('/shares/public-link', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        itemType: 'file',
        itemId: uploadedFileId,
        role: 'viewer',
        password: 'SharePassword@123',
        allowDownload: true
      }
    });
    assert(resPublicLink.status === 200, 'Tạo public link thành công');
    const publicShareToken = resPublicLink.data.data.shareToken;
    assert(resPublicLink.data.data.hasPassword === true, 'Public link có bật mật khẩu');

    // Test 48: Truy cập liên kết công khai khi chưa truyền mật khẩu
    console.log('\n[48] Kiểm tra Truy cập liên kết công khai khi chưa có mật khẩu (nhận requiresPassword)');
    const resPublicNoPass = await request(`/shares/public/${publicShareToken}`);
    assert(resPublicNoPass.status === 200, 'Truy cập public link thành công');
    assert(resPublicNoPass.data.data.requiresPassword === true, 'Hệ thống yêu cầu nhập mật khẩu bảo vệ');

    // Test 49: Truy cập liên kết công khai với mật khẩu chính xác
    console.log('\n[49] Kiểm tra Truy cập liên kết công khai với mật khẩu chính xác');
    const resPublicWithPass = await request(`/shares/public/${publicShareToken}`, {
      headers: { 'x-share-password': 'SharePassword@123' }
    });
    assert(resPublicWithPass.status === 200, 'Mở khóa link công khai thành công');
    assert(resPublicWithPass.data.data.requiresPassword === false, 'Đã mở khóa dữ liệu');
    assert(resPublicWithPass.data.data.item._id === uploadedFileId, 'Thông tin file trùng khớp');

    // Test 50: Tải tệp tin qua liên kết công khai (/api/shares/public/:token/download)
    console.log('\n[50] Kiểm tra Tải tệp tin qua liên kết công khai (/api/shares/public/:token/download)');
    const resPublicDownload = await request(`/shares/public/${publicShareToken}/download`, {
      headers: { 'x-share-password': 'SharePassword@123' },
      isRaw: true
    });
    assert(resPublicDownload.status === 200, 'Tải file qua public link thành công 200');
    assert(resPublicDownload.text === testContent, 'Nội dung file tải qua public link trùng khớp');

    // Test 51: Xem trước tệp tin qua liên kết công khai (/api/shares/public/:token/preview)
    console.log('\n[51] Kiểm tra Xem trước tệp tin qua liên kết công khai (/api/shares/public/:token/preview)');
    const resPublicPreview = await request(`/shares/public/${publicShareToken}/preview`, {
      headers: { 'x-share-password': 'SharePassword@123' },
      isRaw: true
    });
    assert(resPublicPreview.status === 200, 'Xem trước tệp qua public link thành công');
    assert(resPublicPreview.headers.get('content-disposition').includes('inline'), 'Header inline chính xác');

    // Test 52: Tắt liên kết chia sẻ công khai (/api/shares/public-link/file/:id)
    console.log('\n[52] Kiểm tra Tắt liên kết chia sẻ công khai (/api/shares/public-link/file/:id)');
    const resRevokePublic = await request(`/shares/public-link/file/${uploadedFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resRevokePublic.status === 200, 'Tắt liên kết công khai thành công');

    // Test 53: Thu hồi quyền chia sẻ của cộng tác viên (/api/shares/:id)
    console.log('\n[53] Kiểm tra Thu hồi quyền chia sẻ của cộng tác viên (/api/shares/:id)');
    const resRemoveCollab = await request(`/shares/${shareRecordId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resRemoveCollab.status === 200, 'Thu hồi quyền cộng tác viên thành công');

    // =========================================================================
    // 🗑️ KIỂM THỬ THÙNG RÁC, KHÔI PHỤC & XÓA VĨNH VIỄN
    // =========================================================================

    // Test 54: Xóa tệp tin chuyển vào thùng rác (/files/:id)
    console.log('\n[54] Kiểm tra Chuyển tệp tin vào thùng rác (/files/:id)');
    const resTrash = await request(`/files/${uploadedFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resTrash.status === 200, 'Chuyển vào thùng rác thành công');

    // Test 55: Lấy danh sách tệp tin trong thùng rác (/files/trash)
    console.log('\n[55] Kiểm tra Lấy danh sách tệp tin trong thùng rác (/files/trash)');
    const resTrashList = await request('/files/trash', {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resTrashList.status === 200, 'Lấy danh sách thùng rác thành công');
    assert(resTrashList.data.data.some(f => f._id === uploadedFileId), 'File vừa xóa nằm trong danh sách thùng rác');

    // Test 56: Khôi phục tệp tin từ thùng rác (/files/:id/restore)
    console.log('\n[56] Kiểm tra Khôi phục tệp tin từ thùng rác (/files/:id/restore)');
    const resRestore = await request(`/files/${uploadedFileId}/restore`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resRestore.status === 200, 'Khôi phục file thành công');
    assert(resRestore.data.data.isTrash === false, 'File không còn cờ isTrash');

    // Test 57: Xóa vĩnh viễn tệp tin (/files/:id/permanent)
    console.log('\n[57] Kiểm tra Xóa vĩnh viễn tệp tin (/files/:id/permanent)');
    const resPermanent = await request(`/files/${uploadedFileId}/permanent`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resPermanent.status === 200, 'Xóa vĩnh viễn file thành công');

    // Test 58: Dọn sạch thùng rác (/files/trash/empty)
    console.log('\n[58] Kiểm tra Dọn sạch thùng rác (/files/trash/empty)');
    // Đưa file copy vào thùng rác trước để dọn
    await request(`/files/${copiedFileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    const resEmptyTrash = await request('/files/trash/empty', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(resEmptyTrash.status === 200, 'Dọn sạch thùng rác thành công');
    assert(resEmptyTrash.data.data.deletedCount >= 1, 'Số file bị xóa vĩnh viễn >= 1');

    // Dọn dẹp dữ liệu test
    const Folder = require('./src/models/folder.model');
    const Share = require('./src/models/share.model');
    await Share.deleteMany({ $or: [{ owner: userId }, { sharedWith: userId }, { sharedWith: collabUserId }] });
    await Folder.deleteMany({ user: userId });
    await File.deleteMany({ user: userId });
    await User.findByIdAndDelete(userId);
    await User.findByIdAndDelete(collabUserId);
    console.log('\n-> Đã dọn dẹp toàn bộ dữ liệu kiểm thử User, Folders, Files, Shares thành công');

    console.log('\n🎉 TẤT CẢ 58 BƯỚC KIỂM THỬ ĐÃ THÀNH CÔNG RỰC RỠ! 🎉\n');
  } catch (error) {
    console.error('Lỗi khi chạy test:', error);
  } finally {
    if (server) server.close();
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();

