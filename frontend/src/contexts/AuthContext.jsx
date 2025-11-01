import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { SecureChatProvider, useSecureChatContext } from './SecureChatContext.jsx';

const FRIENDS_KEY_PREFIX = 'secure-chat:friends:';

function readFriends(username) {
  if (typeof window === 'undefined' || !username) {
    return [];
  }
  try {
    const stored = window.localStorage.getItem(`${FRIENDS_KEY_PREFIX}${username}`);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Não foi possível ler amigos do storage.', error);
    return [];
  }
}

function writeFriends(username, friends) {
  if (typeof window === 'undefined' || !username) {
    return;
  }
  try {
    window.localStorage.setItem(`${FRIENDS_KEY_PREFIX}${username}`, JSON.stringify(friends));
  } catch (error) {
    console.warn('Não foi possível salvar amigos no storage.', error);
  }
}

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  return (
    <SecureChatProvider>
      <AuthBridge>{children}</AuthBridge>
    </SecureChatProvider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

function AuthBridge({ children }) {
  const {
    state: { currentUserData, initialised, users },
    actions: { registerUser, loginUser, logoutUser },
  } = useSecureChatContext();

  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!currentUserData) {
      setUser(null);
      return;
    }
    const friends = readFriends(currentUserData.username);
    setUser({
      id: currentUserData.id,
      username: currentUserData.username,
      friends,
    });
  }, [currentUserData]);

  const login = (username, _password) => {
    const result = loginUser(username);
    if (!result.success) {
      return result;
    }
    const effectiveUsername = result.user?.username ?? username;
    const friends = readFriends(effectiveUsername);
    setUser((prev) => ({
      id: result.user?.id ?? prev?.id ?? null,
      username: effectiveUsername,
      friends,
    }));
    return { success: true };
  };

  const register = async (username, _password) => {
    const outcome = await registerUser(username);
    if (!outcome.success) {
      return { success: false, message: outcome.message ?? 'Não foi possível registrar o usuário.' };
    }
    const friends = readFriends(outcome.user.username);
    setUser({ id: outcome.user.id, username: outcome.user.username, friends });
    return {
      success: true,
      message: outcome.reused ? outcome.message : 'Conta criada com sucesso.',
    };
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const addFriend = (friendUsername) => {
    if (!user) {
      return { success: false, message: 'Usuário não autenticado.' };
    }
    const trimmed = friendUsername.trim();
    if (!trimmed) {
      return { success: false, message: 'Informe o nome do amigo.' };
    }
    if (trimmed.toLowerCase() === user.username.toLowerCase()) {
      return { success: false, message: 'Você não pode adicionar a si mesmo.' };
    }
    if (user.friends.some((name) => name.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: 'Este usuário já está na sua lista.' };
    }
    const friend = users.find((candidate) => candidate.username?.toLowerCase() === trimmed.toLowerCase());
    if (!friend) {
      return { success: false, message: 'Usuário não encontrado no backend.' };
    }
    const updated = [...user.friends, friend.username];
    writeFriends(user.username, updated);
    setUser((prev) => (prev ? { ...prev, friends: updated } : prev));
    return { success: true, message: `${friend.username} adicionado com sucesso.` };
  };

  const removeFriend = (friendUsername) => {
    if (!user) {
      return;
    }
    const updated = user.friends.filter((name) => name !== friendUsername);
    writeFriends(user.username, updated);
    setUser((prev) => (prev ? { ...prev, friends: updated } : prev));
  };

  const value = useMemo(
    () => ({
      user,
      ready: initialised,
      login,
      register,
      logout,
      addFriend,
      removeFriend,
    }),
    [user, initialised, login, register, logout, addFriend, removeFriend],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthBridge.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}
