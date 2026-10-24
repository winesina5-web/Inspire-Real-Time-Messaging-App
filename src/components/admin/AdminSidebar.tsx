import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const AdminSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { label: 'Overview', to: '/admin', icon: '📊', end: true },
    { label: 'Users', to: '/admin/users', icon: '👥' },
    { label: 'Reports', to: '/admin/reports', icon: '🚩' },
    { label: 'Moderation Rules', to: '/admin/moderation-rules', icon: '🛡️' },
    { label: 'Support Helpdesk', to: '/admin/support', icon: '🎧' },
    { label: 'Chat Inspector', to: '/admin/chats/usr_jordan', icon: '💬' },
    { label: 'Channels', to: '/admin/channels', icon: '📣' },
    { label: 'Analytics', to: '/admin/analytics', icon: '📈' },
    { label: 'Broadcast', to: '/admin/broadcast', icon: '📢' },
    { label: 'User Appeals', to: '/admin/appeals', icon: '⚖️' },
    { label: 'Scheduled Queue', to: '/admin/scheduled-broadcasts', icon: '📅' },
    { label: 'Feature Flags', to: '/admin/feature-flags', icon: '🚩' },
    { label: 'Settings', to: '/admin/settings', icon: '⚙️' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0B0F1A] text-black dark:text-white flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-[#161B2B] border-b border-[#E5E7EB] dark:border-[#2A3348] sticky top-0 z-40">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center font-black">
            🛡️
          </div>
          <span className="font-extrabold text-sm tracking-tight">Inspire Admin</span>
        </div>
        <button
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm"
          aria-label="Toggle navigation drawer"
        >
          {isMobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#161B2B] border-r border-[#E5E7EB] dark:border-[#2A3348] flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Logo brand */}
          <div className="p-6 border-b border-[#E5E7EB] dark:border-[#2A3348] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-2xl bg-[#0E2A6E] text-[#FFD700] flex items-center justify-center font-black shadow-md">
                🛡️
              </div>
              <div>
                <h2 className="font-black text-sm text-black dark:text-white leading-tight">
                  Inspire Console
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#FFD700] bg-[#0E2A6E] px-1.5 py-0.2 rounded">
                  Admin Tier
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="md:hidden p-1 text-gray-400"
            >
              ✕
            </button>
          </div>

          {/* Links list */}
          <nav className="p-3 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setIsMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#0E2A6E] text-white shadow-sm'
                      : 'text-[#4B5563] dark:text-[#9CA3AF] hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-black dark:hover:text-white'
                  }`
                }
              >
                <span className="text-base select-none">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#E5E7EB] dark:border-[#2A3348] space-y-2">
          <div className="flex items-center space-x-2.5 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-[#0E2A6E] text-white flex items-center justify-center text-xs font-bold">
              {user?.display_name?.[0] || 'A'}
            </div>
            <div className="min-w-0">
              <p className="font-bold text-xs truncate">{user?.display_name}</p>
              <p className="text-[10px] text-gray-400 truncate">@{user?.username}</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/chats')}
            className="w-full py-2 px-3 rounded-xl border border-[#0E2A6E] dark:border-[#3D6FE0] text-[#0E2A6E] dark:text-[#3D6FE0] text-xs font-bold hover:bg-[#0E2A6E] hover:text-white transition-colors"
          >
            ← Back to Messenger
          </button>
        </div>
      </aside>

      {/* Main Panel Content Container */}
      <div className="flex-1 overflow-x-hidden p-4 sm:p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </div>
    </div>
  );
};
