import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Đường dẫn thư mục
const ROOT_DIR = path.resolve(__dirname, '..');
const FRONTEND_DIR = path.resolve(ROOT_DIR, 'frontend');
const DIST_DIR = path.resolve(FRONTEND_DIR, 'dist');

// Cấu hình OneHost OnePanel MCP
const MCP_URL = 'https://onehost-wphn072607.000nethost.com:2023/api/mcp';
let TOKEN = 'sp_54d99a0b21ac256c7a86889221a36379570f1e36d99195b1b1fe8718f6040f74';

// Cố gắng đọc token mới nhất từ mcp_config.json nếu có
try {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  const mcpConfigPath = path.join(userProfile, '.gemini', 'config', 'mcp_config.json');
  if (fs.existsSync(mcpConfigPath)) {
    const raw = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf8'));
    const authHeader = raw?.mcpServers?.['onepanel-tfrkvhhwhosting']?.headers?.Authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      TOKEN = authHeader.replace('Bearer ', '').trim();
    }
  }
} catch (e) {
  // Dùng fallback token
}

function sendRpc(payload, sessionId = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Length': Buffer.byteLength(data)
    };
    if (sessionId) {
      headers['mcp-session-id'] = sessionId;
    }

    const req = https.request(MCP_URL, {
      method: 'POST',
      headers,
      rejectUnauthorized: false
    }, (res) => {
      let body = '';
      const newSessionId = res.headers['mcp-session-id'] || sessionId;
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, body, sessionId: newSessionId });
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseRpcResult(body) {
  try {
    // Response từ SSE format: "event: message\ndata: {...}"
    const match = body.match(/data:\s*(\{.*\})/s);
    if (match) {
      return JSON.parse(match[1]);
    }
    return JSON.parse(body);
  } catch (err) {
    return { raw: body };
  }
}

async function callMcpTool(toolName, args, sessionId) {
  const res = await sendRpc({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args
    }
  }, sessionId);

  return parseRpcResult(res.body);
}

async function main() {
  console.log('===========================================================');
  console.log('🚀 BẮT ĐẦU QUY TRÌNH DEPLOY FRONTEND LÊN ONEHOST (SMARTDOC)');
  console.log('===========================================================');

  // Bước 1: Build frontend
  console.log('\n[1/5] 🔨 Đang build frontend React (Vite production mode)...');
  try {
    execSync('npm run build', {
      cwd: FRONTEND_DIR,
      stdio: 'inherit'
    });
    console.log('✅ Build frontend hoàn tất thành công!');
  } catch (error) {
    console.error('❌ Lỗi trong quá trình build frontend. Dừng deploy.');
    process.exit(1);
  }

  if (!fs.existsSync(DIST_DIR)) {
    console.error(`❌ Thư mục build không tồn tại: ${DIST_DIR}`);
    process.exit(1);
  }

  // Bước 2: Khởi tạo kết nối OnePanel MCP
  console.log('\n[2/5] 📡 Kết nối tới máy chủ OneHost qua API OnePanel...');
  const initRes = await sendRpc({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'deploy-onehost-script', version: '2.0.0' }
    }
  });

  const sessionId = initRes.sessionId;
  if (!sessionId) {
    console.error('❌ Không thể khởi tạo phiên kết nối MCP với OneHost. Kiểm tra lại token/kết nối mạng.');
    process.exit(1);
  }

  await sendRpc({
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  }, sessionId);

  console.log(`✅ Kết nối thành công! Session ID: ${sessionId}`);

  // Bước 3: Lấy danh sách file assets cũ trên server
  console.log('\n[3/5] 🔍 Kiểm tra các tệp tin trên máy chủ OneHost...');
  const listRes = await callMcpTool('list_files', { path: 'public_html/assets' }, sessionId);
  let oldAssetFiles = [];
  try {
    const parsedText = JSON.parse(listRes?.result?.content?.[0]?.text || '{}');
    if (Array.isArray(parsedText?.files)) {
      oldAssetFiles = parsedText.files.map(f => f.filename || f.basename);
    }
  } catch (e) {
    // Không đọc được danh sách cũ
  }

  // Bước 4: Tải các tệp tin mới lên server
  console.log('\n[4/5] 📤 Đang tải các tệp tin lên thư mục public_html trên OneHost...');
  const newUploadedAssets = new Set();

  // 4.1: Upload assets trong dist/assets
  const distAssetsDir = path.join(DIST_DIR, 'assets');
  if (fs.existsSync(distAssetsDir)) {
    const assetFiles = fs.readdirSync(distAssetsDir);
    for (const fileName of assetFiles) {
      const localFilePath = path.join(distAssetsDir, fileName);
      const stat = fs.statSync(localFilePath);
      if (stat.isFile()) {
        const remotePath = `public_html/assets/${fileName}`;
        const content = fs.readFileSync(localFilePath, 'utf8');
        process.stdout.write(`   ⬆️  Đang tải ${remotePath} (${(stat.size / 1024).toFixed(1)} KB)... `);
        await callMcpTool('write_file', { path: remotePath, content }, sessionId);
        newUploadedAssets.add(fileName);
        console.log('✅ Xong');
      }
    }
  }

  // 4.2: Upload favicon / icons nếu có
  for (const staticFile of ['favicon.svg', 'icons.svg']) {
    const localPath = path.join(DIST_DIR, staticFile);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf8');
      const remotePath = `public_html/${staticFile}`;
      process.stdout.write(`   ⬆️  Đang tải ${remotePath}... `);
      await callMcpTool('write_file', { path: remotePath, content }, sessionId);
      console.log('✅ Xong');
    }
  }

  // 4.3: Upload index.html sau cùng
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    process.stdout.write('   ⬆️  Đang cập nhật public_html/index.html... ');
    await callMcpTool('write_file', { path: 'public_html/index.html', content: indexContent }, sessionId);
    console.log('✅ Xong');
  }

  // Bước 5: Dọn dẹp các tệp asset hash cũ
  console.log('\n[5/5] 🧹 Dọn dẹp các bundle JS/CSS phiên bản cũ trên server...');
  let cleanedCount = 0;
  for (const oldFile of oldAssetFiles) {
    if (!newUploadedAssets.has(oldFile)) {
      try {
        await callMcpTool('delete_file', {
          path: `public_html/assets/${oldFile}`,
          type: 'file'
        }, sessionId);
        console.log(`   🗑️  Đã xóa bundle cũ: ${oldFile}`);
        cleanedCount++;
      } catch (err) {
        // Bỏ qua lỗi xóa file cũ
      }
    }
  }
  if (cleanedCount === 0) {
    console.log('   ✨ Không có tệp bundle cũ nào cần xóa.');
  }

  console.log('\n===========================================================');
  console.log('🎉 DEPLOY HOÀN TẤT THÀNH CÔNG LÊN ONEHOST!');
  console.log('🌐 Website chính thức: https://smartdocs.id.vn/');
  console.log('🔗 Backend Render API: https://k23cnt1-buiduchuy-tttn-1.onrender.com/api');
  console.log('💡 Gợi ý: Hãy mở trình duyệt và nhấn Ctrl + F5 (hoặc cửa sổ ẩn danh)');
  console.log('===========================================================');
}

main().catch((err) => {
  console.error('\n❌ Có lỗi xảy ra trong quá trình deploy:', err);
  process.exit(1);
});
