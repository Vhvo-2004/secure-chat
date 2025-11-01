import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Label from '../components/ui/Label.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import './auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim()) {
      setError('Informe o usuário cadastrado.');
      return;
    }
    const result = login(username, password);
    if (!result.success) {
      setError(result.message);
      return;
    }
    navigate('/home');
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card">
        <CardHeader>
          <div className="auth-icon" aria-hidden>🔒</div>
          <CardTitle>Bem-vindo de volta</CardTitle>
          <CardDescription>Entre com suas credenciais para acessar o chat seguro.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="form-grid">
            {error ? <Alert variant="error">{error}</Alert> : null}
            <div>
              <Label htmlFor="login-username">Usuário</Label>
              <div className="input-icon">
                <span>👤</span>
                <Input
                  id="login-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Digite seu usuário"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="login-password">Senha</Label>
              <div className="input-icon">
                <span>🔑</span>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                />
              </div>
            </div>
            <Button type="submit">Entrar</Button>
          </form>
          <div className="auth-footer">
            Não tem uma conta?
            <Link className="link" to="/register">
              Registre-se
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

