import React from 'react';
import { getAvatarColor } from '../utils/helpers';

interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: 'w-7 h-7 text-xs',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base font-semibold',
  xl: 'w-20 h-20 text-xl font-bold',
};

const dotSizeClasses = {
  xs: 'w-2 h-2 bottom-0 right-0 border',
  sm: 'w-2.5 h-2.5 bottom-0 right-0 border-2',
  md: 'w-3 h-3 bottom-0.5 right-0.5 border-2',
  lg: 'w-3.5 h-3.5 bottom-0.5 right-0.5 border-2',
  xl: 'w-4 h-4 bottom-1 right-1 border-2',
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  showOnlineStatus = false,
  className = '',
}) => {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const colors = getAvatarColor(name || 'inspire');

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full select-none ${className}`}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className={`${sizeClasses[size]} rounded-full object-cover border border-[#E5E7EB] dark:border-[#2A3348]`}
          onError={(e) => {
            // If image fails to load, hide image and show initials fallback
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : null}

      {!avatarUrl && (
        <div
          style={{ backgroundColor: colors.bg, color: colors.text }}
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold tracking-tight shadow-sm`}
          aria-hidden="true"
        >
          {initials || '?'}
        </div>
      )}

      {showOnlineStatus && (
        <span
          className={`absolute rounded-full border-white dark:border-[#161B2B] ${
            isOnline ? 'bg-[#16A34A] dark:bg-[#22C55E]' : 'bg-gray-400 dark:bg-gray-600'
          } ${dotSizeClasses[size]}`}
          title={isOnline ? 'Online' : 'Offline'}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
};
