import PropTypes from 'prop-types';

export default function PendingSharesList({ pendingShares, onAccept }) {
  if (!pendingShares.length) return null;
  return (
    <div className="card">
      <h3>Convites pendentes</h3>
      <ul className="list">
        {pendingShares.map((share) => {
          const groupInfo = typeof share.group === 'object' ? share.group : null;
          return (
            <li key={share.id} className="share-item">
              <div>
                <strong>{groupInfo?.name ?? 'Grupo'}</strong>
                <div className="share-meta">
                  Enviado por {share.sender?.username ?? share.sender}
                  {groupInfo?.keyFingerprint && <span> · Fingerprint: {groupInfo.keyFingerprint}</span>}
                </div>
              </div>
              <button onClick={() => onAccept(share.id)}>Importar chave</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

PendingSharesList.propTypes = {
  pendingShares: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      sender: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
      group: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    }),
  ).isRequired,
  onAccept: PropTypes.func.isRequired,
};
