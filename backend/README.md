# REST API Quản Lý Người Dùng & Xác Thực JWT 2 Tầng Token

Dự án RESTful API hoàn chỉnh được xây dựng trên nền tảng **Node.js**, **Express**, **MongoDB (Mongoose)** theo mô hình kiến trúc phân tầng chuẩn (**Layered Architecture**: Model - Service - Controller - Route), tích hợp cơ chế bảo mật xác thực **Dual JWT Token** (`secretToken` ngắn hạn & `refreshToken` dài hạn) và hệ thống **Quản lý Người dùng (User Management)**.

---

## 1. Cấu Trúc Thư Mục & Kiến Trúc Phân Tầng

```text
backend/
├── src/
│   ├── config/
│   │   ├── db.js             # Kết nối MongoDB thông qua Mongoose
│   │   └── jwt.js            # Cấu hình Secret Key & hàm tạo/xác thực token
│   ├── models/
│   │   └── user.model.js     # Schema Mongoose: mã hóa bcrypt, ẩn mật khẩu, lưu refreshToken
│   ├── services/
│   │   ├── auth.service.js   # Xử lý logic đăng ký, đăng nhập, refresh token, đăng xuất
│   │   └── user.service.js   # Xử lý logic CRUD người dùng, phân trang, đổi mật khẩu
│   ├── controllers/
│   │   ├── auth.controller.js# Tiếp nhận HTTP request auth, gọi service & phản hồi JSON
│   │   └── user.controller.js# Tiếp nhận HTTP request user, gọi service & phản hồi JSON
│   ├── routes/
│   │   ├── index.js          # Gắn các route con và endpoint /api/health
│   │   ├── auth.routes.js    # Định tuyến xác thực /api/auth/*
│   │   └── user.routes.js    # Định tuyến quản lý user /api/users/*
│   ├── middlewares/
│   │   ├── auth.middleware.js# Xác thực secretToken & kiểm tra phân quyền (Role)
│   │   ├── validate.middleware.js # Kiểm tra tính hợp lệ của dữ liệu đầu vào (Body, Params)
│   │   └── error.middleware.js# Bắt lỗi tập trung (Global Error Handler) & 404
│   ├── utils/
│   │   ├── apiError.js       # Class ApiError tùy biến mã lỗi HTTP
│   │   └── apiResponse.js    # Tiện ích chuẩn hóa cấu trúc JSON trả về
│   └── app.js                # Thiết lập Express, CORS, JSON Parser, gom Route
├── server.js                 # Điểm khởi động ứng dụng (Entry Point)
├── .env.example              # Mẫu các biến môi trường cấu hình
├── .env                      # File biến môi trường thực tế
├── package.json              # Khai báo thư viện phụ thuộc và scripts
├── api-tests.http            # File kịch bản test bằng REST Client / Postman
├── test-api.js               # Kịch bản kiểm thử tự động toàn diện 11 bước
└── README.md                 # Tài liệu hướng dẫn sử dụng API
```

---

## 2. Cơ Chế Xác Thực 2 Loại Token (Dual-Token Authentication)

Hệ thống bảo vệ tài nguyên theo tiêu chuẩn an toàn cao nhất với 2 loại token:

1. **`secretToken` (Access Token - Ngắn hạn)**:
   - Thời gian tồn tại: **15 phút** (cấu hình qua `JWT_EXPIRES_IN`).
   - Dùng để gửi kèm trong HTTP Request Header:  
     `Authorization: Bearer <secretToken>`
   - Giúp giảm thiểu rủi ro bảo mật nếu token bị rò rỉ.
2. **`refreshToken` (Dài hạn)**:
   - Thời gian tồn tại: **7 ngày** (cấu hình qua `JWT_REFRESH_EXPIRES_IN`).
   - Được lưu trữ an toàn trong MongoDB gắn liền với tài khoản của người dùng.
   - Dùng để gọi API `/api/auth/refresh-token` để cấp mới `secretToken` mà người dùng không cần đăng nhập lại.
   - Khi người dùng đăng xuất (`/api/auth/logout`) hoặc đổi mật khẩu, `refreshToken` trong database sẽ bị xóa/vô hiệu hóa ngay lập tức.

---

## 3. Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Bước 1: Cài đặt thư viện phụ thuộc
Di chuyển vào thư mục `backend`:
```bash
cd backend
npm install
```

