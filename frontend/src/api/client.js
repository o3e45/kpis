const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }
  headers.Accept = headers.Accept ?? 'application/json';

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message ?? `Request to ${path} failed with status ${response.status}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function safeReadError(response) {
  try {
    const payload = await response.json();
    if (payload?.detail) {
      return Array.isArray(payload.detail)
        ? payload.detail.map((item) => item.msg ?? item).join(', ')
        : payload.detail;
    }
    return typeof payload === 'string' ? payload : undefined;
  } catch (error) {
    return undefined;
  }
}

export async function fetchEvents() {
  return request('/events');
}

export async function fetchPurchaseOrders() {
  return request('/purchase_orders');
}

export async function fetchSuggestions(limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) });
  return request(`/agents/suggestions?${query.toString()}`);
}

export async function approveSuggestion(suggestionId) {
  return request(`/agents/suggestions/${suggestionId}/approve`, { method: 'POST' });
}

export async function searchDocuments(query) {
  const params = new URLSearchParams({ query });
  return request(`/search/documents?${params.toString()}`);
}

export async function ingestPurchase({ llcName, file }) {
  const form = new FormData();
  form.append('llc_name', llcName);
  form.append('file', file);
  return request('/ingest/purchase', { method: 'POST', body: form });
}
