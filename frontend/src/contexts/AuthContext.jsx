import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { SecureChatProvider, useSecureChatContext } from './SecureChatContext.jsx';
import { fetchFriends, inviteFriend, respondFriendship } from '../services/api.js';

function normalizeFriendEntry(friendship, currentUserId) {
  if (!friendship || !friendship.id) {
    return null;
  }
  const requester = friendship.requester ?? null;
  const addressee = friendship.addressee ?? null;
  const requesterId = requester?.id ?? requester;
  const addresseeId = addressee?.id ?? addressee;

  const other = requesterId === currentUserId ? addressee : requester;
  const otherId = other?.id ?? other;
  if (!otherId) {
    return null;
  }

  return {
    friendshipId: friendship.id,
    id: otherId,
    username: other?.username ?? otherId,
    status: friendship.status,
    acceptedAt: friendship.acceptedAt ?? null,
  };
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
    state: { currentUserData, initialised },
    actions: { registerUser, loginUser, logoutUser },
  } = useSecureChatContext();

  const [user, setUser] = useState(null);
  const [friendships, setFriendships] = useState([]);

  const refreshFriends = useCallback(async (userId) => {
    if (!userId) {
      setFriendships([]);
      setUser((prev) => (prev ? { ...prev, friends: [] } : prev));
      return [];
    }
    try {
      const data = await fetchFriends(userId);
      const normalized = data
        .map((entry) => normalizeFriendEntry(entry, userId))
        .filter((entry) => entry && entry.status === 'accepted');
      const safe = normalized.filter(Boolean);
      setFriendships(safe);
      setUser((prev) => (prev ? { ...prev, friends: safe } : prev));
      return safe;
    } catch (error) {
      console.warn('Não foi possível carregar amigos do backend.', error);
      setFriendships([]);
      setUser((prev) => (prev ? { ...prev, friends: [] } : prev));
      return [];
    }
  }, []);

  useEffect(() => {
    if (!currentUserData) {
      setFriendships([]);
      setUser(null);
      return;
    }
    setUser({
      id: currentUserData.id,
      username: currentUserData.username,
      friends: [],
    });
    refreshFriends(currentUserData.id);
  }, [currentUserData, refreshFriends]);

  const login = useCallback(
    (username, _password) => {
      const result = loginUser(username);
      if (!result.success) {
        return result;
      }
      const effectiveUsername = result.user?.username ?? username;
      const userId = result.user?.id ?? null;
      setUser({ id: userId, username: effectiveUsername, friends: [] });
      if (userId) {
        refreshFriends(userId);
      }
      return { success: true };
    },
    [loginUser, refreshFriends],
  );

  const register = useCallback(
    async (username, _password) => {
      const outcome = await registerUser(username);
      if (!outcome.success) {
        return {
          success: false,
          message: outcome.message ?? 'Não foi possível registrar o usuário.',
        };
      }
      setUser({ id: outcome.user.id, username: outcome.user.username, friends: [] });
      await refreshFriends(outcome.user.id);
      return {
        success: true,
        message: outcome.reused ? outcome.message : 'Conta criada com sucesso.',
      };
    },
    [refreshFriends, registerUser],
  );

  const logout = useCallback(() => {
    logoutUser();
    setFriendships([]);
    setUser(null);
  }, [logoutUser]);

  const addFriend = useCallback(
    async (friendUsername) => {
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

      try {
        const response = await inviteFriend({
          requesterId: user.id,
          targetUsername: trimmed,
        });
        if (response.status === 'accepted') {
          const normalized = normalizeFriendEntry(response.friendship, user.id);
          if (normalized) {
            setFriendships((prev) => {
              if (prev.some((entry) => entry.id === normalized.id)) {
                return prev;
              }
              return [...prev, normalized];
            });
            setUser((current) => {
              if (!current) {
                return current;
              }
              const currentFriends = current.friends ?? [];
              if (currentFriends.some((entry) => entry.id === normalized.id)) {
                return current;
              }
              return { ...current, friends: [...currentFriends, normalized] };
            });
          }
        }
        if (response.status === 'pending') {
          // Keep current state but inform user
        } else if (response.status === 'accepted') {
          // already handled via normalized
        }
        return { success: true, message: response.message ?? 'Convite enviado.' };
      } catch (error) {
        return {
          success: false,
          message: error.message ?? 'Não foi possível enviar o convite.',
        };
      }
    },
    [user],
  );

  const removeFriend = useCallback(
    async (friendId) => {
      if (!user) {
        return { success: false, message: 'Usuário não autenticado.' };
      }
      const entry = friendships.find((item) => item.id === friendId || item.username === friendId);
      if (!entry) {
        return { success: false, message: 'Amigo não encontrado.' };
      }
      try {
        await respondFriendship(entry.friendshipId, 'remove', { userId: user.id });
        setFriendships((prev) => prev.filter((item) => item.friendshipId !== entry.friendshipId));
        setUser((prev) =>
          prev
            ? {
                ...prev,
                friends: (prev.friends ?? []).filter(
                  (item) => item.friendshipId !== entry.friendshipId,
                ),
              }
            : prev,
        );
        return { success: true, message: `${entry.username} removido.` };
      } catch (error) {
        return {
          success: false,
          message: error.message ?? 'Não foi possível remover o amigo.',
        };
      }
    },
    [friendships, user],
  );

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