### Bước 2: Cấu hình biến môi trường
Kiểm tra file `.env` (hoặc tạo từ `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/user_management_db

JWT_SECRET=super_secret_access_key_k23cnt1_2026
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=super_secret_refresh_key_k23cnt1_2026
JWT_REFRESH_EXPIRES_IN=7d
```

### Bước 3: Khởi động Server
- Chế độ phát triển (Tự động tải lại code với `nodemon`):
  ```bash
  npm run dev
  ```
- Chế độ production:
  ```bash
  npm start
  ```

Server sẽ lắng nghe tại: `http://localhost:5000`

---

## 4. Chạy Kiểm Thử Tự Động (Automated Testing)

Dự án được tích hợp sẵn file kiểm thử tự động `test-api.js` kiểm tra toàn bộ chu trình 11 bước:
```bash
npm run test:api
```

Kết quả kiểm thử:
- ✅ [1] Health check `/api/health`
- ✅ [2] Đăng ký người dùng mới `/api/auth/register`
- ✅ [3] Đăng nhập lấy `secretToken` & `refreshToken` `/api/auth/login`
- ✅ [4] Truy cập protected route `/api/auth/me` với `secretToken`
- ✅ [5] Cấp lại `secretToken` bằng `refreshToken` `/api/auth/refresh-token`
- ✅ [6] Lấy danh sách phân trang người dùng `/api/users`
- ✅ [7] Cập nhật thông tin người dùng `/api/users/:id`
- ✅ [8] Đổi mật khẩu `/api/users/change-password`
- ✅ [9] Đăng nhập lại với mật khẩu mới
- ✅ [10] Đăng xuất `/api/auth/logout`
- ✅ [11] Kiểm tra thu hồi `refreshToken` (trả về 401 Unauthenticated)

---

## 5. Danh Sách API Endpoints Chi Tiết

### A. Authentication Endpoints (`/api/auth`)

| Method | Endpoint | Mô tả | Quyền |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Public |
| `POST` | `/api/auth/login` | Đăng nhập (nhận `secretToken` & `refreshToken`) | Public |
| `POST` | `/api/auth/refresh-token` | Làm mới `secretToken` bằng `refreshToken` | Public |
| `POST` | `/api/auth/logout` | Đăng xuất (thu hồi `refreshToken`) | Authenticated |

---

### B. User Profile & Account Endpoints (Dành Cho Người Dùng Hiện Tại)

*Tất cả các API này yêu cầu Header: `Authorization: Bearer <secretToken>` và tự động nhận diện tài khoản mà không cần truyền ID trên URL.*

#### 1. Lấy thông tin cá nhân (Profile)
- **Method**: `GET`
- **URL**: `/api/users/profile` *(hoặc `/api/users/me`, `/api/auth/me`)*
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Lấy thông tin cá nhân thành công",
    "data": {
      "_id": "67...",
      "name": "Bùi Đức Huy",
      "email": "duchuy@example.com",
      "role": "user",
      "phone": "0987654321",
      "isActive": true,
      "createdAt": "2026-09-03T18:00:00.000Z"
    }
  }
  ```

#### 2. Sửa thông tin cá nhân
- **Method**: `PUT` hoặc `PATCH`
- **URL**: `/api/users/profile` *(hoặc `/api/auth/profile`)*
- **Body (JSON)**:
  ```json
  {
    "name": "Bùi Đức Huy (Đã Cập Nhật)",
    "phone": "0912345678"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Cập nhật thông tin cá nhân thành công",
    "data": {
      "_id": "67...",
      "name": "Bùi Đức Huy (Đã Cập Nhật)",
      "email": "duchuy@example.com",
      "phone": "0912345678"
    }
  }
  ```

#### 3. Đổi mật khẩu
- **Method**: `PATCH` hoặc `PUT`
- **URL**: `/api/users/change-password` *(hoặc `/api/auth/change-password`)*
- **Body (JSON)**:
  ```json
  {
    "currentPassword": "password123",
    "newPassword": "newpassword456"
  }
  ```
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại trên các thiết bị."
  }
  ```

#### 4. Đăng xuất (Logout)
- **Method**: `POST`
- **URL**: `/api/users/logout` *(hoặc `/api/auth/logout`)*
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Đăng xuất thành công, refreshToken đã bị vô hiệu hóa",
    "data": null
  }
  ```

---

### C. Quản Trị Người Dùng (Admin & Management)

*Yêu cầu Header: `Authorization: Bearer <secretToken>` và quyền Admin / Manager.*

#### 1. Lấy danh sách người dùng (Phân trang & Tìm kiếm)
- **Method**: `GET`
- **URL**: `/api/users?page=1&limit=10&search=Huy&role=user`
- **Quyền**: `admin`, `manager`
- **Response (200 OK)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Lấy danh sách người dùng thành công",
    "data": [ ... ],
    "metadata": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
  ```

