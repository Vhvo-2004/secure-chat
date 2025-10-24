import PropTypes from 'prop-types';

export default function UserList({ users, currentUserId }) {
  if (!currentUserId) return null;
  const others = users.filter((u) => u.id !== currentUserId);
  if (others.length === 0) return null;
  return (
    <div className="card">
      <h3>Usuários cadastrados</h3>
      <ul className="list">
        {others.map((user) => (
          <li key={user.id}>{user.username}</li>
        ))}
      </ul>
    </div>
  );
}

UserList.propTypes = {
  users: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      username: PropTypes.string.isRequired,
    }),
  ).isRequired,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
