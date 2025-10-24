import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import AppHeader from '../../components/layout/AppHeader';
import StatusBanner from '../../components/common/StatusBanner';
import ChatPanel from '../../components/chat/ChatPanel';
import CryptoLog from '../../components/logs/CryptoLog';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useSecureChatContext } from '../../contexts/SecureChatContext';

export default function GroupChatPage() {
  const { groupId } = useParams();
  const {
    state: {
      currentUserData,
      groups,
      users,
      messages,
      messageInput,
      cryptoLog,
      status,
      isBusy,
      usernameInput,
    },
    actions: {
      setSelectedGroupId,
      setMessageInput,
      handleSendMessage,
      resolveGroupKey,
      setUsernameInput,
      handleRegisterUser,
      handleLogout,
    },
  } = useSecureChatContext();

  useEffect(() => {
    if (groupId) {
      setSelectedGroupId(groupId);
    }
  }, [groupId, setSelectedGroupId]);

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === groupId) ?? null,
    [groups, groupId],
  );

  const groupKey = selectedGroup ? resolveGroupKey(selectedGroup.id) : null;

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

      <div className="page-container group-chat-page">
        <div className="page-header">
          <h2>Conversas seguras · {selectedGroup?.name ?? groupId}</h2>
          <p>
            Acompanhe o chat em tempo real enquanto o diário criptográfico apresenta cada operação das chaves e das
            mensagens cifradas.
          </p>
        </div>

        <div className="group-chat-layout">
          <div className="chat-column">
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
          </div>
          <aside className="log-column">
            <CryptoLog entries={cryptoLog} />
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
