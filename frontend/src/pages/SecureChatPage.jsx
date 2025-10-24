import AppHeader from '../components/layout/AppHeader';
import StatusBanner from '../components/common/StatusBanner';
import UserList from '../components/users/UserList';
import GroupCreateForm from '../components/groups/GroupCreateForm';
import GroupList from '../components/groups/GroupList';
import PendingSharesList from '../components/groups/PendingSharesList';
import ChatPanel from '../components/chat/ChatPanel';
import CryptoLog from '../components/logs/CryptoLog';
import { useSecureChat } from '../hooks/useSecureChat';

export default function SecureChatPage() {
  const {
    state: {
      currentUserData,
      users,
      groups,
      groupKeys,
      pendingShares,
      selectedGroupId,
      messages,
      status,
      isBusy,
      cryptoLog,
      usernameInput,
      groupNameInput,
      groupMemberSelections,
      messageInput,
      selectedGroup,
    },
    actions: {
      setUsernameInput,
      setGroupNameInput,
      toggleMemberSelection,
      setMessageInput,
      setSelectedGroupId,
      handleRegisterUser,
      handleLogout,
      handleCreateGroup,
      handleSendMessage,
      handleShare,
      resolveGroupKey,
    },
  } = useSecureChat();

  const groupKey = selectedGroup ? resolveGroupKey(selectedGroup.id) : null;

  return (
    <div className="app-container">
      <AppHeader
        currentUser={currentUserData}
        usernameInput={usernameInput}
        onUsernameChange={setUsernameInput}
        onRegister={handleRegisterUser}
        isBusy={isBusy}
        onLogout={handleLogout}
      />

      <StatusBanner message={status} />

      <main>
        <section className="column">
          <UserList users={users} currentUserId={currentUserData?.id ?? null} />
          <PendingSharesList pendingShares={pendingShares} onAccept={handleShare} />
        </section>
        <section className="column">
          <GroupCreateForm
            users={users}
            currentUserId={currentUserData?.id ?? null}
            groupName={groupNameInput}
            onGroupNameChange={setGroupNameInput}
            selectedMembers={groupMemberSelections}
            onToggleMember={toggleMemberSelection}
            onSubmit={handleCreateGroup}
            isBusy={isBusy}
          />
          <GroupList
            groups={groups}
            groupKeys={groupKeys}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        </section>
        <section className="column wide">
          <ChatPanel
            currentUser={currentUserData}
            selectedGroup={selectedGroup}
            messages={messages}
            users={users}
            messageInput={messageInput}
            onMessageChange={setMessageInput}
            onSendMessage={handleSendMessage}
            groupKey={groupKey}
          />
        </section>
        <CryptoLog entries={cryptoLog} />
      </main>
    </div>
  );
}
