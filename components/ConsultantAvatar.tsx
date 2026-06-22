import React from 'react';
import type { Personnel } from '../types';

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-14 h-14 text-base',
  lg: 'w-20 h-20 text-xl',
  xl: 'w-28 h-28 text-2xl',
};

interface Props {
  person?: Personnel | null;
  name?: string;
  avatarUrl?: string;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}

export const ConsultantAvatar: React.FC<Props> = ({
  person, name, avatarUrl, size = 'md', className = '', ring = false,
}) => {
  const displayName = name || person?.fullName || '?';
  const src = avatarUrl || person?.avatar;
  const ringClass = ring ? 'ring-2 ring-white shadow-md' : 'border border-gray-200';
  return (
    <div className={`${SIZES[size]} rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center ${ringClass} ${className}`}>
      {src ? (
        <img src={src} alt={displayName} className="w-full h-full object-cover" />
      ) : (
        <span className="font-bold text-violet-700">{displayName.charAt(0)}</span>
      )}
    </div>
  );
};
