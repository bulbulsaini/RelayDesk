const API_BASE = import.meta.env.VITE_API_URL || '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Array<{ field: string; message: string }>
  ) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('relaydesk_token');
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || 'Request failed';
    const details = payload?.error?.details;
    throw new ApiError(response.status, message, details);
  }

  return payload as T;
}
