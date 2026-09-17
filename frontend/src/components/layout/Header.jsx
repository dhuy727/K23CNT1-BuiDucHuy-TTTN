import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  Sun,
  Moon,
  User,
  LogOut,
  Key,
  Shield,
  File,
  Folder
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import searchService from '../../services/searchService';

const Header = () => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchContainerRef = useRef(null);
  const userMenuRef = useRef(null);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await searchService.getSuggestions(searchQuery.trim());
        setSuggestions(res.data || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error('Lỗi lấy gợi ý tìm kiếm:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleSelectSuggestion = (suggestion) => {
    const term = typeof suggestion === 'string' ? suggestion : suggestion.name || suggestion.text;
    setSearchQuery(term);
    setShowSuggestions(false);
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      {/* Search Bar */}
      <div className="search-container" ref={searchContainerRef}>
        <form onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <Search size={18} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm tệp, thư mục, thẻ phân loại AI..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
            />
          </div>
        </form>

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="search-suggestions-dropdown">
            <div style={{ padding: '6px 18px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Gợi ý tìm kiếm
            </div>
            {suggestions.map((item, idx) => {
              const text = typeof item === 'string' ? item : item.name || item.text;
              const type = item.type || 'file';
              return (
                <div
                  key={idx}
                  className="suggestion-item"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  {type === 'folder' ? (
                    <Folder size={16} style={{ color: 'var(--primary-600)' }} />
                  ) : (
                    <File size={16} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span>{text}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        {/* Theme Toggle */}
        <button
          className="btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
        >
          {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        {/* User Profile Menu */}
        <div className="user-profile-menu" ref={userMenuRef}>
          <button
            className="user-avatar-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="avatar-circle">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.name || 'Tài khoản'}
            </span>
          </button>

          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="dropdown-user-info">
                <div className="dropdown-name">{user?.name}</div>
                <div className="dropdown-email">{user?.email}</div>
                {user?.role && (
                  <span className="badge badge-purple" style={{ marginTop: '6px' }}>
                    {user.role.toUpperCase()}
                  </span>
                )}
              </div>

              <button
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings/profile');
                }}
              >
                <User size={16} />
                <span>Hồ sơ cá nhân</span>
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings/change-password');
                }}
              >
                <Key size={16} />
                <span>Đổi mật khẩu</span>
              </button>

              {isAdmin && (
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/admin/users');
                  }}
                >
                  <Shield size={16} />
                  <span>Quản trị người dùng</span>
                </button>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

              <button className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={16} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
