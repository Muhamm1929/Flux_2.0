import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import Sidebar from './components/layout/Sidebar';
import DirectChat from './components/chat/DirectChat';
import GroupChat from './components/chat/GroupChat';
import CreateGroupModal from './components/groups/CreateGroupModal';
import JoinGroupModal from './components/groups/JoinGroupModal';
import AdminPanel from './components/layout/AdminPanel';
import { ChatView, Group, Profile } from './types';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeView, setActiveView] = useState<ChatView>({ type: 'empty' });
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showJoinGroup, setShowJoinGroup] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-lg bg-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  const handleGroupCreated = (groupId: string) => {
    setShowCreateGroup(false);
    // Group will appear in sidebar automatically
  };

  const handleGroupJoined = (group: Group) => {
    setShowJoinGroup(false);
    setActiveView({ type: 'group', groupId: group.id, group });
  };

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        onCreateGroup={() => setShowCreateGroup(true)}
        onJoinGroup={() => setShowJoinGroup(true)}
        onOpenAdmin={() => setShowAdmin(true)}
      />

      <div className="flex-1 bg-slate-900">
        {activeView.type === 'empty' && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
              <span className="text-4xl">💬</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-100 mb-2">Welcome to Flux</h1>
            <p className="text-slate-500 max-w-sm">
              Select a conversation or create a new group to get started
            </p>
          </div>
        )}

        {activeView.type === 'dm' && (
          <DirectChat conversationId={activeView.conversationId} otherUser={activeView.otherUser} />
        )}

        {activeView.type === 'group' && (
          <GroupChat
            group={activeView.group}
            groupId={activeView.groupId}
            onBack={() => setActiveView({ type: 'empty' })}
          />
        )}
      </div>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={handleGroupCreated} />
      )}
      {showJoinGroup && <JoinGroupModal onClose={() => setShowJoinGroup(false)} onJoined={handleGroupJoined} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
