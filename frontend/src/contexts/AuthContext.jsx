import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const USERS_KEY = 'secure-chat:users';
const CURRENT_USER_KEY = 'secure-chat:current-user';

function readStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`Failed to read localStorage key "${key}":`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write localStorage key "${key}":`, error);
  }
}

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    const storedUser = readStorage(CURRENT_USER_KEY, null);
    if (storedUser) {
      setUser(storedUser);
    }
    setInitialised(true);
  }, []);

  const register = (username, password) => {
    if (!username || !password) {
      return { success: false, message: 'Informe usuário e senha.' };
    }

    const users = readStorage(USERS_KEY, []);
    const existing = users.find((item) => item.username.toLowerCase() === username.toLowerCase());

    if (existing) {
      return { success: false, message: 'Este usuário já existe.' };
    }

    const newUser = {
      id: crypto.randomUUID(),
      username,
      password,
      friends: [],
      createdAt: new Date().toISOString(),
    };

    const updatedUsers = [...users, newUser];
    writeStorage(USERS_KEY, updatedUsers);
    return { success: true, message: 'Usuário cadastrado com sucesso.' };
  };

  const login = (username, password) => {
    if (!username || !password) {
      return { success: false, message: 'Informe usuário e senha.' };
    }

    const users = readStorage(USERS_KEY, []);
    const found = users.find((item) => item.username === username && item.password === password);

    if (!found) {
      return { success: false, message: 'Usuário ou senha inválidos.' };
    }

    const userView = { id: found.id, username: found.username, friends: found.friends ?? [] };
    setUser(userView);
    writeStorage(CURRENT_USER_KEY, userView);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CURRENT_USER_KEY);
    }
  };

  const syncUser = (updatedUser) => {
    setUser(updatedUser);
    writeStorage(CURRENT_USER_KEY, updatedUser);
    const users = readStorage(USERS_KEY, []);
    const index = users.findIndex((item) => item.id === updatedUser.id);
    if (index >= 0) {
      users[index] = { ...users[index], friends: updatedUser.friends };
      writeStorage(USERS_KEY, users);
    }
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

    if (user.friends.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      return { success: false, message: 'Este usuário já está na sua lista.' };
    }

    const users = readStorage(USERS_KEY, []);
    const friendUser = users.find((item) => item.username.toLowerCase() === trimmed.toLowerCase());
    if (!friendUser) {
      return { success: false, message: 'Usuário não encontrado.' };
    }

    const updatedUser = { ...user, friends: [...user.friends, friendUser.username] };
    syncUser(updatedUser);
    return { success: true, message: `${friendUser.username} adicionado com sucesso.` };
  };

  const removeFriend = (friendUsername) => {
    if (!user) {
      return;
    }
    const updated = user.friends.filter((name) => name !== friendUsername);
    syncUser({ ...user, friends: updated });
  };

  const value = useMemo(
    () => ({ user, login, register, logout, addFriend, removeFriend, ready: initialised }),
    [user, initialised],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }
  return context;
}

