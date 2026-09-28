const nodemailer = require("nodemailer");

/**
 * Kiểm tra cấu hình Gmail REST API (Google Cloud OAuth2 qua HTTPS port 443 - hoạt động tốt trên Render Free)
 */
const isGmailApiConfigured = () => Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_REFRESH_TOKEN &&
  process.env.EMAIL_USER
);

/**
 * Kiểm tra cấu hình SMTP cổ điển (port 465/587 - dùng được ở local, bị Render Free chặn)
 */
const isSmtpConfigured = () => Boolean(
  process.env.EMAIL_HOST &&
  process.env.EMAIL_PORT &&
  process.env.EMAIL_USER &&
  process.env.EMAIL_APP_PASSWORD
);

/**
 * Lấy access_token mới từ refresh_token qua Google OAuth2 token endpoint
 */
const getGoogleAccessToken = async () => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      throw new Error(`Google OAuth2 lỗi: ${data.error_description || data.error || 'Không nhận được access_token'}`);
    }
    return data.access_token;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Kết nối tới Google OAuth2 bị quá thời gian chờ (10s timeout).');
    }
    throw err;
  }
};

/**
 * Gửi email bằng Gmail REST API qua HTTPS (cổng 443)
 */
const sendMailViaGmailApi = async (message) => {
  // 1. Biên dịch email thành RFC 2822 raw buffer hoàn chỉnh (hỗ trợ đầy đủ tiếng Việt UTF-8)
  const compiler = nodemailer.createTransport({ streamTransport: true, buffer: true });
  const compiled = await compiler.sendMail(message);

  // 2. Chuyển sang Base64URL theo chuẩn của Gmail REST API
  const rawBase64Url = compiled.message.toString('base64url');

  // 3. Lấy access token mới từ refresh token
  const accessToken = await getGoogleAccessToken();

  // 4. Gửi email qua HTTPS API (Port 443 không bao giờ bị Render chặn)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawBase64Url }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gmail API từ chối gửi (${res.status}): ${errData.error?.message || res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Gửi email qua Gmail API bị quá thời gian chờ (10s timeout).');
    }
    throw err;
  }
};

/**
 * Gửi email qua SMTP cổ điển với timeout 10s (chỉ hoạt động khi chạy localhost)
 */
const sendMailViaSmtp = async (message) => {
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
  await transporter.sendMail(message);
};

const sendMail = async (message) => {
  if (process.env.NODE_ENV === 'test') return;

  if (isGmailApiConfigured()) {
    return await sendMailViaGmailApi(message);
  }

  if (isSmtpConfigured()) {
    return await sendMailViaSmtp(message);
  }

  throw new Error(
    'Dịch vụ email chưa được cấu hình. Trên Render, vui lòng cấu hình GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN và EMAIL_USER để gửi mail qua Gmail REST API.'
  );
};

const sendVerificationEmail = async (
  email,
  name,
  code
) => {
  await sendMail({
    from: `"Ứng dụng Quản lý tài liệu" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác thực tài khoản SmartDocs",

    html: `
      <h2>Xin chào ${name}</h2>

      <p>
        Cảm ơn bạn đã đăng ký tài khoản SmartDocs.
      </p>

      <p>
        Mã xác thực tài khoản của bạn là:
      </p>

      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #4f46e5;">
        ${code}
      </p>

      <p>
        Mã có hiệu lực trong 15 phút. Không chia sẻ mã này với bất kỳ ai.
      </p>
    `,
  });
};

const sendPasswordResetEmail = async (
  email,
  name,
  token
) => {
  const resetUrl =
    `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await sendMail({
    from: `"Ứng dụng Quản lý tài liệu" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Đặt lại mật khẩu SmartDocs",

    html: `
      <h2>Xin chào ${name}</h2>

      <p>
        Bạn vừa yêu cầu đặt lại mật khẩu.
      </p>

      <p>
        Click vào link bên dưới:
      </p>

      <a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;">
        Đặt lại mật khẩu
      </a>

      <p>
        Link có hiệu lực trong 15 phút.
      </p>
    `,
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
};
