const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();

const API_BASE_URL =
  configuredBase && configuredBase.length ? configuredBase : resolveDefaultBase();

function resolveDefaultBase() {
  if (typeof window !== "undefined") {
    // When the dashboard is deployed to Vercel as a static bundle the API is usually
    // served from a different origin, so teams provide VITE_API_BASE_URL. Falling back
    // to the current origin ensures local previews (npm run preview) still work while
    // development keeps pointing at the FastAPI server on port 8000.
    return window.location.hostname === "localhost"
      ? "http://localhost:8000"
      : window.location.origin;
  }

  return "http://localhost:8000";
}

async function request(path, options = {}) {
  const url = buildUrl(path);
  const headers = options.headers ? { ...options.headers } : {};
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
  }
  headers.Accept = headers.Accept ?? "application/json";

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(
      message ?? `Request to ${path} failed with status ${response.status}`
    );
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
        ? payload.detail.map((item) => item.msg ?? item).join(", ")
        : payload.detail;
    }
    return typeof payload === "string" ? payload : undefined;
  } catch {
    return undefined;
  }
}

function buildUrl(path) {
  if (!API_BASE_URL) {
    return path;
  }

  try {
    return new URL(path, API_BASE_URL).toString();
  } catch {
    const normalizedBase = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    return `${normalizedBase}${path.startsWith("/") ? "" : "/"}${path}`;
  }
}

export async function fetchEvents() {
  return request("/events");
}

export async function fetchPurchaseOrders() {
  return request("/purchase_orders");
}

export async function fetchSuggestions(limit = 50) {
  const query = new URLSearchParams({ limit: String(limit) });
  return request(`/agents/suggestions?${query.toString()}`);
}

export async function approveSuggestion(suggestionId) {
  return request(`/agents/suggestions/${suggestionId}/approve`, {
    method: "POST",
  });
}

export async function searchDocuments(query) {
  const params = new URLSearchParams({ query });
  return request(`/search/documents?${params.toString()}`);
}

export async function ingestPurchase({ llcName, file }) {
  const form = new FormData();
  form.append("llc_name", llcName);
  form.append("file", file);
  return request("/ingest/purchase", { method: "POST", body: form });
}