#### 2. Xem chi tiết người dùng theo ID
- **Method**: `GET`
- **URL**: `/api/users/:id`

#### 3. Cập nhật thông tin người dùng theo ID (Admin)
- **Method**: `PUT`
- **URL**: `/api/users/:id`

#### 4. Xóa người dùng (Admin)
- **Method**: `DELETE`
- **URL**: `/api/users/:id`
- **Quyền**: `admin`

---

### D. Quản Lý Thư Mục Phân Cấp (Folder Management - `/api/folders`)

*Tất cả các API này yêu cầu Header: `Authorization: Bearer <secretToken>` và tự động phân tách dữ liệu theo tài khoản người dùng.*

| Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `POST` | `/api/folders` | Tạo thư mục mới (ở root hoặc trong thư mục cha `parentId`) |
| `GET` | `/api/folders` | Lấy danh sách thư mục (lọc theo `parentId`, tìm kiếm `search`, phân trang) |
| `GET` | `/api/folders/tree` | Lấy toàn bộ cây thư mục dạng phân cấp lồng nhau (Nested Tree View) |
| `GET` | `/api/folders/:id` | Xem chi tiết thư mục (kèm Breadcrumb đường dẫn và Thống kê tệp/dung lượng) |
| `PATCH` | `/api/folders/:id/rename` | Đổi tên thư mục |
| `PATCH` | `/api/folders/:id/move` | Di chuyển thư mục (kèm thuật toán chống di chuyển lặp vòng) |
| `DELETE` | `/api/folders/:id` | Xóa thư mục (soft delete hoặc thêm `?permanent=true` để xóa vĩnh viễn) |
| `GET` | `/api/folders/:id/files` | Lấy danh sách các tệp tin con nằm bên trong thư mục |

#### 1. Tạo thư mục mới (`POST /api/folders`)
- **Body (JSON)**:
  ```json
  {
    "name": "Báo Cáo Nghiên Cứu",
    "parentId": "67c71... (hoặc 'root' nếu ở thư mục gốc)",
    "color": "#3B82F6",
    "description": "Thư mục tài liệu báo cáo AI"
  }
  ```

#### 2. Lấy cây thư mục (`GET /api/folders/tree`)
- **Response**: Trả về mảng cây phân cấp `children: [...]` lồng nhau đa tầng, hoàn hảo cho việc hiển thị Sidebar / TreeView trên Frontend.

