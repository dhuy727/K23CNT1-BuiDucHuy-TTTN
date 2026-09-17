import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const axiosClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request Interceptor: Gắn Bearer secretToken
axiosClient.interceptors.request.use(
  (config) => {
    const secretToken = localStorage.getItem('secretToken');
    if (secretToken && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${secretToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Xử lý envelope và tự động làm mới phiên khi 401
axiosClient.interceptors.response.use(
  (response) => {
    // Nếu request trả về binary blob (preview / download) thì trả thẳng response
    if (response.config.responseType === 'blob') {
      return response;
    }
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Bỏ qua các endpoint auth công khai
    const isAuthUrl =
      originalRequest.url.includes('/auth/login') ||
      originalRequest.url.includes('/auth/register') ||
      originalRequest.url.includes('/auth/refresh-token');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthUrl) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem('secretToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(`${BASE_URL}/auth/refresh-token`, {
          refreshToken
        });

        const newTokens = res.data?.data;
        const newSecretToken = newTokens?.secretToken;
        const newRefreshToken = newTokens?.refreshToken;

        if (newSecretToken) {
          localStorage.setItem('secretToken', newSecretToken);
          if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
          }

          axiosClient.defaults.headers.common.Authorization = `Bearer ${newSecretToken}`;
          originalRequest.headers.Authorization = `Bearer ${newSecretToken}`;

          processQueue(null, newSecretToken);
          return axiosClient(originalRequest);
        } else {
          throw new Error('Không nhận được token mới');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.removeItem('secretToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.dispatchEvent(new Event('auth:logout'));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;
