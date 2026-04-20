import { useState, useEffect, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Profile, Group } from '../../types';
import Avatar from '../ui/Avatar';
import StatusBadge from '../ui/StatusBadge';
import Modal from '../ui/Modal';

interface AdminPanelProps {
  onClose: () => void;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<'users' | 'groups' | 'settings'>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [allowGroupCreation, setAllowGroupCreation] = useState(true);
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('registration_order');
    setUsers(data ?? []);
  }, []);

  const loadGroups = useCallback(async () => {
    const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
    setGroups(data ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'allow_group_creation').maybeSingle();
    setAllowGroupCreation(data?.value === 'true');
  }, []);

  useEffect(() => {
    loadUsers();
    loadGroups();
    loadSettings();
  }, [loadUsers, loadGroups, loadSettings]);

  const toggleGroupCreation = async () => {
    setLoading(true);
    await supabase
      .from('app_settings')
      .update({ value: allowGroupCreation ? 'false' : 'true' })
      .eq('key', 'allow_group_creation');
    setAllowGroupCreation(!allowGroupCreation);
    setLoading(false);
  };

  const deleteGroup = async (groupId: string) => {
    if (!window.confirm('Delete this group permanently?')) return;
    await supabase.from('groups').delete().eq('id', groupId);
    await loadGroups();
  };

  return (
    <Modal title="Admin Panel" onClose={onClose} maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex border-b border-slate-700">
          {(['users', 'groups', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors capitalize ${
                tab === t ? 'text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'users' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="text-sm text-slate-400 mb-3">Total users: {users.length}</div>
            {users.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-slate-900 rounded-lg">
                <Avatar profile={user} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-medium">{user.username}</div>
                  <StatusBadge profile={user} />
                </div>
                <div className="text-xs text-slate-500">#{user.registration_order}</div>
              </div>
            ))}
          </div>
        )}

        {tab === 'groups' && (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            <div className="text-sm text-slate-400 mb-3">Total groups: {groups.length}</div>
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-3 bg-slate-900 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="text-slate-100 font-medium">{group.name}</div>
                  <div className="text-xs text-slate-500">
                    {group.is_secret ? '🔒 Secret' : '🌐 Public'} • {group.created_at}
                  </div>
                </div>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="text-xs px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors flex-shrink-0"
                >
                  Delete
                </button>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-center text-slate-600 py-8 text-sm">No groups yet</p>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-100 font-medium">Allow Group Creation</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {allowGroupCreation
                      ? 'Users can create groups'
                      : 'Only you can create groups'}
                  </div>
                </div>
                <button
                  onClick={toggleGroupCreation}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    allowGroupCreation
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {allowGroupCreation ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900 rounded-lg border border-slate-700/50">
              <div className="text-sm text-slate-400">Info</div>
              <div className="text-xs text-slate-500 mt-2 space-y-1">
                <div>Total users: {users.length}</div>
                <div>Total groups: {groups.length}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