#### 3. Chi tiết thư mục & Breadcrumb (`GET /api/folders/:id`)
- **Response**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Lấy thông tin chi tiết thư mục thành công",
    "data": {
      "_id": "67...",
      "name": "Báo Cáo Q1",
      "parent": "67...",
      "path": "/67.../67.../"
    },
    "metadata": {
      "breadcrumb": [
        { "_id": "root", "name": "Thư mục gốc" },
        { "_id": "67...", "name": "Dự Án AI" },
        { "_id": "67...", "name": "Báo Cáo Q1" }
      ],
      "statistics": {
        "subfoldersCount": 3,
        "filesCount": 12,
        "totalSize": 2457600
      }
    }
  }
  ```

#### 4. Di chuyển thư mục (`PATCH /api/folders/:id/move`)
- **Body (JSON)**:
  ```json
  {
    "targetParentId": "67c... (hoặc 'root' để đưa ra ngoài cùng)"
  }
  ```
- *Lưu ý*: Hệ thống tự động chặn lỗi vòng lặp (không cho phép di chuyển thư mục cha vào thư mục con của chính nó) và trả về lỗi HTTP 400 rõ ràng.

#### 5. Lấy file con trong thư mục (`GET /api/folders/:id/files`)
- **Query**: `search`, `page`, `limit`, `aiCategory`
- Trả về danh sách tệp tin trực thuộc thư mục được chỉ định (hoặc dùng `/api/folders/root/files` cho thư mục gốc).

---

## 6. Danh Sách Chi Tiết API Quản Lý Tài Liệu (File/Document Management)

Tất cả các endpoint bên dưới đều yêu cầu Header: `Authorization: Bearer <secretToken>`.

### Bảng tổng hợp Endpoints

| STT | Phương thức | Endpoint | Chức năng | Tham số / Body |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `POST` | `/api/files/upload` | Tải lên 1 tệp tin đơn lẻ | Multipart: `file`, `folderId`, `name`, `aiCategory`, `aiTags`, `aiSummary` |
| 2 | `POST` | `/api/files/upload-multiple` | Tải lên nhiều tệp tin (tối đa 10) | Multipart: `files`, `folderId` |
| 3 | `GET` | `/api/files` | Lấy danh sách tài liệu | Query: `folderId`, `search`, `aiCategory`, `type`, `isStarred`, `page`, `limit` |
| 4 | `GET` | `/api/files/:id` | Xem chi tiết thông tin tài liệu | Param: `id` |
| 5 | `GET` | `/api/files/:id/download` | Tải file về máy tính | Param: `id` |
| 6 | `GET` | `/api/files/:id/preview` | Xem trước file inline (PDF, ảnh, audio, video) | Param: `id` |
| 7 | `PATCH` | `/api/files/:id/rename` | Đổi tên tài liệu | Body: `{ "name": "ten_moi.ext" }` |
| 8 | `PATCH` | `/api/files/:id/move` | Di chuyển tài liệu | Body: `{ "targetFolderId": "ID" \| "root" }` |
| 9 | `POST` | `/api/files/:id/copy` | Nhân bản / sao chép tài liệu | Body: `{ "targetFolderId": "ID" }` (tùy chọn) |
| 10 | `PATCH` | `/api/files/:id/star` | Gắn sao yêu thích / bỏ gắn sao | Param: `id` |
| 11 | `DELETE` | `/api/files/:id` | Xóa tài liệu (chuyển vào thùng rác) | Param: `id` (thêm `?permanent=true` để xóa vĩnh viễn) |
| 12 | `GET` | `/api/files/trash` | Danh sách tài liệu trong thùng rác | Query: `search`, `page`, `limit` |
| 13 | `PATCH` | `/api/files/:id/restore` | Khôi phục tài liệu từ thùng rác | Param: `id` (tự chuyển về Root nếu folder cha bị xóa) |
| 14 | `DELETE` | `/api/files/:id/permanent` | Xóa vĩnh viễn tài liệu khỏi DB & đĩa | Param: `id` |
| 15 | `DELETE` | `/api/files/trash/empty` | Dọn sạch toàn bộ thùng rác | Không cần body |

### Ví dụ Chi Tiết Các Thao Tác Thường Dùng

#### 1. Tải lên tệp tin (`POST /api/files/upload`)
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Tệp tin nhị phân tải lên (tối đa 50MB)
  - `folderId`: ID thư mục đích (hoặc bỏ trống / 'root' để lưu tại thư mục gốc)
  - `name`: Tên hiển thị tùy chọn (mặc định lấy theo tên file gốc)
  - `aiCategory`: Phân loại sơ bộ (vd: `Báo cáo`, `Hóa đơn`, `Đồ án`, `Hợp đồng`...)
- **Phản hồi mẫu**:
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "Tải lên tệp tin thành công",
    "data": {
      "_id": "67c7a52...",
      "name": "BaoCaoThucTap.pdf",
      "originalName": "BaoCaoThucTap.pdf",
      "size": 1048576,
      "formattedSize": "1 MB",
      "mimeType": "application/pdf",
      "extension": "pdf",
      "aiCategory": "Báo cáo",
      "isStarred": false,
      "isTrash": false,
      "folder": {
        "_id": "67c79f...",
        "name": "Dự Án AI"
      }
    }
  }
  ```

#### 2. Lấy danh sách tài liệu (`GET /api/files`)
- **Query Parameters**:
  - `folderId`: Lọc theo thư mục (`root` cho thư mục gốc, hoặc bỏ trống để lấy tất cả)
  - `search`: Tìm kiếm theo tên hoặc tóm tắt AI
  - `type`: Lọc theo loại tệp (`image`, `pdf`, `document`, `video`, `audio`, `archive`)
  - `aiCategory`: Lọc theo danh mục AI
  - `isStarred`: `true` để lấy danh sách yêu thích
  - `page` & `limit`: Phân trang

#### 3. Sao chép tài liệu (`POST /api/files/:id/copy`)
- Tạo ra một bản sao vật lý mới trên ổ đĩa và bản ghi mới trong database.
- Nếu không truyền `targetFolderId`, bản sao sẽ nằm trong cùng thư mục với tên `Tên_File - Copy.ext`.

#### 4. Khôi phục từ thùng rác (`PATCH /api/files/:id/restore`)
- Khôi phục trạng thái `isTrash: false`.
- **Cơ chế thông minh**: Nếu thư mục cha trước đây đã bị xóa hoặc đang nằm trong thùng rác, hệ thống tự động chuyển tài liệu về thư mục gốc (Root) để tránh tình trạng mồ côi (orphaned file).

---

## 7. Danh Sách Chi Tiết API Tìm Kiếm & Lọc Đa Tiêu Chí (Search & Filter Module)

