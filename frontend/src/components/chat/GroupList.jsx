import { useMemo, useState } from 'react';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Modal from '../ui/Modal.jsx';
import Alert from '../ui/Alert.jsx';
import Badge from '../ui/Badge.jsx';
import { useSecureChatContext } from '../../contexts/SecureChatContext.jsx';

export default function GroupList() {
  const {
    state: { groups, selectedGroupId, users, currentUserData, pendingShares, status, isBusy },
    actions: { setSelectedGroupId, createGroup, acceptShare },
  } = useSecureChatContext();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [inviteFeedback, setInviteFeedback] = useState(null);

  const availableMembers = useMemo(() => {
    if (!currentUserData) return [];
    return users.filter((user) => user.id !== currentUserData.id);
  }, [users, currentUserData]);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups.filter((group) => group.name?.toLowerCase().includes(search.toLowerCase()));
  }, [groups, search]);

  const handleToggleMember = (memberId) => {
    setSelectedMembers((prev) => {
      if (prev.includes(memberId)) {
        return prev.filter((id) => id !== memberId);
      }
      return [...prev, memberId];
    });
  };

  const handleCreateGroup = async () => {
    setFeedback(null);
    const result = await createGroup(newGroupName, selectedMembers);
    if (!result.success) {
      setFeedback({ type: 'error', message: result.message ?? 'Não foi possível criar o grupo.' });
      return;
    }
    setFeedback({ type: 'success', message: 'Grupo criado e chaves distribuídas.' });
    setNewGroupName('');
    setSelectedMembers([]);
    setIsModalOpen(false);
  };

  const handleAcceptInvite = async (shareId) => {
    setInviteFeedback(null);
    const result = await acceptShare(shareId);
    if (!result.success) {
      setInviteFeedback({ type: 'error', message: result.message ?? 'Não foi possível aceitar o convite.' });
      return;
    }
    setInviteFeedback({ type: 'success', message: 'Convite aceito. A chave foi importada.' });
  };

  return (
    <div className="group-panel">
      <div className="group-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Grupos</h2>
            <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
              {status || 'Gerencie seus espaços seguros de conversa.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              setFeedback(null);
              setIsModalOpen(true);
            }}
            aria-label="Criar novo grupo"
            disabled={!currentUserData}
          >
            +
          </Button>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <Input
            placeholder="Buscar grupos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="group-list" style={{ overflowY: 'auto' }}>
        {filteredGroups.map((group) => {
          const isActive = group.id === selectedGroupId;
          const memberCount = Array.isArray(group.members) ? group.members.length : 0;
          return (
            <div
              key={group.id}
              className={`group-card ${isActive ? 'is-active' : ''}`.trim()}
              onClick={() => setSelectedGroupId(group.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedGroupId(group.id);
                }
              }}
            >
              <strong>{group.name}</strong>
              <span className="text-muted">{memberCount} membro{memberCount === 1 ? '' : 's'}</span>
            </div>
          );
        })}
        {filteredGroups.length === 0 ? (
          <div className="text-muted" style={{ textAlign: 'center', padding: '1rem 0' }}>
            Nenhum grupo corresponde à sua busca.
          </div>
        ) : null}
      </div>

      <section style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Convites pendentes</h3>
          <Badge variant="outline">{pendingShares.length}</Badge>
        </div>
        <p className="text-muted" style={{ margin: '0.25rem 0 0' }}>
          Aceite envelopes X3DH para acessar novas chaves de grupo.
        </p>
        {inviteFeedback ? <Alert variant={inviteFeedback.type}>{inviteFeedback.message}</Alert> : null}
        <div className="pending-list">
          {pendingShares.length === 0 ? (
            <div className="text-muted" style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Nenhum convite aguardando.
            </div>
          ) : (
            pendingShares.map((share) => (
              <div key={share.id} className="pending-item">
                <div>
                  <strong>{share.group?.name ?? 'Grupo'}</strong>
                  <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                    De {share.sender?.username ?? 'Remetente desconhecido'}
                  </div>
                </div>
                <Button size="sm" onClick={() => handleAcceptInvite(share.id)} disabled={isBusy}>
                  Aceitar chave
                </Button>
              </div>
            ))
          )}
        </div>
      </section>

      <Modal
        open={isModalOpen}
        onClose={() => {
          if (isBusy) return;
          setIsModalOpen(false);
          setFeedback(null);
          setSelectedMembers([]);
        }}
        title="Criar novo grupo"
        description={
          currentUserData
            ? 'Selecione os participantes que receberão a chave 3DES automaticamente.'
            : 'Cadastre sua identidade antes de criar grupos.'
        }
        footer={
          <Button onClick={handleCreateGroup} disabled={isBusy || !currentUserData}>
            Criar grupo
          </Button>
        }
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {feedback ? <Alert variant={feedback.type}>{feedback.message}</Alert> : null}
          <Input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="Nome do grupo"
            autoFocus
            disabled={isBusy}
          />
          <div style={{ display: 'grid', gap: '0.5rem', maxHeight: '12rem', overflowY: 'auto' }}>
            {availableMembers.length === 0 ? (
              <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                Nenhum outro usuário disponível no momento.
              </div>
            ) : (
              availableMembers.map((member) => {
                const checked = selectedMembers.includes(member.id);
                return (
                  <label key={member.id} className="member-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleMember(member.id)}
                      disabled={isBusy}
                    />
                    <span>{member.username}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
