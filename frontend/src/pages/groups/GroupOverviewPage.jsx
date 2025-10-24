import { Link } from 'react-router-dom';

export default function GroupOverviewPage() {
  const sampleGroups = [
    { id: 'alpha', name: 'Alpha Team' },
    { id: 'beta', name: 'Beta Ops' },
  ];

  return (
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
  );
}
