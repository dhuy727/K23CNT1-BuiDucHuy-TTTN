import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Folder, Sparkles, Settings } from 'lucide-react';

const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleOpenAi = () => {
    window.dispatchEvent(
      new CustomEvent('open-rag-drawer', {
        detail: { scope: { type: 'all', targetId: null, name: 'Toàn bộ Drive' } }
      })
    );
  };

  const navItems = [
    {
      id: 'home',
      label: 'Trang chủ',
      icon: Home,
      path: '/home',
      isActive: location.pathname === '/home' || location.pathname === '/'
    },
    {
      id: 'drive',
      label: 'Drive',
      icon: Folder,
      path: '/drive',
      isActive: location.pathname.startsWith('/drive')
    },
    {
      id: 'ai',
      label: 'Hỏi AI',
      icon: Sparkles,
      onClick: handleOpenAi,
      isAction: true,
      isActive: false
    },
    {
      id: 'settings',
      label: 'Cài đặt',
      icon: Settings,
      path: '/settings/profile',
      isActive: location.pathname.startsWith('/settings')
    }
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Thanh điều hướng chính di động">
      <div className="bottom-nav-items">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          if (item.isAction) {
            return (
              <button
                key={item.id}
                type="button"
                className={`bottom-nav-item ${item.isActive ? 'active' : ''}`}
                onClick={item.onClick}
                aria-label={item.label}
              >
                <div className="bottom-nav-icon">
                  <IconComponent size={20} />
                </div>
                <span className="bottom-nav-label">{item.label}</span>
              </button>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              className={`bottom-nav-item ${item.isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
            >
              <div className="bottom-nav-icon">
                <IconComponent size={20} />
              </div>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ios-home-indicator" aria-hidden="true" />
    </nav>
  );
};

export default BottomNavigation;
