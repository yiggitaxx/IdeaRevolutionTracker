const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
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
  seedDemo() {
    return request('/api/demo-seed', {
      method: 'POST',
    });
  },
};
