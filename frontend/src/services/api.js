const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
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

