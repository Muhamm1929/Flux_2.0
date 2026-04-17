import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, Users, Search, Plus, LogOut,
  Settings, Lock, Hash, ChevronDown, ChevronRight, Shield
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Profile, Conversation, Group, ChatView } from '../../types';
import Avatar from '../ui/Avatar';
import StatusBadge from '../ui/StatusBadge';

interface SidebarProps {
  activeView: ChatView;
  onSelectView: (view: ChatView) => void;
  onCreateGroup: () => void;
  onJoinGroup: () => void;
  onOpenAdmin: () => void;
}

export default function Sidebar({ activeView, onSelectView, onCreateGroup, onJoinGroup, onOpenAdmin }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<'dms' | 'groups'>('dms');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [groupsOpen, setGroupsOpen] = useState(true);
  const [allowGroupCreation, setAllowGroupCreation] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant1_id.eq.${profile.id},participant2_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (!data) return;

    const withProfiles = await Promise.all(
      data.map(async (conv) => {
        const otherId = conv.participant1_id === profile.id ? conv.participant2_id : conv.participant1_id;
        const { data: other } = await supabase.from('profiles').select('*').eq('id', otherId).maybeSingle();
        const { data: lastMsg } = await supabase
          .from('direct_messages')
          .select('*')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        return { ...conv, other_user: other, last_message: lastMsg };
      })
    );
    setConversations(withProfiles);
  }, [profile]);

  const loadGroups = useCallback(async () => {
    if (!profile) return;
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('group_id, role')
      .eq('user_id', profile.id);

    if (!memberRows) return;

    const groupIds = memberRows.map((r) => r.group_id);
    if (groupIds.length === 0) { setGroups([]); return; }

    const { data: groupData } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .order('created_at', { ascending: false });

    if (!groupData) return;

    const roleMap = Object.fromEntries(memberRows.map((r) => [r.group_id, r.role]));
    setGroups(groupData.map((g) => ({ ...g, my_role: roleMap[g.id] })));
  }, [profile]);

  const loadAllUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('username');
    setAllUsers(data ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'allow_group_creation').maybeSingle();
    setAllowGroupCreation(data?.value === 'true');
  }, []);

  useEffect(() => {
    loadConversations();
    loadGroups();
    loadAllUsers();
    loadSettings();
  }, [loadConversations, loadGroups, loadAllUsers, loadSettings]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel('sidebar-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, loadConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, loadGroups)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, loadConversations)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile, loadConversations, loadGroups]);

  const startDM = async (otherUser: Profile) => {
    if (!profile) return;
    const { data: convId } = await supabase.rpc('get_or_create_conversation', { other_user_id: otherUser.id });
    setShowUserSearch(false);
    setSearch('');
    onSelectView({ type: 'dm', conversationId: convId, otherUser });
    await loadConversations();
  };

  const filteredUsers = allUsers.filter(
    (u) => u.id !== profile?.id && u.username.toLowerCase().includes(search.toLowerCase())
  );

  const canCreateGroup = profile?.is_developer || allowGroupCreation;

  return (
    <div className="w-72 h-full bg-slate-900 border-r border-slate-800 flex flex-col">
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">F</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">Flux</span>
        </div>
      </div>

      {profile && (
        <div className="p-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Avatar profile={profile} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="text-slate-100 font-medium text-sm truncate">{profile.username}</div>
              <StatusBadge profile={profile} />
            </div>
            <div className="flex items-center gap-1">
              {profile.is_developer && (
                <button
                  onClick={onOpenAdmin}
                  title="Admin Panel"
                  className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <Shield size={15} />
                </button>
              )}
              <button
                onClick={signOut}
                title="Sign out"
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setTab('dms')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'dms' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <MessageSquare size={15} />
          Messages
        </button>
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors ${
            tab === 'groups' ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Users size={15} />
          Groups
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'dms' && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                onClick={() => setDmsOpen(!dmsOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                {dmsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Direct Messages
              </button>
              <button
                onClick={() => setShowUserSearch(!showUserSearch)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                title="New message"
              >
                <Plus size={14} />
              </button>
            </div>

            {showUserSearch && (
              <div className="mb-2">
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-8 pr-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                {filteredUsers.slice(0, 8).map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDM(u)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
                  >
                    <Avatar profile={u} size="sm" />
                    <div>
                      <div className="text-sm text-slate-200">{u.username}</div>
                      <StatusBadge profile={u} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {dmsOpen && conversations.map((conv) => {
              const isActive = activeView.type === 'dm' && activeView.conversationId === conv.id;
              return (
                <button
                  key={conv.id}
                  onClick={() => conv.other_user && onSelectView({ type: 'dm', conversationId: conv.id, otherUser: conv.other_user })}
                  className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-colors text-left ${
                    isActive ? 'bg-blue-500/15 text-blue-300' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  {conv.other_user && <Avatar profile={conv.other_user} size="sm" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{conv.other_user?.username}</div>
                    {conv.last_message && (
                      <div className="text-xs text-slate-500 truncate">{conv.last_message.content}</div>
                    )}
                  </div>
                </button>
              );
            })}

            {dmsOpen && conversations.length === 0 && !showUserSearch && (
              <p className="text-xs text-slate-600 text-center py-4 px-2">
                Click + to start a conversation
              </p>
            )}
          </div>
        )}

        {tab === 'groups' && (
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                onClick={() => setGroupsOpen(!groupsOpen)}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider hover:text-slate-200 transition-colors"
              >
                {groupsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                My Groups
              </button>
              <div className="flex gap-1">
                <button
                  onClick={onJoinGroup}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                  title="Join group"
                >
                  <Search size={14} />
                </button>
                {canCreateGroup && (
                  <button
                    onClick={onCreateGroup}
                    className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                    title="Create group"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>

            {groupsOpen && groups.map((group) => {
              const isActive = activeView.type === 'group' && activeView.groupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => onSelectView({ type: 'group', groupId: group.id, group })}
                  className={`w-full flex items-center gap-2.5 px-2 py-2.5 rounded-xl transition-colors text-left ${
                    isActive ? 'bg-blue-500/15 text-blue-300' : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    group.is_secret ? 'bg-slate-700' : 'bg-blue-500/20'
                  }`}>
                    {group.is_secret
                      ? <Lock size={14} className="text-slate-400" />
                      : <Hash size={14} className="text-blue-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{group.name}</div>
                    <div className="text-xs text-slate-500 capitalize">{group.my_role}</div>
                  </div>
                </button>
              );
            })}

            {groupsOpen && groups.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4 px-2">
                No groups yet. Create or join one!
              </p>
            )}

            {!canCreateGroup && !profile?.is_developer && (
              <p className="text-xs text-slate-600 text-center py-2 px-2">
                Group creation is disabled
              </p>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={onJoinGroup}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Settings size={14} />
          Browse Groups
        </button>
      </div>
    </div>
  );
}
