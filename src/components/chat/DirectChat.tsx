import { useState, useEffect, useRef, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Profile, DirectMessage } from '../../types';
import Avatar from '../ui/Avatar';
import StatusBadge from '../ui/StatusBadge';
import MessageBubble from './MessageBubble';

interface DirectChatProps {
  conversationId: string;
  otherUser: Profile;
}

export default function DirectChat({ conversationId, otherUser }: DirectChatProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('direct_messages')
      .select('*, sender:profiles(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [conversationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`dm-${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          (async () => {
            const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).maybeSingle();
            setMessages((prev) => [...prev, { ...payload.new as DirectMessage, sender }]);
          })();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  const sendMessage = async () => {
    if (!input.trim() || !profile) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    const optimisticMessage: DirectMessage = {
      id: Math.random().toString(),
      conversation_id: conversationId,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      sender: profile,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    await supabase.from('direct_messages').insert({ conversation_id: conversationId, sender_id: profile.id, content });
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full w-full md:w-full">
      <div className="px-4 md:px-6 py-4 border-b border-slate-800 flex items-center gap-3 bg-slate-900">
        <Avatar profile={otherUser} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-slate-100 font-semibold truncate">{otherUser.username}</div>
          <StatusBadge profile={otherUser} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-1 pb-20 md:pb-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Avatar profile={otherUser} size="lg" className="mb-4" />
            <div className="text-slate-100 font-semibold text-lg">{otherUser.username}</div>
            <p className="text-slate-500 text-sm mt-1">Start a conversation with {otherUser.username}</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.sender_id === profile?.id;
          const prevMsg = messages[i - 1];
          const showAvatar = !isMine && (i === 0 || prevMsg?.sender_id !== msg.sender_id);
          return (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              sender={msg.sender ?? otherUser}
              isMine={isMine}
              createdAt={msg.created_at}
              showAvatar={showAvatar}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="fixed md:static bottom-0 left-0 right-0 md:bottom-auto px-2 md:px-4 py-4 border-t border-slate-800 bg-slate-900">
        <div className="flex items-end gap-2 md:gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${otherUser.username}...`}
            rows={1}
            className="flex-1 resize-none px-3 md:px-4 py-2 md:py-3 bg-slate-800 border border-slate-700 rounded-lg md:rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-xs md:text-sm leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2.5 md:p-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg md:rounded-xl transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
