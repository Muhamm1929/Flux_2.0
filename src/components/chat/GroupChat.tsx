import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Settings, Users, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Group, GroupMessage, GroupMember, Profile } from '../../types';
import Avatar from '../ui/Avatar';
import MessageBubble from './MessageBubble';
import Modal from '../ui/Modal';

interface GroupChatProps {
  group: Group;
  groupId: string;
  onBack: () => void;
}

export default function GroupChat({ group, groupId, onBack }: GroupChatProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const myRole = members.find((m) => m.user_id === profile?.id)?.role;

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('group_messages')
      .select('*, sender:profiles(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
  }, [groupId]);

  const loadMembers = useCallback(async () => {
    const { data } = await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId);
    setMembers(data ?? []);
  }, [groupId]);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('username');
    setAllUsers(data ?? []);
  }, []);

  useEffect(() => {
    loadMessages();
    loadMembers();
    loadAllUsers();
  }, [loadMessages, loadMembers, loadAllUsers]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`group-${groupId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        (payload) => {
          (async () => {
            const { data: sender } = await supabase.from('profiles').select('*').eq('id', payload.new.sender_id).maybeSingle();
            setMessages((prev) => [...prev, { ...payload.new as GroupMessage, sender }]);
          })();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group_members', filter: `group_id=eq.${groupId}` },
        loadMembers
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId, loadMembers]);

  const sendMessage = async () => {
    if (!input.trim() || !profile) return;
    setSending(true);
    const content = input.trim();
    setInput('');

    const optimisticMessage: GroupMessage = {
      id: Math.random().toString(),
      group_id: groupId,
      sender_id: profile.id,
      content,
      created_at: new Date().toISOString(),
      sender: profile,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    await supabase.from('group_messages').insert({ group_id: groupId, sender_id: profile.id, content });
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const addMember = async (userId: string) => {
    await supabase.from('group_members').insert({ group_id: groupId, user_id: userId, role: 'member' });
    await loadMembers();
    setShowAddMember(false);
  };

  const removeMember = async (userId: string) => {
    await supabase.from('group_members').delete().match({ group_id: groupId, user_id: userId });
    await loadMembers();
  };

  const updateRole = async (userId: string, role: string) => {
    await supabase.from('group_members').update({ role }).match({ group_id: groupId, user_id: userId });
    await loadMembers();
  };

  const memberIds = new Set(members.map((m) => m.user_id));
  const availableUsers = allUsers.filter((u) => !memberIds.has(u.id));

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div>
          <div className="text-slate-100 font-semibold">{group.name}</div>
          {group.description && <div className="text-slate-500 text-sm">{group.description}</div>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMembers(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Users size={18} />
          </button>
          {myRole && ['creator', 'admin'].includes(myRole) && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <Settings size={18} />
            </button>
          )}
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-slate-500 text-sm">No messages yet. Start the conversation!</div>
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
              sender={msg.sender!}
              isMine={isMine}
              createdAt={msg.created_at}
              showAvatar={showAvatar}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-4 border-t border-slate-800">
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${group.name}...`}
            rows={1}
            className="flex-1 resize-none px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm leading-relaxed max-h-32 overflow-y-auto"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {showMembers && (
        <Modal title={`Members (${members.length})`} onClose={() => setShowMembers(false)}>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {members.map((mem) => (
              <div key={mem.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <Avatar profile={mem.profile!} size="sm" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-100 font-medium">{mem.profile?.username}</div>
                    <div className="text-xs text-slate-500 capitalize">{mem.role}</div>
                  </div>
                </div>
                {myRole && ['creator', 'admin'].includes(myRole) && mem.user_id !== profile?.id && (
                  <div className="flex items-center gap-1 ml-2">
                    {mem.role === 'member' && (
                      <button
                        onClick={() => updateRole(mem.user_id, 'admin')}
                        className="text-xs px-2 py-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                      >
                        Make Admin
                      </button>
                    )}
                    <button
                      onClick={() => removeMember(mem.user_id)}
                      className="text-xs px-2 py-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {myRole && ['creator', 'admin'].includes(myRole) && (
            <button
              onClick={() => setShowAddMember(true)}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus size={14} />
              Add Member
            </button>
          )}
        </Modal>
      )}

      {showAddMember && (
        <Modal title="Add Member" onClose={() => setShowAddMember(false)}>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {availableUsers.length === 0 && (
              <p className="text-center text-slate-600 py-4 text-sm">All users are already members</p>
            )}
            {availableUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => addMember(user.id)}
                className="w-full flex items-center gap-2.5 p-3 bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors text-left"
              >
                <Avatar profile={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-100 font-medium">{user.username}</div>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showSettings && myRole && ['creator', 'admin'].includes(myRole) && (
        <Modal title="Group Settings" onClose={() => setShowSettings(false)}>
          <div className="space-y-3">
            <div className="p-3 bg-slate-900 rounded-lg">
              <div className="text-sm text-slate-400">Group ID</div>
              <div className="text-slate-100 font-mono text-xs mt-1 break-all">{groupId}</div>
            </div>
            {group.is_secret && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="text-sm text-amber-400">Secret Group</div>
                <div className="text-xs text-amber-300/70 mt-1">Password: {group.group_password}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
