import { Link } from 'react-router-dom';
import AppHeader from '../../components/layout/AppHeader';
import StatusBanner from '../../components/common/StatusBanner';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useSecureChatContext } from '../../contexts/SecureChatContext';

export default function GroupOverviewPage() {
  const {
    state: { currentUserData, status, isBusy, usernameInput },
    actions: { setUsernameInput, handleRegisterUser, handleLogout },
  } = useSecureChatContext();

  const sampleGroups = [
    { id: 'alpha', name: 'Alpha Team' },
    { id: 'beta', name: 'Beta Ops' },
  ];

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

      <div className="page-container">
        <h2>Explorar grupos</h2>
        <p>Esta é uma visão exemplo apenas para desenvolvimento. Integre com o backend quando estiver pronto.</p>
        <ul className="list">
          {sampleGroups.map((group) => (
            <li key={group.id} className="card">
              <h3>{group.name}</h3>
              <div className="group-actions">
                <Link to={`/groups/${group.id}/chat`}>Abrir chat</Link>
                <Link to={`/groups/${group.id}/members`}>Gerenciar membros</Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </DashboardLayout>
  );
}
