import { useParams } from 'react-router-dom';

const sampleMembers = [
  { id: 'alice', name: 'Alice', role: 'Líder' },
  { id: 'bob', name: 'Bob', role: 'Membro' },
  { id: 'carol', name: 'Carol', role: 'Membro' },
];

export default function GroupMembersPage() {
  const { groupId } = useParams();

  return (
    <div className="page-container">
      <h2>Gerenciar membros · {groupId}</h2>
      <p>
        Este módulo demonstra como a tela de administração pode funcionar. Conecte-se à API para listar membros reais e
        permitir convites ou remoções.
      </p>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Integrante</th>
              <th>Função</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sampleMembers.map((member) => (
              <tr key={member.id}>
                <td>{member.name}</td>
                <td>{member.role}</td>
                <td className="table-actions">
                  {member.role === 'Líder' ? (
                    <button disabled>Responsável</button>
                  ) : (
                    <>
                      <button className="danger">Remover</button>
                      <button>Promover a líder</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3>Adicionar novo participante</h3>
        <form className="form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Usuário
            <input type="text" placeholder="Digite o usuário para convidar" />
          </label>
          <button type="submit">Enviar convite</button>
        </form>
      </div>
    </div>
  );
}
