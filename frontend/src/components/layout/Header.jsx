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
  Folder,
  PanelRight,
  PanelLeft
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import searchService from '../../services/searchService';

const Header = ({ isSidebarCollapsed, onToggleSidebar }) => {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const userMenuRef = useRef(null);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Global Ctrl+K / Cmd+K listener to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const toggleInspector = () => {
    window.dispatchEvent(new CustomEvent('drive:toggle-inspector'));
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
      <div className="header-left">
        {/* Studio Search Command Bar */}
        <div className="search-container" ref={searchContainerRef}>
          <form onSubmit={handleSearchSubmit}>
            <div className="search-input-wrapper">
              <Search size={16} style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm nhanh tệp tin, thư mục, thẻ phân loại AI..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
              />
              <span className="search-kbd">Ctrl K</span>
            </div>
          </form>

          {/* Autocomplete Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="search-suggestions-dropdown">
              <div style={{ padding: '4px 14px', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gợi ý kết quả
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
                      <Folder size={15} style={{ color: 'var(--primary-600)' }} />
                    ) : (
                      <File size={15} style={{ color: 'var(--text-muted)' }} />
                    )}
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="header-actions">
        {/* Toggle Inspector Panel */}
        <button
          className="btn-icon"
          onClick={toggleInspector}
          title="Bật / tắt bảng chi tiết Inspector"
        >
          <PanelRight size={17} />
        </button>

        {/* Theme Toggle */}
        <button
          className="btn-icon"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
        >
          {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        {/* User Profile Menu */}
        <div className="user-profile-menu" ref={userMenuRef}>
          <button
            className="user-avatar-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title="Tài khoản người dùng"
          >
            <div className="avatar-circle">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </div>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user?.name || 'Tài khoản'}
            </span>
          </button>

          {showUserMenu && (
            <div className="user-dropdown-menu">
              <div className="dropdown-user-info">
                <div className="dropdown-name">{user?.name}</div>
                <div className="dropdown-email">{user?.email}</div>
                {user?.role && (
                  <span className="badge badge-purple" style={{ marginTop: '5px' }}>
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
                <User size={15} />
                <span>Hồ sơ cá nhân</span>
              </button>

              <button
                className="dropdown-item"
                onClick={() => {
                  setShowUserMenu(false);
                  navigate('/settings/change-password');
                }}
              >
                <Key size={15} />
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
                  <Shield size={15} />
                  <span>Quản trị người dùng</span>
                </button>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

              <button className="dropdown-item danger" onClick={handleLogout}>
                <LogOut size={15} />
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
