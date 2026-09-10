const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '📁 AI File Manager API',
      version: '1.0.0',
      description: `
## Hệ thống quản lý tệp tin thông minh — Bùi Đức Huy (K23CNT1)

API cung cấp đầy đủ chức năng quản lý người dùng, thư mục, tệp tin,
tìm kiếm nâng cao, chia sẻ và quản lý phiên bản tệp tin.

### Xác thực
Tất cả các endpoint (trừ Auth & Public Share) yêu cầu **Bearer Token**.
- Đăng nhập tại \`POST /auth/login\` để nhận \`secretToken\`
- Click nút **Authorize** → nhập \`Bearer <secretToken>\`
      `,
      contact: {
        name: 'Bùi Đức Huy',
        email: 'buihuyk23@email.com'
      },
      license: {
        name: 'ISC'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development Server'
      }
    ],
    tags: [
      { name: 'Auth', description: 'Đăng ký, đăng nhập, làm mới token' },
      { name: 'Users', description: 'Quản lý thông tin người dùng' },
      { name: 'Folders', description: 'Quản lý thư mục (cây thư mục, di chuyển, thống kê)' },
      { name: 'Files', description: 'Upload, download, preview, quản lý tệp tin' },
      { name: 'Versions', description: 'Lịch sử phiên bản tệp tin (snapshot & restore)' },
      { name: 'Search', description: 'Tìm kiếm nâng cao, gợi ý, bộ lọc metadata' },
      { name: 'Shares', description: 'Chia sẻ nội bộ và tạo liên kết công khai' }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Nhập secretToken nhận được từ /auth/login'
        }
      },
      schemas: {
        // ── Dùng chung ─────────────────────────────────────────────────────────
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Thao tác thành công' },
            data: { type: 'object' }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: { type: 'integer', example: 50 },
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            totalPages: { type: 'integer', example: 3 }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Lỗi xử lý yêu cầu' },
            statusCode: { type: 'integer', example: 400 }
          }
        },
        // ── User ───────────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'Bùi Đức Huy' },
            email: { type: 'string', format: 'email', example: 'huy@example.com' },
            role: { type: 'string', enum: ['admin', 'user'], example: 'user' },
            phone: { type: 'string', example: '0988888888' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        // ── Auth Tokens ────────────────────────────────────────────────────────
        AuthTokens: {
          type: 'object',
          properties: {
            secretToken: { type: 'string', description: 'JWT ngắn hạn (15 phút)' },
            refreshToken: { type: 'string', description: 'JWT dài hạn (7 ngày)' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        // ── Folder ─────────────────────────────────────────────────────────────
        Folder: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d2' },
            name: { type: 'string', example: 'Đồ án' },
            user: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            parent: { type: 'string', nullable: true, example: null },
            path: { type: 'string', example: '/Đồ án' },
            color: { type: 'string', example: '#4F46E5' },
            isTrash: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        // ── File ───────────────────────────────────────────────────────────────
        File: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d3' },
            name: { type: 'string', example: 'BaoCao.pdf' },
            originalName: { type: 'string', example: 'BaoCao.pdf' },
            user: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            folder: { type: 'string', nullable: true, example: null },
            size: { type: 'integer', example: 204800 },
            formattedSize: { type: 'string', example: '200 KB' },
            mimeType: { type: 'string', example: 'application/pdf' },
            extension: { type: 'string', example: 'pdf' },
            aiCategory: { type: 'string', example: 'Báo cáo' },
            aiTags: { type: 'array', items: { type: 'string' }, example: ['báo cáo', 'nghiên cứu'] },
            aiSummary: { type: 'string', example: 'Báo cáo tổng kết dự án' },
            isStarred: { type: 'boolean', example: false },
            isTrash: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        // ── Version ────────────────────────────────────────────────────────────
        Version: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d4' },
            file: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d3' },
            user: { type: 'string', example: '64f1a2b3c4d5e6f7a8b9c0d1' },
            versionNumber: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'BaoCao.pdf' },
            size: { type: 'integer', example: 204800 },
            formattedSize: { type: 'string', example: '200 KB' },
            mimeType: { type: 'string', example: 'application/pdf' },
            note: { type: 'string', example: 'Phiên bản trước khi chỉnh sửa' },
            changeType: {
              type: 'string',
              enum: ['upload', 'update', 'rename', 'restore', 'manual'],
              example: 'manual'
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        // ── Share ──────────────────────────────────────────────────────────────
        Share: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            owner: { type: 'string', description: 'ID người chia sẻ' },
            sharedWith: { type: 'string', description: 'ID người được chia sẻ' },
            itemId: { type: 'string', description: 'ID tệp tin / thư mục' },
            itemType: { type: 'string', enum: ['file', 'folder'] },
            role: { type: 'string', enum: ['viewer', 'editor'] },
            createdAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    },
    security: [{ BearerAuth: [] }]
  },
  // Đường dẫn quét JSDoc annotations từ các route files
  apis: [
    './src/routes/auth.routes.js',
    './src/routes/user.routes.js',
    './src/routes/folder.routes.js',
    './src/routes/file.routes.js',
    './src/routes/version.routes.js',
    './src/routes/search.routes.js',
    './src/routes/share.routes.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
