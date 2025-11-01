import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';
import Label from '../components/ui/Label.jsx';
import Alert from '../components/ui/Alert.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import './auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 4) {
      setError('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    const result = await register(username, password);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setSuccess('Conta criada com sucesso! Redirecionando...');
    setTimeout(() => navigate('/login'), 1500);
  };

  return (
    <div className="auth-wrapper">
      <Card className="auth-card">
        <CardHeader>
          <div className="auth-icon" aria-hidden>✨</div>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>Cadastre-se para acessar os recursos do chat criptografado.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="form-grid">
            {error ? <Alert variant="error">{error}</Alert> : null}
            {success ? <Alert variant="success">{success}</Alert> : null}
            <div>
              <Label htmlFor="register-username">Usuário</Label>
              <div className="input-icon">
                <span>👤</span>
                <Input
                  id="register-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Escolha um nome de usuário"
                  autoComplete="username"
                  disabled={Boolean(success)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="register-password">Senha</Label>
              <div className="input-icon">
                <span>🔑</span>
                <Input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Crie uma senha"
                  autoComplete="new-password"
                  disabled={Boolean(success)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="register-confirm">Confirmar senha</Label>
              <div className="input-icon">
                <span>✅</span>
                <Input
                  id="register-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  disabled={Boolean(success)}
                />
              </div>
            </div>
            <Button type="submit" disabled={Boolean(success)}>
              Registrar
            </Button>
          </form>
          <div className="auth-footer">
            Já possui conta?
            <Link className="link" to="/login">
              Faça login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

