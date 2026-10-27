// Fetch wrapper used by every app. Each app keeps its own login token
// (customer, admin and rider can be signed in on the same phone).
export class ApiError extends Error {
  constructor(code, message, status, params = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.params = params;
  }
}

export function createApi(tokenKey) {
  let token = null;
  try { token = localStorage.getItem(tokenKey); } catch { /* private mode */ }
  const listeners = new Set();

  const setToken = (t) => {
    token = t || null;
    try { if (token) localStorage.setItem(tokenKey, token); else localStorage.removeItem(tokenKey); } catch { /* ignore */ }
    listeners.forEach((fn) => fn(token));
  };

  async function request(method, path, body) {
    let res;
    try {
      res = await fetch(`/api${path}`, {
        method,
        headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError('NETWORK', 'Cannot reach the server.', 0);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && token) setToken(null);
      throw new ApiError(data.code || 'SERVER', data.error || 'Something went wrong.', res.status, data.params);
    }
    return data;
  }

  return {
    get token() { return token; },
    setToken,
    onToken: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    get: (p) => request('GET', p),
    post: (p, b = {}) => request('POST', p, b),
    put: (p, b = {}) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
  };
}
