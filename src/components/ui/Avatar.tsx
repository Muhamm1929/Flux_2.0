import { Profile } from '../../types';

interface AvatarProps {
  profile: Profile;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-xl',
};

export default function Avatar({ profile, size = 'md', className = '' }: AvatarProps) {
  const initial = profile.username.charAt(0).toUpperCase();
  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: profile.avatar_color }}
    >
      {initial}
    </div>
  );
}
