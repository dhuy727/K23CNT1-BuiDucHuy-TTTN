const nodemailer = require("nodemailer");

const isEmailConfigured = () => Boolean(
  process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD
);

const getTransporter = () => nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD }
});

const sendMail = async (message) => {
  if (process.env.NODE_ENV === 'test') return;
  if (!isEmailConfigured()) {
    throw new Error('Dịch vụ email chưa được cấu hình. Vui lòng thiết lập EMAIL_HOST, EMAIL_PORT, EMAIL_USER và EMAIL_APP_PASSWORD.');
  }
  await getTransporter().sendMail(message);
};

const sendVerificationEmail = async (
  email,
  name,
  code
) => {
  await sendMail({
    from: `"Ứng dụng Quản lý tài liệu" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Xác thực tài khoản",

    html: `
      <h2>Xin chào ${name}</h2>

      <p>
        Cảm ơn bạn đã đăng ký tài khoản.
      </p>

      <p>
        Mã xác thực tài khoản của bạn là:
      </p>

      <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">
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
    subject: "Đặt lại mật khẩu",

    html: `
      <h2>Xin chào ${name}</h2>

      <p>
        Bạn vừa yêu cầu đặt lại mật khẩu.
      </p>

      <p>
        Click vào link bên dưới:
      </p>

      <a href="${resetUrl}">
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
