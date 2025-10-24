import AppHeader from '../components/layout/AppHeader';
import StatusBanner from '../components/common/StatusBanner';
import UserList from '../components/users/UserList';
import GroupCreateForm from '../components/groups/GroupCreateForm';
import GroupList from '../components/groups/GroupList';
import PendingSharesList from '../components/groups/PendingSharesList';
import CryptoLog from '../components/logs/CryptoLog';
import FriendInvitePanel from '../components/users/FriendInvitePanel';
import DashboardLayout from '../components/layout/DashboardLayout';
import { useSecureChatContext } from '../contexts/SecureChatContext';

export default function SecureChatPage() {
  const {
    state: {
      currentUserData,
      users,
      groups,
      groupKeys,
      pendingShares,
      selectedGroupId,
      status,
      isBusy,
      cryptoLog,
      usernameInput,
      groupNameInput,
      groupMemberSelections,
    },
    actions: {
      setUsernameInput,
      setGroupNameInput,
      toggleMemberSelection,
      setSelectedGroupId,
      handleRegisterUser,
      handleLogout,
      handleCreateGroup,
      handleShare,
    },
  } = useSecureChatContext();

  return (
    <DashboardLayout>
      <AppHeader
        currentUser={currentUserData}
        usernameInput={usernameInput}
        onUsernameChange={setUsernameInput}
        onRegister={handleRegisterUser}
        isBusy={isBusy}
        onLogout={handleLogout}
      />

      <StatusBanner message={status} />

      <div className="content-layout home-layout">
        <section className="content-column">
          <div className="stack">
            <UserList users={users} currentUserId={currentUserData?.id ?? null} />
            <FriendInvitePanel currentUser={currentUserData} />
            <PendingSharesList pendingShares={pendingShares} onAccept={handleShare} />
          </div>
        </section>

        <section className="content-column">
          <div className="stack">
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
          </div>
          <CryptoLog entries={cryptoLog} />
        </section>
      </div>
    </DashboardLayout>
  );
}
