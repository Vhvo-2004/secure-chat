import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../../components/layout/AppHeader';
import StatusBanner from '../../components/common/StatusBanner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import GroupCreateForm from '../../components/groups/GroupCreateForm';
import GroupList from '../../components/groups/GroupList';
import { useSecureChatContext } from '../../contexts/SecureChatContext';

export default function GroupOverviewPage() {
  const {
    state: {
      currentUserData,
      status,
      isBusy,
      usernameInput,
      users,
      groups,
      groupKeys,
      selectedGroupId,
      groupNameInput,
      groupMemberSelections,
    },
    actions: {
      setUsernameInput,
      handleRegisterUser,
      handleLogout,
      setGroupNameInput,
      toggleMemberSelection,
      handleCreateGroup,
      setSelectedGroupId,
    },
  } = useSecureChatContext();

  const navigate = useNavigate();

  const handleSelectGroup = (groupId) => {
    setSelectedGroupId(groupId);
    navigate(`/groups/${groupId}/chat`);
  };

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

      <div className="page-container groups-overview-page">
        <div className="page-header">
          <h2>Central de grupos</h2>
          <p>
            Crie novos espaços seguros, acompanhe os membros vinculados e acesse rapidamente o chat com o diário
            criptográfico compartilhado.
          </p>
        </div>

        <div className="groups-overview-content">
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
            onSelectGroup={handleSelectGroup}
            renderActions={(group) => (
              <>
                <Link to={`/groups/${group.id}/chat`}>Abrir chat</Link>
                <Link to={`/groups/${group.id}/members`}>Gerenciar membros</Link>
              </>
            )}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
