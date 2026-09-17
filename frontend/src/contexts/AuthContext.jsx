import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const secretToken = localStorage.getItem('secretToken');
    if (!secretToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await authService.getMe();
      if (response.data) {
        setUser(response.data);
        localStorage.setItem('user', JSON.stringify(response.data));
      }
    } catch (err) {
      console.error('Không thể lấy thông tin người dùng:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    const handleLogoutEvent = () => {
      setUser(null);
      localStorage.removeItem('secretToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    };

    window.addEventListener('auth:logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, [fetchProfile]);

  const login = async (credentials) => {
    const response = await authService.login(credentials);
    const data = response.data;

    const tokens = data.tokens || {
      secretToken: data.secretToken,
      refreshToken: data.refreshToken
    };

    if (tokens?.secretToken) {
      localStorage.setItem('secretToken', tokens.secretToken);
    }
    if (tokens?.refreshToken) {
      localStorage.setItem('refreshToken', tokens.refreshToken);
    }

    if (data.user) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  };

  const register = async (userData) => {
    const response = await authService.register(userData);
    return response;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch (err) {
      console.error('Lỗi khi đăng xuất:', err);
    } finally {
      setUser(null);
      localStorage.removeItem('secretToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
    }
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const newUser = { ...prev, ...updatedData };
      localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    });
  };

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user && localStorage.getItem('secretToken')),
    isAdmin: user?.role === 'admin' || user?.role === 'manager',
    login,
    register,
    logout,
    updateUser,
    refreshProfile: fetchProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
