import React from 'react';
import { MessageCircle, Radio, Phone, CircleUserRound, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface BottomNavProps {
  totalUnread?: number;
  missedCalls?: number;
  hasUnseenStatus?: boolean;
  isAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  totalUnread = 0,
  missedCalls = 0,
  hasUnseenStatus = false,
  isAdmin = false,
}) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0E2A6E] border-t border-white/15 pb-[env(safe-area-inset-bottom)]"
      aria-label="Bottom Navigation"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-14 px-1">
        {/* Chats */}
        <NavLink
          to="/chats"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
              isActive
                ? 'text-white font-bold'
                : 'text-white font-medium opacity-90'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <MessageCircle size={19} strokeWidth={2} aria-hidden="true" />
                {totalUnread > 0 && (
                  <span
                    className="absolute -top-1.5 -right-3 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-[#FFD700] text-[#1A1A2E] shadow-sm animate-fade-in"
                    aria-label={`${totalUnread} unread messages`}
                  >
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : ''}`}>Chats</span>
            </>
          )}
        </NavLink>

        {/* Channels (Feature 112) */}
        <NavLink
          to="/channels"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
              isActive
                ? 'text-[#0E2A6E] dark:text-[#3D6FE0] font-bold'
                : 'text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:text-black dark:hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Radio size={19} strokeWidth={2} aria-hidden="true" />
              <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : ''}`}>Channels</span>
            </>
          )}
        </NavLink>

        {/* Calls (Doc 07 Feature 13-16) */}
        <NavLink
          to="/calls"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
              isActive
                ? 'text-[#0E2A6E] dark:text-[#3D6FE0] font-bold'
                : 'text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:text-black dark:hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Phone size={19} strokeWidth={2} aria-hidden="true" />
                {missedCalls > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 text-[10px] font-extrabold rounded-full bg-rose-500 text-white shadow-sm">
                    {missedCalls}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : ''}`}>Calls</span>
            </>
          )}
        </NavLink>

        {/* Status / Stories (Doc 07 Feature 19-21) */}
        <NavLink
          to="/status"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
              isActive
                ? 'text-[#0E2A6E] dark:text-[#3D6FE0] font-bold'
                : 'text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:text-black dark:hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <span className="flex h-[19px] w-[19px] items-center justify-center rounded-full border-2 border-current text-[10px]" aria-hidden="true">●</span>
                {hasUnseenStatus && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-[#FFD700] ring-2 ring-white dark:ring-[#0B0F1A]" />
                )}
              </div>
              <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : ''}`}>Status</span>
            </>
          )}
        </NavLink>

        {/* Profile */}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
              isActive
                ? 'text-[#0E2A6E] dark:text-[#3D6FE0] font-bold'
                : 'text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:text-black dark:hover:text-white'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <CircleUserRound size={19} strokeWidth={2} aria-hidden="true" />
              <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : ''}`}>Profile</span>
            </>
          )}
        </NavLink>

        {/* Admin Console */}
        {isAdmin && (
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive
                  ? 'text-[#0E2A6E] dark:text-[#3D6FE0] font-bold'
                  : 'text-[#4B5563] dark:text-[#9CA3AF] font-medium hover:text-black dark:hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <ShieldCheck size={19} strokeWidth={2} aria-hidden="true" />
                <span className={`text-[11px] mt-1 ${isActive ? 'font-bold' : ''}`}>Admin</span>
              </>
            )}
          </NavLink>
        )}
      </div>
    </nav>
  );
};
