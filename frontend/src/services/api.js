const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');
    let payload = null;

    if (response.status !== 204) {
      if (isJson) {
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }
      } else {
        payload = await response.text();
      }
    }

    if (!response.ok) {
      let message = '';
      if (isJson && payload && typeof payload === 'object') {
        const bodyMessage = Array.isArray(payload.message)
          ? payload.message.join(' ')
          : payload.message;
        message = bodyMessage ?? payload.error ?? '';
        if (!message) {
          try {
            message = JSON.stringify(payload);
          } catch (error) {
            message = '';
          }
        }
      } else if (typeof payload === 'string') {
        message = payload.trim();
      }
      if (!message) {
        message = `Requisição falhou com status ${response.status}`;
      }
      throw new Error(message);
    }

    if (response.status === 204) {
      return null;
    }

    if (isJson) {
      return payload;
    }

    return payload ?? null;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo esgotado ao comunicar com o servidor.');
    }
    throw new Error(error?.message || 'Não foi possível completar a requisição.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchGroups(userId) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return request(`/groups${query}`);
}

export async function fetchFriends(userId, status = 'accepted') {
  const query = new URLSearchParams();
  if (userId) {
    query.set('userId', userId);
  }
  if (status) {
    query.set('status', status);
  }
  const suffix = query.toString();
  return request(`/friends${suffix ? `?${suffix}` : ''}`);
}

export async function inviteFriend(payload) {
  return request('/friends/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function respondFriendship(id, action, payload) {
  return request(`/friends/${id}/${action}`, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  });
}

export async function createGroup(payload) {
  return request('/groups', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchMessages(groupId) {
  return request(`/groups/${groupId}/messages`);
}

export async function sendMessage(groupId, body) {
  return request(`/groups/${groupId}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const apiInfo = {
  baseUrl: API_URL,
};