Tất cả các endpoint bên dưới đều yêu cầu Header: `Authorization: Bearer <secretToken>`.

### Bảng tổng hợp Endpoints

| STT | Phương thức | Endpoint | Chức năng | Tham số / Query Params |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/search` | **Tìm kiếm & Lọc đa tiêu chí** cho Files & Folders | `q`, `target`, `folderId`, `recursive`, `type`, `extension`, `minSize`, `maxSize`, `sizePreset`, `startDate`, `endDate`, `datePreset`, `aiCategory`, `aiTags`, `aiStatus`, `isStarred`, `sortBy`, `sortOrder`, `page`, `limit` |
| 2 | `GET` | `/api/search/suggestions` | **Gợi ý tìm kiếm Autocomplete** | `q` (từ khóa người dùng đang nhập) |
| 3 | `GET` | `/api/search/filters-metadata` | **Metadata hỗ trợ hiển thị bộ lọc** | Không cần tham số |

### Chi tiết các tham số lọc của `/api/search`

- **`q`** / **`search`**: Từ khóa tìm kiếm không phân biệt chữ hoa/thường (khớp theo tên tệp tin, tên thư mục, mô tả thư mục, tóm tắt AI `aiSummary`, thẻ tag `aiTags`, danh mục `aiCategory`).
- **`target`**:
  - `all` (Mặc định): Trả về cả tệp tin và thư mục thỏa mãn điều kiện.
  - `files`: Chỉ tìm và trả về tệp tin.
  - `folders`: Chỉ tìm và trả về thư mục.
- **`folderId` & `recursive`**:
  - `folderId`: ID thư mục cần tìm kiếm (hoặc `root`).
  - `recursive`: `true` (Mặc định - Tìm kiếm đệ quy toàn bộ thư mục con cháu bên trong), `false` (Chỉ tìm trong cấp hiện tại).
- **`type`**: Nhóm định dạng tệp tin:
  - `document`: PDF, Word, Excel, PowerPoint, Text, Markdown, CSV...
  - `image`: JPG, PNG, GIF, WebP, SVG, BMP...
  - `video`: MP4, MKV, AVI, MOV...
  - `audio`: MP3, WAV, FLAC, AAC...
  - `archive`: ZIP, RAR, 7Z, TAR, GZ...
  - `code`: JS, TS, HTML, CSS, JSON, Python, Java, C++...
- **`extension`**: Lọc theo đuôi mở rộng chính xác (vd: `pdf`, `docx`, `png`...).
- **`sizePreset`**:
  - `tiny`: Dưới 1 MB
  - `small`: 1 MB - 10 MB
  - `medium`: 10 MB - 100 MB
  - `large`: Trên 100 MB
  *(Hoặc dùng `minSize` & `maxSize` tính theo Bytes)*.
- **`datePreset`**:
  - `today`: Trong ngày hôm nay
  - `yesterday`: Hôm qua
  - `last7days`: 7 ngày qua
  - `last30days`: 30 ngày qua
  - `thisYear`: Trong năm nay
  *(Hoặc dùng `startDate` & `endDate` theo định dạng `YYYY-MM-DD`)*.
- **`aiCategory`**: Lọc theo phân loại AI (`Báo cáo`, `Hóa đơn`, `Hợp đồng`, `Đồ án`...).
- **`aiTags`**: Lọc theo thẻ tag AI.
- **`isStarred`**: `true` (Chỉ lấy tài liệu/thư mục được đánh dấu sao yêu thích).

### Phản hồi mẫu `/api/search`

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Tìm kiếm và lọc dữ liệu thành công",
  "data": {
    "items": [
      {
        "_id": "67c7a52...",
        "name": "BaoCaoThucTap.pdf",
        "itemType": "file",
        "size": 1048576,
        "formattedSize": "1 MB",
        "extension": "pdf",
        "aiCategory": "Báo cáo",
        "folder": {
          "_id": "67c79f...",
          "name": "Dự Án AI"
        }
      }
    ],
    "folders": [],
    "files": [ ... ]
  },
  "metadata": {
    "statistics": {
      "totalFolders": 0,
      "totalFiles": 1,
      "totalResults": 1
    },
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 8. Tiêu Chuẩn Phản Hồi Dữ Liệu (Standardized Response Format)

### Khi thành công:
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Mô tả kết quả thực thi",
  "data": { ... },
  "metadata": { ... } // (Tùy chọn: metadata phân trang / breadcrumb / statistics)
}
```

### Khi xảy ra lỗi:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Thông điệp lỗi chi tiết rõ ràng"
}
```



