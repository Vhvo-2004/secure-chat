import PropTypes from 'prop-types';

export default function CryptoLog({ entries }) {
  return (
    <section className="column full">
      <div className="card log-card">
        <h3>Diário criptográfico</h3>
        {entries.length === 0 ? (
          <p>
            Os detalhes de X3DH e 3DES aparecerão aqui assim que você gerar identidades, compartilhar convites ou
            enviar mensagens.
          </p>
        ) : (
          <ul className="log-list">
            {entries.map((entry) => (
              <li key={entry.id} className="log-entry">
                <div className="log-header">
                  <div className="log-header-main">
                    <span className="log-phase">{entry.phase}</span>
                    <span className="log-title">{entry.title}</span>
                  </div>
                  <time>{new Date(entry.timestamp).toLocaleString()}</time>
                </div>
                {entry.description && <p>{entry.description}</p>}
                {entry.reason && (
                  <p className="log-reason">
                    <strong>Por quê?</strong> {entry.reason}
                  </p>
                )}
                {Array.isArray(entry.artifacts) && entry.artifacts.length > 0 && (
                  <ul className="log-artifacts">
                    {entry.artifacts.map((artifact, index) => (
                      <li key={index}>
                        <strong>{artifact.label}:</strong> {artifact.value}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

CryptoLog.propTypes = {
  entries: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      phase: PropTypes.string,
      title: PropTypes.string,
      description: PropTypes.string,
      reason: PropTypes.string,
      timestamp: PropTypes.number,
      artifacts: PropTypes.arrayOf(
        PropTypes.shape({
          label: PropTypes.string,
          value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }),
      ),
    }),
  ).isRequired,
};
