import React, { useState } from 'react';
import { createKeyMaterial, exportBundle } from '@chat-e2e/crypto';
import { storeKeyMaterial } from '../utils/keyMaterialStorage.js';
import { API_CONFIG } from '../config/api.js';

interface AuthScreenProps {
  onLogin: (token: string, username: string, password: string) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Browser-friendly base64 utils
  const u8ToB64 = (u8: Uint8Array) => {
    let s = '';
    u8.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s);
  };

  async function publishBundleAutomatically(token: string, password: string): Promise<boolean> {
    try {
      console.log('🔐 Iniciando publicação automática do bundle...');
      const material = createKeyMaterial(8);
      
      // Store the key material securely before publishing
      console.log('💾 Armazenando chaves privadas localmente...');
      const stored = await storeKeyMaterial(material, password);
      if (!stored) {
        console.warn('⚠️ Falha ao armazenar chaves localmente, mas continuando...');
      }
      
      const bundle = exportBundle(material);
      
      console.log('🔑 Bundle gerado:', {
        identityKey: bundle.identityKey ? 'OK' : 'ERRO',
        signedPreKey: bundle.signedPreKey ? 'OK' : 'ERRO',
        oneTimePreKeys: bundle.oneTimePreKeys.length
      });
      
      const payload = {
        bundle: {
          identityKey: u8ToB64(bundle.identityKey),
          signingPublicKey: bundle.signingPublicKey ? u8ToB64(bundle.signingPublicKey) : undefined,
          signedPreKey: u8ToB64(bundle.signedPreKey),
          signedPreKeySignature: u8ToB64(bundle.signedPreKeySignature),
          oneTimePreKeys: bundle.oneTimePreKeys.map((p: { id: string; key: Uint8Array }) => ({ 
            id: p.id, 
            key: u8ToB64(p.key) 
          }))
        }
      };
      
      console.log('📤 Enviando bundle para:', API_CONFIG.ENDPOINTS.KEYS_PUBLISH);
      const res = await fetch(API_CONFIG.ENDPOINTS.KEYS_PUBLISH, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      console.log('📥 Resposta do servidor:', {
        status: res.status,
        statusText: res.statusText,
        ok: res.ok
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Erro na publicação do bundle:', errorText);
        return false;
      }
      
      console.log('✅ Bundle publicado com sucesso!');
      console.log('🔐 Chaves privadas armazenadas localmente com segurança');
      return true;
    } catch (error) {
      console.error('💥 Erro ao publicar bundle automaticamente:', error);
      return false;
    }
  }

  async function handleRegister() {
    if (!username || !password) {
      setMessage('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    setMessage('Criando conta...');

    try {
      console.log('🔄 Iniciando processo de registro para:', username);
      console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);
      console.log('📡 Endpoint de registro:', API_CONFIG.ENDPOINTS.REGISTER);

      // 1. Registrar usuário
      const registerRes = await fetch(API_CONFIG.ENDPOINTS.REGISTER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log('📥 Resposta do registro:', {
        status: registerRes.status,
        statusText: registerRes.statusText,
        ok: registerRes.ok
      });

      if (!registerRes.ok) {
        const data = await registerRes.json();
        console.error('❌ Erro no registro:', data);
        setMessage(data.error || 'Erro no registro');
        return;
      }

      console.log('✅ Registro concluído com sucesso');
      setMessage('Conta criada! Fazendo login automático...');

      // 2. Fazer login automático para obter token
      console.log('🔑 Iniciando login automático...');
      const loginRes = await fetch(API_CONFIG.ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const loginData = await loginRes.json();
      console.log('📥 Resposta do login:', {
        status: loginRes.status,
        ok: loginRes.ok,
        hasToken: !!loginData.token
      });

      if (!loginRes.ok || !loginData.token) {
        console.error('❌ Erro no login automático:', loginData);
        setMessage('Conta criada, mas erro no login automático. Faça login manualmente.');
        setIsLogin(true);
        setPassword('');
        return;
      }

      console.log('✅ Login automático concluído');
      setMessage('Login realizado! Configurando chaves criptográficas...');

      // 3. Publicar bundle de chaves automaticamente
      console.log('🔐 Iniciando publicação automática do bundle...');
      const bundlePublished = await publishBundleAutomatically(loginData.token, password);
      
      if (bundlePublished) {
        console.log('🎉 Processo completo de registro finalizado com sucesso!');
        setMessage('✅ Conta criada e configurada com sucesso! Redirecionando...');
        // Aguardar um pouco para mostrar a mensagem
        setTimeout(() => {
          onLogin(loginData.token, username, password);
        }, 1500);
      } else {
        console.warn('⚠️ Bundle não foi publicado durante o registro');
        setMessage('⚠️ Conta criada, mas houve erro na configuração das chaves. Verifique o console do navegador para mais detalhes.');
        console.warn('⚠️ Bundle não foi publicado durante o registro. O usuário precisará publicar manualmente ou tentar novamente.');
        // Mesmo com erro no bundle, fazer login para permitir tentativa manual
        setTimeout(() => {
          onLogin(loginData.token, username, password);
        }, 3000);
      }

    } catch (error) {
      console.error('💥 Erro durante processo de registro:', error);
      setMessage('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!username || !password) {
      setMessage('Por favor, preencha todos os campos');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      console.log('🔄 Iniciando processo de login para:', username);
      console.log('🌐 API Base URL:', API_CONFIG.BASE_URL);
      console.log('📡 Endpoint de login:', API_CONFIG.ENDPOINTS.LOGIN);

      const res = await fetch(API_CONFIG.ENDPOINTS.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      console.log('📥 Resposta do login:', {
        status: res.status,
        ok: res.ok,
        hasToken: !!data.token
      });

      if (res.ok && data.token) {
        console.log('✅ Login realizado com sucesso');
        setMessage('Login realizado com sucesso!');
        onLogin(data.token, username, password);
      } else {
        console.error('❌ Erro no login:', data);
        setMessage(data.error || 'Erro no login');
      }
    } catch (error) {
      console.error('💥 Erro durante login:', error);
      setMessage('Erro de conexão com o servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#f5f5f5'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ textAlign: 'center', marginBottom: '2rem', color: '#333' }}>
          Chat E2E
        </h1>

        <div style={{ marginBottom: '1rem' }}>
          <button
            style={{
              padding: '0.5rem 1rem',
              margin: '0 0.5rem',
              border: isLogin ? '2px solid #007bff' : '1px solid #ccc',
              backgroundColor: isLogin ? '#007bff' : 'white',
              color: isLogin ? 'white' : '#333',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              setIsLogin(true);
              setMessage('');
            }}
          >
            Login
          </button>
          <button
            style={{
              padding: '0.5rem 1rem',
              margin: '0 0.5rem',
              border: !isLogin ? '2px solid #007bff' : '1px solid #ccc',
              backgroundColor: !isLogin ? '#007bff' : 'white',
              color: !isLogin ? 'white' : '#333',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            onClick={() => {
              setIsLogin(false);
              setMessage('');
            }}
          >
            Registrar
          </button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Nome de usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                isLogin ? handleLogin() : handleRegister();
              }
            }}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '1rem'
            }}
            disabled={loading}
          />
        </div>

        <button
          onClick={isLogin ? handleLogin : handleRegister}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Carregando...' : (isLogin ? 'Entrar' : 'Criar Conta')}
        </button>

        {message && (
          <div style={{
            marginTop: '1rem',
            padding: '0.5rem',
            borderRadius: '4px',
            backgroundColor: message.includes('sucesso') ? '#d4edda' : '#f8d7da',
            color: message.includes('sucesso') ? '#155724' : '#721c24',
            border: message.includes('sucesso') ? '1px solid #c3e6cb' : '1px solid #f5c6cb'
          }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}