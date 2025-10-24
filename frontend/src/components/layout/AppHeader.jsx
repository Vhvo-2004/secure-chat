import PropTypes from 'prop-types';

export default function AppHeader({
  currentUser,
  usernameInput,
  onUsernameChange,
  onRegister,
  isBusy,
  onLogout,
}) {
  return (
    <header>
      <h1>Secure Chat · Sessões X3DH + 3DES</h1>
      {currentUser ? (
        <div className="user-info">
          <span>Conectado como {currentUser.username}</span>
          <button onClick={onLogout}>Encerrar sessão local</button>
        </div>
      ) : (
        <form onSubmit={onRegister} className="form inline">
          <input
            type="text"
            value={usernameInput}
            placeholder="Escolha um nome de usuário"
            onChange={(e) => onUsernameChange(e.target.value)}
          />
          <button type="submit" disabled={isBusy}>
            Gerar identidade &amp; registrar
          </button>
        </form>
      )}
    </header>
  );
}

AppHeader.propTypes = {
  currentUser: PropTypes.object,
  usernameInput: PropTypes.string.isRequired,
  onUsernameChange: PropTypes.func.isRequired,
  onRegister: PropTypes.func.isRequired,
  isBusy: PropTypes.bool.isRequired,
  onLogout: PropTypes.func.isRequired,
};
