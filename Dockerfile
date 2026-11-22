# ==============================================================================
# Giai đoạn 1: Biên dịch Frontend React (Vite Multi-stage Build)
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# ==============================================================================
# Giai đoạn 2: Máy chủ Production Backend Node.js
# ==============================================================================
FROM node:20-alpine AS production-server
WORKDIR /app

# Cài đặt các gói tiện ích hệ thống cơ bản
RUN apk add --no-cache curl

# Cài đặt Production Dependencies cho Backend
COPY backend/package*.json ./backend/
RUN npm --prefix backend install --omit=dev

# Sao chép mã nguồn Backend
COPY backend/ ./backend/

# Sao chép bản build Frontend đã tối ưu vào thư mục frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Tạo thư mục uploads vật lý cho backend
RUN mkdir -p /app/backend/uploads

# Thiết lập biến môi trường
ENV NODE_ENV=production
ENV PORT=3000

# Expose cổng 3000 phục vụ toàn bộ Web App (Single-port architecture)
EXPOSE 3000

WORKDIR /app/backend

# Kiểm tra sức khỏe ứng dụng (Health check)
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
