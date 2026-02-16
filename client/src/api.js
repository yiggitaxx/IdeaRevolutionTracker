const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('iet_token') || '';
}

function setToken(token) {
  if (token) localStorage.setItem('iet_token', token);
  else localStorage.removeItem('iet_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = response.status;
    throw err;
  }

  return data;
}

export const api = {
  getToken,
  setToken,

  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  logout() {
    return request('/api/auth/logout', { method: 'POST' });
  },

  me() {
    return request('/api/auth/me');
  },

  upgrade() {
    return request('/api/auth/upgrade', { method: 'POST' });
  },

  createIdea(payload) {
    return request('/api/ideas', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getIdeas() {
    return request('/api/ideas');
  },

  getIdea(id) {
    return request(`/api/ideas/${id}`);
  },

  createRevision(ideaId, payload) {
    return request(`/api/ideas/${ideaId}/revisions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getRevisions(ideaId) {
    return request(`/api/ideas/${ideaId}/revisions`);
  },

  getInsights(ideaId) {
    return request(`/api/ideas/${ideaId}/insights`);
  },

  exportIdea(ideaId) {
    return request(`/api/ideas/${ideaId}/export`);
  },

  seedDemo() {
    return request('/api/demo-seed', {
      method: 'POST',
    });
  },
};
