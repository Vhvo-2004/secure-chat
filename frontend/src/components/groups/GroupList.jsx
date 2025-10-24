import PropTypes from 'prop-types';

export default function GroupList({ groups, groupKeys, selectedGroupId, onSelectGroup, renderActions }) {
  if (!groups.length) return null;
  return (
    <div className="card">
      <h3>Grupos</h3>
      <ul className="list groups">
        {groups.map((group) => {
          const keyInfo = groupKeys[group.id];
          const missingKey = !keyInfo;
          return (
            <li
              key={group.id}
              className={group.id === selectedGroupId ? 'active' : ''}
              onClick={() => onSelectGroup(group.id)}
            >
              <div className="group-title">{group.name}</div>
              <div className="group-meta">
                <span>Membros: {group.members?.length ?? 0}</span>
                <span>
                  Chave: {missingKey ? 'aguardando' : keyInfo.fingerprint}
                  {group.keyFingerprint && !missingKey && keyInfo.fingerprint !== group.keyFingerprint ? ' ⚠' : ''}
                </span>
              </div>
              {renderActions ? (
                <div className="group-actions" onClick={(event) => event.stopPropagation()}>
                  {renderActions(group)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

GroupList.propTypes = {
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string.isRequired,
      members: PropTypes.array,
      keyFingerprint: PropTypes.string,
    }),
  ).isRequired,
  groupKeys: PropTypes.object.isRequired,
  selectedGroupId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSelectGroup: PropTypes.func.isRequired,
  renderActions: PropTypes.func,
};

GroupList.defaultProps = {
  renderActions: undefined,
};
