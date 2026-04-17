import { Profile, getStatusLabel, StatusLabel } from '../../types';

interface StatusBadgeProps {
  profile: Profile;
  className?: string;
}

const statusStyles: Record<StatusLabel, string> = {
  Developer: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Pioneer: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  Explorer: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  Trailblazer: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  Member: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
};

export default function StatusBadge({ profile, className = '' }: StatusBadgeProps) {
  const label = getStatusLabel(profile);
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyles[label]} ${className}`}>
      {label}
    </span>
  );
}
