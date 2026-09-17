import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layout
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from './ProtectedRoute';

// Auth Pages
import LoginPage from '../pages/auth/LoginPage';
import RegisterPage from '../pages/auth/RegisterPage';
import VerifyEmailPage from '../pages/auth/VerifyEmailPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '../pages/auth/ResetPasswordPage';

// Drive Pages
import MyDrivePage from '../pages/drive/MyDrivePage';
import StarredPage from '../pages/drive/StarredPage';
import TrashPage from '../pages/drive/TrashPage';
import SearchPage from '../pages/drive/SearchPage';

// Share Pages
import SharedWithMePage from '../pages/shares/SharedWithMePage';
import SharedByMePage from '../pages/shares/SharedByMePage';
import PublicSharePage from '../pages/shares/PublicSharePage';

// Settings & Admin
import ProfilePage from '../pages/settings/ProfilePage';
import ChangePasswordPage from '../pages/settings/ChangePasswordPage';
import UsersPage from '../pages/admin/UsersPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public Share Route (Không bắt buộc login) */}
      <Route path="/shares/public/:shareToken" element={<PublicSharePage />} />

      {/* Protected Routes inside MainLayout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/drive" replace />} />
        <Route path="drive" element={<MyDrivePage />} />
        <Route path="drive/folder/:folderId" element={<MyDrivePage />} />
        <Route path="starred" element={<StarredPage />} />
        <Route path="trash" element={<TrashPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="shares/shared-with-me" element={<SharedWithMePage />} />
        <Route path="shares/shared-by-me" element={<SharedByMePage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
        <Route path="settings/change-password" element={<ChangePasswordPage />} />

        {/* Admin only route */}
        <Route
          path="admin/users"
          element={
            <ProtectedRoute requireAdmin={true}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  );
};

export default AppRoutes;
