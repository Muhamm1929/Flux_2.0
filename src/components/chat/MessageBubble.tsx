import { Profile } from '../../types';
import Avatar from '../ui/Avatar';

interface MessageBubbleProps {
  content: string;
  sender: Profile;
  isMine: boolean;
  createdAt: string;
  showAvatar: boolean;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageBubble({ content, sender, isMine, createdAt, showAvatar }: MessageBubbleProps) {
  if (isMine) {
    return (
      <div className="flex justify-end mb-1">
        <div className="max-w-xs lg:max-w-md">
          <div className="bg-blue-500 text-white px-4 py-2.5 rounded-2xl rounded-br-md text-sm leading-relaxed">
            {content}
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-slate-600">{formatTime(createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 mb-1">
      <div className="w-8 flex-shrink-0">
        {showAvatar && <Avatar profile={sender} size="sm" />}
      </div>
      <div className="max-w-xs lg:max-w-md">
        {showAvatar && (
          <div className="text-xs text-slate-500 mb-1 ml-1">{sender.username}</div>
        )}
        <div className="bg-slate-700 text-slate-100 px-4 py-2.5 rounded-2xl rounded-bl-md text-sm leading-relaxed">
          {content}
        </div>
        <div className="mt-1 ml-1">
          <span className="text-xs text-slate-600">{formatTime(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}
