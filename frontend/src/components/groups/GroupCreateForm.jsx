import PropTypes from 'prop-types';

export default function GroupCreateForm({
  users,
  currentUserId,
  groupName,
  onGroupNameChange,
  selectedMembers,
  onToggleMember,
  onSubmit,
  isBusy,
}) {
  if (!currentUserId) return null;
  return (
    <div className="card">
      <h3>Novo grupo</h3>
      <form onSubmit={onSubmit} className="form">
        <label>
          Nome do grupo
          <input
            type="text"
            value={groupName}
            onChange={(e) => onGroupNameChange(e.target.value)}
            placeholder="Ex.: Squad Segurança"
          />
        </label>
        <span className="hint">Selecione os participantes (você é incluído automaticamente).</span>
        <div className="members-grid">
          {users
            .filter((user) => user.id !== currentUserId)
            .map((user) => (
              <label key={user.id} className="member-option">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(user.id)}
                  onChange={() => onToggleMember(user.id)}
                />
                {user.username}
              </label>
            ))}
        </div>
        <button type="submit" disabled={isBusy}>
          Criar grupo e compartilhar chave 3DES
        </button>
      </form>
    </div>
  );
}

GroupCreateForm.propTypes = {
  users: PropTypes.array.isRequired,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  groupName: PropTypes.string.isRequired,
  onGroupNameChange: PropTypes.func.isRequired,
  selectedMembers: PropTypes.arrayOf(
    PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  ).isRequired,
  onToggleMember: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  isBusy: PropTypes.bool.isRequired,
};
