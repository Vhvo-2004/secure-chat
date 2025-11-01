import { useMemo } from 'react';
import Badge from '../ui/Badge.jsx';
import { useSecureChatContext } from '../../contexts/SecureChatContext.jsx';

function formatTimestamp(value) {
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch (error) {
    return '';
  }
}

export default function CryptoPanel() {
  const {
    state: { cryptoLog },
  } = useSecureChatContext();

  const entries = useMemo(() => cryptoLog ?? [], [cryptoLog]);

  return (
    <div className="crypto-panel">
      <div className="crypto-header">
        <h2 style={{ margin: 0 }}>Diário criptográfico</h2>
        <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
          Acompanhe cada etapa de geração de chaves, convites X3DH e envio de mensagens cifradas.
        </p>
      </div>
      <div className="crypto-body">
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            Eventos registrados <Badge variant="outline">{entries.length}</Badge>
          </h3>
          <p className="text-muted" style={{ margin: '0.35rem 0 1rem' }}>
            Este painel reflete as mesmas informações do antigo diário criptográfico, preservando fases, razões e artefatos.
          </p>
          <div className="crypto-log">
            {entries.length === 0 ? (
              <div className="text-muted">Nenhuma operação registrada ainda.</div>
            ) : (
              entries.map((entry) => (
                <article key={entry.id} className="crypto-log-item">
                  <header className="crypto-log-header">
                    <div className="crypto-log-title">
                      <span className="log-phase">{entry.phase}</span>
                      <strong>{entry.title}</strong>
                    </div>
                    <time>{formatTimestamp(entry.timestamp)}</time>
                  </header>
                  {entry.description ? <p>{entry.description}</p> : null}
                  {entry.reason ? (
                    <p className="log-reason">
                      <strong>Por quê?</strong> {entry.reason}
                    </p>
                  ) : null}
                  {Array.isArray(entry.artifacts) && entry.artifacts.length > 0 ? (
                    <ul className="log-artifacts">
                      {entry.artifacts.map((artifact, index) => (
                        <li key={index}>
                          <strong>{artifact.label}:</strong> {artifact.value}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
