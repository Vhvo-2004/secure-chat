import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import Modal from '../ui/Modal.jsx';
import Alert from '../ui/Alert.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { createGroup, fetchGroups } from '../../services/api.js';

const STUB_GROUPS = [
  { id: 'stub-1', name: 'Equipe de Desenvolvimento', members: ['João', 'Maria', 'Pedro'] },
  { id: 'stub-2', name: 'Projeto Alpha', members: ['Ana', 'Carlos'] },
  { id: 'stub-3', name: 'Discussão Geral', members: ['João', 'Maria', 'Ana', 'Carlos', 'Pedro'] },
];

export default function GroupList({ selectedGroupId, onSelectGroup }) {
  const { user } = useAuth();
  const [groups, setGroups] = useState(STUB_GROUPS);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [status, setStatus] = useState({ type: 'stub', message: 'Utilizando dados de demonstração.' });
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadGroups() {
      if (!user) return;
      try {
        const data = await fetchGroups(user.id);
        if (!Array.isArray(data) || data.length === 0) {
          if (isMounted) {
            setStatus({ type: 'stub', message: 'Nenhum grupo encontrado no backend. Exibindo exemplos.' });
            setGroups(STUB_GROUPS);
          }
          return;
        }
        if (isMounted) {
          const normalized = data.map((item) => ({
            id: item.id || item._id || crypto.randomUUID(),
            name: item.name || 'Grupo sem nome',
            members: Array.isArray(item.members) ? item.members : [],
          }));
          setGroups(normalized);
          setStatus({ type: 'api', message: 'Grupos carregados a partir do backend.' });
        }
      } catch (error) {
        console.info('Falha ao carregar grupos do backend, utilizando dados estáticos.', error);
        if (isMounted) {
          setStatus({ type: 'stub', message: 'Backend indisponível. Utilizando grupos de exemplo.' });
          setGroups(STUB_GROUPS);
        }
      }
    }

    loadGroups();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const filteredGroups = useMemo(() => {
    if (!search) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(search.toLowerCase()));
  }, [groups, search]);

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setErrorMessage('Informe um nome para o grupo.');
      return;
    }

    if (status.type === 'api' && user) {
      try {
        const created = await createGroup({ name, creator: user.id, members: [], keyFingerprint: null });
        const normalized = {
          id: created.id || created._id || crypto.randomUUID(),
          name: created.name || name,
          members: Array.isArray(created.members) ? created.members : [],
        };
        setGroups((prev) => [normalized, ...prev]);
        setNewGroupName('');
        setErrorMessage('');
        setIsModalOpen(false);
        return;
      } catch (error) {
        console.info('Falha ao criar grupo no backend, caindo para stub.', error);
        setStatus({ type: 'stub', message: 'Backend indisponível. Utilizando grupos locais.' });
      }
    }

    const fallbackGroup = {
      id: crypto.randomUUID(),
      name,
      members: user ? [user.username] : [],
    };
    setGroups((prev) => [fallbackGroup, ...prev]);
    setNewGroupName('');
    setErrorMessage('');
    setIsModalOpen(false);
  };

  return (
    <div className="group-panel">
      <div className="group-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Grupos</h2>
            <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
              {status.message}
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setIsModalOpen(true)} aria-label="Criar novo grupo">
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
              onClick={() => onSelectGroup(group)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onSelectGroup(group);
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

      <Modal
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setErrorMessage('');
        }}
        title="Criar novo grupo"
        description={
          status.type === 'api'
            ? 'O grupo será criado no backend se o serviço estiver disponível.'
            : 'O backend não oferece suporte no momento. Este grupo ficará apenas nesta sessão.'
        }
        footer={
          <Button onClick={handleCreateGroup}>
            Criar grupo
          </Button>
        }
      >
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}
          <Input
            value={newGroupName}
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="Nome do grupo"
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

GroupList.propTypes = {
  selectedGroupId: PropTypes.string,
  onSelectGroup: PropTypes.func.isRequired,
};

