import axiosClient from '../api/axiosClient';

const authService = {
  login: async (credentials) => {
    return await axiosClient.post('/auth/login', credentials);
  },

  register: async (userData) => {
    return await axiosClient.post('/auth/register', userData);
  },

  verifyEmail: async ({ email, code }) => {
    return await axiosClient.post('/auth/verify-email', { email, code });
  },

  resendVerificationCode: async (email) => {
    return await axiosClient.post('/auth/resend-verification-code', { email });
  },

  forgotPassword: async (email) => {
    return await axiosClient.post('/auth/forgot-password', { email });
  },

  verifyForgotPassword: async (token) => {
    return await axiosClient.post('/auth/verify-forgot-password', { token });
  },

  resetPassword: async ({ token, newPassword }) => {
    return await axiosClient.post('/auth/reset-password', { token, newPassword });
  },

  getMe: async () => {
    return await axiosClient.get('/auth/me');
  },

  updateProfile: async (data) => {
    return await axiosClient.put('/auth/profile', data);
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    return await axiosClient.patch('/auth/change-password', { currentPassword, newPassword });
  },

  logout: async (refreshToken) => {
    try {
      return await axiosClient.post('/auth/logout', { refreshToken });
    } catch {
      // Bỏ qua lỗi server nếu token đã hết hạn
      return { success: true };
    }
  }
};

export default authService;
